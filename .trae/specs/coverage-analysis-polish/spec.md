# 覆盖分析功能至善至美 Spec

## Why
当前覆盖分析功能虽有"半径/行政区/缓冲区叠置/盲区聚类/候选点列表/堆叠柱图"的基础框架，但只能算"能跑通"，离"好用"还有明显差距：后端只输出二值化的盲区/非盲区，看不到覆盖率分级、人口加权、服务区重叠、充电站效率；前端盲区社区列表藏在 state 里不显示、候选点只露 5 个、地图无图例、社区点击无详情、行政区切换不飞行、无历史对比、无结果导出、空状态/加载态缺失。本 spec 将覆盖分析从"功能框架"打磨到"至善至美"，做到分析维度完整、结果展示丰富、交互流畅、视觉精致。

## What Changes

### 后端：分析维度完善
- **新增**：覆盖率 5 级分级体系（极差<10% / 较差 10-30% / 一般 30-60% / 良好 60-90% / 优秀≥90%），每社区输出 `level` 字段
- **新增**：人口加权覆盖率 `populationCoverageRate`（已覆盖人口 / 总人口），与现有"社区数覆盖率"并列
- **新增**：服务区重叠分析 `overlapAreas`（多个充电站服务区相交区域）+ `redundancyScore`（冗余度评分 0-100）
- **新增**：充电站覆盖效率 `stationEfficiency`（每座充电站覆盖的社区数、人口、平均覆盖率、负荷指数）
- **新增**：覆盖率分级统计 `coverageLevels`（5 级各有多少社区、多少人口）
- **修复**：`server.ts` line 727 空语句 `totalPopulation;` BUG（盲区人口未累加到 totalPopulation，虽 line 843 单独计算但语义混乱）
- **BREAKING**：`/api/v1/analysis/coverage` 响应 `data` 新增 `populationCoverageRate`、`coverageLevels`、`overlapAreas`、`redundancyScore`、`stationEfficiency` 字段；`communityResults` 每项新增 `level` 字段

### 前端：结果展示丰富
- **新增**：地图图例组件 `MapLegend.tsx`（左下角浮动，含服务区/盲区/候选点/覆盖率分级色阶 4 组图例）
- **新增**：社区按覆盖率渐变着色（极差红→较差橙→一般黄→良好浅绿→优秀深绿），替代现有"盲区红/非盲区默认"二值渲染
- **新增**：服务区重叠区域用斜线填充样式标识（透明度叠加 + 斜线 pattern）
- **新增**：盲区社区列表面板（右侧或底部抽屉，可排序/搜索/分页，点击飞行定位）
- **新增**：盲区候选点完整面板（不止 5 个，可按人口/社区数排序，含详情展开）
- **新增**：社区点击详情弹窗（社区名/行政区/人口/覆盖率/分级/覆盖它的充电站列表）
- **新增**：充电站覆盖效率面板（每站覆盖社区数/人口/平均覆盖率/负荷指数，可排序）
- **改造**：4 格指标卡升级为 6 格（新增"人口覆盖率""冗余度"）
- **改造**：右侧图表面板升级（保留堆叠柱图 + 新增覆盖率分级饼图 + 新增充电站效率 Top10 横向柱图）

### 前端：交互优化
- **新增**：行政区切换联动飞行（切换"行政区"下拉后地图飞行到该区中心，zoom 12）
- **新增**：覆盖率热力图模式切换（图层面板新增"分级着色/热力图"二选一切换）
- **新增**：覆盖分析历史对比（最近 3 次分析并排对比卡片：参数 + 覆盖率 + 盲区社区数）
- **新增**：分析结果导出（CSV 导出盲区社区列表 + 打印覆盖分析报告）
- **改造**：空状态引导（首次进入覆盖分析 Tab 显示"配置参数后点击开始分析"引导卡）
- **改造**：加载态规范（分析中显示进度条 + "正在分析 N 个社区..." 动态文案）

## Impact
- Affected specs: 充电覆盖分析子系统、商业选址决策子系统（盲区联动）、地图展示与查询子系统（图例组件复用）
- Affected code: `server.ts`（`/api/v1/analysis/coverage` 接口扩展）、`src/App.tsx`（覆盖分析 Tab UI 重构、新 state、新交互）、`src/components/MapLegend.tsx`（新组件）、`src/components/CoverageCommunityList.tsx`（新组件）、`src/components/CoverageHistoryCompare.tsx`（新组件）、`src/components/StationEfficiencyPanel.tsx`（新组件）

---

## ADDED Requirements

### Requirement: 覆盖率 5 级分级体系
覆盖分析 SHALL 将每个社区按覆盖率归入 5 级分级，并输出分级统计。

#### Scenario: 分级计算
- **WHEN** 后端完成缓冲区叠置分析
- **THEN** 每个社区 `communityResults[].level` 字段取值：`极差`（<10%）/`较差`（10-30%）/`一般`（30-60%）/`良好`（60-90%）/`优秀`（≥90%）
- **AND** 响应 `data.coverageLevels` 输出 5 级统计数组，每项含 `level`、`count`、`population`
- **AND** 原 `isBlindSpot` 字段保留（`level === "极差"` 时为 true），向后兼容

#### Scenario: 分级地图渲染
- **WHEN** 覆盖分析完成
- **THEN** 社区图层按 `level` 渐变着色：极差#EF4444 / 较差#F59E0B / 一般#FACC15 / 良好#84CC16 / 优秀#10B981
- **AND** 填充透明度 0.35，边界同色 1px
- **AND** 切换"热力图模式"时改用 HeatmapLayer 渲染覆盖率（低覆盖率高权重）

### Requirement: 人口加权覆盖率
覆盖分析 SHALL 区分"社区数覆盖率"与"人口覆盖率"两个维度。

#### Scenario: 双覆盖率计算
- **WHEN** 后端完成分析
- **THEN** 响应 `data.summary.coverageRate`（社区数覆盖率，保留原义）
- **AND** 响应 `data.summary.populationCoverageRate`（人口覆盖率 = 已覆盖人口 / 总人口，保留 1 位小数）
- **AND** 已覆盖人口 = Σ(社区人口 × min(覆盖率, 1))，仅对非盲区社区累加
- **AND** 前端 6 格指标卡同时展示两个覆盖率

### Requirement: 服务区重叠分析
覆盖分析 SHALL 标识多个充电站服务区的重叠区域，并计算冗余度。

#### Scenario: 重叠区域输出
- **WHEN** 后端完成缓冲区生成
- **THEN** 对所有服务区两两求交（turf.intersect）
- **AND** 响应 `data.overlapAreas` 为 GeoJSON FeatureCollection，每个 Feature 含 `stations: [站名1, 站名2]`、`area: 平方米`
- **AND** 响应 `data.redundancyScore` 为 0-100 数字（重叠总面积 / 服务区总面积 × 100，越高冗余越严重）

#### Scenario: 重叠区域地图渲染
- **WHEN** 覆盖分析完成
- **THEN** 前端新增 `overlapSourceRef`/`overlapLayerRef`，用斜线 pattern 填充样式渲染重叠区域
- **AND** 图层可见性跟随 `activeTab === "coverage"` 控制
- **AND** 弹窗显示"X 与 Y 服务区重叠 / 面积 Z 平方米"

### Requirement: 充电站覆盖效率统计
覆盖分析 SHALL 输出每座充电站的覆盖效率指标。

#### Scenario: 效率计算
- **WHEN** 后端完成分析
- **THEN** 响应 `data.stationEfficiency` 为数组，每项含 `stationId`、`stationName`、`brand`、`coveredCommunities`（社区数）、`coveredPopulation`、`avgCoverageRatio`、`loadIndex`（负荷指数，复用热力图算法）
- **AND** 数组按 `coveredPopulation` 降序排序

#### Scenario: 效率面板展示
- **WHEN** 覆盖分析完成
- **THEN** 前端新增"充电站效率"面板（右侧图表面板下方或独立 Tab）
- **AND** 展示 Top 10 充电站横向柱图（按覆盖人口排序）
- **AND** 列表可排序（点击表头切换覆盖社区数/人口/平均覆盖率/负荷指数）

### Requirement: 地图图例组件
系统 SHALL 在地图左下角提供覆盖分析图例。

#### Scenario: 图例渲染
- **WHEN** `activeTab === "coverage"` 且已有分析结果
- **THEN** 地图左下角渲染 `MapLegend` 组件（`absolute left-3 bottom-3 z-10`）
- **AND** 图例含 4 组：
  1. 服务区（青色半透明方块）
  2. 重叠区（斜线方块）
  3. 盲区候选点（金色定位针图标）
  4. 覆盖率分级色阶（5 色渐变条 + 标签）
- **AND** 图例可折叠（点击标题折叠为窄条）

### Requirement: 盲区社区列表面板
系统 SHALL 提供完整的盲区社区列表，支持排序、搜索、飞行定位。

#### Scenario: 列表渲染
- **WHEN** 覆盖分析完成
- **THEN** 右侧图表面板下方或独立抽屉渲染 `CoverageCommunityList` 组件
- **AND** 默认显示所有盲区社区（`level === "极差"`），每项含：社区名、行政区、人口、覆盖率、覆盖它的充电站（或"无覆盖"）
- **AND** 顶部工具栏：搜索框（按社区名模糊匹配）、排序下拉（人口降序/覆盖率升序/行政区）、分级筛选（极差/较差/一般/良好/优秀 多选）
- **AND** 分页：每页 20 条，底部"加载更多"按钮

#### Scenario: 点击飞行定位
- **WHEN** 用户点击列表某项
- **THEN** 地图飞行到该社区质心（`map.getView().animate({ center, zoom: 14 })`）
- **AND** 高亮该社区（边界加粗 2px + 闪烁动画 1 次）
- **AND** 弹出社区详情弹窗

### Requirement: 社区点击详情弹窗
系统 SHALL 在点击社区时显示该社区的覆盖详情。

#### Scenario: 详情弹窗
- **WHEN** 用户点击地图上某社区要素
- **THEN** 弹出详情卡片（地图浮窗或屏幕中央模态），含：
  - 社区名 / 行政区 / 人口
  - 覆盖率（百分比 + 分级色块）
  - 覆盖它的充电站列表（站名、品牌、快慢充数、距离）
  - "在此选址"按钮（若为盲区）
- **AND** 若该社区被多座充电站覆盖，列表按距离升序

### Requirement: 盲区候选点完整面板
系统 SHALL 提供完整的盲区候选点列表，不止 5 个。

#### Scenario: 完整列表
- **WHEN** 覆盖分析完成且 `blindSpotClusters.length > 0`
- **THEN** 候选点面板显示全部候选点（非仅 slice(0,5)）
- **AND** 每项含：编号、质心坐标、社区数、人口、平均覆盖率
- **AND** 顶部排序：人口降序（默认）/ 社区数降序 / 覆盖率升序
- **AND** 每项可展开显示包含的盲区社区列表
- **AND** "在此选址"按钮保留

### Requirement: 行政区切换联动飞行
系统 SHALL 在切换行政区下拉时联动地图飞行。

#### Scenario: 飞行动画
- **WHEN** 用户切换"行政区"下拉（无论是否触发分析）
- **THEN** 地图飞行到该区中心（预设各区中心坐标），zoom 12，动画时长 800ms
- **AND** 若选"全部行政区"，飞行到徐州市中心 [117.2846, 34.262]，zoom 11

### Requirement: 覆盖分析历史对比
系统 SHALL 保留最近 3 次分析结果，支持并排对比。

#### Scenario: 历史保留
- **WHEN** 用户执行新的覆盖分析
- **THEN** 前端将当前结果（参数 + 摘要）压入 `coverageHistory` 数组，最多保留 3 条
- **AND** 历史卡片显示在面板顶部，每张含：参数（模式/半径/行政区）、覆盖率、盲区社区数、盲区人口、与当前差异（↑↓百分比）

#### Scenario: 历史对比
- **WHEN** 用户点击某张历史卡片
- **THEN** 地图临时切换到该历史结果的服务区/盲区渲染
- **AND** 再次点击或点击"返回当前"恢复

### Requirement: 分析结果导出
系统 SHALL 支持导出覆盖分析结果。

#### Scenario: CSV 导出
- **WHEN** 用户点击"导出 CSV"按钮
- **THEN** 前端将 `communityResults` 生成 CSV（列：社区名/行政区/人口/覆盖率/分级/覆盖充电站）
- **AND** 文件名 `覆盖分析_YYYYMMDD_HHmm.csv`，UTF-8 BOM 编码（Excel 兼容）

#### Scenario: 报告打印
- **WHEN** 用户点击"打印报告"按钮
- **THEN** 组装打印 HTML（参数 / 6 格指标 / 分级统计 / Top10 盲区 / Top10 充电站效率），调用 `window.print()`
- **AND** 打印样式用 `@media print` 控制，A4 纵向

### Requirement: 空状态与加载态规范
系统 SHALL 提供规范的空状态与加载态。

#### Scenario: 空状态
- **WHEN** 进入覆盖分析 Tab 且无分析结果
- **THEN** 水平栏参数区下方显示空状态引导卡：图标 + "配置参数后点击开始分析" + 示例参数建议（如"快充 800m / 全部行政区"）

#### Scenario: 加载态
- **WHEN** 分析进行中
- **THEN** 按钮变为"分析中..."（已实现）+ 顶部显示进度条（动画 0-90%）
- **AND** 地图上覆盖半透明遮罩 + 中央"正在分析 N 个社区..."文案
- **AND** N 来自上次分析的社区总数（首次分析时显示"正在分析..."）

---

## MODIFIED Requirements

### Requirement: 覆盖分析响应字段
`/api/v1/analysis/coverage` SHALL 在原响应基础上扩展分析维度。

#### Modified Scenario
- **WHEN** 后端完成分析
- **THEN** 响应 `data` 在原有字段基础上新增：
  - `summary.populationCoverageRate`（number，人口覆盖率）
  - `summary.redundancyScore`（number，冗余度 0-100）
  - `coverageLevels`（数组，5 级统计）
  - `overlapAreas`（GeoJSON FeatureCollection，服务区重叠区域）
  - `stationEfficiency`（数组，充电站覆盖效率）
- **AND** `communityResults` 每项新增 `level` 字段（`极差`/`较差`/`一般`/`良好`/`优秀`）
- **AND** 原有 `coverageRate`、`blindSpots`、`blindSpotCommunities`、`blindSpotPopulation`、`totalStations`、`serviceAreas`、`blindSpotClusters`、`districtStats` 保持不变

### Requirement: 覆盖分析面板布局
覆盖分析 Tab 的水平栏与右侧面板 SHALL 重新组织以容纳新功能。

#### Modified Scenario
- **WHEN** 用户进入覆盖分析 Tab
- **THEN** 水平栏上行：标题 + 参数控件（充电模式/服务半径/行政区/开始分析/导出 CSV/打印报告）
- **AND** 水平栏下行：6 格指标卡（覆盖率/人口覆盖率/盲区社区/盲区人口/充电站总数/冗余度）+ 历史对比卡片（若有）
- **AND** 右侧面板分 3 个可折叠区：
  1. 各行政区覆盖率堆叠柱图（保留）
  2. 覆盖率分级饼图（新增）
  3. 充电站效率 Top10 横向柱图（新增）
- **AND** 右侧面板下方：盲区社区列表（CoverageCommunityList 组件）
- **AND** 地图左下角：图例（MapLegend 组件）
- **AND** 地图右下角：候选点完整面板入口（点击展开浮层）

---

## Technical Approach

### 后端（server.ts）
1. **修复 BUG**：line 727 `totalPopulation;` 删除（盲区人口已在 line 843 单独计算，totalPopulation 在 line 700 已累加所有社区，语义正确）
2. **分级计算**：在 `communityResults.push` 前根据 `coveragePercent` 计算 `level`
3. **人口加权覆盖率**：`totalCoveredPop` 已在 line 740 累加 `pop * maxCoverageRatio`，直接 `populationCoverageRate = round(totalCoveredPop / totalPopulation * 1000) / 10`
4. **覆盖率分级统计**：遍历 `communityResults` 按 `level` 分组计数 + 累加人口
5. **服务区重叠**：双层循环 `serviceAreas`，`turf.intersect(buffer[i], buffer[j])` 求交，过滤 null，输出 FeatureCollection；冗余度 = Σ重叠面积 / Σ服务区面积 × 100
6. **充电站效率**：遍历 `communityResults`，对每座充电站统计其作为 `coveredBy` 的社区数、人口、平均覆盖率；负荷指数复用 `/api/v1/analysis/heatmap` 算法

### 前端（src/App.tsx + 新组件）
1. **新组件**：
   - `src/components/MapLegend.tsx`：通用图例组件，接收 `items: { label, color, icon? }[]`，可折叠
   - `src/components/CoverageCommunityList.tsx`：盲区社区列表，props: `communities, onLocate, onSelect`
   - `src/components/CoverageHistoryCompare.tsx`：历史对比卡片组，props: `history, current, onRecall`
   - `src/components/StationEfficiencyPanel.tsx`：充电站效率面板，props: `efficiency`
2. **新 state**：`coverageLevels`、`overlapAreas`、`stationEfficiency`、`populationCoverageRate`、`redundancyScore`、`coverageHistory`（数组）、`coverageViewMode`（"graded" | "heatmap"）
3. **社区样式重构**：`communityStyle` 函数增加 `level` 参数，按分级返回不同填充色；新增 `communityGradedStyle` 替代原二值样式
4. **重叠图层**：新增 `overlapSourceRef`/`overlapLayerRef`，用 `FillPattern`（ol/style）渲染斜线
5. **图例渲染**：`activeTab === "coverage" && coverageSummary` 时渲染 `<MapLegend items={...} />`
6. **历史保留**：`runCoverageAnalysis` 成功后将 `{ params, summary, timestamp }` 压入 `coverageHistoryRef.current`，最多 3 条
7. **导出 CSV**：前端纯生成，不依赖后端
8. **打印报告**：复用 `SchemeReportPrint.tsx` 模式，组装 HTML 后 `window.print()`

### 视觉规范
- 6 格指标卡沿用现有渐变 + 左侧色条样式
- 分级色阶：极差#EF4444 / 较差#F59E0B / 一般#FACC15 / 良好#84CC16 / 优秀#10B981
- 重叠区斜线：45° 斜线，#F59E0B 描边，透明度 0.3
- 图例卡片：白色 95% 透明 + backdrop-blur + 圆角 8px + 1px 边框
- 历史对比卡片：宽 200px，并排显示，当前结果高亮金边

---

## 验收优先级
- **P0（必须）**：分级体系、人口加权覆盖率、盲区社区列表、地图图例、社区点击详情、行政区联动飞行、空状态/加载态、BUG 修复
- **P1（重要）**：服务区重叠分析、充电站效率面板、盲区候选点完整面板、覆盖率分级饼图
- **P2（扩展）**：历史对比、CSV 导出、打印报告、热力图模式切换
