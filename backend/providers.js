const PROVIDERS = {
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
  const apiKey = assertApiKey(provider);
  assertImageData(payload.personImage, "personImage");
  assertImageData(payload.garmentImage, "garmentImage");

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
    return data;
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

  const direct = data.output || data.result || data.image || data.image_url || data.url;
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  PROVIDERS,
  runProvider
};
