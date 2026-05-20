const ITEM_TYPES = ["top", "pants", "skirt", "dress", "shoes", "bag", "hat"];

const LABELS = {
  top: "Top",
  pants: "Pants",
  skirt: "Skirt",
  dress: "Dress",
  shoes: "Shoes",
  bag: "Bag",
  hat: "Hat"
};

async function classifyItemImage(payload) {
  const image = payload.image || "";
  assertImageData(image);

  const remote = await classifyWithHuggingFace(image).catch(() => null);
  if (remote?.type) {
    return remote;
  }

  return classifyWithLocalHints({
    fileName: payload.fileName || "",
    image
  });
}

async function classifyWithHuggingFace(image) {
  if (!process.env.HF_TOKEN && process.env.HF_CLASSIFIER_REMOTE !== "true") {
    return null;
  }

  const model = process.env.HF_ITEM_CLASSIFIER_MODEL || "openai/clip-vit-large-patch14";
  const labels = [
    "shirt, blouse, jacket, sweater, coat, or top",
    "pants, trousers, jeans, or shorts",
    "skirt",
    "dress",
    "shoes, sneakers, boots, or sandals",
    "bag, purse, handbag, or backpack",
    "hat or cap"
  ];
  const response = await fetchWithTimeout(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: image,
      parameters: {
        candidate_labels: labels
      }
    })
  }, 8000);
  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  const winner = Array.isArray(data) ? data[0] : data?.labels?.[0] ? { label: data.labels[0], score: data.scores?.[0] } : null;
  const index = labels.findIndex((label) => label === winner?.label);
  const type = ITEM_TYPES[index];
  if (!type) {
    return null;
  }

  return {
    type,
    label: LABELS[type],
    confidence: Number(winner.score || 0),
    source: "hf-zero-shot"
  };
}

function classifyWithLocalHints({ fileName, image }) {
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

  const dimensions = readImageDimensions(image);
  if (dimensions) {
    const ratio = dimensions.height / Math.max(dimensions.width, 1);
    if (ratio > 1.85) {
      return {
        type: "pants",
        label: LABELS.pants,
        confidence: 0.48,
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
    type: "top",
    label: LABELS.top,
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
