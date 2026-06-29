# Checklist

## 后端 GIS 意图解析与空间分析
- [x] `parseGisIntent` 函数存在且能识别"附近 Nkm"、"半径 N 公里"、"覆盖分析"、"铜山区有多少站"等模式
- [x] `doGisAnalysis` 函数使用 turf.circle 做缓冲区，用 turf.booleanPointInPolygon 或 turf.pointsWithinPolygon 做叠置筛选
- [x] `doGisAnalysis` 返回的站点按距离由近到远排序，每个站点带 distanceKm 属性
- [x] `/api/v1/ai/chat` 在 SSE 流中先发送结构化 gis_result 事件
- [x] gis_result 包含 type、radius、center、count、coveredPopulation、coveredCommunities、stations[] 等完整信息
- [x] enrichedContext 中告知 AI 站点列表已卡片化展示，AI 只需总结建议

## 前端 AI 回复渲染升级
- [x] AI 消息类型包含 gisResult 可选字段（AiGisResult 接口）
- [x] SSE 解析能识别 gisResult 事件并更新消息状态
- [x] GIS 分析结论卡片展示：充电站数、覆盖人口、覆盖社区
- [x] 可点击站点列表：每个站点显示名称、距离、品牌、快慢充数
- [x] 点击站点名调用 flyToStationById 飞图 + 弹详情
- [x] "在地图上查看"按钮调用 visualizeGisAnalysis 画缓冲区 + 飞图
- [x] gisBufferSourceRef 管理缓冲区图层，虚线绿色边框样式

## 集成与测试
- [x] 问"附近 5km 充电站"能得到正确的缓冲区分析结果（站点按距离排序）
- [x] AI 回复中站点列表是结构化数据渲染，不依赖 AI 文本格式
- [x] 点击站点名称可跳转到地图对应位置并弹出详情
- [x] "在地图上查看"按钮可绘制缓冲区圆并飞图
- [x] `npm run lint` TypeScript 检查通过
