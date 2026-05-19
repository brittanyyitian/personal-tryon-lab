const { runProvider } = require("./providers");
const {
  completeTryonJob,
  createTryonJob,
  failTryonJob,
  isSupabaseConfigured,
  uploadResultImage
} = require("./supabase");

async function runTryonJob(payload) {
  const job = await createTryonJob(payload);

  try {
    const result = await runProvider(payload.providerId, payload);
    const resultStoragePath = await uploadResultImage(job?.id, result.imageUrl);
    const finalResult = {
      ...result,
      jobId: job?.id || null,
      resultStoragePath,
      storage: resultStoragePath ? "supabase" : "inline"
    };
    await completeTryonJob(job?.id, finalResult);
    return {
      ...finalResult,
      supabaseEnabled: isSupabaseConfigured()
    };
  } catch (error) {
    await failTryonJob(job?.id, error);
    error.jobId = job?.id || null;
    throw error;
  }
}

module.exports = {
  runTryonJob
};
