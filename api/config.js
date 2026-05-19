const { keyStatus, loadEnv } = require("../backend/config");
const { sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return;
  }

  sendJson(response, 200, {
    remoteAvailable: true,
    keys: keyStatus()
  });
};
