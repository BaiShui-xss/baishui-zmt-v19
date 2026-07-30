/* 新媒体运营工作台 — Phase 2 同步后端（支持 HTTPS 自签证书）
 * 零外部依赖：内置 http/https 服务器 + node:sqlite（Node 22 实验特性）
 * 同时托管前端静态文件与 /api 同步接口，电脑与手机共用同一份数据。
 *
 * 启动： node --experimental-sqlite server.js [端口]
 *
 * HTTPS：若同级 certs/ 目录存在 key.pem + cert.pem，则自动改用 HTTPS 监听；
 *        否则回退为普通 HTTP。证书用 `openssl` 自签（见 README「手机端常见问题」）。
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

/* ---------- SQLite（node:sqlite） ---------- */
let DatabaseSync;
try { ({ DatabaseSync } = require("node:sqlite")); }
catch (e) {
  console.error("❌ 当前 Node 版本不支持 node:sqlite，请用 Node 22.5+ 并以 --experimental-sqlite 启动");
  process.exit(1);
}
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "ops.db"));
db.exec("CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT, updatedAt INTEGER)");

function getState(){
  const row = db.prepare("SELECT value, updatedAt FROM kv WHERE key='state'").get();
  return row ? { state: JSON.parse(row.value), updatedAt: row.updatedAt } : { state: null, updatedAt: 0 };
}
function setState(state, clientUpdatedAt){
  const updatedAt = Math.max(Date.now(), clientUpdatedAt || 0);
  db.prepare("INSERT INTO kv(key, value, updatedAt) VALUES('state', ?, ?) " +
             "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt")
    .run(JSON.stringify(state), updatedAt);
  return updatedAt;
}

/* ---------- 静态文件服务 ---------- */
const root = __dirname;
const port = parseInt(process.argv[2] || "5173", 10);
const TYPES = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon",
};

function sendJson(res, code, obj){
  const b = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type":"application/json; charset=utf-8" });
  res.end(b);
}
function readBody(req){
  return new Promise((resolve, reject)=>{
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

/* ---------- 请求处理（http / https 共用同一个 handler） ---------- */
async function handler(req, res) {
  const p = decodeURIComponent(req.url.split("?")[0]);

  /* ---- API ---- */
  if (p === "/api/ping") { sendJson(res, 200, { sync:true }); return; }
  if (p === "/api/state" && req.method === "GET") { sendJson(res, 200, getState()); return; }
  if (p === "/api/state" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body || !body.state) return sendJson(res, 400, { error:"invalid body" });
      const u = setState(body.state, body.updatedAt);
      return sendJson(res, 200, { updatedAt:u });
    } catch(e){ return sendJson(res, 500, { error:String(e) }); }
  }

  /* ---- 静态 ---- */
  let fp = p === "/" ? "/index.html" : p;
  const full = path.join(root, fp);
  if (!full.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------- 局域网 IP（仅用于日志提示） ---------- */
function lanIP(){
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const ni of ifs[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) return ni.address;
    }
  }
  return "127.0.0.1";
}

/* ---------- 启动（优先 HTTPS） ---------- */
const CERT_DIR = path.join(__dirname, "certs");
const keyFile = path.join(CERT_DIR, "key.pem");
const certFile = path.join(CERT_DIR, "cert.pem");
const useHTTPS = fs.existsSync(keyFile) && fs.existsSync(certFile);

function banner(proto){
  console.log(`\n  新媒体运营工作台 · ${proto} 后端已启动`);
  console.log(`  本机:    ${proto.toLowerCase()}://localhost:${port}`);
  console.log(`  手机:    ${proto.toLowerCase()}://${lanIP()}:${port}  (同一 WiFi)`);
  console.log(`  数据:    ${path.join(DATA_DIR, "ops.db")}`);
  if (proto === "HTTPS")
    console.log(`  ⚠️ 自签证书：手机首次访问需在「设置→通用→VPN与设备管理」信任，并点「仍要访问」\n`);
  else
    console.log(`  手机浏览器打开 → 菜单 → "添加到主屏幕" 即像 App 安装\n`);
}

if (useHTTPS) {
  const options = { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  // HTTPS 在主端口（手机 PWA 用，不受 iOS HTTPS-Only 限制）
  https.createServer(options, handler).listen(port, "0.0.0.0", () => banner("HTTPS"));
  // HTTP 在 +1 端口（Mac 本地 / 内置预览用，零证书摩擦，立刻能开）
  const httpPort = port + 1;
  http.createServer(handler).listen(httpPort, "0.0.0.0", () => {
    console.log(`  (Mac 本地/预览): http://localhost:${httpPort}\n`);
  });
} else {
  http.createServer(handler).listen(port, "0.0.0.0", () => banner("HTTP"));
}
