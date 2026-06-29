# 选址与盲区分析联动及面板美化 Spec

## Why
当前"选址决策"与"覆盖分析（盲区）"两个功能完全割裂：选址决策只评估单点虚拟站点的覆盖人口/竞争避让度，不知道当前区域整体盲区分布；覆盖分析只输出全局盲区，无法把盲区结果反向用于指导选址。用户需要在覆盖分析定位出的盲区中进行选址决策，让两者形成"先找盲区→再在盲区中选址→选址后消除盲区"的工作闭环。同时现有面板字小、留白多、排版松散，视觉体验差。

## What Changes
- **新增**：覆盖分析结果输出**盲区聚类中心**（盲区社区质心聚合），作为推荐选址候选点，前端在地图上以特殊样式标记
- **新增**：盲区分析 Tab 提供"在盲区中心选址"快捷操作——点击某盲区候选点即跳转到选址 Tab，将该点作为虚拟站点放置并自动评估
- **新增**：选址决策 Tab 显示"当前区域盲区概况"卡片（来自最近一次覆盖分析结果），标注虚拟站点是否落入盲区，体现联动
- **新增**：选址评估后端返回 `in_blind_spot` 字段，前端据此在指标卡片高亮"该点消除盲区"
- **改造**：重做两个水平面板的视觉——分区卡片化、字号统一放大、图标着色、指标卡用渐变/色块、控件间距规范，消除空旷感
- **改造**：盲区分析摘要从 4 格扩展为含推荐选址候选点的列表区
- **BREAKING**：`/api/v1/analysis/coverage` 响应新增 `blindSpotClusters` 字段；`/api/v1/analysis/evaluate-site` 响应新增 `in_blind_spot` 字段

## Impact
- Affected specs: 商业选址决策子系统、充电覆盖分析子系统
- Affected code: `server.ts`（两个分析接口增加聚类/盲区判定）、`src/App.tsx`（面板 UI 重写、联动跳转逻辑、新 state）

---

## ADDED Requirements

### Requirement: 盲区聚类推荐选址候选点
覆盖分析 SHALL 将相邻盲区社区聚合为聚类，输出每个聚类的质心作为推荐选址候选点。

#### Scenario: 聚类生成
- **WHEN** 用户执行覆盖分析
- **THEN** 后端对盲区社区按距离（默认阈值 1500m）做聚合
- **AND** 每个聚类输出 `clusterId`、`center: [lng, lat]`（质心）、`communityCount`、`population`（盲区人口总和）
- **AND** 响应 `blindSpotClusters` 字段为数组，按 `population` 降序

#### Scenario: 候选点地图标记
- **WHEN** 覆盖分析完成
- **THEN** 前端在地图上以金色定位针样式标记每个聚类中心
- **AND** 弹窗显示"盲区人口 / 社区数 / 在此选址"按钮

### Requirement: 盲区→选址一键跳转
系统 SHALL 支持从盲区候选点一键进入选址决策并自动放置虚拟站点。

#### Scenario: 跳转选址
- **WHEN** 用户点击某盲区候选点的"在此选址"按钮
- **THEN** `activeTab` 切换为 `site`
- **AND** 以该聚类质心坐标调用 `placeVirtualStation` 放置虚拟站点并触发评估
- **AND** 选址面板的"当前区域盲区概况"卡片显示该聚类信息

### Requirement: 选址面板显示盲区联动
选址决策 SHALL 显示与最近一次覆盖分析的联动信息。

#### Scenario: 虚拟站点落入盲区
- **WHEN** 用户放置的虚拟站点位于最近一次覆盖分析的盲区内
- **THEN** 后端 `evaluate-site` 返回 `in_blind_spot: true` 及该点所属聚类信息
- **AND** 选址面板指标区高亮"该选址将消除盲区"提示
- **AND** 若无覆盖分析历史或不在盲区，则不显示该提示

#### Scenario: 盲区概况卡片
- **WHEN** 选址 Tab 打开且存在最近一次覆盖分析结果
- **THEN** 面板显示"当前区域盲区概况"卡片：覆盖率、剩余盲区社区数、剩余盲区人口
- **AND** 卡片标题含"来自覆盖分析"角标，表明数据来源

### Requirement: 面板视觉美化
两个水平面板 SHALL 采用统一的设计语言，提升可读性与美观度。

#### Scenario: 视觉规范
- **WHEN** 选址 Tab 或覆盖分析 Tab 渲染
- **THEN** 面板采用分区卡片布局（标题栏 + 参数区 + 指标区），卡片间 12px 间距
- **AND** 字号统一：标题 14px font-bold、标签 13px、数值 18px font-bold、说明 11px
- **AND** 指标卡使用浅色渐变背景（如绿/蓝/橙/紫对应不同指标）+ 左侧色条
- **AND** 按钮使用实心圆角 + hover 阴影，快/慢充切换为分段控件样式
- **AND** 输入框/下拉框统一高度 32px、圆角 6px、聚焦边框高亮
- **AND** 消除大面积留白，参数区与指标区紧凑排列

---

## MODIFIED Requirements

### Requirement: 顶部水平分析栏
原有水平栏 SHALL 升级为分区卡片化设计，并承载联动信息。

#### Modified Scenario
- **WHEN** 用户进入选址或覆盖分析 Tab
- **THEN** 水平栏高度自适应内容（约 160–200px），分上下两行
- **AND** 上行为标题栏（图标+功能名+说明）与参数控件区
- **AND** 下行为指标卡片网格 + 联动信息卡（选址 Tab 的盲区概况 / 覆盖分析 Tab 的候选点列表入口）
- **AND** 两个 Tab 独占水平栏，互不干扰，切换 Tab 不丢失各自状态

### Requirement: 覆盖分析响应
`/api/v1/analysis/coverage` SHALL 在原响应基础上增加盲区聚类。

#### Modified Scenario
- **WHEN** 后端完成缓冲区叠置分析
- **THEN** 响应 `data` 增加 `blindSpotClusters`：每项含 `clusterId`、`center`、`communityCount`、`population`
- **AND** 原有 `coverageRate`、`blindSpots`、`blindSpotCommunities`、`blindSpotPopulation`、`totalStations` 保持不变

### Requirement: 选址评估响应
`/api/v1/analysis/evaluate-site` SHALL 返回该点是否落入最近盲区。

#### Modified Scenario
- **WHEN** 后端完成单点评估
- **THEN** 响应 `data` 增加 `in_blind_spot: boolean`
- **AND** 若 `in_blind_spot` 为 true，附带 `blindSpotClusterId`（可选）
- **AND** 判定依据：若请求携带 `coverageBlindSpots`（最近盲区几何数组），则判断虚拟站点缓冲区与任一盲区相交；未携带则 `in_blind_spot: false`

---

## Technical Approach

### 后端（server.ts）
1. `/api/v1/analysis/coverage`：在返回前对 `blindSpots` 按质心两两距离 ≤1500m 聚类（简单贪心聚合），输出 `blindSpotClusters`
2. `/api/v1/analysis/evaluate-site`：从 `req.body` 读 `coverageBlindSpots`（可选，WGS84 Polygon 数组），用 `turf.booleanIntersects` 判断 `bufferPoly` 与任一盲区相交 → `in_blind_spot`

### 前端（src/App.tsx）
1. 新增 state：`blindSpotClusters`（覆盖分析聚类结果）、`lastCoverageSummary`（最近一次覆盖摘要，跨 Tab 保留）
2. `runCoverageAnalysis` 成功后保存 `blindSpotClusters` 与 `lastCoverageSummary`，并在地图渲染候选点图层（复用 `searchSource` 或新增 `clusterSource`）
3. 候选点弹窗"在此选址"按钮：`setActiveTab("site")` + `placeVirtualStation(cluster.center)`
4. `evaluateSite` 请求体携带 `coverageBlindSpots: lastCoverageBlindSpotsRef.current`（WGS84 几何数组）
5. 选址面板读取 `lastCoverageSummary` 渲染盲区概况卡片；读取 `siteMetrics.in_blind_spot` 高亮提示
6. 重写两个面板 JSX：卡片化、字号放大、渐变指标卡、分段控件
