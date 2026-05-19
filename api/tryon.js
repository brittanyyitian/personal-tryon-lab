const { loadEnv } = require("../backend/config");
const { runTryonJob } = require("../backend/tryon-handler");
const { readJsonBody, sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await runTryonJob(payload);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Server error",
      jobId: error.jobId || null,
      details: error.details
    });
  }
};
