const { loadEnv } = require("../backend/config");
const { removeImageBackground } = require("../backend/background-removal");
const { handleOptions, readJsonBody, sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = async function handler(request, response) {
  if (handleOptions(request, response)) {
    return;
  }
  if (request.method !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await removeImageBackground(payload.image);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Could not remove background.",
      details: error.details || null
    });
  }
};
