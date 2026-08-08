# Changelog · 新媒体运营工作台

所有版本号与 `sw.js` 的 `CACHE` 常量（`ops-vNN`）及资源 `?v=N` 一致。

## [v19.0.0] - 2026-07-31（当前稳定版）
### Changed
- 移动端（`@media(max-width:860px)`）给日期/时间输入加 `-webkit-appearance:none;appearance:none`
- `.modal .mb` 加 `overflow-x:hidden` 兜底
- `.modal .mb .field` 加 `max-width:100%`
### Fixed
- 真实 iOS Safari 下日期输入框固有最小宽度导致超屏、与同级栏不对齐（真机确认解决）

## [v18.0.0] - 2026-07-31
### Added
- 「设置 → 关于」展示程序版本 + 运行中 Service Worker 缓存版本，附冷启动/重装提示

## [v17.0.0] - 2026-07-31
### Changed
- 日期/时间输入加 `width:100%;min-width:0;max-width:100%`
- `.row2` 改 `minmax(0,1fr) minmax(0,1fr)`
- 弹窗内 `input/select/textarea` 统一 `min-width:0;max-width:100%`

## [v16.0.0] - 2026-07-30
### Added
- 移动端顶栏「👤 个人资料」入口
### Changed
- `openModal` 字段回填加 `setV/setCk` 空值保护
- 待办勾选状态改 `done↔todo`
- `.modal` 加 `max-height:calc(100dvh-40px)` + flex 纵向布局 + `.mb` 滚动
- 看板 SVG 轴标签 9→13，图表容器横向滚动
- `init` 仅 `SYNC.enabled` 为真时 `apiPing()`
- 补 `<link rel="icon">`
### Fixed
- 编辑弹窗 `Cannot set properties of null` 崩溃
- 待办勾选无视觉变化
- 弹窗关闭按钮被挤出视口点不到
- 看板图表窄屏字号过小
- 启动即 404 `/api/ping`
- favicon 404

## [v15.0.0] - 2026-07-30
### Added
- Playwright 真机视口（iPhone 13, 390×844）自动化验收（86 项断言）
### Changed
- 验收清单新增「第 3 节 移动端专项」「第 6 节 验收记录」

## [v4.2.0] - 移动端专项优化（至 v14 阶段）
### Fixed
- 小屏顶栏标题竖排（改垂直堆叠）
- 多账号面板 mini 区显示各账号选题数等细节
### Added
- `open.html` 引导页 + `assets/qr-phone.png` 二维码扫码直达

## [v4.1.0]
### Changed
- 废弃局域网 IP + 自签证书、Pinggy 动态隧道（60 分钟变地址）；定案 CloudStudio 固定公网部署
### Fixed
- 地址频繁变化导致无法稳定装到主屏

## [v4.0.0]
### Added
- `sw.js` cache-first 策略，`CACHE` 常量（`ops-v4` 起）与 `?v=N` 资源版本化

## [v3.1.0]
### Changed
- 选题 `status` 状态机与过滤（idea/draft/ready/published）
- 看板纯 SVG 多线图（按账号分色、日期对齐）+ 指标切换 chips
- 报告按本周/本月聚合，复用 todos/reminders/topics/memos
- 两处 `load()` 加迁移（缺字段补空数组）
- 看板预置近 6 天示例数据

## [v3.0.0]
### Added
- 发布日历（按日期聚合待办/提醒/选题，单日详情）
- 选题素材库（`state.topics` 全生命周期）
- 数据看板（`state.metrics` + SVG 趋势图 + 对比卡）
- 周/月报（Markdown 聚合 + 复制/下载）

## [v2.1.0]
### Changed
- plist 改为真实终端手动注册（规避沙箱拦截 launchctl）
- iOS HTTPS-Only 双端口方案固化；自签证书 SAN 含多地址
### Fixed
- `launchctl bootstrap` 报 `Bootstrap failed:5`
- iOS「仅限 HTTPS」强制升级导致网址无效

## [v2.0.0]
### Added
- `server.js`：Node + SQLite（node:sqlite 零依赖）同步后端，数据存 `data/ops.db`
- 双端口 HTTPS:5173 + HTTP:5174
- 设置中心 `SYNC` 开关与三套同步逻辑（默认关闭）

## [v1.1.0]
### Changed
- 面板配色由偏蓝改为中性深灰层级（背景纯黑，面板 `#0c0c0c/#141414/#1d1d1d`）
- 新增左侧可折叠账号切换面板（全部账号 / 单账号）

## [v1.0.0]
### Added
- 纯前端单页应用骨架：`index.html` + `style.css` + `store.js` + `app.js`
- 核心 4 模块：备忘录、待办、提醒、多账号面板
- `store.js` 状态 / `migrate()` 兜底 / JSON 导入导出（`KEY=ops-workbench-v2`）
- 基础响应式 + PWA（manifest + sw.js cache-first）
- `gen_icons.py` 图标生成脚本
