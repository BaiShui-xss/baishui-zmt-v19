---
name: baishui-zmt-v19
description: 从零复现「新媒体运营工作台」稳定版 v19 的已验证工程工作流。This skill should be used when the user wants to rebuild/reproduce the multi-account new-media operations PWA at its verified v19 state, follow the exact v1→v19 build sequence, understand module development order, or recall key technical decisions (neutral-dark visual spec, localStorage-first data layer, optional Node+SQLite sync, CloudStudio fixed HTTPS deploy, iOS date-input fix). 触发词示例：「复现运营台」「重建新媒体工作台」「按 v19 重做」「运营台工作流」「新媒体工作台怎么搭」。
version: 1.0.0
agent_created: true
license: MIT
display_name: "新媒体运营工作台 v19 复现"
display_name_en: "New-Media Ops Workbench v19 Repro"
---

# 新媒体运营工作台 · v19 复现 Workflow

## 0. 这是什么 / 何时用

本 skill 把「新媒体运营工作台」从 **第一步原型** 到 **稳定版 v19** 的全部开发过程，提炼成一条**已验证、去踩坑**的最直接路径。后续只要照此顺序执行，即可从零复现 v19 的全部功能。

适用于以下场景：
- 从空白目录重建整个工作台，要求结果等价于已交付的 v19。
- 理解模块开发顺序、各版本里程碑的关键决策。
- 在另一台机器 / 新会话里继续维护或扩展该工作台。

> 完整可运行的字节级源码已归档在 `references/v19-source/`（与本项目 v19 完全一致）。最快的「从零复现」方式见第 11 节：直接复制该目录，再按本 skill 核对关键决策即可，无需重新手写代码。

**核心约束（贯穿全程，不可偏离）**
1. **视觉规范：中性深灰、不要蓝调**。背景纯黑 `#000`，面板层级 `#0c0c0c / #141414 / #1d1d1d`；品牌强调色仅作功能性高亮（激活态 / 进度条 / 状态点），不用于面板底色。
2. **数据 localStorage 优先**：所有数据默认存浏览器 localStorage，可选接 Node+SQLite 后端做多设备同步；跨设备默认用手动「导出/导入 JSON」。
3. **纯前端单页、零构建**：原生 HTML/CSS/JS，无打包器、无框架。

---

## 1. 技术栈与环境配置

| 项 | 选型 | 说明 |
|---|---|---|
| 前端 | 原生 HTML + CSS + JS | 零依赖、零构建，直接静态托管即可运行 |
| 数据层 | `localStorage`（键 `ops-workbench-v2`） | 本地优先；`migrate()` 兜底缺字段 |
| 后端（可选） | Node 22 + `node:sqlite` | 启动需 `node --experimental-sqlite server.js`；零外部 npm 依赖 |
| 图标 | Python3 标准库脚本 `gen_icons.py` | 纯 stdlib 生成 PNG，无需 Pillow |
| PWA | `manifest.webmanifest` + `sw.js`（cache-first） | 可「添加到主屏幕」、离线可用 |
| 部署（定案） | CloudStudio 固定公网 HTTPS 静态托管 | 手机/电脑同一地址，长期不变，证书正规 |
| 验证 | `node --check` / DOM id 交叉 / `curl` / Playwright | 见第 9 节 |

**环境准备（一次性）**
- 确认 Node ≥ 22.5（支持 `node:sqlite`）；Python3 自带。
- 若需自签证书（仅本地 Mac 后端用，非部署必需）：
  ```bash
  # 在 certs/ 下生成 key.pem + cert.pem（有效期 825 天，SAN 含 localhost/127.0.0.1/内网IP）
  openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem \
    -days 825 -subj "/CN=运营台本地服务" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.83"
  ```

---

## 2. 项目初始化（文件结构 + 职责）

新建项目根目录，按以下结构落地（与 `references/v19-source/` 一致）：

```
项目根/
  index.html               入口页面（DOM 骨架 + 顶栏/侧栏/底栏/弹窗容器）
  assets/css/style.css     样式（中性深灰层级 + 响应式 + 弹窗布局 + iOS 日期修复）
  assets/js/store.js       数据层：state / migrate() / 持久化 / 同步 / 导入导出
  assets/js/app.js         UI 层：渲染 / 导航 / 弹窗 / 折叠 / 搜索 / 设置 / PWA 注册
  manifest.webmanifest     PWA 清单（安装到手机用）
  sw.js                    Service Worker（离线缓存外壳，CACHE 版本化）
  serve.js                 零依赖本地静态服务器（纯本地模式）
  server.js                可选同步后端（Node+SQLite，双端口 HTTPS+HTTP）
  gen_icons.py             图标生成脚本（stdlib），产出 assets/icons/icon-*.png
  open.html                手机扫码直达引导页（指向固定公网地址）
  prototype.html           设计原型（参考，非正式入口）
  docs/                    CHANGELOG、开发日志、使用说明（参考）
```

**各文件职责要点**
- `store.js`：定义 `KEY="ops-workbench-v2"`，导出全局 `state`、`migrate()`、`persist()`、`save()`、`exportJSON()`、`importJSON()`、`mergeIntoState()`，以及同步后端逻辑（`SYNC`、`apiPing/pullState/pushState`）。**所有 UI 改动必须经 `save()`（=persist + 可选 push）落盘。**
- `app.js`：每条路由一个 `renderXxx()`；模态框统一用 `#mask` 容器 + `openModal(type,id)`；`APP_VERSION` 常量须与 `sw.js` 的 `CACHE` 同步 bump。
- `sw.js`：`CACHE` 常量版本化（当前 `ops-v19`），`ASSETS` 列表带 `?v=19`；改前端资源后必须 bump 此版本号，手机才会拉到新版。

---

## 3. 已验证开发工作流（按真实跑通顺序，已剔除踩坑）

> 以下步骤即「最快且正确」的路径。每一步都给出目标、产出、关键技术决策、验收标准。调试/返工/被废弃的方案不在此列。

### 步骤 1 · 原型与视觉定调
- **目标**：先定视觉与模块划分，避免后期返工。
- **产出**：`prototype.html`（用中性深灰验证布局）。
- **关键决策**：
  - 面板配色以 `#808080` 灰为基准的深灰层级（背景纯黑，面板 `#0c0c0c/#141414/#1d1d1d`），去除蓝调。
  - 模块划分 = **核心 4 件**（备忘录 / 待办 / 提醒 / 多账号面板）+ **Phase 3 扩展 4 件**（发布日历 / 选题素材库 / 数据看板 / 周月报）。
- **验收**：原型视觉被确认「中性深灰、有高级感、无蓝调」。

### 步骤 2 · Phase 1 MVP（核心 4 模块）
- **目标**：落地可运行单页应用骨架 + 核心 4 模块。
- **产出**：`index.html` + `assets/css/style.css` + `assets/js/store.js` + `assets/js/app.js` + `manifest.webmanifest` + `sw.js` + `gen_icons.py`。
- **关键决策**：
  - `store.js`：`state` 初始含 `accounts/memos/todos/reminders` + `reminderTypes/profile/settings`；`migrate()` 对缺失集合补默认（防渲染崩溃）；`KEY="ops-workbench-v2"`。
  - `index.html` DOM 骨架：左侧 `.sidebar`（账号面板 + 模块导航）、`.main`（顶栏 + `.content` 各 `section.view`）、底部 `.botnav`（移动端）、统一 `#mask` 弹窗容器。
  - 侧栏可折叠（`.collapse-btn`），支持「全部账号 / 单账号」视图（`window._scope`）。
  - 引入 `manifest.webmanifest` + `sw.js`（cache-first），支持「添加到主屏幕」。
  - `gen_icons.py` 用纯 stdlib 生成 `assets/icons/icon-192.png` / `icon-512.png`（深灰圆角方块 + 白色面板描边 + 天蓝状态点）。
- **验收**：核心 4 模块可增删改、数据刷新后仍在；JSON 备份/导入可用；桌面+手机基本可用；可装 PWA。

### 步骤 3 · Phase 2 同步后端（可选，默认关）
- **目标**：提供多设备同步能力，但**默认关闭**，用户手动开启。
- **产出**：`server.js`（替代/补充 `serve.js`）。
- **关键决策**：
  - 用 `node:sqlite` 零依赖实现；数据存 `data/ops.db`（`kv` 表，键 `state` + `updatedAt`）。
  - 服务**双端口**：HTTPS `:5173`（手机 PWA，自签证书）+ HTTP `:5174`（Mac 本机/内置预览，零证书摩擦）；`certs/` 存在 `key.pem+cert.pem` 才启用 HTTPS，否则回退 HTTP。
  - API：`GET /api/ping`、`GET|POST /api/state`（last-write-wins，以 `updatedAt` 为准；`pullState` 仅当远端 `updatedAt > 本地 lastSync` 才覆盖）。
  - 设置中心 `SYNC` 开关 + 后端地址；`init` 中**仅当 `SYNC.enabled` 为真时才 `apiPing()`**（避免静态部署产生 404）。
- **验收**：开启同步并填后端地址后，多端数据实时一致；关闭时纯本地正常运行。

### 步骤 4 · Phase 3 扩展 4 模块
- **目标**：补齐 4 个分析/内容模块，复用既有数据与渲染模式。
- **产出**：`app.js` 新增 `renderCalendar/renderTopics/renderAnalytics/renderReport` 等；`store.js` 新增 `state.topics` / `state.metrics` 与 `load()` 迁移。
- **关键决策（数据模型）**：
  - **选题素材库** `state.topics`：`{id, accountId, title, body, tags:[], status, pinned, createdAt}`；`status ∈ idea(灵感,灰)/draft(草稿,蓝)/ready(待发,琥珀)/published(已发,绿)`；支持搜索、状态过滤 chips、点击编辑/删除；`load()` 加迁移补空数组防崩溃。
  - **数据看板** `state.metrics`：`{id, accountId, date:'YYYY-MM-DD', followers, views, likes, comments}`（整数）；纯 SVG 多线趋势图（按账号分色、按日期对齐 x 轴）+ 指标切换 chips（粉丝/阅读播放/点赞/评论）+ 账号对比卡（最新值 + 环比 delta，涨绿跌红）；近 6 天示例数据 seed 以展示趋势。
  - **发布日历**：按日期聚合 todos/reminders/topics，单日详情 + 新建入口（从日历视图「新建」预填选中日 09:00）；图例按自定义提醒类型动态显示。
  - **周/月报**：按本周(周一~今)/本月(1号~今)聚合完成待办、计划发布、已发布、新增选题、新增备忘，生成 Markdown 预览，支持复制 / 下载 `.md`。
- **验收**：4 模块均渲染正常；多账号面板 mini 区显示各账号选题数；看板 SVG 在窄屏可读。

### 步骤 5 · PWA 缓存机制 + 部署收敛
- **目标**：让前端更新可靠到达手机，并锁定统一访问地址。
- **关键决策**：
  - `sw.js` 确立 cache-first + `CACHE="ops-vNN"` 常量 + 资源 `?v=N` 版本化；**任何前端改动须同步 bump `CACHE` 与 `?v=N` 与 `app.js` 的 `APP_VERSION`**。
  - 部署定案为 **CloudStudio 固定公网 HTTPS**（纯静态托管，脱离 Node 后端也能完整运行）；废弃「局域网 IP+自签证书」「Pinggy 动态隧道（60 分钟变地址）」等易变方案。
  - 配套 `open.html` + 二维码引导页（指向固定地址），避免手机手动输入出错。
- **验收**：部署后全资源 200；手机「添加到主屏幕」后离线可加载；地址长期不变。

### 步骤 6 · 验收与移动端打磨（v15 → v19）
- **目标**：用真机视口自动化验收，修复移动端体验，最终在真实 iOS Safari 验证通过。
- **关键决策**：
  - 建立《验收交接清单》（桌面 + 手机各走一遍，含移动端专项），用 Playwright（iPhone 13 视口 390×844）跑 **86 项断言** 作为回归基线。
  - v16：修编辑弹窗空值崩溃（`setV/setCk` 空值保护）、待办勾选状态（`done↔todo`）、弹窗超高关闭按钮挤出视口（`.modal` 加 `max-height:calc(100dvh-40px)` + flex 纵向 + body 滚动）、看板轴标签字号、启动 404、favicon；新增移动端「👤 个人资料」入口（侧栏 ≤860px 隐藏后替代）。
  - v18：新增「设置 → 关于」展示「程序版本 + 运行中 Service Worker 缓存版本」，便于确认是否更新到最新。
  - v17→v19：**iOS Safari 日期输入框固有最小宽度** 专项——最终生效方案见第 6 节「iOS 日期框修复」。
- **验收**：86/86 PASS、0 FAIL；真实手机浏览器下日期框与同级栏对齐。

---

## 4. 版本里程碑 v1 → v19（关键决策表）

| 版本 | 阶段 | 关键新增 / 决策 | 关键技术点 |
|---|---|---|---|
| v1.0.0 | Phase 1 MVP | 四件套骨架 + 核心 4 模块 + JSON 备份/导入 + 基础 PWA | `index.html`/`style.css`/`store.js`/`app.js`；`KEY=ops-workbench-v2`；`migrate()` |
| v1.1.0 | 视觉/侧栏 | 中性深灰配色定稿 + 可折叠账号切换面板 | 面板层级 `#0c0c0c/#141414/#1d1d1d`；`_scope` 单/全账号 |
| v2.0.0 | Phase 2 后端 | Node+SQLite 同步后端 + 双端口 + 设置中心 SYNC | `server.js`；`node:sqlite`；HTTPS:5173+HTTP:5174 |
| v2.1.0 | 后端部署 | 真实终端注册 plist；iOS HTTPS-Only 双端口固化；证书 SAN 含多地址 | 规避沙箱拦截 `launchctl`；自签证书信任流程 |
| v3.0.0 | Phase 3 | 扩展 4 模块：发布日历 / 选题库 / 数据看板 / 周月报 | `state.topics`/`state.metrics` + 各 `renderXxx` |
| v3.1.0 | 扩展打磨 | 选题状态机 + 看板 SVG 多线图 + 报告范围聚合 + `load()` 迁移 + 示例数据 | `status` idea/draft/ready/published；SVG 按账号分色 |
| v4.0.0 | PWA 缓存 | `sw.js` cache-first + `CACHE` 版本化（`ops-vNN`）+ `?v=N` | 改前端必 bump CACHE |
| v4.1.0 | 部署收敛 | 定案 CloudStudio 固定公网部署，废弃局域网IP/Pinggy | 手机电脑同一地址、长期不变 |
| v4.2.0 | 移动优化 | `open.html`+二维码引导页；顶栏竖排修复；mini 选题数等 | 顶栏 ≤860px 垂直堆叠 |
| v15.0.0 | 验收基线 | Playwright 真机视口 86 项断言 | 验收清单 + 移动端专项 |
| v16.0.0 | 首轮修复 | 移动端个人资料入口；修 3 P0 + 4 P1 | 空值保护/勾选状态/弹窗布局/favicon |
| v17.0.0 | 日期第一轮 | 日期框 `min-width:0;max-width:100%` + `.row2` `minmax(0,1fr)` | 本地验证通过，真机仍溢出 |
| v18.0.0 | 版本标识 | 「设置→关于」显示程序版本 + 缓存版本 | `APP_VERSION` 与 `CACHE` 同步 |
| v19.0.0 | 真机修复 | 真实 iOS Safari 日期框修复（最终稳定版） | `-webkit-appearance:none` + `overflow-x:hidden` |

---

## 5. 核心模块数据模型与关键函数

### store.js（数据层）
```js
const KEY = "ops-workbench-v2";
// state 集合：accounts, memos, todos, reminders, topics, metrics, reminderTypes, profile, settings
// migrate(s): 缺任何数组补 []；reminderTypes 缺省 3 标准类型；profile/settings 补默认
// load(): JSON.parse(localStorage) → migrate()；失败/无则 seed()
// persist(): 写 localStorage； save(): persist() + (SYNC.enabled ? pushState())
// 同步：SYNC={enabled,url:'/api',lastSync}; apiPing/pullState/pushState（last-write-wins）
// 导入：importJSON → showImportChoice(merge/overwrite)；mergeIntoState 按 id 去重、不删本机
```

**数据模型（务必一致）**
- `memo`: `{id, accountId, content, tags:[], pinned, createdAt}`
- `todo`: `{id, accountId, title, detail, priority:'high|mid|low', status:'todo|doing|done', due}`
- `reminder`: `{id, accountId, type, typeId, title, trigger, repeat:'无|每天|每周|每月', done}`
- `reminderType`: `{id, name, color}`（默认 pub/review/cus）
- `topic`: `{id, accountId, title, body, tags:[], status:'idea|draft|ready|published', pinned, createdAt, publishedAt?}`
- `metric`: `{id, accountId, date:'YYYY-MM-DD', followers, views, likes, comments}`
- `profile`: `{name, avatar}`（avatar 为 dataURL 或空）
- `settings`: `{notify:boolean}`

### app.js（UI 层）关键渲染函数
`renderBrand / renderAcctPanel / setScope / renderDash / renderMemo / renderTodo / renderRem / renderCalendar / renderDayDetail / renderTopics / renderAnalytics / renderSvgChart / renderReport / go / renderEverywhere / openModal / openProfileModal / openSettings / openSearch / exportChartPNG / importMetricsCSV / computeHealth`

**必守**：`openModal` 字段回填一律用空值保护（`setV`/`setCk`），避免 `Cannot set properties of null`；待办勾选用 `done↔todo` 状态分支。

---

## 6. 视觉规范 + iOS 日期框修复（精确决策）

### CSS 变量（中性深灰，无蓝调）
```css
--bg:#000000; --bg-grad:径向中性灰光晕(rgba(128,128,128,.07/.05));
--panel:#0c0c0c; --panel-2:#141414; --panel-3:#1d1d1d;
--border:#333333;  /* 可见灰描边 */  --border-soft:#222222;
--text:#f2f2f2;  --muted:#9a9a9a;  --muted-2:#6b6b6b;
--accent:#38bdf8; --accent-2:#2dd4bf;  /* 仅功能性高亮（激活/进度/状态点） */
```
背景光晕/网格一律用 `rgba(128,128,128,…)` 中性灰，去除任何蓝/青环境色。

### 移动端顶栏
`@media(max-width:860px)` 下 `.topbar` 改为垂直堆叠（标题在上、按钮在下换行），避免标题被按钮挤成单字竖排。

### iOS Safari 日期框修复（v17→v19，最终生效方案）
**根因**：Apple 官方 iOS Safari 对 `type=datetime-local|date` 保留「固有最小宽度不吃 `min-width:0`」的老 quirk；开源 Chromium/WebKit 已修复，故本地无法复现，只能靠真机闭环。

**最终修复（仅移动端 `@media(max-width:860px)` 生效，避免桌面端日期选择器退化）**：
```css
/* 移动端：日期/时间输入退化为可收缩普通输入框，点按仍弹原生选择器 */
.modal input[type="datetime-local"], .modal input[type="date"] {
  -webkit-appearance: none; appearance: none;
}
/* 兜底任何残余横向溢出 */
.modal .mb { overflow-x: hidden; }
.modal .mb .field { max-width: 100%; }
/* 所有弹窗内 input/select/textarea 统一收缩 */
.modal input, .modal select, .modal textarea { min-width: 0; max-width: 100%; }
/* 双列网格允许收缩到内容以下 */
.row2 { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
```
> 注意：v17 的 `min-width:0;max-width:100%` 对真机不足，必须叠加上 `-webkit-appearance:none` 才彻底解决。

---

## 7. 同步后端（可选）配置

- 启动：`node --experimental-sqlite server.js [端口]`，默认 5173。
- 有 `certs/key.pem+cert.pem` → 自动 HTTPS:5173 + HTTP:5174；否则纯 HTTP:5173。
- `SYNC` 默认关闭；用户在「设置 → 云端同步」填后端地址并开启；前端逻辑：apiPing / pullState（15s 轮询）/ pushState。
- CloudStudio 当前为纯静态托管、不跑 Node，故跨设备共用一份数据需另部署后端并填入设置（用户暂选手动 JSON 迁移，未自动化）。

---

## 8. 部署拓扑（最终定案）

- **主方案**：CloudStudio 固定公网 HTTPS 静态托管，`workbuddy_cloudstudio_deploy` 同目录原地更新；手机/电脑同一地址、长期不变、证书正规。
- 已停用的旧方案（勿回退）：局域网 IP+自签证书、Pinggy 动态隧道（60 分钟变地址）。
- 本地 Mac 后端（`launchd` 托管，http :5174 / https :5173）仅作桌面兜底与同局域网同步，非必需。
- `open.html` 与二维码指向固定地址，避免手机手动输入错误。

---

## 9. 自验证 Workflow（无浏览器环境）

改完前端后，按顺序自验（守住质量门）：
1. `node --check assets/js/app.js && node --check assets/js/store.js` —— 过 JS 语法。
2. DOM id 交叉比对：用 Node 脚本比对 `app.js` 引用的 `$("#id")`/`getElementById` 是否都存在于 `index.html`（排除运行时动态注入的 `f_*/av*/set*`，这些是 `openModal` 内动态生成的）。抓白屏根因。
3. `workbuddy_cloudstudio_deploy` 同目录原地更新。
4. `curl --noproxy localhost,127.0.0.1 http://localhost:5173/... ` 逐项断言首页/JS/CSS/sw.js 全 200 且关键代码字符串命中（本机有 HTTP_PROXY 须 `--noproxy`）。
5. **资源改动必 bump `sw.js` 的 `CACHE`**（如 `ops-v19`→`ops-v20`）与 `index.html`/`app.js` 的 `?v=N`、`app.js` 的 `APP_VERSION`，手机才会拉到新版。
6. 移动端专项：用 Playwright（iPhone 13, 390×844）跑 86 项断言；或依赖真实手机反馈闭环（iOS 日期 quirk 本地不可复现）。

---

## 10. v19 完整功能清单（验收口径）

**通用 / 部署**
- 固定公网地址返回 200，标题「新媒体运营工作台」；导航切换无空白视图。
- 数据自动保存（刷新仍在）；同浏览器多标签页即时同步（`storage` 事件）。
- 视觉规范达标（中性深灰、无蓝调）；导出/导入 JSON 智能合并（保留本机、仅补新内容）。

**8 大模块**
1. **多账号面板**：账号矩阵、健康分、待办完成度进度条；点侧栏账号→仅显该账号；点「全部账号」→合并。
2. **备忘录**：卡片二次编辑/删除、标签、置顶；全局搜索可命中。
3. **待办**：优先级/状态筛选、完成勾选、截止日 over/soon 警示、点击编辑。
4. **提醒**：类型自定义（名称+颜色）、过滤 chips 动态生成、点击编辑；通知授权后到点弹系统通知；日历/底栏角标。
5. **发布日历**：月历渲染、点日期出当日详情、◀▶切月、今日高亮；从日历「新建」预填选中日 09:00；图例按自定义类型动态显示。
6. **选题素材库**：搜索、状态过滤、点击编辑/删除、置顶优先；多账号面板显各账号选题数。
7. **数据看板**：SVG 多线趋势图（按账号分色）、指标切换 chips（粉丝/阅读播放/点赞/评论）、账号对比卡（最新值+环比+百分比）、录入增删改；CSV 模板下载、CSV 批量导入、导出趋势图 PNG。
8. **周/月报**：本周/本月切换、Markdown 预览、复制、下载 `.md`。

**全局能力**
- 全局搜索 🔍 跨模块检索，结果点击跳转并打开编辑。
- 设置中心 ⚙：提醒通知开关+权限；云端同步开关+后端地址+测试连接（默认关）；导出/导入/清空。
- 个人资料：点左上角品牌区改昵称（≤12 字）/ 上传裁剪头像（含缩放滑杆）。
- 导入智能合并：弹窗「合并 / 覆盖 / 取消」。

**移动端（逐项点测）**
- 各模块弹窗不出界、可滚动、无横向滚动条；日期输入框与同级栏对齐（v19 修复）。
- 顶栏标题不竖排；datetime/date 选择器文字左对齐、点击区 ≥44px；底栏 botnav 可横滑。
- 「添加到主屏幕」后 PWA 离线（断网）仍可加载；通知权限申请可授权。
- 「设置 → 关于」显示「程序版本 + 运行中缓存」，可核对是否更新到最新。

---

## 11. 从零复现最短路径（操作清单）

**方式 A · 直接复用字节级归档（最快、最准）**
1. 复制 `references/v19-source/` 整目录到新项目根。
2. 用 `node --check` 过 `assets/js/*.js`。
3. 本地预览：`node serve.js 5173`（或 `python3 -m http.server 5173`），浏览器开 `http://localhost:5173`。
4. 如需手机：走 CloudStudio 固定公网部署（`workbuddy_cloudstudio_deploy`），并确认 `sw.js` 的 `CACHE` 与资源 `?v=N` 一致。
5. 按第 10 节清单逐项验收。

**方式 B · 按工作流从零手写**
1. 第 1 节搭环境；第 2 节建文件结构与各文件职责。
2. 第 3 节步骤 1→6 顺序实现；每步对照第 4 节里程碑决策与第 5/6 节数据模型/视觉规范。
3. 关键不可省：中性深灰视觉、localStorage 优先 + `migrate()`、`sw.js` 版本化、iOS 日期框 `-webkit-appearance:none` 修复、`openModal` 空值保护、待办 `done↔todo`。
4. 第 9 节自验 → 第 10 节验收 → 部署。

> 复现后任何前端改动，牢记「三处版本同步」：`sw.js` 的 `CACHE` + `index.html`/`app.js` 的 `?v=N` + `app.js` 的 `APP_VERSION`。


---

# 产品描述与使用说明（对外文档 · 与附件完全一致，禁止删改）

> 以下内容来自用户提供的两份附件，作为本 skill 的「描述（使用说明）」原样录入，未做编辑或删减。

# 新媒体运营工作台 · 开发日志（对外版）

> 本文面向用户与协作者，**仅记录功能演进与可用性改进**，不含内部实现细节与运维踩坑。完整版（含技术决策与问题排查过程）见 `开发日志-对内版.md` / `开发日志.md`。

---

## 一、产品目标

一款面向新媒体运营的 **PWA（可安装到手机、可离线）** 单页工作台，把账号管理、灵感记录、任务跟踪、内容选题、数据复盘、周期报告整合到一处。数据默认存浏览器本地，可选开启多设备同步。

核心设计原则：中性深灰视觉（无蓝调）、纯前端可静态部署、移动端与桌面端一致的操作逻辑。

---

## 二、功能演进时间线

### 原型与视觉定调
- 先用设计原型验证「中性深灰无蓝调」界面，确定面板配色层级与模块划分。

### Phase 1 · MVP（核心 4 模块）
- 备忘录、待办事项、提醒事项、多账号面板。
- JSON 备份/导入、基础响应式（手机/电脑）、PWA「添加到主屏幕」。

### Phase 2 · 同步后端
- 支持 Node + SQLite 同步后端，可在设置中开启多设备共享。

### Phase 3 · 扩展 4 模块
- **发布日历**：按日期聚合待办/提醒/选题，单日详情。
- **选题素材库**：选题全生命周期管理（灵感→草稿→待发→已发）。
- **数据看板**：多账号数据趋势图与对比卡。
- **周/月报**：自动聚合工作产出，一键复制/下载 Markdown。

### 部署与统一访问
- 采用固定公网 HTTPS 地址，手机/电脑同一入口，长期不变。

### 验收与移动端打磨（v15 → v19）
- 用真机视口自动化验收，修复编辑弹窗、待办勾选、弹窗布局等问题。
- 重点解决移动端日期输入框的宽度对齐，最终在真实手机浏览器上验证通过。

---

## 三、版本变更记录（功能视角）

### v1.0.0 — Phase 1 MVP
- **新增**：备忘录、待办、提醒、多账号面板；JSON 备份/导入；基础响应式与 PWA 安装。

### v1.1.0 — 视觉与侧栏
- **改进**：面板配色改为中性深灰；新增可折叠账号切换面板。

### v2.0.0 — 同步后端
- **新增**：Node + SQLite 同步后端（可选开启）；双端口服务与设置中心同步开关。

### v3.0.0 / v3.1.0 — 扩展 4 模块
- **新增**：发布日历、选题素材库、数据看板、周/月报。
- **改进**：选题状态机与过滤、看板 SVG 趋势图与指标切换、报告范围聚合。

### v4.0.0 — PWA 缓存机制
- **改进**：资源版本化（`ops-vNN`），前端更新后手机自动拉到新版。

### v4.1.0 / v4.2.0 — 统一访问与移动优化
- **改进**：固定公网部署，替代易变地址；新增扫码直达引导页；移动端顶栏与布局打磨。

### v15.0.0 — 验收基线
- **新增**：真机视口自动化验收（86 项断言）。
- **改进**：验收清单新增移动端专项与记录。

### v16.0.0 — 首轮修复
- **新增**：移动端个人资料入口。
- **修复**：编辑弹窗崩溃、待办勾选无变化、弹窗关闭按钮点不到、看板图表窄屏字号过小、启动报错与图标 404。

### v17.0.0 / v18.0.0 — 日期框与版本标识
- **改进**：日期输入框响应式宽度（第一轮）。
- **新增**：「设置 → 关于」显示程序版本与缓存版本，便于确认是否更新到最新。

### v19.0.0（当前稳定版）
- **修复**：真实手机浏览器下日期输入框超宽、与同级栏不对齐的问题。
- **改进**：弹窗加横向溢出兜底，移动端输入框与桌面端体验一致。

---

## 四、当前状态

- **稳定版本**：`ops-v19`
- **访问地址**：`https://b5053b29b4f74f0293cbae7a057ab833.sh4.agentos-app.net`
- 8 个模块全部可用，移动端（iOS/Android）弹窗、日期输入、底部导航均正常。

# 新媒体运营工作台 · 使用说明（图文版）

## 1. 产品概述

**新媒体运营工作台**是一款面向新媒体运营场景的 PWA（Progressive Web App），把日常运营工作整合到同一个页面：

- 多账号面板：一览所有账号的待办、选题、健康分、发布状态；
- 备忘录 / 待办 / 提醒：记录灵感、管理任务、设置到点通知；
- 日历视图：按日期查看所有待发布/待办/提醒；
- 选题素材库：管理灵感、草稿、待发、已发内容；
- 数据看板：录入并查看多账号粉丝/阅读/点赞/评论趋势；
- 周/月报：自动聚合本周/本月工作产出，一键复制或下载 Markdown。

数据默认保存在浏览器 `localStorage` 中，可离线使用；也支持通过设置里的「云端同步」接入后端实现多设备共享。

---

## 2. 界面总览

打开应用后，桌面端呈现左中右三栏布局：左侧导航与账号切换、顶部工具栏、右侧主内容区。

![多账号面板](screenshots/01-dash.png)

- **A. 左侧边栏**：品牌区、账号切换面板、功能模块入口、底部同步状态胶囊。
- **B. 顶部工具栏**：当前页面标题、账号范围选择、备份/导入/搜索/设置/新建按钮。
- **C. 主内容区**：根据当前模块展示对应数据卡片或列表。

> 在手机端，左侧边栏会隐藏，取而代之的是底部 8 个模块图标，操作逻辑与桌面端一致。

---

## 3. 各模块界面说明

### 3.1 多账号面板

默认首页，展示全部账号的运营卡片：待办完成度、今日发布、选题数、健康分。

![多账号面板](screenshots/01-dash.png)

- 点击账号名称可切换到该账号的单独视图；
- 点击卡片内的「今日发布 / 选题」可快速跳转对应模块。

### 3.2 备忘录

用于记录碎片化灵感、会议记录、素材片段，支持标签与置顶。

![备忘录](screenshots/02-memo.png)

- 卡片按时间倒序排列；
- 搜索框可按正文 / 标签检索；
- 点击卡片进入编辑，支持删除。

### 3.3 待办事项

管理日常任务，支持优先级、截止日期、归属账号。

![待办事项](screenshots/03-todo.png)

- 左侧复选框可快速标记完成；
- 逾期日期会显示为红色；
- 顶部 chips 可按状态筛选。

### 3.4 提醒事项

设置一次性或周期性提醒，到点弹出系统通知。

![提醒事项](screenshots/04-reminder.png)

- 类型颜色可自定义；
- 支持「每天 / 每周 / 每月」重复；
- 需要浏览器通知权限（首次可在设置中申请）。

### 3.5 日历

按月展示所有带日期的事项：待办、提醒、选题发布。

![日历](screenshots/05-calendar.png)

- 点击日期进入单日详情；
- 日期上的小色块代表不同类型的事件；
- 可直接在日历上选择日期新建提醒。

### 3.6 选题素材库

管理内容选题全生命周期：灵感 → 草稿 → 待发 → 已发。

![选题素材库](screenshots/06-topics.png)

- 状态用颜色区分（灰 / 蓝 / 琥珀 / 绿）；
- 支持标签、置顶、搜索；
- 点击卡片编辑正文与标签。

### 3.7 数据看板

手动录入每日数据，查看趋势与账号对比。

![数据看板](screenshots/07-analytics.png)

- 切换指标 chips：粉丝 / 阅读播放 / 点赞 / 评论；
- SVG 多线趋势图展示最近录入；
- 对比卡显示最新值与上次变化（涨红跌绿）。

### 3.8 周/月报

自动聚合本周或本月工作产出。

![周/月报](screenshots/08-report.png)

- 切换「本周 / 本月」范围；
- 一键复制 Markdown 文本；
- 可下载 `.md` 文件交付给团队或上级。

---

## 4. 核心操作步骤

### 4.1 切换功能模块

点击左侧边栏的菜单项即可切换主内容区。手机端则点击底部导航。

![切换模块](screenshots/step-nav.png)

> 当前激活的模块会有高亮底色。

### 4.2 新建一条待办

1. 进入「待办事项」模块；
2. 点击右上角 **「+ 新建」** 按钮；
3. 填写标题、详情、优先级、归属账号和截止日期；
4. 点击「保存」。

![点击新建](screenshots/step-newbtn.png)

新建弹窗中的日期/时间输入框已针对 iOS Safari 优化，宽度与同级栏保持一致。

![日期框对齐](screenshots/step-todo-date.png)

### 4.3 账号范围筛选

在任意模块顶部工具栏点击 **「全部账号」** 胶囊，可切换为单个账号视图。筛选后各模块只显示该账号的数据。

![多账号面板](screenshots/01-dash.png)

### 4.4 编辑与删除

- 点击任意卡片即可打开编辑弹窗；
- 弹窗底部有「取消」和「保存」按钮；
- 编辑已有项时，底部会出现「🗑 删除」按钮。

### 4.5 全局搜索

点击顶部工具栏的 **🔍** 按钮，输入关键词即可跨模块搜索。

![全局搜索](screenshots/12-search.png)

- 覆盖备忘录、待办、提醒、选题、账号；
- 点击搜索结果会跳转到对应模块并打开编辑。

### 4.6 备份与导入

点击顶部工具栏的 **⬇ 备份** / **⬆ 导入**，即可导出全部数据为 JSON，或从 JSON 恢复。

### 4.7 设置中心

点击顶部工具栏的 **⚙** 按钮打开设置。

![设置中心](screenshots/09-settings.png)

可配置：
- 提醒通知权限；
- 云端同步开关与后端地址；
- 数据备份、导入、清空；
- **关于**：查看当前程序版本与运行中 Service Worker 缓存版本。

### 4.8 个人资料

点击顶部工具栏的 **👤** 按钮（桌面端也可点击左上角品牌区），可修改昵称和头像。

![个人资料](screenshots/10-profile.png)

- 昵称会显示在左上角品牌区；
- 头像支持图片 URL 或留空显示首字。

---

## 5. 常见问题解答

### Q1：手机和电脑的数据为什么不互通？

默认数据保存在各自浏览器的 `localStorage` 中。如需多设备共享，需要在「设置 → 云端同步」中启用并填写一个可达的同步后端地址，或手动通过「备份 / 导入」JSON 迁移数据。

### Q2：我更新了 App，但手机端还是旧版怎么办？

PWA 由 Service Worker 缓存外壳资源。如果「设置 → 关于」里的「运行中缓存」仍是旧版本号，请：

1. 从后台彻底划掉 App；
2. 重新从主屏图标打开；
3. 必要时长按主屏图标「删除」后，重新从 Safari「添加到主屏幕」。

### Q3：为什么离线后打不开？

首次在线访问后，Service Worker 会把 App 外壳缓存到本地。之后离线应能打开。如果离线无法打开，请确认你之前至少在线打开过一次，且浏览器没有清除站点数据。

### Q4：提醒到点不弹通知？

需要在系统/浏览器中授予通知权限。可在「设置」中点击「申请通知权限」。iOS PWA 的通知行为受系统控制，建议保持 App 在后台。

### Q5：日期输入框在手机上显示异常？

当前稳定版已针对 iOS Safari 优化。请确保「设置 → 关于」里的「运行中缓存」为最新版本号（如 `ops-v19`），并按 Q2 的方法冷启动 App。

---

## 6. 快速索引

| 想做什么 | 操作路径 |
|----------|----------|
| 查看所有账号状态 | 多账号面板（默认首页） |
| 写备忘录 / 素材 | 备忘录 → 新建 |
| 添加任务并设截止日 | 待办事项 → 新建 → 填截止日期 |
| 设置到点提醒 | 提醒事项 → 新建 → 触发时间 |
| 按月查看发布计划 | 日历 |
| 管理选题状态 | 选题素材库 |
| 录入/查看数据趋势 | 数据看板 |
| 生成本周/本月报告 | 周/月报 |
| 换头像/昵称 | 个人资料 |
| 开启多设备同步 | 设置 → 云端同步 |
