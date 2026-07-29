function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body ? JSON.parse(request.body) : {};
  }

  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        reject(Object.assign(new Error("Request body is too large. Use smaller test images."), { statusCode: 413 }));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });

    request.on("error", reject);
  });
}

function sendMethodNotAllowed(response, methods) {
  setCorsHeaders(response);
  response.setHeader("Allow", methods.join(", "));
  sendJson(response, 405, { error: "Method not allowed." });
}

function handleOptions(request, response) {
  if (request.method !== "OPTIONS") {
    return false;
  }
  setCorsHeaders(response);
  response.statusCode = 204;
  response.end();
  return true;
}

module.exports = {
  handleOptions,
  readJsonBody,
  sendJson,
  sendMethodNotAllowed
};
