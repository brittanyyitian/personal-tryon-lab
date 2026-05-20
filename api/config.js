const { keyStatus, loadEnv } = require("../backend/config");
const { sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  sendJson(response, 200, {
    remoteAvailable: true,
    keys: keyStatus(),
    supabase: {
      enabled: Boolean(supabaseUrl && serviceRoleKey),
      hasUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      urlLooksValid: /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl),
      jobTable: process.env.SUPABASE_JOB_TABLE || "tryon_jobs",
      resultBucket: process.env.SUPABASE_RESULT_BUCKET || "tryon-results"
    }
  });
};
