# baishui-zmt-v19 · 新媒体运营工作台 v19 复现 Skill

WorkBuddy 用户级技能：从零复现「新媒体运营工作台」稳定版 v19 的已验证工程工作流。

## 包含
- `SKILL.md`：去踩坑后的最直接路径（原型 → Phase1 MVP → Phase2 同步后端 → Phase3 扩展 4 模块 → PWA 缓存/部署收敛 → v15–v19 验收打磨）、v1→v19 版本里程碑关键决策、核心数据模型、中性深灰视觉规范、iOS Safari 日期框修复、自验证与部署流程、v19 完整功能清单、从零复现操作清单。
- `references/v19-source/`：字节级归档（= 线上 v19 验证源码），已 `node --check` 通过、版本一致（`sw.js` CACHE = `app.js` APP_VERSION = `ops-v19`）。**最快复现方式：直接复制该目录即可等价于 v19。**

## 使用方法
1. 将整个 `baishui-zmt-v19` 目录放入 WorkBuddy 用户级技能目录：`~/.workbuddy/skills/`
2. 新建对话说「按 baishui-zmt-v19 复现运营台」即可唤起该技能。

## 许可
MIT
