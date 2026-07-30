/* 新媒体运营工作台 — 零依赖本地静态服务器
 * 用法： node serve.js [端口]
 * 默认端口 5173。手机同 WiFi 访问 http://<你的Mac内网IP>:端口
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.argv[2] || 5173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon"
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(root, p);
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`\n  新媒体运营工作台已启动`);
  console.log(`  本机访问:  http://localhost:${port}`);
  console.log(`  手机访问:  http://<你的Mac内网IP>:${port}  (需同一 WiFi)`);
  console.log(`  手机浏览器打开后 → 菜单 → "添加到主屏幕" 即可像 App 安装\n`);
});
