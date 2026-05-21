const DEFAULT_REMOVE_BG_MODEL = "briaai/RMBG-1.4";

function removeBgModel() {
  return (process.env.HF_REMOVE_BG_MODEL || DEFAULT_REMOVE_BG_MODEL).trim();
}

function isBackgroundRemovalConfigured() {
  return Boolean(process.env.HF_TOKEN);
}

async function removeImageBackground(image) {
  const parsed = parseImageDataUrl(image);
  if (!isBackgroundRemovalConfigured()) {
    const error = new Error("Background removal needs HF_TOKEN.");
    error.statusCode = 400;
    throw error;
  }

  const model = removeBgModel();
  const response = await fetchWithTimeout(`${removeBgBaseUrl()}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": parsed.mime,
      "x-wait-for-model": "true"
    },
    body: parsed.buffer
  }, Number(process.env.HF_REMOVE_BG_TIMEOUT_MS || 25000));

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const error = new Error(`Background removal returned ${response.status}.`);
    error.statusCode = response.status;
    error.details = summarizeRemoteData(await response.text().catch(() => ""));
    throw error;
  }

  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    const imageUrl = extractImageDataUrl(data);
    if (imageUrl) {
      return {
        imageUrl,
        model,
        source: "huggingface"
      };
    }

    const error = new Error("Background removal did not return an image.");
    error.details = summarizeRemoteData(data);
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mime = contentType.includes("image/") ? contentType.split(";")[0] : "image/png";
  return {
    imageUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    model,
    source: "huggingface"
  };
}

function parseImageDataUrl(value) {
  const match = typeof value === "string" ? value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/) : null;
  if (!match) {
    const error = new Error("image must be a data URL image.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 18 * 1024 * 1024) {
    const error = new Error("image is too large for background removal.");
    error.statusCode = 413;
    throw error;
  }

  return {
    mime: match[1],
    buffer
  };
}

function extractImageDataUrl(data) {
  if (!data) {
    return "";
  }
  if (typeof data === "string") {
    return data.startsWith("data:image/") ? data : "";
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractImageDataUrl(item);
      if (found) {
        return found;
      }
    }
  }
  if (typeof data === "object") {
    for (const key of ["image", "image_url", "output", "generated_image"]) {
      const found = extractImageDataUrl(data[key]);
      if (found) {
        return found;
      }
    }
  }
  return "";
}

function removeBgBaseUrl() {
  return (process.env.HF_REMOVE_BG_BASE_URL || "https://api-inference.huggingface.co/models").replace(/\/+$/, "");
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

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

module.exports = {
  DEFAULT_REMOVE_BG_MODEL,
  isBackgroundRemovalConfigured,
  removeBgModel,
  removeImageBackground
};
