const { keyStatus, loadEnv } = require("../backend/config");
const { isBackgroundRemovalConfigured, removeBgModel } = require("../backend/background-removal");
const { sendJson, sendMethodNotAllowed } = require("./_utils");

loadEnv();

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const classifierModels = process.env.HF_ITEM_CLASSIFIER_MODELS || process.env.HF_ITEM_CLASSIFIER_MODEL || "patrickjohncyh/fashion-clip,Marqo/marqo-fashionCLIP,openai/clip-vit-large-patch14";

  sendJson(response, 200, {
    remoteAvailable: true,
    keys: keyStatus(),
    itemClassifier: {
      remoteEnabled: Boolean(process.env.HF_TOKEN || process.env.HF_CLASSIFIER_REMOTE === "true"),
      hasHfToken: Boolean(process.env.HF_TOKEN),
      models: classifierModels.split(",").map((model) => model.trim()).filter(Boolean)
    },
    backgroundRemoval: {
      remoteEnabled: isBackgroundRemovalConfigured(),
      hasHfToken: Boolean(process.env.HF_TOKEN),
      model: removeBgModel()
    },
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
