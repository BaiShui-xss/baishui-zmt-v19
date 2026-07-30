/* =========================================================
 * 数据层 (Data Store) — 新媒体运营工作台 Phase 1
 * 本地优先：数据存浏览器 localStorage，并支持 JSON 导入/导出。
 * 后续 Phase 2 同步后端将在此层替换为远程 API（保持接口不变）。
 * ========================================================= */
const KEY = "ops-workbench-v2";

let state = load();
window._scope = "all";   // "all" | accountId
window._f = {};          // 过滤器：pri / type

/* ---------- 数据迁移：保证各集合字段存在，避免渲染崩溃 ---------- */
function migrate(s){
  if(!s || !s.accounts) return null;
  if(!Array.isArray(s.topics))    s.topics = [];
  if(!Array.isArray(s.metrics))   s.metrics = [];
  if(!Array.isArray(s.memos))     s.memos = [];
  if(!Array.isArray(s.todos))     s.todos = [];
  if(!Array.isArray(s.reminders)) s.reminders = [];
  // 提醒自定义类型（名称 + 颜色），缺省回退到 3 个标准类型
  if(!Array.isArray(s.reminderTypes)) s.reminderTypes = [
    {id:"pub",name:"内容发布",color:"#38bdf8"},
    {id:"rev",name:"数据复盘",color:"#a78bfa"},
    {id:"cus",name:"自定义",color:"#2dd4bf"},
  ];
  if(Array.isArray(s.reminders)) s.reminders.forEach(r=>{ if(!r.typeId) r.typeId = r.type || "cus"; });
  // 个人资料（左上角昵称/头像），缺省回退到默认品牌，避免渲染崩溃
  if(!s.profile || typeof s.profile !== "object") s.profile = {name:"运营工作台", avatar:""};
  if(typeof s.profile.name !== "string")   s.profile.name = "运营工作台";
  if(typeof s.profile.avatar !== "string") s.profile.avatar = "";
  // 设置项（提醒通知开关等），缺省回退
  if(!s.settings || typeof s.settings !== "object") s.settings = {notify:false};
  if(typeof s.settings.notify !== "boolean") s.settings.notify = false;
  return s;
}

/* ---------- 持久化 ---------- */
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    const m = migrate(s);
    if(m) return m;
  }catch(e){}
  return seed();
}
// 仅写本地（不触发后端推送），供外部状态覆盖（跨标签页 / 同步拉取）使用
function persist(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){
    console.error("本地存储写入失败：", e);
    if(window.toast) window.toast("⚠️ 本地存储写入失败，数据可能未保存");
  }
}
function save(){ persist(); if(SYNC.enabled) pushState(); }
function uid(){ return Math.random().toString(36).slice(2,9); }

/* ---------- 跨标签页 / 跨页面同步 ----------
 * 多个标签页（或 PWA 多实例）共享同一份 localStorage，但各自维护独立内存 state。
 * 若不监听 storage 事件，B 标签页的 save() 会用陈旧内存覆盖 A 的修改 → 数据丢失。
 * 监听后：其他页面改动会即时同步到本页视图；编辑中的弹窗按 id 重新定位对象，避免编辑丢失。 */
function applyExternalState(incoming, opts){
  opts = opts || {};
  const editingId = window.__editingId ? window.__editingId() : null;
  // 同步轮询(pull)且本页正在编辑时，暂不覆盖内存，避免冲掉在编数据；编辑保存后会自然合并
  if(opts.skipIfModal && window.__isEditing && window.__isEditing()) return;
  const migrated = migrate(incoming);
  if(!migrated) return;
  state = migrated;
  if(editingId && window.__repointEditing) window.__repointEditing(editingId);
  if(window.renderEverywhere) window.renderEverywhere(true);
  else if(window.renderAll) window.renderAll();
}
window.addEventListener("storage", e => {
  if(e.key !== KEY) return;
  if(e.newValue == null) return;            // 其他标签页清空了存储，本页保留当前数据
  try{ applyExternalState(JSON.parse(e.newValue)); }
  catch(_){}
});

/* ---------- 种子数据（首次打开时） ---------- */
function seed(){
  const now = Date.now(), D = 86400000;
  const dayAgo = n => { const d = new Date(now - n*D); return d.toISOString().slice(0,10); };
  return {
    accounts:[
      {id:"a1",platform:"小红书",name:"生活研究所",emoji:"📕",status:"active",goal:"粉丝破 5w"},
      {id:"a2",platform:"抖音",name:"DailyVlog",emoji:"🎵",status:"active",goal:"月增 1w"},
      {id:"a3",platform:"公众号",name:"深夜读写",emoji:"💬",status:"incub",goal:"开通流量主"},
      {id:"a4",platform:"视频号",name:"财经小课堂",emoji:"📺",status:"sleep",goal:"测试选题"},
    ],
    memos:[
      {id:uid(),accountId:"a1",content:"选题：\"一个人住的第 365 天\"——用时间轴叙事，配 9 图日常碎片，结尾抛互动问题。",tags:["选题","情感"],pinned:true,createdAt:now-D},
      {id:uid(),accountId:"a2",content:"运镜灵感：开头用 0.5x 慢动作特写+字幕卡点，完播率可能更高。",tags:["拍摄"],pinned:false,createdAt:now-2*D},
      {id:uid(),accountId:"",content:"通用：下个月做一期\"新媒体人工具箱\"合集，顺手吸粉。",tags:["规划"],pinned:false,createdAt:now-3*D},
    ],
    todos:[
      {id:uid(),accountId:"a1",title:"写完《独居好物》笔记正文",detail:"含 6 个单品 + 购买链接",priority:"high",status:"todo",due:now+D},
      {id:uid(),accountId:"a1",title:"设计封面 3 版 A/B/C",detail:"",priority:"mid",status:"doing",due:now+D*2},
      {id:uid(),accountId:"a2",title:"剪辑周更 Vlog",detail:"时长 60s 内",priority:"mid",status:"todo",due:now+D*3},
      {id:uid(),accountId:"a3",title:"起草流量主开通申请文",detail:"",priority:"low",status:"todo",due:now+D*5},
      {id:uid(),accountId:"a1",title:"回复上周评论区高频问题",detail:"已整理 12 条",priority:"high",status:"done",due:now-D},
    ],
    reminders:[
      {id:uid(),accountId:"a1",type:"pub",typeId:"pub",title:"发布《独居好物》笔记",trigger:now+D,repeat:"无",done:false},
      {id:uid(),accountId:"a2",type:"pub",typeId:"pub",title:"发布周更 Vlog",trigger:now+D*3,repeat:"每周",done:false},
      {id:uid(),accountId:"a1",type:"rev",typeId:"rev",title:"小红书本周数据复盘",trigger:now+D*2,repeat:"每周",done:false},
      {id:uid(),accountId:"a3",type:"cus",typeId:"cus",title:"确认流量主审核结果",trigger:now+D*5,repeat:"无",done:false},
    ],
    topics:[
      {id:uid(),accountId:"a1",title:"一个人住的第 365 天",body:"时间轴叙事 + 9 图日常碎片，结尾抛互动问题。",tags:["选题","情感"],status:"draft",pinned:true,createdAt:now-D},
      {id:uid(),accountId:"a2",title:"0.5x 慢动作开场卡点",body:"开头慢动作特写 + 字幕卡点，完播率可能更高。",tags:["拍摄","技巧"],status:"idea",pinned:false,createdAt:now-2*D},
      {id:uid(),accountId:"",title:"新媒体人工具箱合集",body:"Notion / 剪映 / 稿定设计，顺手吸粉。",tags:["规划","干货"],status:"ready",pinned:false,createdAt:now-3*D},
      {id:uid(),accountId:"a3",title:"周末读完的 3 本书",body:"深读 + 摘录，引导关注公众号。",tags:["读书","公众号"],status:"published",pinned:false,createdAt:now-5*D,publishedAt:now-5*D},
    ],
    metrics:[
      {id:uid(),accountId:"a1",date:dayAgo(5),followers:42000,views:120000,likes:8500,comments:420},
      {id:uid(),accountId:"a1",date:dayAgo(3),followers:43100,views:135000,likes:9100,comments:470},
      {id:uid(),accountId:"a1",date:dayAgo(1),followers:44800,views:152000,likes:10200,comments:530},
      {id:uid(),accountId:"a2",date:dayAgo(5),followers:12000,views:80000,likes:5200,comments:300},
      {id:uid(),accountId:"a2",date:dayAgo(2),followers:12650,views:91000,likes:6100,comments:340},
      {id:uid(),accountId:"a2",date:dayAgo(0),followers:13100,views:98000,likes:6500,comments:360},
      {id:uid(),accountId:"a3",date:dayAgo(4),followers:3200,views:15000,likes:980,comments:60},
      {id:uid(),accountId:"a3",date:dayAgo(1),followers:3380,views:17500,likes:1100,comments:72},
    ],
    reminderTypes:[
      {id:"pub",name:"内容发布",color:"#38bdf8"},
      {id:"rev",name:"数据复盘",color:"#a78bfa"},
      {id:"cus",name:"自定义",color:"#2dd4bf"},
    ],
    profile:{ name:"运营工作台", avatar:"" },
    settings:{ notify:false },
  };
}

/* ---------- 常量 ---------- */
const PLAT = ["小红书","抖音","公众号","视频号","B站","微博","其他"];
const STATUSMAP = {active:["active","活跃"],incub:["incub","孵化中"],sleep:["sleep","休眠"]};

/* ---------- 通用助手 ---------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const acct = id => state.accounts.find(a => a.id === id);
const fmtDate = ts => { const d = new Date(ts); return `${d.getMonth()+1}/${d.getDate()}`; };
const fmtFull = ts => { const d = new Date(ts), p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const dueClass = ts => { const t = ts - Date.now(); return t < 0 ? "over" : t < 3*86400000 ? "soon" : ""; };
const esc = s => (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const scopeFilter = arr => window._scope === "all" ? arr : arr.filter(x => x.accountId === window._scope);

/* ---------- 同步后端 (Phase 2) ---------- */
/* 后端为唯一真源；本地 localStorage 作为离线缓存。策略：启动拉取、变更推送、定时轮询。
   冲突采用 last-write-wins（单人使用场景足够；多端不会同时编辑同一份）。
   更新顺序以服务端的 updatedAt 为准：每次推送都用「最新时间」覆盖，拉取仅在远端更新时间
   严格大于本地 lastSync 时生效，避免用陈旧数据覆盖本地、也避免无谓重绘。 */
const SYNC_CFG_KEY = "ops-sync-cfg";
function loadSyncCfg(){ try{ return JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; }catch(e){ return {}; } }
function saveSyncCfg(o){ try{ localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(o)); }catch(e){} }
const _sc = loadSyncCfg();
const SYNC = { enabled: !!_sc.enabled, url: _sc.url || "/api", lastSync:0 };
async function apiPing(){
  try{ const r = await fetch(SYNC.url + "/ping", {cache:"no-store"}); SYNC.enabled = r.ok; }
  catch(e){ SYNC.enabled = false; }
  return SYNC.enabled;
}
async function pushState(){
  try{
    const r = await fetch(SYNC.url + "/state", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({state, updatedAt: SYNC.lastSync})});
    if(!r.ok) return;
    const d = await r.json(); SYNC.lastSync = d.updatedAt;
    if(window.updateSyncPill) window.updateSyncPill("ok");
  }catch(e){ if(window.updateSyncPill) window.updateSyncPill("err"); }
}
async function pullState(){
  try{
    const r = await fetch(SYNC.url + "/state", {cache:"no-store"});
    if(!r.ok) return false;
    const data = await r.json();
    if(data.state == null){ SYNC.lastSync = data.updatedAt || 0; await pushState(); return false; }
    if(data.updatedAt <= SYNC.lastSync) return false;   // 远端未更新的情况直接跳过
    // 编辑中(pull)跳过覆盖：弹窗里的在编数据合并以本地为准，轮询延后到弹窗关闭
    applyExternalState(data.state, {skipIfModal:true});
    SYNC.lastSync = data.updatedAt;
    persist();                                          // 写回本地缓存，但不回推后端（内容即远端快照）
    if(window.updateSyncPill) window.updateSyncPill("ok");
    return true;
  }catch(e){ if(window.updateSyncPill) window.updateSyncPill("err"); return false; }
}

/* ---------- 备份：导出 / 导入 JSON ---------- */
function exportJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  const d = new Date(), p = n => String(n).padStart(2,"0");
  a.href = URL.createObjectURL(blob);
  a.download = `ops-backup-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  if(window.toast) window.toast("已导出备份 JSON");
}
function importJSON(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const s = JSON.parse(r.result);
      const m = migrate(s);
      if(!m) throw new Error("文件格式不正确（缺少 accounts）");
      // 有 UI 时弹出「合并 / 覆盖」选择；无 UI 兜底直接覆盖（保持旧行为）
      if(window.showImportChoice) window.showImportChoice(m);
      else { state = m; commitImport(); if(window.toast) window.toast("备份已导入"); }
    }catch(e){ alert("导入失败：" + e.message); }
  };
  r.readAsText(file);
}
/* 合并：保留本机数据，仅补入备份里没有的新内容（按 id 去重，绝不删除本机条目）。
   用于手机/电脑之间手动同步——导出一端、导入另一端，两边独有内容都保留。 */
function mergeIntoState(src){
  let added = 0;
  const union = k => {
    if(!Array.isArray(state[k]) || !Array.isArray(src[k])) return;
    const seen = new Set(state[k].map(x => x && x.id));
    src[k].forEach(x => { if(x && x.id && !seen.has(x.id)){ state[k].push(x); added++; } });
  };
  ["accounts","memos","todos","reminders","topics","metrics","reminderTypes"].forEach(union);
  if(src.profile && typeof src.profile === "object") state.profile = src.profile;
  return added;
}
function commitImport(){
  save();
  window._scope = "all";
  if(window.renderEverywhere) window.renderEverywhere(false);
  else if(window.renderAll) window.renderAll();
}
