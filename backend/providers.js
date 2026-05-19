const PROVIDERS = {
  opensource: {
    label: "OPEN SOURCE VTON",
    requiredKey: null
  },
  fashn: {
    label: "FASHN",
    requiredKey: "FASHN_API_KEY"
  },
  replicate: {
    label: "IDM-VTON",
    requiredKey: "REPLICATE_API_TOKEN"
  },
  openai: {
    label: "OPENAI BEAUTY",
    requiredKey: "OPENAI_API_KEY"
  }
};

function assertProvider(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    const error = new Error(`Unsupported provider: ${providerId}`);
    error.statusCode = 400;
    throw error;
  }
  return provider;
}

function assertRemoteConsent({ remoteEnabled, consentAccepted }) {
  if (!remoteEnabled || !consentAccepted) {
    const error = new Error("Remote test mode and upload consent are required.");
    error.statusCode = 403;
    throw error;
  }
}

function assertApiKey(provider) {
  if (!provider.requiredKey) {
    return "";
  }

  const key = process.env[provider.requiredKey];
  if (!key) {
    const error = new Error(`${provider.requiredKey} is missing in .env`);
    error.statusCode = 412;
    throw error;
  }
  return key;
}

function assertImageData(value, label) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    const error = new Error(`${label} must be a data URL image.`);
    error.statusCode = 400;
    throw error;
  }

  if (Buffer.byteLength(value, "utf8") > 22 * 1024 * 1024) {
    const error = new Error(`${label} is too large.`);
    error.statusCode = 413;
    throw error;
  }
}

async function runProvider(providerId, payload) {
  const provider = assertProvider(providerId);
  assertRemoteConsent(payload);
  assertImageData(payload.personImage, "personImage");
  assertImageData(payload.garmentImage, "garmentImage");

  if (providerId === "opensource") {
    return runOpenSourceVton(payload);
  }

  const apiKey = assertApiKey(provider);

  if (providerId === "fashn") {
    return runFashn(apiKey, payload);
  }

  if (providerId === "replicate") {
    return runReplicate(apiKey, payload);
  }

  if (providerId === "openai") {
    return runOpenAI(apiKey, payload);
  }

  throw new Error("Provider not implemented.");
}

async function runFashn(apiKey, payload) {
  const response = await fetch("https://api.fashn.ai/v1/run", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model_name: "tryon-max",
      inputs: {
        product_image: payload.garmentImage,
        model_image: payload.personImage,
        prompt: fashnPrompt(payload.mode),
        resolution: "1k",
        generation_mode: "balanced",
        num_images: 1,
        output_format: "png",
        return_base64: true
      }
    })
  });

  const data = await readJsonResponse(response);
  const predictionId = data.id || data.prediction_id;
  if (!predictionId && extractImageUrl(data)) {
    return providerResult("fashn", extractImageUrl(data), data);
  }

  if (!predictionId) {
    throw providerError("FASHN response did not include a prediction id.", data);
  }

  const result = await pollFashn(apiKey, predictionId);
  return providerResult("fashn", extractImageUrl(result), result);
}

async function pollFashn(apiKey, predictionId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(2000);
    const response = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const data = await readJsonResponse(response);
    const status = String(data.status || "").toLowerCase();

    if (["completed", "succeeded", "success"].includes(status) || extractImageUrl(data)) {
      return data;
    }

    if (["failed", "error", "canceled"].includes(status)) {
      throw providerError("FASHN generation failed.", data);
    }
  }

  throw new Error("FASHN generation timed out.");
}

async function runReplicate(apiKey, payload) {
  const version = process.env.REPLICATE_IDM_VTON_VERSION || "5d3f1bbc79a26f884ea7ebbfdb6947cb8bedfc80eabc925f6c15fa7ddcb359e8";
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait"
    },
    body: JSON.stringify({
      version,
      input: {
        human_img: payload.personImage,
        garm_img: payload.garmentImage,
        garment_des: "test garment"
      }
    })
  });

  const data = await readJsonResponse(response);
  return providerResult("replicate", extractImageUrl(data), data);
}

async function runOpenAI(apiKey, payload) {
  const prompt = [
    "Create a restrained fashion try-on concept image for a private non-commercial test.",
    "Keep the person's identity, body proportions, and the garment recognizable.",
    "Use a minimal black, white, and grey editorial studio look.",
    `Mode: ${payload.mode || "real"}.`
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESPONSES_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: payload.personImage },
            { type: "input_image", image_url: payload.garmentImage }
          ]
        }
      ],
      tools: [
        {
          type: "image_generation",
          size: "1024x1536",
          quality: "medium"
        }
      ]
    })
  });

  const data = await readJsonResponse(response);
  return providerResult("openai", extractImageUrl(data), data);
}

async function runOpenSourceVton(payload) {
  const { Client, handle_file } = await import("@gradio/client");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");

  const space = process.env.HF_VTON_SPACE || "fashn-ai/fashn-vton-1.5";
  const apiName = process.env.HF_VTON_API_NAME || "/try_on";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tryon-hf-"));
  const personPath = path.join(tempDir, "person.png");
  const garmentPath = path.join(tempDir, "garment.png");

  try {
    writeDataUrl(payload.personImage, personPath);
    writeDataUrl(payload.garmentImage, garmentPath);

    const client = await Client.connect(space, {
      hf_token: process.env.HF_TOKEN || undefined
    });

    const result = await client.predict(apiName, openSourcePayload(apiName, {
      personPath,
      garmentPath,
      handle_file,
      mode: payload.mode
    }));

    const statusMessage = extractStatusMessage(result);
    if (statusMessage) {
      throw providerError(statusMessage, summarizeShape(result));
    }

    const imageUrl = extractImageUrl(result);
    if (!imageUrl) {
      throw providerError("OPEN SOURCE VTON did not return an image URL.", summarizeShape(result));
    }
    return providerResult("opensource", await normalizeImageForBrowser(imageUrl), result);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function openSourcePayload(apiName, { personPath, garmentPath, handle_file, mode }) {
  if (apiName === "/try_on") {
    return {
      person_image: handle_file(personPath),
      garment_image: handle_file(garmentPath),
      category: "tops",
      garment_photo_type: "flat-lay",
      num_timesteps: mode === "real" ? 30 : 40,
      guidance_scale: mode === "editorial" ? 3 : 2.5,
      seed: 42,
      segmentation_free: true
    };
  }

  if (apiName === "/try_on_cloth") {
    return {
      human_image: handle_file(personPath),
      cloth_image: handle_file(garmentPath)
    };
  }

  return {
    dict: {
      background: handle_file(personPath),
      layers: [],
      composite: null
    },
    garm_img: handle_file(garmentPath),
    garment_des: openSourceGarmentPrompt(mode),
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw providerError(`Remote API request failed with ${response.status}.`, data);
  }

  return data;
}

function providerResult(providerId, imageUrl, raw) {
  if (!imageUrl) {
    throw providerError(`${PROVIDERS[providerId].label} did not return an image URL.`, raw);
  }

  return {
    providerId,
    imageUrl,
    raw
  };
}

function extractImageUrl(data) {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return looksLikeImageReference(data) ? data : "";
  }

  if (Array.isArray(data)) {
    return data.map(extractImageUrl).find(Boolean) || "";
  }

  if (data.b64_json) {
    return `data:image/png;base64,${data.b64_json}`;
  }

  if (data.type === "image_generation_call" && data.result) {
    return `data:image/png;base64,${data.result}`;
  }

  const direct = data.url || data.path || data.output || data.result || data.image || data.image_url;
  if (direct) {
    return extractImageUrl(direct);
  }

  if (data.data) {
    return extractImageUrl(data.data);
  }

  if (data.images) {
    return extractImageUrl(data.images);
  }

  if (data.output) {
    return extractImageUrl(data.output);
  }

  return "";
}

function looksLikeImageReference(value) {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    /\.(png|jpe?g|webp)(\?.*)?$/i.test(value)
  );
}

function extractStatusMessage(data) {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return looksLikeImageReference(data) ? "" : data;
  }

  if (Array.isArray(data)) {
    return data.map(extractStatusMessage).find(Boolean) || "";
  }

  if (typeof data !== "object") {
    return "";
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  if (data.data) {
    return extractStatusMessage(data.data);
  }

  return "";
}

function writeDataUrl(dataUrl, filePath) {
  const fs = require("node:fs");
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid image data.");
  }
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
}

async function normalizeImageForBrowser(imageUrl) {
  if (!imageUrl) {
    return "";
  }

  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Could not fetch generated image: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  }

  const fs = require("node:fs");
  if (fs.existsSync(imageUrl)) {
    const bytes = fs.readFileSync(imageUrl);
    const mimeType = imageUrl.toLowerCase().endsWith(".jpg") || imageUrl.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  }

  return imageUrl;
}

function openSourceGarmentPrompt(mode) {
  return {
    real: "a realistic garment",
    soft: "a clean stylish garment",
    editorial: "a minimal fashion editorial garment"
  }[mode] || "a realistic garment";
}

function fashnPrompt(mode) {
  return {
    real: "Prioritize realistic fit, garment fidelity, and original body proportions.",
    soft: "Prioritize realistic fit with subtle flattering lighting and clean styling.",
    editorial: "Create a minimal fashion editorial try-on while keeping the garment recognizable."
  }[mode] || "Prioritize realistic fit, garment fidelity, and original body proportions.";
}

function providerError(message, details) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function summarizeShape(value, depth = 0) {
  if (depth > 3) {
    return typeof value;
  }

  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => summarizeShape(item, depth + 1));
  }

  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (key.toLowerCase().includes("base64") || key.toLowerCase().includes("b64")) {
      output[key] = "[base64 omitted]";
    } else {
      output[key] = summarizeShape(item, depth + 1);
    }
  }
  return output;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  PROVIDERS,
  runProvider
};
