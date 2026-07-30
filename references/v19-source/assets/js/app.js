/* =========================================================
 * UI 层 (App) — 新媒体运营工作台 Phase 1
 * 渲染 / 导航 / 弹窗 / 折叠侧栏 / 备份 / PWA 注册
 * 依赖 store.js 中的 state, $, acct, esc, scopeFilter 等。
 * ========================================================= */

/* 当前版本号：每次改前端并重部署时，务必与 sw.js 的 CACHE（ops-vNN）同步 bump。
   用于「设置 → 关于」展示，方便确认手机端是否拉到最新版（冷启动后核对）。 */
const APP_VERSION = "ops-v19";

/* ---------------- 左上角个人资料（昵称 / 头像） ---------------- */
function renderBrand(){
  const p = state.profile || {name:"运营工作台", avatar:""};
  const logo = $("#brandLogo");
  if(p.avatar){
    logo.style.backgroundImage = `url(${p.avatar})`;
    logo.style.backgroundSize = "cover";
    logo.style.backgroundPosition = "center";
    logo.textContent = "";
  } else {
    logo.style.backgroundImage = "";
    logo.textContent = "运";
  }
  const nm = $("#brandName");
  if(nm) nm.textContent = p.name || "运营工作台";
}

/* ---------------- 账号切换面板（可折叠） ---------------- */
function renderAcctPanel(){
  const rows = [{id:"all",emoji:"🌐",name:"全部账号",status:null}]
    .concat(state.accounts.map(a => ({id:a.id,emoji:a.emoji,name:a.name,status:a.status})));
  $("#acctPanel").innerHTML = rows.map(r=>{
    const active = window._scope === r.id;
    const sd = r.status ? `<span class="sdot ${r.status}"></span>` : "";
    return `<div class="acct-row ${active?'active':''}" data-scope="${r.id}" title="${esc(r.name)}">
      <span class="ava sm">${r.emoji}</span><span class="lbl">${esc(r.name)}</span>${sd}</div>`;
  }).join("");
}
function renderScopeUI(){
  const all = {id:"all",emoji:"🌐",name:"全部账号"};
  const cur = window._scope === "all" ? all : (state.accounts.find(a=>a.id===window._scope) || all);
  $("#scopeName").textContent = cur.name;
  $("#scopeLabel").querySelector(".em").textContent = cur.emoji;
  const rows = [all].concat(state.accounts.map(a=>({id:a.id,emoji:a.emoji,name:a.name})));
  $("#scopeBar").innerHTML = rows.map(r=>`<span class="chip ${window._scope===r.id?'active':''}" data-scope="${r.id}">${r.emoji} ${esc(r.name)}</span>`).join("");
}
function setScope(id){
  window._scope = id;
  renderAcctPanel(); renderScopeUI();
  renderMemo(); renderTodo(); renderRem(); renderTopics();
  if($("#view-memo").classList.contains("active")) renderMemoHead();
  if($("#view-todo").classList.contains("active")) renderTodoHead();
  if($("#view-reminder").classList.contains("active")) renderRemHead();
  if($("#view-calendar").classList.contains("active")){ renderCalendar(); if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d); }
  if($("#view-topics").classList.contains("active")) renderTopicsHead();
  if($("#view-analytics").classList.contains("active")) renderAnalytics();
}
function renderMemoHead(){ $("#pageCrumb").textContent = window._scope==="all" ? "全部账号 · 合并备忘录" : acct(window._scope).name+" · 备忘录"; }
function renderTodoHead(){ $("#pageCrumb").textContent = window._scope==="all" ? "全部账号 · 合并待办" : "待办 · "+acct(window._scope).name; }
function renderRemHead(){ $("#pageCrumb").textContent = window._scope==="all" ? "全部账号 · 合并提醒" : "提醒 · "+acct(window._scope).name; }

/* ---------------- 多账号面板（仪表盘） ---------------- */
function renderDash(){
  const ac = state.accounts, todos = state.todos, rem = state.reminders;
  const done = todos.filter(t=>t.status==="done").length;
  const overdue = todos.filter(t=>t.status!=="done" && t.due<Date.now()).length;
  const todayPub = rem.filter(r=>!r.done && fmtDate(r.trigger)===fmtDate(Date.now()) && r.type==="pub").length;
  const pct = todos.length ? Math.round(done/todos.length*100) : 0;
  $("#statRow").innerHTML = [
    {k:"管理账号",v:ac.length,cls:""},
    {k:"待办完成率",v:`${pct}<small>%</small>`,cls:"accent"},
    {k:"逾期待办",v:overdue,cls:overdue?"warn":"ok"},
    {k:"今日待发布",v:todayPub,cls:todayPub?"warn":"ok"},
  ].map(s=>`<div class="stat ${s.cls}"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>`).join("");
  $("#dashCount").textContent = `共 ${ac.length} 个账号`;
  $("#acctGrid").innerHTML = ac.map(a=>{
    const at = state.todos.filter(t=>t.accountId===a.id);
    const dn = at.filter(t=>t.status==="done").length;
    const p = at.length ? Math.round(dn/at.length*100) : 0;
    const near = at.filter(t=>t.status!=="done" && t.due-Date.now()<7*86400000).length;
    const todayPub = rem.filter(r=>!r.done && r.accountId===a.id && fmtDate(r.trigger)===fmtDate(Date.now()) && r.type==="pub").length;
    const rm = state.memos.filter(m=>m.accountId===a.id).length;
    const tm = state.topics.filter(x=>x.accountId===a.id).length;
    const health = computeHealth(a, at);
    const hc = health>=80?"up":health>=60?"":"down";
    const [sc,sn] = STATUSMAP[a.status];
    return `<div class="acard">
      <div class="head"><div class="ava">${a.emoji}</div>
        <div class="meta" style="flex:1"><div class="nm">${esc(a.name)}</div><div class="pf">${a.platform} · ${esc(a.goal||"")}</div></div>
        <span class="pill ${sc}">${sn}</span></div>
      <div class="barrow"><span>待办完成度</span><span>${dn}/${at.length}</span></div>
      <div class="bar"><i style="width:${p}%"></i></div>
      <div class="mini">
        <div>临近截止<b class="${near?'hot':''}">${near}</b></div>
        <div>今日发布<b class="${todayPub?'hot':''}">${todayPub}</b></div>
        <div>选题<b>${tm}</b></div>
        <div>健康分<b class="${hc}">${health}</b></div>
      </div></div>`;
  }).join("");
}

/* ---------------- 备忘录 ---------------- */
function renderMemo(){
  const list = scopeFilter(state.memos).sort((a,b)=>(b.pinned-a.pinned)||(b.createdAt-a.createdAt));
  if(!list.length){ renderMemoHead(); $("#memoList").innerHTML = `<div class="empty">该范围下还没有备忘录，点右上角「新建」记录灵感吧</div>`; return; }
  renderMemoHead();
  $("#memoList").innerHTML = list.map(m=>{
    const a = m.accountId ? acct(m.accountId) : null;
    return `<div class="card memo" data-act="edit-memo" data-id="${m.id}"><div class="top">${m.pinned?'<span class="pin">📌</span>':''}<div class="body">${esc(m.content)}</div></div>
      <div class="foot">${m.tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}
        ${a?`<span class="acctag">${a.emoji} ${esc(a.name)}</span>`:'<span class="acctag">通用</span>'}
        <span class="at">${fmtDate(m.createdAt)}</span></div>
      <span class="del-x" data-act="del-memo" data-id="${m.id}" title="删除">×</span></div>`;
  }).join("");
}

/* ---------------- 待办 ---------------- */
function renderTodo(){
  let list = scopeFilter(state.todos);
  if(window._f.pri==="high") list = list.filter(t=>t.priority==="high");
  if(window._f.pri==="todo") list = list.filter(t=>t.status!=="done");
  if(window._f.pri==="done") list = list.filter(t=>t.status==="done");
  list.sort((a,b)=>(a.status==="done")-(b.status==="done")||(a.due-b.due));
  if(!list.length){ renderTodoHead(); $("#todoList").innerHTML = `<div class="empty">该筛选下暂无待办</div>`; return; }
  renderTodoHead();
  $("#todoList").innerHTML = list.map(t=>{
    const a = acct(t.accountId), dc = dueClass(t.due);
    const pn = {high:"高",mid:"中",low:"低"}[t.priority];
    return `<div class="card todo ${t.status==="done"?"done":""}" data-act="edit-todo" data-id="${t.id}">
      <div class="check" data-act="toggle" data-id="${t.id}">✓</div>
      <div style="flex:1"><div class="tt">${esc(t.title)}</div>
        ${t.detail?`<div class="det">${esc(t.detail)}</div>`:""}
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <span class="pri ${t.priority}">${pn}优先级</span>
          <span class="acctag">${a?a.emoji+" "+esc(a.name):"通用"}</span>
          ${t.due?`<span class="due ${dc}">📅 ${fmtFull(t.due)}</span>`:""}
        </div></div>
      <span class="del-x" data-act="del-todo" data-id="${t.id}" title="删除">×</span></div>`;
  }).join("");
}

/* 提醒自定义类型解析：把 r.typeId（或旧 r.type）映射成 {id,name,color} */
function remTypeOf(r){
  const list = state.reminderTypes || [];
  const t = list.find(x => x.id === (r.typeId || r.type));
  if(t) return {id:t.id, name:t.name, color:t.color};
  const fb = {pub:{name:"内容发布",color:"#38bdf8"},rev:{name:"数据复盘",color:"#a78bfa"},cus:{name:"自定义",color:"#2dd4bf"}};
  if(fb[r.type]) return {id:r.type, name:fb[r.type].name, color:fb[r.type].color};
  return {id:r.type||"cus", name:"自定义", color:"#2dd4bf"};
}
function renderRemLegend(){
  const el = $("#remLegend"); if(!el) return;
  const types = state.reminderTypes || [];
  el.innerHTML = types.map(t=>`<span><i class="lg" style="background:${t.color}"></i>${esc(t.name)}</span>`).join("") + `<span><i class="lg todo"></i>待办截止</span>`;
}
/* ---------------- 提醒 ---------------- */
function renderRem(){
  let list = scopeFilter(state.reminders);
  if(window._f.type && window._f.type!=="all") list = list.filter(r=> remTypeOf(r).id === window._f.type);
  list.sort((a,b)=>a.trigger-b.trigger);
  renderRemHead();
  // 动态渲染类型过滤 chips（含自定义类型与配色）
  const types = state.reminderTypes || [];
  $("#remType").innerHTML = `<span class="chip ${!window._f.type||window._f.type==="all"?"active":""}" data-rtype="all">全部</span>`
    + types.map(t=>`<span class="chip ${window._f.type===t.id?"active":""}" data-rtype="${t.id}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:6px"></i>${esc(t.name)}</span>`).join("");
  renderRemLegend();
  if(!list.length){ $("#remList").innerHTML = `<div class="empty">该范围 / 类型下暂无提醒</div>`; return; }
  $("#remList").innerHTML = list.map(r=>{
    const a = acct(r.accountId); const t = remTypeOf(r);
    return `<div class="card reminder" data-act="edit-reminder" data-id="${r.id}"><div class="rtime">${fmtFull(r.trigger).slice(5,16)}</div>
      <div style="flex:1"><span class="rtype" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${esc(t.name)}</span>
        ${r.repeat && r.repeat!=="无"?`<span class="rep">↻ ${r.repeat}</span>`:""}
        <div style="font-weight:600;margin-top:6px">${esc(r.title)}</div>
        <div style="margin-top:4px"><span class="acctag">${a?a.emoji+" "+esc(a.name):"通用"}</span></div></div>
        <span class="del-x" data-act="del-reminder" data-id="${r.id}" title="删除">×</span></div>`;
  }).join("");
  updateReminderBadge();
}

/* ---------------- 发布日历 (Phase 3) ---------------- */
let calMonth = (function(){ const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
let calSel = null;          // 当前选中的日期 {y,m,d}，点击天数格子后填充
let calComposeDate = null;  // 从日历新建事项时预填的日期（Date），用完即清空
function renderCalendar(){
  $("#pageCrumb").textContent = (window._scope==="all" ? "全部账号" : (acct(window._scope)||{name:"全部账号"}).name) + " · 发布日历";
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $("#calTitle").textContent = y + " 年 " + (m+1) + " 月";
  const rems = scopeFilter(state.reminders).filter(r=>{ const d=new Date(r.trigger); return d.getFullYear()===y && d.getMonth()===m; });
  const todos = scopeFilter(state.todos).filter(t=>{ const d=new Date(t.due); return d.getFullYear()===y && d.getMonth()===m; });
  const byDay = {};
  rems.forEach(r=>{ const k=new Date(r.trigger).getDate(); const col=remTypeOf(r).color; (byDay[k]=byDay[k]||[]).push({cls:r.type==="pub"?"pub":r.type==="rev"?"rev":"cus", t:r.title, col}); });
  todos.forEach(t=>{ const k=new Date(t.due).getDate(); (byDay[k]=byDay[k]||[]).push({cls:"todo", t:t.title, done:t.status==="done"}); });
  const first = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  let cells = "";
  for(let i=0;i<first;i++) cells += '<div class="cal-cell empty"></div>';
  const t = new Date(), isCur = t.getFullYear()===y && t.getMonth()===m;
  for(let d=1; d<=days; d++){
    const evs = byDay[d]||[];
    const dots = evs.slice(0,3).map(e=>{
      if(e.cls==="todo") return '<i class="cd todo'+(e.done?' done':'')+'" title="'+esc(e.t)+'"></i>';
      return '<i class="cd" style="background:'+(e.col||'#9a9a9a')+'" title="'+esc(e.t)+'"></i>';
    }).join("");
    const more = evs.length>3 ? '<span class="cmore">+'+(evs.length-3)+'</span>' : "";
    const sel = (calSel && calSel.y===y && calSel.m===m && calSel.d===d) ? " selected" : "";
    cells += '<div class="cal-cell'+(isCur&&d===t.getDate()?' today':'')+sel+'" data-day="'+d+'"><div class="cd-num">'+d+'</div><div class="cd-dots">'+dots+more+'</div></div>';
  }
  $("#calGrid").innerHTML = cells;
  renderRemLegend();
}
/* 点击某天后，在日历下方展示该日全部事项（提醒 + 待办截止） */
function renderDayDetail(y,m,d){
  const el = $("#calDetail");
  if(!el) return;
  const rems = scopeFilter(state.reminders).filter(r=>{ const dt=new Date(r.trigger); return dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d; })
    .sort((a,b)=>a.trigger-b.trigger);
  const todos = scopeFilter(state.todos).filter(t=>{ const dt=new Date(t.due); return dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d; });
  const wk = ["日","一","二","三","四","五","六"][new Date(y,m,d).getDay()];
  const dateStr = `${y} 年 ${m+1} 月 ${d} 日 · 周${wk}`;
  const remHtml = rems.map(r=>{
    const a = acct(r.accountId); const t = remTypeOf(r);
    return `<div class="cd-item" data-act="edit-reminder" data-id="${r.id}">
      <span class="cd-badge" style="background:${t.color};color:#04121b">${esc(t.name)}</span>
      <div class="cd-main"><div class="cd-t">${esc(r.title)}</div>
        <div class="cd-meta"><span class="acctag">${a?a.emoji+" "+esc(a.name):"通用"}</span><span class="cd-time">🕒 ${fmtFull(r.trigger).slice(11)}</span></div>
      </div></div>`;
  }).join("");
  const todoHtml = todos.map(t=>{
    const a = acct(t.accountId);
    return `<div class="cd-item ${t.status==="done"?"done":""}" data-act="edit-todo" data-id="${t.id}">
      <span class="cd-badge todo">待办</span>
      <div class="cd-main"><div class="cd-t">${esc(t.title)}</div>
        <div class="cd-meta"><span class="acctag">${a?a.emoji+" "+esc(a.name):"通用"}</span>${t.status==="done"?'<span class="cd-done">已完成</span>':'<span class="cd-time">⏰ 待处理</span>'}</div>
      </div></div>`;
  }).join("");
  el.style.display = "block";
  if(!rems.length && !todos.length){
    el.innerHTML = `<div class="cd-head"><span>${dateStr}</span><button class="btn btn-ghost cd-new" data-cdnew="${y}-${m}-${d}">＋ 新建此日事项</button></div>
      <div class="empty" style="padding:14px 4px">这一天还没有事项。点右上角「新建」，或上方按钮，添加一条发布 / 待办。</div>`;
    return;
  }
  el.innerHTML = `<div class="cd-head"><span>${dateStr}</span><button class="btn btn-ghost cd-new" data-cdnew="${y}-${m}-${d}">＋ 新建此日事项</button></div>`
    + (rems.length ? `<div class="cd-group">提醒 / 发布</div>${remHtml}` : "")
    + (todos.length ? `<div class="cd-group">待办截止</div>${todoHtml}` : "");
}
function toLocalInput(d){
  const p = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- 选题素材库 (Phase 3) ---------------- */
function renderTopicsHead(){ $("#pageCrumb").textContent = window._scope==="all" ? "全部账号 · 选题素材库" : (acct(window._scope)||{name:""}).name+" · 选题素材库"; }
function renderTopics(){
  let list = scopeFilter(state.topics);
  if(window._f.tstatus && window._f.tstatus!=="all") list = list.filter(x=>x.status===window._f.tstatus);
  const q = (window._tq||"").toLowerCase();
  if(q) list = list.filter(x => (x.title||"").toLowerCase().includes(q) || (x.body||"").toLowerCase().includes(q) || (x.tags||[]).some(t=>t.toLowerCase().includes(q)));
  list.sort((a,b)=>(b.pinned-a.pinned)||(b.createdAt-a.createdAt));
  if(!list.length){ renderTopicsHead(); $("#topicList").innerHTML = `<div class="empty">该范围下还没有选题，点右上角「新建」沉淀灵感吧</div>`; return; }
  renderTopicsHead();
  const smap = {idea:["idea","灵感"],draft:["draft","草稿"],ready:["ready","待发"],published:["published","已发"]};
  $("#topicList").innerHTML = list.map(tp=>{
    const a = tp.accountId ? acct(tp.accountId) : null;
    const [c,n] = smap[tp.status] || smap.idea;
    return `<div class="card topic" data-act="edit-topic" data-id="${tp.id}">
      <div class="top">${tp.pinned?'<span class="pin">📌</span>':''}<div class="tt">${esc(tp.title||"未命名选题")}</div>
        <span class="del-x" data-act="del-topic" data-id="${tp.id}" title="删除">×</span></div>
      ${tp.body?`<div class="body">${esc(tp.body)}</div>`:""}
      <div class="foot">
        <span class="tstatus ${c}">${n}</span>
        ${tp.tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join("")}
        ${a?`<span class="acctag">${a.emoji} ${esc(a.name)}</span>`:'<span class="acctag">通用</span>'}
        <span class="at">${fmtDate(tp.createdAt)}</span>
      </div></div>`;
  }).join("");
}

/* ---------------- 数据看板 (Phase 3) ---------------- */
function fmtNum(v){
  v = Number(v)||0;
  if(Math.abs(v) >= 10000) return (v/10000).toFixed(v%10000===0?0:1) + "万";
  return v.toLocaleString("en-US");
}
window._fm = window._fm || "followers";
function renderAnalytics(){
  const m = window._fm;
  const mlabel = {followers:"粉丝数",views:"阅读 / 播放量",likes:"点赞数",comments:"评论数"}[m];
  $("#chartTitle").textContent = (window._scope==="all"?"全部账号":(acct(window._scope)||{name:""}).name) + " · " + mlabel + "趋势";
  const pal = ["#38bdf8","#2dd4bf","#a78bfa","#fbbf24","#f87171","#34d399","#f472b6"];
  const accts = window._scope==="all" ? state.accounts : state.accounts.filter(a=>a.id===window._scope);
  const lines = accts.map((a,i)=>{
    const recs = state.metrics.filter(x=>x.accountId===a.id).slice().sort((p,q)=>p.date<q.date?-1:1);
    return {id:a.id, name:a.name, emoji:a.emoji, color:pal[i%pal.length], points:recs.map(r=>({d:r.date.slice(5), v:Number(r[m])||0}))};
  }).filter(l=>l.points.length);
  $("#chartWrap").innerHTML = lines.length ? renderSvgChart(lines) : '<div class="empty">还没有录入数据，点右上角「新建」添加一条指标记录</div>';
  $("#chartLegend").innerHTML = lines.map(l=>`<span class="lg-item"><i style="background:${l.color}"></i>${l.emoji} ${esc(l.name)}</span>`).join("");
  const rows = accts.map(a=>{
    const recs = state.metrics.filter(x=>x.accountId===a.id).slice().sort((p,q)=>p.date<q.date?1:-1);
    const latest = recs[0], prev = recs[1];
    const v = latest ? Number(latest[m])||0 : null;
    const delta = (latest && prev) ? (Number(latest[m])||0)-(Number(prev[m])||0) : null;
    const prevV = prev ? Number(prev[m])||0 : null;
    return {a, v, delta, prevV, has:!!latest};
  });
  $("#anaCount").textContent = `共 ${accts.length} 个账号`;
  $("#anaGrid").innerHTML = rows.map(r=>{
    const [sc,sn] = STATUSMAP[r.a.status];
    const dv = r.delta==null ? "—" : (r.delta>0?"+":"")+fmtNum(r.delta);
    const dcls = r.delta==null ? "" : r.delta>0?"up":"down";
    const pv = (r.delta!=null && r.prevV!=null && r.prevV!==0) ? (r.delta/r.prevV*100) : null;
    const pvTxt = pv==null ? "" : ` <span class="pct ${dcls}">(${pv>0?"+":""}${pv.toFixed(1)}%)</span>`;
    return `<div class="acard">
      <div class="head"><div class="ava">${r.a.emoji}</div>
        <div class="meta" style="flex:1"><div class="nm">${esc(r.a.name)}</div><div class="pf">${r.a.platform}</div></div>
        <span class="pill ${sc}">${sn}</span></div>
      <div class="barrow"><span>${mlabel}</span><span>${r.has?fmtNum(r.v):"—"}</span></div>
      <div class="mini"><div>${r.has?"较上次":"暂无数据"}<b class="${dcls}">${dv}</b>${pvTxt}</div></div>
    </div>`;
  }).join("");
  const all = scopeFilter(state.metrics).slice().sort((p,q)=>p.date<q.date?1:-1);
  $("#anaRecCount").textContent = all.length ? `共 ${all.length} 条` : "";
  $("#metricList").innerHTML = all.length ? all.map(r=>{
    const a = acct(r.accountId);
    return `<div class="card mrec" data-act="edit-metric" data-id="${r.id}">
      <div style="flex:1">
        <div class="tt">${a?a.emoji+" "+esc(a.name):"通用"} · ${r.date}</div>
        <div class="mrec-stats">👥 ${fmtNum(r.followers||0)} · ▶ ${fmtNum(r.views||0)} · ♥ ${fmtNum(r.likes||0)} · 💬 ${fmtNum(r.comments||0)}</div>
      </div>
      <span class="del-x" data-act="del-metric" data-id="${r.id}" title="删除">×</span>
    </div>`;
  }).join("") : '<div class="empty">还没有录入记录</div>';
}
function renderSvgChart(lines){
  const W=680,H=240,padL=42,padR=16,padT=16,padB=28;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const dateSet=[...new Set(lines.flatMap(l=>l.points.map(p=>p.d)))].sort();
  let max=1; lines.forEach(l=>l.points.forEach(p=>{ if(p.v>max) max=p.v; }));
  const yOf=v=>padT+innerH-(v/max)*innerH;
  const xOf=i=> dateSet.length>1 ? padL + i/(dateSet.length-1)*innerW : padL+innerW/2;
  let grid=""; const steps=4;
  for(let i=0;i<=steps;i++){ const y=padT+innerH*i/steps; const val=Math.round(max*(1-i/steps)); grid+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="rgba(128,128,128,.12)" stroke-width="1"/><text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="13" fill="#6b6b6b">${fmtNum(val)}</text>`; }
  let xlab=""; const labelIdx = dateSet.length>1 ? [0, Math.floor((dateSet.length-1)/2), dateSet.length-1] : [0];
  labelIdx.forEach(i=>{ xlab+=`<text x="${xOf(i)}" y="${H-8}" text-anchor="middle" font-size="13" fill="#9a9a9a">${dateSet[i]}</text>`; });
  let paths="";
  lines.forEach(l=>{
    const map={}; l.points.forEach(p=>map[p.d]=p.v);
    let d="", started=false;
    dateSet.forEach((dt,i)=>{
      if(map[dt]==null){ started=false; return; }
      const x=xOf(i).toFixed(1), y=yOf(map[dt]).toFixed(1);
      d += (started?` L${x} ${y}`:` M${x} ${y}`); started=true;
    });
    paths+=`<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    l.points.forEach(p=>{ const i=dateSet.indexOf(p.d); paths+=`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="3.2" fill="${l.color}"/>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">${grid}${paths}${xlab}</svg>`;
}

/* ---------------- 周/月报 (Phase 3) ---------------- */
window._rr = window._rr || "week";
function renderReport(){
  const r = window._rr;
  const now=new Date();
  let start;
  if(r==="week"){ const d=new Date(now); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); start=d; }
  else { start=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); }
  const end=now;
  const inR = ts => ts>=start.getTime() && ts<=end.getTime();
  const doneTodos = state.todos.filter(t=>t.status==="done" && (inR(t.due)|| (t.due==null && inR(t.createdAt))));
  const pubRem = state.reminders.filter(x=>x.type==="pub" && inR(x.trigger));
  const pubTopics = state.topics.filter(x=>x.status==="published" && inR(x.publishedAt || x.createdAt));
  const newTopics = state.topics.filter(x=>inR(x.createdAt));
  const newMemos = state.memos.filter(x=>inR(x.createdAt));
  const fmt = ts => { const d=new Date(ts); const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const title = (r==="week"?"运营周报":"运营月报") + `（${fmt(start.getTime())} ~ ${fmt(end.getTime())}）`;
  const lines=[];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`## 概览`);
  lines.push(`- 完成待办：${doneTodos.length} 项`);
  lines.push(`- 计划发布：${pubRem.length} 篇`);
  lines.push(`- 已发布内容：${pubTopics.length} 篇`);
  lines.push(`- 新增选题：${newTopics.length} 个`);
  lines.push(`- 新增备忘：${newMemos.length} 条`);
  lines.push("");
  lines.push(`## 各账号进展`);
  state.accounts.forEach(a=>{
    const dt = doneTodos.filter(t=>t.accountId===a.id).length;
    const pr = pubRem.filter(x=>x.accountId===a.id).length;
    const pt = pubTopics.filter(x=>x.accountId===a.id).length;
    const nt = newTopics.filter(x=>x.accountId===a.id).length;
    lines.push(`### ${a.emoji} ${a.name}（${a.platform}）`);
    lines.push(`- 完成待办：${dt} 项`);
    lines.push(`- 计划发布：${pr} 篇 · 已发布：${pt} 篇`);
    lines.push(`- 新增选题：${nt} 个`);
    lines.push("");
  });
  lines.push(`## 明细`);
  lines.push(`### 完成待办`);
  if(doneTodos.length) doneTodos.forEach(t=>{ const a=acct(t.accountId); lines.push(`- ${a?a.emoji+" "+esc(a.name):"通用"}：${esc(t.title)}`); }); else lines.push(`- 无`);
  lines.push("");
  lines.push(`### 发布节点`);
  if(pubRem.length) pubRem.forEach(x=>{ const a=acct(x.accountId); lines.push(`- ${fmt(x.trigger).slice(5)} ${a?a.emoji+" "+esc(a.name):"通用"}：${esc(x.title)}`); }); else lines.push(`- 无`);
  lines.push("");
  lines.push(`### 新增选题`);
  if(newTopics.length) newTopics.forEach(tp=>{ const a=acct(tp.accountId); lines.push(`- ${a?a.emoji+" "+esc(a.name):"通用"}：${esc(tp.title||"未命名")}（${ ({idea:"灵感",draft:"草稿",ready:"待发",published:"已发"}[tp.status]||"灵感")}）`); }); else lines.push(`- 无`);
  const md = lines.join("\n");
  window._reportMd = md;
  $("#reportDoc").innerHTML = `<pre>${esc(md)}</pre>`;
}

/* ---------------- 导航 ---------------- */
const TITLES = {
  dash:["多账号面板","各账号运营状态与待办进度一览"],
  memo:["备忘录","灵感 · 选题 · 运营想法"],
  todo:["待办事项","按账号分类，支持优先级与截止日"],
  reminder:["提醒事项","发布节点 / 数据复盘 / 自定义"],
  calendar:["发布日历","把发布与待办节点铺到月历上"],
  topics:["选题素材库","沉淀选题 / 脚本 / 素材，支持标签与状态管理"],
  analytics:["数据看板","手动录入指标，看趋势与账号对比"],
  report:["周/月报","基于现有数据自动汇总运营周报 / 月报"],
};
function go(view){
  $$(".nav-item[data-view]").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
  $$(".botnav .bi").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+view).classList.add("active");
  $("#pageTitle").textContent = TITLES[view][0];
  $("#pageCrumb").textContent = TITLES[view][1];
  if(view==="dash") renderDash();
  if(view==="memo") renderMemo();
  if(view==="todo") renderTodo();
  if(view==="reminder") renderRem();
  if(view==="calendar") renderCalendar();
  if(view==="topics") renderTopics();
  if(view==="analytics") renderAnalytics();
  if(view==="report") renderReport();
}
$$(".nav-item[data-view], .botnav .bi").forEach(n=>n.addEventListener("click",()=>go(n.dataset.view)));
$$(".nav-item[data-soon]").forEach(n=>n.addEventListener("click",()=>toast("该模块在 Phase 3 规划中")));
function toast(msg){
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--panel-3);color:var(--text);border:1px solid var(--border);padding:10px 18px;border-radius:10px;z-index:50;font-size:13px;box-shadow:var(--shadow)";
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),1800);
}

/* ---------------- 全量重渲染（导入备份后，归位到全部账号） ---------------- */
function renderAll(){
  window._scope = "all";
  renderEverywhere(false);
}
/* 全量重渲染：keepScope=true 时保留当前账号范围（跨标签页同步 / 后端拉取后用，避免打断用户选择） */
function renderEverywhere(keepScope){
  if(!keepScope) window._scope = "all";
  renderAcctPanel(); renderScopeUI(); renderBrand();
  renderDash(); renderMemo(); renderTodo(); renderRem(); renderCalendar(); renderTopics(); renderAnalytics(); renderReport();
}

/* ---------------- 同步状态药丸（让用户直观看到同步是否工作） ---------------- */
window.updateSyncPill = function(status){
  const pill = document.querySelector(".sync-pill");
  if(!pill) return;
  const dot = pill.querySelector(".dot");
  const txt = pill.lastElementChild;
  if(status==="local"){ dot.style.background="#6b6b6b"; txt.textContent="本地模式 · 数据存本机"; }
  else if(status==="ok"){ dot.style.background="#34d399"; txt.textContent="已同步 · " + new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}); }
  else if(status==="err"){ dot.style.background="#f87171"; txt.textContent="同步异常 · 将重试"; }
};

/* ---------------- 点击委托：范围 / 过滤 / 勾选 ---------------- */
document.addEventListener("click", e=>{
  const sc = e.target.closest("[data-scope]");
  if(sc){ setScope(sc.dataset.scope); return; }
  const p = e.target.closest("[data-pri]");
  if(p){ window._f.pri = p.dataset.pri==="all" ? undefined : p.dataset.pri; syncChips("#todoPri","pri",p.dataset.pri); renderTodo(); return; }
  const r = e.target.closest("[data-rtype]");
  if(r){ window._f.type = r.dataset.rtype==="all" ? undefined : r.dataset.rtype; syncChips("#remType","rtype",r.dataset.rtype); renderRem(); return; }
  const chk = e.target.closest("[data-act='toggle']");
  if(chk){
    const t = state.todos.find(x=>x.id===chk.dataset.id);
    if(t){ t.status = t.status==="done" ? "todo" : "done"; save(); renderTodo(); renderDash(); renderCalendar(); renderReport(); if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d); }
    return;
  }
  const cal = e.target.closest("[data-cal]");
  if(cal){ calMonth.setMonth(calMonth.getMonth() + (cal.dataset.cal==="prev"?-1:1)); renderCalendar(); return; }
  const dayCell = e.target.closest("[data-day]");
  if(dayCell){ const d = parseInt(dayCell.dataset.day,10); calSel = {y:calMonth.getFullYear(), m:calMonth.getMonth(), d}; renderCalendar(); renderDayDetail(calSel.y, calSel.m, calSel.d); return; }
  const cdnew = e.target.closest("[data-cdnew]");
  if(cdnew){ const [yy,mm,dd] = cdnew.dataset.cdnew.split("-").map(Number); calComposeDate = new Date(yy, mm, dd, 9, 0); openModal("reminder"); return; }
  const dct = e.target.closest("[data-act='del-topic']");
  if(dct){ if(confirm("确定删除该选题？")){ state.topics = state.topics.filter(x=>x.id!==dct.dataset.id); save(); renderTopics(); renderDash(); } return; }
  const ect = e.target.closest("[data-act='edit-topic']");
  if(ect){ openModal("topic", ect.dataset.id); return; }
  const dmem = e.target.closest("[data-act='del-memo']");
  if(dmem){ if(confirm("确定删除该备忘录？")){ state.memos = state.memos.filter(x=>x.id!==dmem.dataset.id); save(); renderMemo(); renderDash(); } return; }
  const emem = e.target.closest("[data-act='edit-memo']");
  if(emem){ openModal("memo", emem.dataset.id); return; }
  const dtod = e.target.closest("[data-act='del-todo']");
  if(dtod){ if(confirm("确定删除该待办？")){ state.todos = state.todos.filter(x=>x.id!==dtod.dataset.id); save(); renderTodo(); renderDash(); } return; }
  const etod = e.target.closest("[data-act='edit-todo']");
  if(etod){ openModal("todo", etod.dataset.id); return; }
  const drem = e.target.closest("[data-act='del-reminder']");
  if(drem){ if(confirm("确定删除该提醒？")){ state.reminders = state.reminders.filter(x=>x.id!==drem.dataset.id); save(); renderRem(); renderDash(); if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d); } return; }
  const erem = e.target.closest("[data-act='edit-reminder']");
  if(erem){ openModal("reminder", erem.dataset.id); return; }
  const ts = e.target.closest("[data-ts]");
  if(ts){ window._f.tstatus = ts.dataset.ts==="all" ? undefined : ts.dataset.ts; syncChips("#topicStatus","ts",ts.dataset.ts); renderTopics(); return; }
  const mc = e.target.closest("[data-m]");
  if(mc){ window._fm = mc.dataset.m; syncChips("#metricSel","m",mc.dataset.m); renderAnalytics(); return; }
  const rr = e.target.closest("[data-r]");
  if(rr){ window._rr = rr.dataset.r; syncChips("#repRange","r",rr.dataset.r); renderReport(); return; }
  const dmt = e.target.closest("[data-act='del-metric']");
  if(dmt){ if(confirm("确定删除该记录？")){ state.metrics = state.metrics.filter(x=>x.id!==dmt.dataset.id); save(); renderAnalytics(); } return; }
  const emt = e.target.closest("[data-act='edit-metric']");
  if(emt){ openModal("metric", emt.dataset.id); return; }
  const fdel = e.target.closest("#f_del");
  if(fdel){
    if(confirm("确定删除该项？")){
      if(editType==="topic") state.topics = state.topics.filter(x=>x.id!==editing.id);
      else if(editType==="metric") state.metrics = state.metrics.filter(x=>x.id!==editing.id);
      else if(editType==="reminder") state.reminders = state.reminders.filter(x=>x.id!==editing.id);
      else if(editType==="memo") state.memos = state.memos.filter(x=>x.id!==editing.id);
      else if(editType==="todo") state.todos = state.todos.filter(x=>x.id!==editing.id);
      save(); closeModal();
      renderMemo(); renderTodo(); renderRem(); renderTopics(); renderAnalytics(); renderDash();
      if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d);
    }
    return;
  }
});
$("#topicSearch").addEventListener("input", e=>{ window._tq = e.target.value.trim().toLowerCase(); renderTopics(); });
function syncChips(sel, attr, val){
  $$(sel+" .chip").forEach(c=>c.classList.toggle("active", val==="all" ? c.dataset[attr]==="all" : c.dataset[attr]===val));
}

/* ---------------- 侧栏折叠 ---------------- */
$("#collapseBtn").addEventListener("click", ()=>{
  const s = $("#sidebar"); s.classList.toggle("collapsed");
  $("#collapseBtn").textContent = s.classList.contains("collapsed") ? "»" : "«";
  $("#collapseBtn").title = s.classList.contains("collapsed") ? "展开侧栏" : "收起侧栏";
});

/* ---------------- 左上角品牌区：点击编辑昵称 / 头像 ---------------- */
$("#brand").addEventListener("click", e=>{
  if(e.target.closest("#collapseBtn")) return;   // 点「收起」按钮不触发编辑
  openProfileModal();
});
/* 移动端侧栏隐藏，顶栏加一个独立的「个人资料」入口，保证手机也能改昵称 / 头像 */
const profileBtn = $("#profileBtn");
if(profileBtn) profileBtn.addEventListener("click", ()=> openProfileModal());

/* ---------------- 弹窗 / 增删改 ---------------- */
let editing = null, editType = null;
let avSrcImg = null, avPending = "";   // 头像编辑临时态：avSrcImg=源图, avPending=待保存的裁剪后 dataURL
// 暴露给 store.js 的跨标签页/同步逻辑使用，避免编辑中的内存对象在外部状态覆盖后丢失
window.__isEditing    = () => !!editing;
window.__editingId    = () => editing ? editing.id : null;
window.__repointEditing = (id) => {
  if(!editing || !editType) return;
  const arr = {topic:state.topics, metric:state.metrics, memo:state.memos, todo:state.todos, reminder:state.reminders}[editType];
  if(!arr) return;
  const found = arr.find(x => x.id === id);
  if(found) editing = found;   // 重新定位到新 state 中的同一对象，保留在编编辑
};
function openModal(type, id){
  editType = type; editing = null;
  let pre = null;
  if(id){
    if(type==="topic")        pre = state.topics.find(x=>x.id===id) || null;
    else if(type==="memo")    pre = state.memos.find(x=>x.id===id) || null;
    else if(type==="todo")    pre = state.todos.find(x=>x.id===id) || null;
    else if(type==="reminder")pre = state.reminders.find(x=>x.id===id) || null;
    else if(type==="metric")  pre = state.metrics.find(x=>x.id===id) || null;
    editing = pre || null;
  }
  $("#mTitle").textContent = (pre?"编辑":"新建") + (type==="memo"?"备忘录":type==="todo"?"待办":type==="reminder"?"提醒":type==="topic"?"选题":type==="metric"?"指标记录":type==="account"?"账号":"");
  let html = "";
  if(type==="memo"){
    html = `<div class="field"><label>内容</label><textarea id="f_content" placeholder="记录灵感、选题或想法…"></textarea></div>
      <div class="row2">
        <div class="field"><label>归属账号</label><select id="f_acct">${acctOpts(true)}</select></div>
        <div class="field"><label>标签(逗号分隔)</label><input id="f_tags" placeholder="选题, 拍摄"></div>
      </div>
      <div class="field"><label><input type="checkbox" id="f_pin"> 置顶</label></div>`;
  } else if(type==="todo"){
    html = `<div class="field"><label>标题</label><input id="f_title" placeholder="要做什么"></div>
      <div class="field"><label>详情</label><textarea id="f_detail" placeholder="补充说明(可选)"></textarea></div>
      <div class="row2">
        <div class="field"><label>归属账号</label><select id="f_acct">${acctOpts()}</select></div>
        <div class="field"><label>优先级</label><select id="f_pri"><option value="high">高</option><option value="mid" selected>中</option><option value="low">低</option></select></div>
      </div>
      <div class="field"><label>截止日期</label><input type="datetime-local" id="f_due"></div>`;
  } else if(type==="reminder"){
    const selId = pre ? (pre.typeId || pre.type || "pub") : (window._f.type && window._f.type!=="all" ? window._f.type : "pub");
    html = `<div class="field"><label>标题</label><input id="f_title" placeholder="提醒内容"></div>
      <div class="field"><label>类型（可自定义名称与颜色）</label>
        <div class="type-chips" id="f_typeChips"></div>
        <button class="btn btn-ghost" id="f_typeAdd" type="button" style="margin-top:8px;font-size:12px;padding:6px 10px">＋ 新建类型</button>
        <div class="type-new" id="f_typeNew" style="display:none;margin-top:10px;border:1px dashed var(--border);border-radius:10px;padding:12px">
          <div class="field" style="margin:0 0 8px"><input id="f_typeName" maxlength="12" placeholder="类型名称，如：直播"></div>
          <div class="swatches" id="f_typeSwatches"></div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" id="f_typeSave" type="button" style="font-size:12px;padding:6px 12px">保存类型</button>
            <button class="btn btn-ghost" id="f_typeCancel" type="button" style="font-size:12px;padding:6px 12px">取消</button>
          </div>
        </div>
        <input type="hidden" id="f_typeId" value="${selId}" />
      </div>
      <div class="row2">
        <div class="field"><label>触发时间</label><input type="datetime-local" id="f_trig"></div>
        <div class="field"><label>重复</label><select id="f_rep"><option value="无">无</option><option value="每天">每天</option><option value="每周">每周</option><option value="每月">每月</option></select></div>
      </div>
      <div class="field"><label>归属账号</label><select id="f_acct">${acctOpts()}</select></div>
      ${pre?'<div class="field" style="margin-top:2px"><button class="btn btn-ghost" id="f_del" style="color:var(--danger);width:100%">🗑 删除此提醒</button></div>':''}`;
  } else if(type==="topic"){
    html = `<div class="field"><label>选题标题</label><input id="f_title" placeholder="一句话说清这个选题"></div>
      <div class="field"><label>内容 / 脚本 / 备注</label><textarea id="f_body" placeholder="展开写：角度、结构、钩子、素材…"></textarea></div>
      <div class="row2">
        <div class="field"><label>归属账号</label><select id="f_acct">${acctOpts(true)}</select></div>
        <div class="field"><label>状态</label><select id="f_status"><option value="idea">灵感</option><option value="draft">草稿</option><option value="ready">待发</option><option value="published">已发</option></select></div>
      </div>
      <div class="field"><label>标签(逗号分隔)</label><input id="f_tags" placeholder="选题, 情感, 教程"></div>
      <div class="field"><label><input type="checkbox" id="f_pin"> 置顶</label></div>
      ${pre?'<div class="field" style="margin-top:2px"><button class="btn btn-ghost" id="f_del" style="color:var(--danger);width:100%">🗑 删除此选题</button></div>':''}`;
  } else if(type==="metric"){
    html = `<div class="field"><label>归属账号</label><select id="f_acct">${acctOpts()}</select></div>
      <div class="field"><label>日期</label><input type="date" id="f_date"></div>
      <div class="row2">
        <div class="field"><label>粉丝数</label><input type="number" id="f_followers" placeholder="0" min="0"></div>
        <div class="field"><label>阅读/播放</label><input type="number" id="f_views" placeholder="0" min="0"></div>
      </div>
      <div class="row2">
        <div class="field"><label>点赞</label><input type="number" id="f_likes" placeholder="0" min="0"></div>
        <div class="field"><label>评论</label><input type="number" id="f_comments" placeholder="0" min="0"></div>
      </div>
      ${pre?'<div class="field" style="margin-top:2px"><button class="btn btn-ghost" id="f_del" style="color:var(--danger);width:100%">🗑 删除此记录</button></div>':''}`;
  } else if(type==="account"){
    html = `<div class="field"><label>账号名称</label><input id="f_name" placeholder="如：生活研究所"></div>
      <div class="row2">
        <div class="field"><label>平台</label><select id="f_plat">${PLAT.map(p=>`<option>${p}</option>`).join("")}</select></div>
        <div class="field"><label>图标 Emoji</label><input id="f_emoji" placeholder="📕" value="📱"></div>
      </div>
      <div class="row2">
        <div class="field"><label>状态</label><select id="f_st"><option value="active">活跃</option><option value="incub">孵化中</option><option value="sleep">休眠</option></select></div>
        <div class="field"><label>目标</label><input id="f_goal" placeholder="如：粉丝破 5w"></div>
      </div>`;
  }
  $("#mBody").innerHTML = html;
  /* 安全回填：各表单字段并不相同（如备忘录没有 #f_title、待办没有 #f_body），
     直接 $("#x").value= 会在字段缺失时抛 TypeError 并中断弹窗打开，故统一走空值保护。 */
  const setV  = (sel, v) => { const el = $(sel); if(el) el.value = v; };
  const setCk = (sel, v) => { const el = $(sel); if(el) el.checked = !!v; };
  if(pre){
    setV("#f_acct", pre.accountId||"");
    if(type==="memo"){ setV("#f_content", pre.content||""); setV("#f_tags", (pre.tags||[]).join(", ")); setCk("#f_pin", pre.pinned); }
    if(type==="todo"){ setV("#f_title", pre.title||""); setV("#f_detail", pre.detail||""); setV("#f_pri", pre.priority||"mid"); setV("#f_due", pre.due ? toLocalInput(new Date(pre.due)) : ""); }
    if(type==="reminder"){ setV("#f_title", pre.title||""); setV("#f_trig", pre.trigger ? toLocalInput(new Date(pre.trigger)) : ""); setV("#f_rep", pre.repeat||"无"); }
    if(type==="topic"){ setV("#f_title", pre.title||""); setV("#f_body", pre.body||""); setV("#f_status", pre.status||"idea"); setV("#f_tags", (pre.tags||[]).join(", ")); setCk("#f_pin", pre.pinned); }
    if(type==="metric"){ setV("#f_date", pre.date||""); setV("#f_followers", pre.followers||0); setV("#f_views", pre.views||0); setV("#f_likes", pre.likes||0); setV("#f_comments", pre.comments||0); }
  } else if(window._scope!=="all" && (type==="memo"||type==="todo"||type==="reminder"||type==="topic"||type==="metric")){
    const sel = $("#f_acct"); if(sel) sel.value = window._scope;
  }
  if(type==="metric" && !pre){ $("#f_date").value = new Date().toISOString().slice(0,10); }
  if(type==="reminder" && calComposeDate){ $("#f_trig").value = toLocalInput(calComposeDate); calComposeDate = null; }
  if(type==="reminder"){ const curTypeId = pre ? (pre.typeId||pre.type||"pub") : (window._f.type && window._f.type!=="all" ? window._f.type : "pub"); initReminderTypeUI(curTypeId); }
  $("#mask").classList.add("show");
}
function acctOpts(allowGeneral){
  let o = allowGeneral ? `<option value="">通用</option>` : "";
  return o + state.accounts.map(a=>`<option value="${a.id}">${a.emoji} ${esc(a.name)}</option>`).join("");
}
function closeModal(){ $("#mask").classList.remove("show"); calComposeDate = null; }

/* 提醒类型选择器：芯片选择已有类型，或新建自定义类型（名称 + 颜色） */
function initReminderTypeUI(selId){
  const PALETTE = ["#38bdf8","#2dd4bf","#a78bfa","#fbbf24","#f87171","#34d399","#f472b6","#fb923c","#94a3b8"];
  const chips = $("#f_typeChips"), sw = $("#f_typeSwatches"), newBox = $("#f_typeNew"), selInput = $("#f_typeId");
  if(!chips) return;
  const drawChips = (sel)=>{
    chips.innerHTML = (state.reminderTypes||[]).map(t=>`<span class="type-chip ${t.id===sel?'active':''}" data-tid="${t.id}" style="--tc:${t.color}"><i style="background:${t.color}"></i>${esc(t.name)}</span>`).join("");
    if(selInput) selInput.value = sel;
  };
  drawChips(selId);
  chips.querySelectorAll(".type-chip").forEach(c=> c.onclick = ()=> drawChips(c.dataset.tid));
  $("#f_typeAdd").onclick = ()=>{
    newBox.style.display = "block"; $("#f_typeName").value = ""; $("#f_typeName").focus();
    sw.innerHTML = PALETTE.map((c,i)=>`<span class="swatch ${i===0?'active':''}" data-c="${c}" style="background:${c}"></span>`).join("");
    sw.querySelectorAll(".swatch").forEach(s=> s.onclick = ()=>{ sw.querySelectorAll(".swatch").forEach(x=>x.classList.remove("active")); s.classList.add("active"); });
  };
  $("#f_typeCancel").onclick = ()=>{ newBox.style.display = "none"; };
  $("#f_typeSave").onclick = ()=>{
    const name = ($("#f_typeName").value||"").trim();
    const active = sw.querySelector(".swatch.active");
    const color = active ? active.dataset.c : PALETTE[0];
    if(!name){ toast("请填写类型名称"); return; }
    const id = "t_"+uid();
    state.reminderTypes = (state.reminderTypes||[]).concat({id, name, color});
    save();
    newBox.style.display = "none";
    drawChips(id);
    toast("已新增类型：" + name);
  };
}

/* ---------------- 个人资料编辑（昵称 + 头像裁剪预览） ---------------- */
function cropToDataURL(img, scale){
  scale = scale || 1;
  const size = 256, canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#141414"; ctx.fillRect(0,0,size,size);
  // 居中以最短边取正方形；scale>1 表示放大(取更小区域)，实现缩放裁剪
  const side = Math.min(img.width, img.height);
  const sw = side / scale, sh = side / scale;
  const sx = (img.width - sw)/2, sy = (img.height - sh)/2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.9);
}
function drawAvPreview(){
  const box = $("#avPreview"), txt = $("#avPreviewText");
  if(avSrcImg){
    const zv = $("#avZoom");
    const scale = zv ? (parseFloat(zv.value) || 1) : 1;
    avPending = cropToDataURL(avSrcImg, scale);
    box.style.backgroundImage = `url(${avPending})`;
    box.style.backgroundSize = "cover"; box.style.backgroundPosition = "center";
    txt.style.display = "none";
  } else if(avPending){
    box.style.backgroundImage = `url(${avPending})`;
    box.style.backgroundSize = "cover"; box.style.backgroundPosition = "center";
    txt.style.display = "none";
  } else {
    box.style.backgroundImage = ""; txt.style.display = "";
    txt.textContent = "运";
  }
}
function openProfileModal(){
  editType = "profile"; editing = null;
  $("#mTitle").textContent = "编辑个人资料";
  const p = state.profile || {name:"", avatar:""};
  $("#mBody").innerHTML = `
    <div class="field"><label>头像</label>
      <div class="avatar-edit">
        <div class="av-preview" id="avPreview"><span id="avPreviewText">运</span></div>
        <div class="av-actions">
          <button class="btn btn-ghost" id="avPick" type="button">📁 选择图片</button>
          <button class="btn btn-ghost" id="avRemove" type="button" style="color:var(--danger)">移除头像</button>
          <input type="file" id="avFile" accept="image/*" hidden />
        </div>
      </div>
      <div class="av-zoom" id="avZoomWrap" style="display:none">
        <label>缩放裁剪</label>
        <input type="range" id="avZoom" min="1" max="3" step="0.01" value="1" />
      </div>
      <div class="hint">支持 JPG / PNG / WebP / GIF，自动裁成正方形。</div>
    </div>
    <div class="field"><label>昵称</label>
      <input id="f_nick" maxlength="12" placeholder="运营工作台" value="${esc(p.name||"")}" />
      <div class="hint"><span id="nickCount">${(p.name||"").length}</span>/12 字</div>
    </div>`;
  $("#f_nick").addEventListener("input", ()=>{ $("#nickCount").textContent = $("#f_nick").value.length; });
  avSrcImg = null; avPending = p.avatar || "";
  drawAvPreview();
  $("#avPick").onclick = ()=> $("#avFile").click();
  $("#avRemove").onclick = ()=>{ avSrcImg = null; avPending = ""; $("#avZoomWrap").style.display = "none"; drawAvPreview(); };
  $("#avFile").onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{ avSrcImg = img; $("#avZoom").value = 1; $("#avZoomWrap").style.display = "block"; drawAvPreview(); };
      img.onerror = ()=> toast("图片读取失败，请换一张");
      img.src = r.result;
    };
    r.onerror = ()=> toast("文件读取失败");
    r.readAsDataURL(f); e.target.value = "";
  };
  $("#avZoom").oninput = ()=> drawAvPreview();
  $("#mask").classList.add("show");
}
$("#mClose").onclick = closeModal; $("#mCancel").onclick = closeModal;
$("#mask").addEventListener("click", e=>{ if(e.target===$("#mask")) closeModal(); });
$("#newBtn").onclick = () => {
  const v = curView();
  if(v==="report"){ renderReport(); toast("已刷新周/月报"); return; }
  if(v==="calendar"){
    // 新建日历事项 = 新建一条提醒（发布 / 复盘 / 自定义），默认日期为选中日或今天
    const base = calSel ? new Date(calSel.y, calSel.m, calSel.d, 9, 0) : new Date();
    calComposeDate = base;
    if(!calSel){ calSel = {y:base.getFullYear(), m:base.getMonth(), d:base.getDate()}; renderCalendar(); renderDayDetail(calSel.y, calSel.m, calSel.d); }
    openModal("reminder");
    return;
  }
  openModal(v==="dash" ? "account" : (v==="analytics" ? "metric" : (v==="topics" ? "topic" : v)));
};
$("#mSave").onclick = () => {
  const t = editType;
  if(t==="profile"){
    const name = ($("#f_nick").value || "").trim().slice(0,12) || "运营工作台";
    state.profile = { name, avatar: avPending || "" };
    save(); renderBrand(); closeModal();
    toast("已更新个人资料");
    return;
  }
  if(t==="memo"){
    const data = {accountId:$("#f_acct").value, content:$("#f_content").value, tags:($("#f_tags").value||"").split(",").map(s=>s.trim()).filter(Boolean), pinned:$("#f_pin").checked};
    if(editing){ const tg = state.memos.find(x=>x.id===editing.id); if(tg) Object.assign(tg, data); else state.memos.push(Object.assign({id:uid(), createdAt:Date.now()}, data)); }
    else state.memos.push(Object.assign({id:uid(), createdAt:Date.now()}, data));
  }
  else if(t==="todo"){
    const data = {accountId:$("#f_acct").value, title:$("#f_title").value, detail:$("#f_detail").value, priority:$("#f_pri").value, status: editing ? (editing.status||"todo") : "todo", due:dt($("#f_due").value)};
    if(editing){ const tg = state.todos.find(x=>x.id===editing.id); if(tg) Object.assign(tg, data); else state.todos.push(Object.assign({id:uid()}, data)); }
    else state.todos.push(Object.assign({id:uid()}, data));
  }
  else if(t==="reminder"){
    const data = {accountId:$("#f_acct").value, typeId:$("#f_typeId").value||"cus", type:$("#f_typeId").value||"cus", title:$("#f_title").value, trigger:dt($("#f_trig").value), repeat:$("#f_rep").value};
    if(editing){ const tg = state.reminders.find(x=>x.id===editing.id); if(tg){ data.done = tg.done; Object.assign(tg, data); } else state.reminders.push(Object.assign({id:uid(), done:false}, data)); }
    else state.reminders.push(Object.assign({id:uid(), done:false}, data));
  }
  else if(t==="account") state.accounts.push({id:uid(),platform:$("#f_plat").value,name:$("#f_name").value,emoji:$("#f_emoji").value||"📱",status:$("#f_st").value,goal:$("#f_goal").value});
  else if(t==="topic"){
    const wasPublished = editing && editing.status==="published";   // 转 published 之前是否已是已发
    const data = {accountId:$("#f_acct").value, title:$("#f_title").value, body:$("#f_body").value, tags:($("#f_tags").value||"").split(",").map(s=>s.trim()).filter(Boolean), status:$("#f_status").value, pinned:$("#f_pin").checked};
    if(data.status==="published" && !wasPublished) data.publishedAt = Date.now();
    if(editing){ Object.assign(editing, data); }
    else state.topics.push(Object.assign({id:uid(), createdAt:Date.now()}, data));
  }
  else if(t==="metric"){
    const data = {
      accountId:$("#f_acct").value,
      date:$("#f_date").value || new Date().toISOString().slice(0,10),
      followers:parseInt($("#f_followers").value,10)||0,
      views:parseInt($("#f_views").value,10)||0,
      likes:parseInt($("#f_likes").value,10)||0,
      comments:parseInt($("#f_comments").value,10)||0,
    };
    if(editing){ Object.assign(editing, data); }
    else state.metrics.push(Object.assign({id:uid()}, data));
  }
  save(); closeModal();
  renderBrand();
  renderAcctPanel(); renderScopeUI(); renderDash(); renderMemo(); renderTodo(); renderRem(); renderCalendar(); renderTopics(); renderAnalytics(); renderReport();
  if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d);
};
function dt(v){ if(!v) return Date.now(); const d = new Date(v); return isNaN(d) ? Date.now() : d.getTime(); }
function curView(){ const v = [...document.querySelectorAll(".view")].find(x=>x.classList.contains("active")); return v ? v.id.replace("view-","") : "dash"; }

/* ---------------- 备份按钮 ---------------- */
$("#exportBtn").addEventListener("click", exportJSON);
$("#importBtn").addEventListener("click", ()=>$("#importFile").click());
$("#importFile").addEventListener("change", e=>{ const f = e.target.files[0]; if(f) importJSON(f); e.target.value=""; });
$("#repCopy").addEventListener("click", ()=>{
  if(navigator.clipboard && window._reportMd) navigator.clipboard.writeText(window._reportMd).then(()=>toast("已复制到剪贴板")).catch(()=>toast("复制失败，请手动选择"));
  else toast("暂无可复制内容");
});
$("#repDownload").addEventListener("click", ()=>{
  if(!window._reportMd) return;
  const blob = new Blob([window._reportMd], {type:"text/markdown;charset=utf-8"});
  const a = document.createElement("a"); const d = new Date(), p = n=>String(n).padStart(2,"0");
  a.href = URL.createObjectURL(blob);
  a.download = `ops-${window._rr==="week"?"week":"month"}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.md`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  toast("已下载 Markdown 文件");
});

/* ---------------- 设置 / 搜索 / 看板增强 按钮接线 ---------------- */
$("#settingsBtn").onclick = openSettings;
$("#settingsClose").onclick = ()=> $("#settingsMask").classList.remove("show");
$("#settingsCancel").onclick = ()=> $("#settingsMask").classList.remove("show");
$("#settingsMask").addEventListener("click", e=>{ if(e.target===$("#settingsMask")) $("#settingsMask").classList.remove("show"); });
$("#searchBtn").onclick = openSearch;
$("#searchClose").onclick = ()=> $("#searchMask").classList.remove("show");
$("#searchMask").addEventListener("click", e=>{ if(e.target===$("#searchMask")) $("#searchMask").classList.remove("show"); });
$("#searchInput").addEventListener("input", e=> runSearch(e.target.value));
$("#metricTpl").onclick = downloadMetricTemplate;
$("#metricCsv").onclick = ()=> $("#metricFile").click();
$("#metricFile").addEventListener("change", e=>{ const f=e.target.files[0]; if(f) importMetricsCSV(f); e.target.value=""; });
$("#chartPng").onclick = exportChartPNG;
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ $("#settingsMask").classList.remove("show"); $("#searchMask").classList.remove("show"); $("#importMask").classList.remove("show"); } });
$("#importChoiceClose").onclick = ()=> $("#importMask").classList.remove("show");
$("#impCancel").onclick = ()=> $("#importMask").classList.remove("show");
$("#importMask").addEventListener("click", e=>{ if(e.target===$("#importMask")) $("#importMask").classList.remove("show"); });
let _pendingImport = null;
window.showImportChoice = m => { _pendingImport = m; $("#importMask").classList.add("show"); };
$("#impMerge").onclick = ()=>{
  if(!_pendingImport) return;
  const n = mergeIntoState(_pendingImport);
  commitImport();
  $("#importMask").classList.remove("show");
  toast(n ? `已合并 ${n} 条新内容` : "没有可合并的新内容（本机已包含）");
};
$("#impOverwrite").onclick = ()=>{
  if(!_pendingImport) return;
  state = _pendingImport;
  commitImport();
  $("#importMask").classList.remove("show");
  toast("已用备份覆盖本机全部数据");
};

/* ---------------- 主动浏览器提醒（Notification） ---------------- */
const NOTIF_KEY = "ops-notified-v1";
function getNotified(){ try{ return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}; }catch(e){ return {}; } }
function setNotified(o){ try{ localStorage.setItem(NOTIF_KEY, JSON.stringify(o)); }catch(e){} }
function nextOccurrence(ts, repeat){
  const d = new Date(ts);
  if(repeat==="每天") d.setDate(d.getDate()+1);
  else if(repeat==="每周") d.setDate(d.getDate()+7);
  else if(repeat==="每月") d.setMonth(d.getMonth()+1);
  else return ts;
  return d.getTime();
}
function notifyReminder(r){
  const a = acct(r.accountId);
  const title = "🔔 " + (r.title||"提醒");
  const body = (a?a.emoji+" "+a.name+" · ":"") + (remTypeOf(r).name||"提醒");
  let usedSys = false;
  try{ if("Notification" in window && Notification.permission==="granted"){ new Notification(title, {body}); usedSys = true; } }catch(e){}
  if(!usedSys && window.toast) window.toast(title + "  " + body);
}
function checkReminders(){
  if(!state.reminders) return;
  const now = Date.now();
  const notified = getNotified();
  let changed = false, fired = 0;
  state.reminders.forEach(r=>{
    if(r.done || r.trigger > now) return;
    const occ = "r:"+r.id+":"+r.trigger;
    if(notified[occ]) return;
    notifyReminder(r);
    notified[occ] = now; fired++;
    if(r.repeat && r.repeat!=="无"){
      let t = r.trigger;
      while(t <= now) t = nextOccurrence(t, r.repeat);   // 推进到下一个未来触发点，避免逾期后重复轰炸
      r.trigger = t; changed = true;
    }
  });
  if(fired){
    setNotified(notified);
    if(changed){ save(); renderRem(); renderCalendar(); if(calSel) renderDayDetail(calSel.y, calSel.m, calSel.d); renderDash(); }
    updateReminderBadge();
  }
}
function updateReminderBadge(){
  const up = state.reminders.filter(r=>!r.done && r.trigger - Date.now() < 7*86400000 && r.trigger - Date.now() > -86400000).length;
  document.querySelectorAll(".nav-item[data-view='reminder'], .bi[data-view='reminder']").forEach(el=>{
    let b = el.querySelector(".soon");
    if(up>0){ if(!b){ b=document.createElement("span"); b.className="soon"; el.appendChild(b); } b.textContent = up; }
    else if(b){ b.remove(); }
  });
}
function startNotifier(){
  if(window.__notifierStarted) return;
  window.__notifierStarted = true;
  checkReminders();
  setInterval(checkReminders, 60000);
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) checkReminders(); });
}
function maybeStartNotifier(){
  if(state.settings && state.settings.notify && "Notification" in window && Notification.permission==="granted") startNotifier();
}
function requestNotifyPermission(announce){
  if(!("Notification" in window)){ if(announce) toast("当前环境不支持系统通知"); return; }
  if(Notification.permission==="granted"){ if(announce) toast("通知已授权"); return; }
  Notification.requestPermission().then(perm=>{
    if(perm==="granted"){ state.settings.notify = true; save(); startNotifier(); if(announce) toast("已授权，到点会弹通知"); }
    else if(announce) toast("未授权，将仅在应用内提示");
    const cb = $("#setNotify"); if(cb) cb.checked = (perm==="granted");
  });
}

/* ---------------- 设置中心 ---------------- */
function openSettings(){
  const p = ("Notification" in window) ? Notification.permission : "unsupported";
  const permTxt = p==="unsupported" ? "当前环境不支持系统通知"
    : p==="granted" ? "已授权 ✅" : p==="denied" ? "已被浏览器拒绝（需在站点设置中开启）" : "未授权";
  $("#settingsBody").innerHTML = `
    <div class="set-sec">
      <div class="set-t">提醒通知</div>
      <div class="set-d">提醒到点时弹出系统通知（需授权）。状态：${permTxt}</div>
      <div class="set-row" style="margin-top:8px">
        <span class="set-l">启用通知</span>
        <label class="switch"><input type="checkbox" id="setNotify" ${state.settings.notify?"checked":""}><span class="slider"></span></label>
      </div>
      <button class="btn btn-ghost" id="setReqPerm" style="font-size:12px;padding:6px 10px;margin-top:10px">申请通知权限</button>
    </div>
    <div class="set-sec">
      <div class="set-t">云端同步</div>
      <div class="set-d">启用后数据通过同步后端在多设备间共享（需可达的后端地址）。当前：${SYNC.enabled?"已启用":"未启用"}</div>
      <div class="set-row" style="margin-top:10px">
        <span class="set-l">启用同步</span>
        <label class="switch"><input type="checkbox" id="setSync" ${SYNC.enabled?"checked":""}><span class="slider"></span></label>
      </div>
      <input class="search wide" id="setSyncUrl" value="${esc(SYNC.url)}" placeholder="https://your-backend/api" style="margin-top:10px" />
      <div class="set-d" style="margin-top:6px">保存后点击「测试连接」验证可达性。手机/电脑共用一份数据需后端公网可达。</div>
      <button class="btn btn-ghost" id="setSyncTest" style="font-size:12px;padding:6px 10px;margin-top:8px">测试连接</button>
    </div>
    <div class="set-sec">
      <div class="set-t">数据</div>
      <div class="set-row" style="margin-top:8px;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="setExport">⬇ 导出备份</button>
        <button class="btn btn-ghost" id="setImport">⬆ 导入备份</button>
        <button class="btn btn-ghost" id="setClear" style="color:var(--danger)">🗑 清空数据</button>
      </div>
    </div>
    <div class="set-sec">
      <div class="set-t">关于</div>
      <div class="set-d" id="appVersionLine" style="line-height:1.7"></div>
      <div class="set-d" style="margin-top:6px;color:var(--muted)">若「运行中缓存」仍显示旧版本，请冷启动 App：杀掉 PWA 进程 → 重新从主屏图标打开；必要时长按主屏图标「删除」后重新「添加到主屏幕」。</div>
    </div>`;
  $("#settingsMask").classList.add("show");
  // 填充版本信息：代码版本 + 当前生效的 Service Worker 缓存版本
  (async ()=>{
    let swVer = "（不支持 / 未启用）";
    try {
      if (navigator.serviceWorker && "caches" in window) {
        const names = await caches.keys();
        const hit = names.find(n => /^ops-v\d+$/.test(n));
        if (hit) swVer = hit;
        else if (navigator.serviceWorker.controller) swVer = "（已注册，缓存未命名）";
      }
    } catch(e) { swVer = "（读取失败）"; }
    const el = $("#appVersionLine");
    if (el) el.innerHTML = `程序版本：<b style="color:var(--text)">${APP_VERSION}</b><br>运行中缓存：<b style="color:var(--text)">${swVer}</b>`;
  })();
  $("#setNotify").onchange = e=>{
    state.settings.notify = e.target.checked; save();
    if(state.settings.notify) requestNotifyPermission();
    maybeStartNotifier();
  };
  $("#setReqPerm").onclick = ()=> requestNotifyPermission(true);
  $("#setSync").onchange = async e=>{
    SYNC.enabled = e.target.checked;
    saveSyncCfg({enabled:SYNC.enabled, url:SYNC.url});
    if(SYNC.enabled){ const ok = await apiPing(); if(ok) await pullState(); }
    openSettings();   // 刷新状态文字
  };
  $("#setSyncUrl").onchange = e=>{ SYNC.url = e.target.value.trim()||"/api"; saveSyncCfg({enabled:SYNC.enabled, url:SYNC.url}); if(SYNC.enabled) apiPing(); };
  $("#setSyncTest").onclick = async ()=>{ const ok = await apiPing(); toast(ok?"✅ 后端可达":"❌ 无法连接后端"); };
  $("#setExport").onclick = ()=> exportJSON();
  $("#setImport").onclick = ()=> $("#importFile").click();
  $("#setClear").onclick = ()=>{
    if(confirm("确定清空全部数据？此操作不可撤销，建议先导出备份。")){
      localStorage.removeItem(KEY); localStorage.removeItem(SYNC_CFG_KEY); location.reload();
    }
  };
}

/* ---------------- 全局搜索 ---------------- */
function typeIcon(t){ return {memo:"📝",todo:"✅",reminder:"🔔",topic:"💡",account:"👤"}[t]||"•"; }
function typeLabel(t){ return {memo:"备忘录",todo:"待办",reminder:"提醒",topic:"选题",account:"账号"}[t]||t; }
function openSearch(){
  $("#searchInput").value = "";
  $("#searchResults").innerHTML = `<div class="empty" style="border:none;padding:30px">输入关键词，跨备忘录 / 待办 / 提醒 / 选题搜索</div>`;
  $("#searchCount").textContent = "";
  $("#searchMask").classList.add("show");
  setTimeout(()=>{ try{ $("#searchInput").focus(); }catch(e){} }, 50);
}
function runSearch(q){
  q = (q||"").trim().toLowerCase();
  if(!q){ $("#searchResults").innerHTML = ""; $("#searchCount").textContent=""; return; }
  const res = [];
  const push = (type, view, id, title, sub)=> res.push({type, view, id, title:title||"(无标题)", sub:sub||"", icon:typeIcon(type)});
  state.memos.forEach(m=>{ if((m.content||"").toLowerCase().includes(q) || (m.tags||[]).join(" ").toLowerCase().includes(q)) push("memo","memo",m.id,m.content,(m.tags||[]).join(" ")); });
  state.todos.forEach(t=>{ if((t.title||"").toLowerCase().includes(q) || (t.detail||"").toLowerCase().includes(q)) push("todo","todo",t.id,t.title,t.detail); });
  state.reminders.forEach(r=>{ if((r.title||"").toLowerCase().includes(q) || remTypeOf(r).name.toLowerCase().includes(q)) push("reminder","reminder",r.id,r.title,remTypeOf(r).name); });
  state.topics.forEach(t=>{ if((t.title||"").toLowerCase().includes(q) || (t.body||"").toLowerCase().includes(q)) push("topic","topics",t.id,t.title,t.body); });
  state.accounts.forEach(a=>{ if(a.name.toLowerCase().includes(q) || a.platform.toLowerCase().includes(q)) push("account","dash",a.id,a.name,a.platform); });
  res.sort((a,b)=>a.title.localeCompare(b.title));
  $("#searchCount").textContent = `命中 ${res.length} 条`;
  if(!res.length){ $("#searchResults").innerHTML = `<div class="empty" style="border:none;padding:24px">没有匹配「${esc(q)}」的内容</div>`; return; }
  $("#searchResults").innerHTML = res.map((r,i)=>`<div class="sres" data-i="${i}">
    <span class="sicon">${r.icon}</span>
    <div class="smain"><div class="st">${esc(r.title).slice(0,60)}</div><div class="ss">${typeLabel(r.type)} · ${esc(r.sub).slice(0,40)}</div></div>
  </div>`).join("");
  $("#searchResults").querySelectorAll(".sres").forEach(el=>{
    el.onclick = ()=>{
      const r = res[+el.dataset.i];
      $("#searchMask").classList.remove("show");
      go(r.view);
      if(r.type==="account"){ setScope(r.id); }
      else { setTimeout(()=> openModal(r.type, r.id), 140); }
    };
  });
}

/* ---------------- 数据看板增强：导出 / CSV 导入 ---------------- */
function exportChartPNG(){
  const svg = document.querySelector("#chartWrap svg");
  if(!svg){ toast("暂无图表可导出"); return; }
  const xml = new XMLSerializer().serializeToString(svg);
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const W = +svg.viewBox.baseVal.width || 680, H = +svg.viewBox.baseVal.height || 240;
  const img = new Image();
  img.onload = ()=>{
    const c = document.createElement("canvas"); c.width=W; c.height=H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0c0c0c"; ctx.fillRect(0,0,W,H);
    ctx.drawImage(img,0,0);
    c.toBlob(blob=>{
      const a=document.createElement("a"); a.download="ops-chart.png"; a.href=URL.createObjectURL(blob); a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      toast("已导出趋势图 PNG");
    });
  };
  img.onerror = ()=> toast("导出失败，请重试");
  img.src = src;
}
function downloadMetricTemplate(){
  const csv = "account,date,followers,views,likes,comments\n生活研究所,2026-07-30,44800,152000,10200,530\n";
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.download="ops-metrics-template.csv"; a.href=URL.createObjectURL(blob); a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("已下载 CSV 模板（account 列填账号名称）");
}
function importMetricsCSV(file){
  const r = new FileReader();
  r.onload = ()=>{
    const text = r.result;
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2){ toast("CSV 无有效数据行"); return; }
    const header = lines[0].split(",").map(s=>s.trim().toLowerCase());
    const iAcc=header.indexOf("account"), iDate=header.indexOf("date"),
          iF=header.indexOf("followers"), iV=header.indexOf("views"),
          iL=header.indexOf("likes"), iC=header.indexOf("comments");
    if(iAcc<0||iDate<0||iF<0||iV<0||iL<0||iC<0){ toast("表头需含 account,date,followers,views,likes,comments"); return; }
    let n=0;
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(",");
      const name = (cols[iAcc]||"").trim();
      const acc = state.accounts.find(a=> a.name===name || a.id===name);
      if(!acc) continue;
      const num = v => parseInt(v,10)||0;
      state.metrics.push({id:uid(), accountId:acc.id, date:(cols[iDate]||"").trim(),
        followers:num(cols[iF]), views:num(cols[iV]), likes:num(cols[iL]), comments:num(cols[iC])});
      n++;
    }
    save(); renderAnalytics();
    toast(n ? `已导入 ${n} 条指标（跳过 ${lines.length-1-n} 条无匹配账号）` : "未匹配到任何账号，请检查 account 列");
  };
  r.readAsText(file);
}

/* ---------------- 账号健康分（多账号面板） ---------------- */
function computeHealth(a, at){
  const total = at.length;
  const done = at.filter(t=>t.status==="done").length;
  const overdue = at.filter(t=>t.status!=="done" && t.due<Date.now()).length;
  const near = at.filter(t=>{ const x=t.due-Date.now(); return t.status!=="done" && x>0 && x<3*86400000; }).length;
  let score = 70;
  if(total) score += Math.round(done/total*20);
  score -= overdue*12 + near*4;
  return Math.max(0, Math.min(100, score));
}

/* ---------------- PWA 注册（仅经 http(s) 访问时） ---------------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(err=>console.warn("SW 注册失败：", err));
  });
}

/* ---------------- 初始化（先与后端同步，再渲染） ---------------- */
(async function init(){
  // 仅当同步已启用时才 ping 后端；默认（本地模式 / 纯静态部署）不发起网络请求，避免无后端时的 /api/ping 404
  if(SYNC.enabled){
    const ok = await apiPing();
    if(ok){ await pullState(); if(window.updateSyncPill) window.updateSyncPill("ok"); }
    else if(window.updateSyncPill) window.updateSyncPill("local");
  } else {
    if(window.updateSyncPill) window.updateSyncPill("local");
  }
  renderAcctPanel(); renderScopeUI(); renderBrand(); renderDash(); renderMemo(); renderTodo(); renderRem(); renderTopics(); renderAnalytics(); renderReport();
  updateReminderBadge();
  maybeStartNotifier();
  setInterval(() => { if(SYNC.enabled) pullState(); }, 15000);
})();
