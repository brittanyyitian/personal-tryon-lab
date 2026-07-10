const { runProvider } = require("./providers");
const {
  completeTryonJob,
  createTryonJob,
  failTryonJob,
  isSupabaseConfigured,
  uploadResultImage
} = require("./supabase");

async function runTryonJob(payload) {
  const persistenceWarnings = [];
  let job = null;

  try {
    job = await createTryonJob(payload);
  } catch (error) {
    persistenceWarnings.push(persistenceWarning("create job", error));
  }

  try {
    const result = await runProvider(payload.providerId, payload);
    let resultStoragePath = "";
    try {
      resultStoragePath = await uploadResultImage(job?.id, result.imageUrl);
    } catch (error) {
      persistenceWarnings.push(persistenceWarning("upload result", error));
    }
    const finalResult = {
      ...result,
      jobId: job?.id || null,
      resultStoragePath,
      storage: resultStoragePath ? "supabase" : "inline"
    };
    try {
      await completeTryonJob(job?.id, finalResult);
    } catch (error) {
      persistenceWarnings.push(persistenceWarning("complete job", error));
    }
    return {
      ...finalResult,
      supabaseEnabled: isSupabaseConfigured(),
      persistenceWarnings
    };
  } catch (error) {
    try {
      await failTryonJob(job?.id, error);
    } catch (persistenceError) {
      persistenceWarnings.push(persistenceWarning("fail job", persistenceError));
    }
    error.jobId = job?.id || null;
    error.persistenceWarnings = persistenceWarnings;
    throw error;
  }
}

function persistenceWarning(step, error) {
  return {
    step,
    message: error.message || "Supabase persistence failed."
  };
}

module.exports = {
  runTryonJob
};
