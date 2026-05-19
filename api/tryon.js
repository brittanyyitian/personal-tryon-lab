const { loadEnv } = require("../backend/config");
const { runProvider } = require("../backend/providers");
const { readJsonBody, sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await runProvider(payload.providerId, payload);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Server error",
      details: error.details
    });
  }
};
