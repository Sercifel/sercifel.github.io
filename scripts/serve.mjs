import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve("public");
const startPort = Number(process.env.PORT) || 8080;
const maxPort = startPort + 20;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const safeResolve = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, "");
  const resolved = path.resolve(rootDir, normalized);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }
  return resolved;
};

const serveFile = async (filePath, res) => {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] ?? "application/octet-stream";
  const data = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": type });
  res.end(data);
};

const server = http.createServer(async (req, res) => {
  try {
    const resolved = safeResolve(req.url ?? "/");
    if (!resolved) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    let target = resolved;
    let stat = await fs.stat(target).catch(() => null);

    if (stat && stat.isDirectory()) {
      target = path.join(target, "index.html");
      stat = await fs.stat(target).catch(() => null);
    }

    if (!stat) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    await serveFile(target, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

const startServer = (port) => {
  server.listen(port);
};

server.on("listening", () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : startPort;
  console.log(`Serving ${rootDir} at http://localhost:${activePort}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const address = server.address();
    const currentPort =
      typeof address === "object" && address ? address.port : startPort;
    const nextPort = currentPort + 1;
    if (nextPort > maxPort) {
      console.error(
        `Port ${currentPort} is in use. No free port found up to ${maxPort}.`
      );
      process.exit(1);
    }
    console.warn(`Port ${currentPort} is in use, trying ${nextPort}...`);
    setTimeout(() => startServer(nextPort), 100);
    return;
  }
  console.error("Server error:", error);
  process.exit(1);
});

startServer(startPort);
