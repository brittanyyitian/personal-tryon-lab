const DEFAULT_JOB_TABLE = "tryon_jobs";
const DEFAULT_RESULT_BUCKET = "tryon-results";

function supabaseConfig() {
  return {
    url: stripTrailingSlash(process.env.SUPABASE_URL || ""),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    jobTable: process.env.SUPABASE_JOB_TABLE || DEFAULT_JOB_TABLE,
    resultBucket: process.env.SUPABASE_RESULT_BUCKET || DEFAULT_RESULT_BUCKET
  };
}

function isSupabaseConfigured() {
  const config = supabaseConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

async function createTryonJob(input) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const row = await supabaseRequest(`/rest/v1/${supabaseConfig().jobTable}`, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: {
      provider: input.providerId,
      status: "running",
      mode: input.mode || "fit",
      item_type: input.itemType || "",
      garment_source: input.garmentSource || "",
      person_image_name: input.personImageName || "",
      garment_image_name: input.garmentImageName || "",
      error: null
    }
  });

  return Array.isArray(row) ? row[0] : row;
}

async function completeTryonJob(jobId, result) {
  if (!jobId || !isSupabaseConfigured()) {
    return null;
  }

  return updateTryonJob(jobId, {
    status: "succeeded",
    result_image_url: result.imageUrl || "",
    result_storage_path: result.resultStoragePath || "",
    raw_provider_id: result.providerId || "",
    error: null
  });
}

async function failTryonJob(jobId, error) {
  if (!jobId || !isSupabaseConfigured()) {
    return null;
  }

  return updateTryonJob(jobId, {
    status: "failed",
    error: error.message || "Generation failed"
  });
}

async function updateTryonJob(jobId, patch) {
  const row = await supabaseRequest(`/rest/v1/${supabaseConfig().jobTable}?id=eq.${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: {
      ...patch,
      updated_at: new Date().toISOString()
    }
  });

  return Array.isArray(row) ? row[0] : row;
}

async function uploadResultImage(jobId, imageUrl) {
  if (!jobId || !isSupabaseConfigured() || !imageUrl?.startsWith("data:image/")) {
    return "";
  }

  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return "";
  }

  const [, contentType, base64] = match;
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] || "png";
  const path = `results/${jobId}.${ext}`;
  const config = supabaseConfig();

  await supabaseStorageRequest(`/storage/v1/object/${config.resultBucket}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: Buffer.from(base64, "base64")
  });

  return `${config.resultBucket}/${path}`;
}

async function supabaseRequest(path, options) {
  const config = supabaseConfig();
  const response = await fetch(`${config.url}${path}`, {
    method: options.method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return readSupabaseResponse(response);
}

async function supabaseStorageRequest(path, options) {
  const config = supabaseConfig();
  const response = await fetch(`${config.url}${path}`, {
    method: options.method,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...options.headers
    },
    body: options.body
  });

  return readSupabaseResponse(response);
}

async function readSupabaseResponse(response) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Supabase request failed with ${response.status}.`);
    error.details = data;
    throw error;
  }

  return data;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

module.exports = {
  completeTryonJob,
  createTryonJob,
  failTryonJob,
  isSupabaseConfigured,
  uploadResultImage
};
