const { loadEnv } = require("../backend/config");
const { classifyItemImage } = require("../backend/item-classifier");
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
    const result = await classifyItemImage(payload);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Could not classify item."
    });
  }
};
