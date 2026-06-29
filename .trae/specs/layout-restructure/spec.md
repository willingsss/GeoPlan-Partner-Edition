# 主界面布局重构 Spec

## Why
当前地图展示面板、覆盖分析（盲区）、选址决策共用一个 `absolute top-3 left-3 w-80` 的浮动面板，根据 `activeTab` 切换内容。该浮动面板遮挡地图、控件拥挤、参数不完整（选址 `chargeMode` 在前端被硬编码为 `"fast"`，覆盖分析半径固定由 `chargeMode` 推导，无法自定义）。需要将三类面板按功能拆分到不同位置，并补全参数。

## What Changes
- **改造**：将"地图展示与查询"面板从浮动卡片改为紧邻左侧 Tab 栏的**竖直栏**（左侧第二列，常驻显示）
- **改造**：将"选址决策"与"覆盖分析（盲区）"面板从浮动卡片迁移到地图上方的**水平栏**（并排两组控件）
- **改造**：移除 `panelCollapsed` 浮动面板的展开/收起逻辑及"展开功能面板"浮动按钮（竖直栏与水平栏取代其作用）
- **新增**：覆盖分析支持**自定义服务半径**输入（覆盖原有 `chargeMode` 自动推导逻辑，保留快/慢充快捷预设）
- **新增**：覆盖分析支持**行政区过滤**（仅分析选定区的社区）
- **新增**：选址决策暴露 `chargeMode` 选择器（快充/慢充），同步传给后端 `evaluate-site`
- **新增**：选址决策新增**拟建品牌**选择器，保存方案时携带真实品牌（替代硬编码 `"国家电网"`）
- **BREAKING**：`activeTab` 为 `map` / `coverage` / `site` 时不再切换浮动面板内容；三类控件改为按位置常驻。`系统管理` Tab 仍走全屏管理界面。

## Impact
- Affected specs: 地图展示与查询子系统、充电覆盖分析子系统、商业选址决策子系统
- Affected code: `src/App.tsx`（主布局容器、面板位置重构、参数控件、`runCoverageAnalysis` / `evaluateSite` / `saveScheme` 调用参数）、`server.ts`（`/api/v1/analysis/coverage` 与 `/api/v1/analysis/evaluate-site` 接收 `radius` / `district` / `chargeMode` / `brand` 参数）

---

## ADDED Requirements

### Requirement: 地图展示竖直栏
系统 SHALL 在左侧 Tab 栏右侧紧邻放置一条竖直栏，承载地图展示与查询子系统的全部控件。

#### Scenario: 竖直栏常驻显示
- **WHEN** 用户进入地图相关视图（`activeTab` 为 `map` / `coverage` / `site`）
- **THEN** 竖直栏紧邻左侧 Tab 栏右侧渲染，宽度约 280px，占满内容区高度
- **AND** 栏内自上而下包含：地点搜索框、充电站品牌图层勾选、住宅小区图层勾选、公众反馈点图层勾选、区域统计
- **AND** 竖直栏不遮挡地图（地图宽度 = 总宽 - Tab 栏 - 竖直栏）

#### Scenario: 竖直栏收起
- **WHEN** 用户点击竖直栏顶部收起按钮
- **THEN** 竖直栏收起为窄条（约 12px），地图扩展占满剩余宽度
- **AND** 提供展开按钮恢复竖直栏

### Requirement: 顶部水平分析栏
系统 SHALL 在地图上方放置一条水平栏，并排承载"选址决策"与"覆盖分析（盲区）"两组控件。

#### Scenario: 水平栏布局
- **WHEN** 用户进入地图相关视图
- **THEN** 地图上方渲染一条水平栏，高度约 96px，左右分两组
- **AND** 左组为"选址决策"控件：服务半径滑块、充电模式选择、拟建品牌选择、实时指标摘要、保存方案、方案对比
- **AND** 右组为"覆盖分析（盲区）"控件：充电模式选择、自定义半径输入、行政区过滤、开始分析按钮、分析摘要（覆盖率/盲区社区/盲区人口/充电站数）
- **AND** 地图区域位于水平栏下方，占满剩余高度

### Requirement: 覆盖分析自定义参数
系统 SHALL 允许用户自定义覆盖分析的服务半径与行政区范围。

#### Scenario: 自定义半径
- **WHEN** 用户在覆盖分析组输入自定义半径（300–2000m）或选择快/慢充预设
- **THEN** 前端将 `radius` 与 `chargeMode` 一并 POST 到 `/api/v1/analysis/coverage`
- **AND** 后端优先使用传入 `radius`，未传时回退到 `chargeMode` 推导（快充 800m / 慢充 400m）

#### Scenario: 行政区过滤
- **WHEN** 用户选择某一行政区（如"铜山区"）后点击开始分析
- **THEN** 前端将 `district` 传给后端
- **AND** 后端仅对该区社区做缓冲区叠置分析，返回该区的覆盖率与盲区
- **AND** 若选"全部行政区"，则按原全量逻辑分析

### Requirement: 选址决策参数补全
系统 SHALL 允许用户选择拟建站点的充电模式与品牌，并真实传递给后端。

#### Scenario: 充电模式选择
- **WHEN** 用户在选址决策组切换快充/慢充
- **THEN** 前端将该 `chargeMode` 传给 `/api/v1/analysis/evaluate-site`（替代当前硬编码 `"fast"`）
- **AND** 后端据此推导默认半径（未传 `radius` 时）

#### Scenario: 拟建品牌选择
- **WHEN** 用户选择拟建品牌（如"国家电网""特来电""星星充电"等）后保存方案
- **THEN** 前端将所选品牌写入 `saveScheme` 请求的 `brand` 字段（替代当前硬编码 `"国家电网"`）
- **AND** 保存的方案记录真实品牌

---

## MODIFIED Requirements

### Requirement: 主内容区布局
原有的浮动面板（`data-panel-area`，`absolute top-3 left-3 w-80`）SHALL 被竖直栏 + 顶部水平栏的组合取代。

#### Modified Scenario
- **WHEN** `activeTab` 为 `map` / `coverage` / `site`
- **THEN** 内容区结构为：左侧 Tab 栏 → 地图展示竖直栏 → 右侧主区（顶部水平分析栏 + 下方地图）
- **AND** 不再渲染 `data-panel-area` 浮动面板及其展开按钮
- **AND** `activeTab === "admin"` 时仍渲染全屏系统管理界面，隐藏竖直栏与水平栏

---

## Technical Approach

### 前端（src/App.tsx）
1. 主内容区 `flex-1` 容器改为横向 flex：`<aside Tab栏> <地图展示竖直栏> <div flex-col 主区>`
2. 新增竖直栏组件（宽 280px，可收起），承载原 `activeTab === "map"` 分支的全部内容
3. 主区上方新增水平栏（高 96px），并排渲染原 `activeTab === "site"` 与 `activeTab === "coverage"` 分支内容，紧凑横排
4. 地图容器改为 `flex-1 relative`（不再是 `absolute inset-0`），下方留出水平栏高度
5. 删除 `panelCollapsed` 浮动面板逻辑、"展开功能面板"按钮、`data-panel-area` 节点；保留竖直栏自身的收起状态（新 state `mapPanelCollapsed`）
6. 新增 state：`coverageRadius`（number，默认由 chargeMode 推导）、`coverageDistrict`（string，默认 "all"）、`siteChargeMode`（"fast"|"slow"）、`siteBrand`（string，默认 "国家电网"）
7. `runCoverageAnalysis` 请求体改为 `{ chargeMode, radius: coverageRadius, district: coverageDistrict }`
8. `evaluateSite` 请求体改为 `{ lng, lat, radius: siteRadiusRef.current, chargeMode: siteChargeMode }`
9. `saveScheme` 请求体的 `brand` 改为 `siteBrand`

### 后端（server.ts）
1. `/api/v1/analysis/coverage`：从 `req.body` 解构 `radius`、`district`；`serviceRadius = parseFloat(radius) || (chargeMode === "fast" ? 800 : 400)`；若 `district` 非空则过滤 `communitiesDatabase`
2. `/api/v1/analysis/evaluate-site`：已支持 `chargeMode`，仅需确认 `radius` 优先级正确（`parseFloat(radius) || (chargeMode === "fast" ? 800 : 400)`，当前实现已满足）
