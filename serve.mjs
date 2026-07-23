import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end("Not found"); }
      const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      const range = req.headers.range;

      // Soporte de Range (necesario para video: reproducir y saltar)
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= stat.size) end = stat.size - 1;
        if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }); return res.end(); }
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Cache-Control": "no-cache",
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }

      res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(port, () => console.log("Servidor listo en http://localhost:" + port));
