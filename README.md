# GeoPlan — 新能源充电设施规划与决策支持平台

基于 WebGIS 的充电基础设施空间分析与选址决策系统，面向江苏省徐州市，整合 367 座充电站与 388 个住宅小区的空间数据。

## 技术栈

- **前端**：React 19 + TypeScript + OpenLayers 10 + ECharts 6 + Tailwind CSS 4
- **后端**：Express + MySQL 8.0（空间扩展）+ Turf.js
- **AI**：DeepSeek API（通过 Google GenAI SDK 调用）
- **构建**：Vite 6 + esbuild

## 快速启动

```bash
npm install                          # 安装依赖
npx tsx scripts/init-db.ts           # 初始化数据库
npx tsx scripts/import-data.ts       # 导入真实数据（可选）
npm run dev                          # 启动开发服务器 http://localhost:3000
```

需要创建 `.env` 文件配置数据库连接、高德 API Key 和 DeepSeek API Key。详见 [项目阅读文档](./geoplan-docs/geoplan-docs.html)。

## 演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 投资商 | 投资商_王总 | 123456 |
| 车主 | 车主_张先生 | 123456 |

## 核心功能

- **地图展示与查询** — 充电站、社区、反馈点的多图层可视化与详情查询
- **充电覆盖分析** — 服务区缓冲区建模、盲区识别、盲区聚类推荐
- **商业选址决策** — 虚拟站点放置、四维指标评估、方案管理与对比
- **AI 辅助决策** — 自然语言 GIS 查询、空间分析联动、流式回复
- **系统管理** — 用户管理、反馈审核、充电站 CRUD、操作日志

## 文档

完整的项目阅读文档（架构、数据库设计、API 参考、核心算法、状态管理）请打开 [geoplan-docs.html](./geoplan-docs/geoplan-docs.html)。

## 目录结构

```
src/           前端源码（App.tsx 主组件）
scripts/       数据脚本（init-db / import-data / fetch-poi）
data/          数据文件（CSV / GeoJSON）
server.ts      后端服务（Express + Turf.js）
database.sql   数据库 DDL
```
