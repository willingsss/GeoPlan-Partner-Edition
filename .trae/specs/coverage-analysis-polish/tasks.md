# Tasks

## 阶段一：后端分析能力完善（P0）

### 任务 1.1：覆盖率分级与人口加权覆盖率
- [x] Task 1.1.1: 修复 `server.ts` line 727 空语句 BUG（删除 `totalPopulation;`）
- [x] Task 1.1.2: 在 `communityResults.push` 前根据 `coveragePercent` 计算 `level` 字段（极差<10% / 较差 10-30% / 一般 30-60% / 良好 60-90% / 优秀≥90%）
- [x] Task 1.1.3: 在 `summary` 中新增 `populationCoverageRate` 字段（`Math.round(totalCoveredPop / totalPopulation * 1000) / 10`）
- [x] Task 1.1.4: 新增 `coverageLevels` 数组，遍历 `communityResults` 按 `level` 分组，输出 `{ level, count, population }`

### 任务 1.2：服务区重叠分析
- [x] Task 1.2.1: 在 `serviceAreas` 生成后，双层循环 `for i < for j` 用 `turf.intersect(buffer[i], buffer[j])` 求交
- [x] Task 1.2.2: 收集非空交集为 `overlapAreas` FeatureCollection，每个 Feature properties 含 `stations: [name_i, name_j]`、`area: 平方米`（用 `getPlanarPolygonArea3857`）
- [x] Task 1.2.3: 计算 `redundancyScore = Σ重叠面积 / Σ服务区面积 × 100`，保留 1 位小数
- [x] Task 1.2.4: 响应 `data` 新增 `overlapAreas` 与 `redundancyScore` 字段

### 任务 1.3：充电站覆盖效率统计
- [x] Task 1.3.1: 新建 `stationEfficiencyMap: Map<stationId, { coveredCommunities, coveredPopulation, coverageRatioSum, loadIndex }>`
- [x] Task 1.3.2: 遍历 `communityResults`，对每个 `coveredBy !== null` 的社区，更新对应充电站的统计
- [x] Task 1.3.3: `loadIndex` 复用 `/api/v1/analysis/heatmap` 算法（快充×2 + 慢充×1）× (1 + 周边人口/10000) / (1 + 竞品距离衰减)
- [x] Task 1.3.4: 输出 `stationEfficiency` 数组（按 `coveredPopulation` 降序），响应 `data` 新增该字段

## 阶段二：前端结果展示完善（P0）

### 任务 2.1：地图图例组件
- [x] Task 2.1.1: 创建 `src/components/MapLegend.tsx`，props: `items: { label, color, icon?: ReactNode }[]`、`title: string`、`collapsible: boolean`
- [x] Task 2.1.2: 容器样式：`absolute left-3 bottom-3 z-10`，白色 95% 透明 + backdrop-blur + 圆角 8px + 1px 边框
- [x] Task 2.1.3: 折叠态仅显示标题栏（窄条），展开态显示全部图例项
- [x] Task 2.1.4: 在 App.tsx 中 `activeTab === "coverage" && coverageSummary` 时渲染，items 含 4 组（服务区/重叠区/候选点/分级色阶）

### 任务 2.2：社区按分级渐变着色
- [x] Task 2.2.1: 新增 `communityGradedStyle(feature)` 函数，读取 `feature.get("coverageRatio")` 和 `level`，返回对应分级色的 Fill + Stroke
- [x] Task 2.2.2: 分级色阶：极差#EF4444 / 较差#F59E0B / 一般#FACC15 / 良好#84CC16 / 优秀#10B981，填充透明度 0.35
- [x] Task 2.2.3: 覆盖分析完成后，将 `communityResults` 的 `coverageRatio` 和 `level` 写入 communitySource 中对应 Feature 的 properties
- [x] Task 2.2.4: `communityLayerRef` 的 style 切换为 `communityGradedStyle`（仅覆盖分析 Tab），其他 Tab 保留原 `communityStyle`

### 任务 2.3：服务区重叠图层
- [x] Task 2.3.1: 新增 `overlapSourceRef`（VectorSource）和 `overlapLayerRef`（VectorLayer），斜线 pattern 填充样式
- [x] Task 2.3.2: 斜线样式：用 `ol/style` 的 `Fill` + 自定义 canvas pattern（45° 斜线，#F59E0B 描边，透明度 0.3）
- [x] Task 2.3.3: `runCoverageAnalysis` 成功后用 `readFeaturesFromWGS84(json.data.overlapAreas)` 渲染重叠区
- [x] Task 2.3.4: 图层可见性跟随 `activeTab === "coverage"` 控制

### 任务 2.4：盲区社区列表组件
- [x] Task 2.4.1: 创建 `src/components/CoverageCommunityList.tsx`，props: `communities: CommunityResult[]`、`onLocate: (comm) => void`、`onSelect: (comm) => void`
- [x] Task 2.4.2: 顶部工具栏：搜索框（按社区名 includes 匹配）、排序下拉（人口降序/覆盖率升序/行政区）、分级筛选（多选 chips）
- [x] Task 2.4.3: 列表项：社区名 / 行政区 / 人口 / 覆盖率（带分级色块）/ 覆盖充电站名或"无覆盖"
- [x] Task 2.4.4: 分页：每页 20 条，底部"加载更多"按钮
- [x] Task 2.4.5: 在 App.tsx 右侧面板下方渲染（`activeTab === "coverage" && coverageResults.length > 0`）

### 任务 2.5：社区点击详情弹窗
- [x] Task 2.5.1: 给 `communityLayerRef` 注册 `singleclick` 事件（仅覆盖分析 Tab 激活）
- [x] Task 2.5.2: 点击时 `map.forEachFeatureAtPixel` 找到社区 Feature，读取其 properties
- [x] Task 2.5.3: 弹出详情卡片（地图浮窗 Overlay 或屏幕中央模态），含：社区名/行政区/人口/覆盖率/分级/覆盖充电站列表/"在此选址"按钮（若为盲区）
- [x] Task 2.5.4: 覆盖充电站列表按距离升序，每项显示站名/品牌/快慢充数/距离

### 任务 2.6：盲区候选点完整面板
- [x] Task 2.6.1: 修改水平栏候选点区，移除 `.slice(0, 5)` 限制，显示全部候选点
- [x] Task 2.6.2: 候选点列表移到地图右下角浮层（`absolute right-3 bottom-3 z-10`，宽 280px，最大高 400px，可滚动）
- [x] Task 2.6.3: 顶部排序下拉：人口降序（默认）/ 社区数降序 / 覆盖率升序
- [x] Task 2.6.4: 每项可展开显示包含的盲区社区列表（折叠面板）
- [x] Task 2.6.5: "在此选址"按钮保留，点击后 `setActiveTab("site")` + `placeVirtualStation`

## 阶段三：交互优化（P0）

### 任务 3.1：行政区切换联动飞行
- [x] Task 3.1.1: 新增 `districtCenters: Record<string, [number, number]>` 常量（徐州市各区中心坐标）
- [x] Task 3.1.2: `setCoverageDistrict` 的 onChange 中调用 `map.getView().animate({ center: fromLonLat(districtCenters[value] || [117.2846, 34.262]), zoom: value === "all" ? 11 : 12, duration: 800 })`

### 任务 3.2：6 格指标卡升级
- [x] Task 3.2.1: 将原 4 格升级为 6 格：覆盖率 / 人口覆盖率 / 盲区社区 / 盲区人口 / 充电站总数 / 冗余度
- [x] Task 3.2.2: 人口覆盖率用 `coverageSummary.populationCoverageRate`，冗余度用 `coverageSummary.redundancyScore`（≥30 红色，10-30 橙色，<10 绿色）

### 任务 3.3：右侧图表面板升级
- [x] Task 3.3.1: 新增"覆盖率分级饼图"区块（ECharts pie，5 级色阶，显示各分级社区数占比）
- [x] Task 3.3.2: 新增"充电站效率 Top10 横向柱图"区块（ECharts bar，横向，按覆盖人口排序）
- [x] Task 3.3.3: 三个图表面板可折叠，默认展开堆叠柱图，其他折叠

### 任务 3.4：空状态与加载态规范
- [x] Task 3.4.1: 无分析结果时，水平栏下方显示空状态引导卡（图标 + "配置参数后点击开始分析" + 示例参数建议）
- [x] Task 3.4.2: 分析中显示进度条（顶部固定，动画 0-90%）+ 地图半透明遮罩 + 中央"正在分析 N 个社区..."文案
- [x] Task 3.4.3: N 取自上次分析的社区总数（首次显示"正在分析..."）

## 阶段四：扩展能力（P1）

### 任务 4.1：覆盖率热力图模式切换
- [x] Task 4.1.1: 图层面板新增"分级着色/热力图"二选一 radio 控件
- [x] Task 4.1.2: 热力图模式：用 HeatmapLayer 渲染社区质心，权重 = 1 - coverageRatio（覆盖率越低权重越高）
- [x] Task 4.1.3: 切换时隐藏/显示 communityLayer 与 heatmapLayer

### 任务 4.2：覆盖分析历史对比
- [x] Task 4.2.1: 创建 `src/components/CoverageHistoryCompare.tsx`，props: `history: CoverageHistoryItem[]`、`current: CoverageSummary | null`、`onRecall: (item) => void`
- [x] Task 4.2.2: 历史卡片并排显示（最多 3 张），每张含：参数（模式/半径/行政区）、覆盖率、盲区社区数、盲区人口、与当前差异（↑↓百分比）
- [x] Task 4.2.3: `runCoverageAnalysis` 成功后将 `{ params, summary, timestamp }` 压入 `coverageHistoryRef.current`，最多 3 条
- [x] Task 4.2.4: 点击历史卡片临时切换地图渲染到该历史结果，再次点击恢复

### 任务 4.3：CSV 导出
- [x] Task 4.3.1: 水平栏新增"导出 CSV"按钮
- [x] Task 4.3.2: 点击后前端纯生成 CSV（列：社区名/行政区/人口/覆盖率/分级/覆盖充电站），UTF-8 BOM 编码
- [x] Task 4.3.3: 文件名 `覆盖分析_YYYYMMDD_HHmm.csv`，用 `Blob` + `URL.createObjectURL` + `a.download` 触发下载

### 任务 4.4：打印报告
- [x] Task 4.4.1: 水平栏新增"打印报告"按钮
- [x] Task 4.4.2: 组装打印 HTML（参数 / 6 格指标 / 分级统计 / Top10 盲区 / Top10 充电站效率）
- [x] Task 4.4.3: 调用 `window.print()`，CSS `@media print` 控制只显示报告区域

## Task Dependencies
- Task 1.2（重叠分析）依赖 Task 1.1（分级与人口覆盖率，因复用 totalCoveredPop）
- Task 1.3（充电站效率）依赖 Task 1.1
- Task 2.2（分级着色）依赖 Task 1.1（后端输出 level 字段）
- Task 2.3（重叠图层）依赖 Task 1.2
- Task 2.6（候选点面板）无后端依赖，可并行
- Task 3.2（6 格指标卡）依赖 Task 1.1 和 Task 1.2
- Task 3.3（图表面板）依赖 Task 1.1（分级饼图）和 Task 1.3（效率柱图）
- Task 4.2（历史对比）依赖阶段二全部完成
- Task 4.3（CSV 导出）依赖 Task 1.1（level 字段）
