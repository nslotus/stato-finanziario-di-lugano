// npm run serve — serves docs/ on http://127.0.0.1:8080 to view the page locally (no dependencies).
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "..", "docs");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, url.endsWith("/") ? url + "index.html" : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(8080, "127.0.0.1", () => console.log("http://127.0.0.1:8080/"));
