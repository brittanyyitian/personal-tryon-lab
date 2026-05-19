const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { keyStatus, loadEnv } = require("./config");
const { runProvider } = require("./providers");

loadEnv();

const root = path.join(__dirname, "..", "frontend", "src");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/config" && request.method === "GET") {
      sendJson(response, 200, {
        remoteAvailable: true,
        keys: keyStatus()
      });
      return;
    }

    if (url.pathname === "/api/tryon" && request.method === "POST") {
      const payload = await readJsonBody(request);
      const result = await runProvider(payload.providerId, payload);
      sendJson(response, 200, result);
      return;
    }

    serveStatic(url, response);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Server error",
      details: error.details
    });
  }
});

function serveStatic(url, response) {
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
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

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

server.listen(port, () => {
  console.log(`Personal Try-On Lab running at http://localhost:${port}`);
});
