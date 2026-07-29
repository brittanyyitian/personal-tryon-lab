const ITEM_TYPES = ["top", "pants", "skirt", "dress", "shoes", "bag", "hat"];

const LABELS = {
  unknown: "Check type",
  top: "Top",
  pants: "Pants",
  skirt: "Skirt",
  dress: "Dress",
  shoes: "Shoes",
  bag: "Bag",
  hat: "Hat"
};

const DEFAULT_REMOTE_MODELS = [
  "patrickjohncyh/fashion-clip",
  "Marqo/marqo-fashionCLIP",
  "openai/clip-vit-large-patch14"
];

const ZERO_SHOT_LABELS = [
  "a product photo of a top, shirt, blouse, sweater, jacket, or coat",
  "a product photo of pants, trousers, jeans, shorts, leggings, or cargo pants",
  "a product photo of a skirt",
  "a product photo of a dress",
  "a product photo of shoes, sneakers, boots, sandals, or heels",
  "a product photo of a bag, handbag, purse, tote, backpack, or clutch",
  "a product photo of a hat, cap, beanie, or bucket hat"
];

async function classifyItemImage(payload) {
  const image = payload.image || "";
  assertImageData(image);

  const local = classifyWithLocalHints({
    fileName: payload.fileName || "",
    image,
    visualHint: payload.visualHint
  });
  if (local.confidence >= 0.68 && local.type !== "top") {
    return local;
  }

  const remote = await classifyWithHuggingFace(image);
  if (remote?.type && shouldTrustRemote(remote, local)) {
    return remote;
  }

  if (remote?.error) {
    return {
      ...local,
      remoteError: remote.error,
      remoteAttempts: remote.attempts
    };
  }
  return {
    ...local,
    remoteRejected: remote?.type ? {
      type: remote.type,
      confidence: remote.confidence,
      source: remote.source,
      model: remote.model
    } : undefined
  };
}

function shouldTrustRemote(remote, local) {
  if (!local || local.source === "fallback") {
    return Number(remote.confidence || 0) >= 0.62;
  }
  if (remote.type === local.type) {
    return true;
  }
  if (remote.type === "top" && local.type !== "top" && local.confidence >= 0.55) {
    return false;
  }
  return Number(remote.confidence || 0) >= 0.72;
}

async function classifyWithHuggingFace(image) {
  if (!process.env.HF_TOKEN && process.env.HF_CLASSIFIER_REMOTE !== "true") {
    return null;
  }

  const attempts = [];
  for (const model of classifierModels()) {
    const result = await classifyWithHuggingFaceModel(model, image).catch((error) => ({
      error: error.message || "remote failed",
      details: error.details
    }));
    if (result?.type) {
      return result;
    }
    attempts.push({
      model,
      error: result?.error || "no classification",
      details: result?.details
    });
  }

  return {
    error: "remote-classifier-unavailable",
    attempts: attempts.map(summarizeAttempt)
  };
}

async function classifyWithHuggingFaceModel(model, image) {
  const response = await fetchWithTimeout(`${classifierBaseUrl()}/${model}`, {
    method: "POST",
    headers: {
      ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: image,
      parameters: {
        candidate_labels: ZERO_SHOT_LABELS
      },
      options: {
        wait_for_model: true
      }
    })
  }, Number(process.env.HF_ITEM_CLASSIFIER_TIMEOUT_MS || 12000));
  if (!response.ok) {
    const error = new Error(`HF classifier ${model} returned ${response.status}.`);
    error.details = summarizeRemoteData(await response.text());
    throw error;
  }

  const data = await response.json().catch(() => null);
  const winner = normalizeZeroShotWinner(data);
  const index = ZERO_SHOT_LABELS.findIndex((label) => label === winner?.label);
  const type = ITEM_TYPES[index];
  if (!type) {
    const error = new Error(`HF classifier ${model} returned an unsupported shape.`);
    error.details = summarizeRemoteData(data);
    throw error;
  }

  return {
    type,
    label: LABELS[type],
    confidence: Number(winner.score || 0),
    source: model.includes("fashion") ? "fashionclip" : "clip",
    model
  };
}

function classifierModels() {
  const configured = process.env.HF_ITEM_CLASSIFIER_MODELS || process.env.HF_ITEM_CLASSIFIER_MODEL || "";
  return (configured ? configured.split(",") : DEFAULT_REMOTE_MODELS)
    .map((model) => model.trim())
    .filter(Boolean);
}

function classifierBaseUrl() {
  return (process.env.HF_ITEM_CLASSIFIER_BASE_URL || "https://api-inference.huggingface.co/models").replace(/\/+$/, "");
}

function normalizeZeroShotWinner(data) {
  if (!data) {
    return null;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item && typeof item === "object")
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null;
  }
  if (Array.isArray(data.labels)) {
    return {
      label: data.labels[0],
      score: data.scores?.[0]
    };
  }
  return null;
}

function summarizeAttempt(attempt) {
  return {
    model: attempt.model,
    error: attempt.error,
    details: summarizeRemoteData(attempt.details)
  };
}

function summarizeRemoteData(data) {
  if (!data) {
    return null;
  }
  if (typeof data === "string") {
    return data.length > 280 ? `${data.slice(0, 280)}...` : data;
  }
  if (Array.isArray(data)) {
    return data.slice(0, 3).map(summarizeRemoteData);
  }
  if (typeof data === "object") {
    const output = {};
    for (const [key, value] of Object.entries(data).slice(0, 8)) {
      output[key] = summarizeRemoteData(value);
    }
    return output;
  }
  return data;
}

function classifyWithLocalHints({ fileName, image, visualHint }) {
  const text = fileName.toLowerCase();
  const keywordRules = [
    ["pants", /(pants|trouser|jeans|denim|shorts|legging|cargo)/],
    ["skirt", /(skirt)/],
    ["dress", /(dress|gown)/],
    ["shoes", /(shoe|sneaker|boot|loafer|sandal|heel|trainer)/],
    ["bag", /(bag|purse|handbag|tote|backpack|clutch)/],
    ["hat", /(hat|cap|beanie|bucket)/],
    ["top", /(shirt|tee|tshirt|top|blouse|jacket|coat|hoodie|sweater|cardigan|vest)/]
  ];

  for (const [type, pattern] of keywordRules) {
    if (pattern.test(text)) {
      return {
        type,
        label: LABELS[type],
        confidence: 0.74,
        source: "filename"
      };
    }
  }

  if (visualHint?.type && ITEM_TYPES.includes(visualHint.type)) {
    return {
      type: visualHint.type,
      label: LABELS[visualHint.type],
      confidence: Number(visualHint.confidence || 0.62),
      source: visualHint.source || "visual-shape",
      visualHint
    };
  }

  const dimensions = readImageDimensions(image);
  if (dimensions) {
    const ratio = dimensions.height / Math.max(dimensions.width, 1);
    if (ratio > 1.18) {
      return {
        type: "pants",
        label: LABELS.pants,
        confidence: 0.58,
        source: "shape"
      };
    }
    if (ratio < 0.72) {
      return {
        type: "bag",
        label: LABELS.bag,
        confidence: 0.42,
        source: "shape"
      };
    }
  }

  return {
    type: "unknown",
    label: LABELS.unknown,
    confidence: 0.3,
    source: "fallback"
  };
}

function assertImageData(value) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    const error = new Error("image must be a data URL image.");
    error.statusCode = 400;
    throw error;
  }
  if (Buffer.byteLength(value, "utf8") > 22 * 1024 * 1024) {
    const error = new Error("image is too large.");
    error.statusCode = 413;
    throw error;
  }
}

function readImageDimensions(dataUrl) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  const type = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");

  if (type.includes("png") && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if ((type.includes("jpeg") || type.includes("jpg")) && buffer.length > 4) {
    return readJpegDimensions(buffer);
  }

  if (type.includes("webp") && buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF") {
    return readWebpDimensions(buffer);
  }

  return null;
}

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer) {
  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (format === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  return null;
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

module.exports = {
  classifyItemImage,
  ITEM_TYPES,
  LABELS
};
