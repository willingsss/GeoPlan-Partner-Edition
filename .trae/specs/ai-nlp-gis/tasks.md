# Tasks

## 任务 1：后端 GIS 意图解析与空间分析
- [x] Task 1.1: 新增 `parseGisIntent(message)` 函数，识别"附近 Nkm"、"半径 N 公里"、"覆盖分析"、"铜山区有多少站"等自然语言模式，返回结构化意图
- [x] Task 1.2: 新增 `doGisAnalysis(intent, userLocation, chargingStations, communities)` 函数，执行 turf 缓冲区 + 筛选统计，返回 `{ stations, count, coveredPopulation, coveredCommunities, radius, center }`
- [x] Task 1.3: 改造 `/api/v1/ai/chat` 接口，在发送 DeepSeek 请求前调用 `doGisAnalysis`，将真实分析结果注入 `enrichedContext`，在回复 content 中嵌入 `[station:ID]` 和 `[gis:...]` 标记

## 任务 2：前端 AI 回复渲染升级
- [x] Task 2.1: 改造 `renderAiContent`，识别 `[station:ID]` 格式，将其渲染为可点击的站点链接（样式：带下划线、青绿色）
- [x] Task 2.2: 实现 `flyToStation(id)` 函数，根据站点 id 找到坐标，调用地图飞行接口并弹出充电站详情模态框
- [x] Task 2.3: 改造 `renderAiContent`，识别 `[gis:stations:N:pop:P:comm:C]` 标记，渲染为 GIS 分析结论卡片（带图标、数字、简要说明）
- [x] Task 2.4: 为 GIS 结论卡片添加"在地图上查看"按钮，点击后在地图上绘制缓冲区圆 + 高亮范围内站点

## 任务 3：集成与美化
- [x] Task 3.1: AI 接口的 systemPrompt 更新，加入 GIS 指令格式说明，让 AI 知道如何嵌入标记
- [x] Task 3.2: 测试"附近 5km 充电站"、"3km 覆盖多少小区"等典型问句，验证 GIS 分析和跳转链路
- [x] Task 3.3: 运行 `npm run lint`，TypeScript 检查通过

## 任务 4：修复方案 - 结构化 GIS 数据返回（替代标记方案）
- [x] Task 4.1: 后端 doGisAnalysis 站点按距离排序，增加 distanceKm 属性
- [x] Task 4.2: 后端 SSE 流新增 gis_result 结构化事件（先于 AI 文本发送）
- [x] Task 4.3: 后端优化 enrichedContext，AI 只需做总结建议，不列站点
- [x] Task 4.4: 前端 AI 消息增加 gisResult 字段，SSE 解析 gis_result 事件
- [x] Task 4.5: 前端 GIS 分析卡片 + 可点击站点列表（结构化数据渲染）
- [x] Task 4.6: 前端 visualizeGisAnalysis 画缓冲区圆 + 飞图
- [x] Task 4.7: 简化 renderAiContent，移除 station/gis 标记解析

## Task Dependencies
- Task 1.2 依赖 Task 1.1（意图解析结果）
- Task 1.3 依赖 Task 1.1 和 Task 1.2
- Task 2.1、2.2、2.3 依赖 Task 1.3 的后端标记格式确定
- Task 3.2 依赖 Task 1 和 Task 2 全部完成
- Task 4.1-4.7 为 1-3 的替代方案，基于结构化数据而非 AI 标记
