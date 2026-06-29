# Tasks

## 任务 1：后端覆盖分析接口参数扩展
- [x] Task 1.1: 改造 `/api/v1/analysis/coverage`，从 `req.body` 解构 `radius` 与 `district`，`serviceRadius = parseFloat(radius) || (chargeMode === "fast" ? 800 : 400)`
- [x] Task 1.2: 在该接口中，若 `district` 非空且不为 `"all"`，则过滤 `communitiesDatabase.features` 仅保留该区社区，统计与盲区均基于过滤后数据
- [x] Task 1.3: 确认 `/api/v1/analysis/evaluate-site` 的 `radius` 优先级（`parseFloat(radius) || (chargeMode === "fast" ? 800 : 400)`）已正确，无需改动则跳过

## 任务 2：前端新增 state 与参数控件
- [x] Task 2.1: 在 `src/App.tsx` 新增 state：`coverageRadius`（number，初始 0 表示用 chargeMode 推导）、`coverageDistrict`（string，初始 `"all"`）、`siteChargeMode`（"fast"|"slow"，初始 `"fast"`）、`siteBrand`（string，初始 `"国家电网"`）、`mapPanelCollapsed`（boolean，初始 false）
- [x] Task 2.2: 改造 `runCoverageAnalysis`，请求体改为 `{ chargeMode, radius: coverageRadius || undefined, district: coverageDistrict }`
- [x] Task 2.3: 改造 `evaluateSite`，请求体 `chargeMode` 改为 `siteChargeMode`（替代硬编码 `"fast"`）
- [x] Task 2.4: 改造 `saveScheme`，请求体 `brand` 改为 `siteBrand`（替代硬编码 `"国家电网"`）

## 任务 3：主布局容器重构
- [x] Task 3.1: 将右侧主区域 `flex-1 flex flex-col` 改为横向 flex：`<aside Tab栏> <地图展示竖直栏> <div flex-col 主区>`，主区内部纵向为"顶部水平分析栏 + 地图"
- [x] Task 3.2: 删除原 `data-panel-area` 浮动面板节点（`absolute top-3 left-3 w-80`）及其内部三个 `activeTab` 分支
- [x] Task 3.3: 删除"展开功能面板"浮动按钮（`panelCollapsed` 控制的展开按钮）与对应 zoom 偏移逻辑（`useEffect` 中 `panelCollapsed`/`activeTab` 联动调整 zoom 控件 top 的代码清理或简化）
- [x] Task 3.4: 地图容器从 `absolute inset-0` 改为 `flex-1 relative`，确保地图在水平栏下方占满剩余高度；`activeTab === "admin"` 时仍隐藏地图

## 任务 4：地图展示竖直栏
- [x] Task 4.1: 新增竖直栏组件（宽 280px，`activeTab !== "admin"` 时渲染），紧邻左侧 Tab 栏右侧，高度占满内容区
- [x] Task 4.2: 将原 `activeTab === "map"` 分支内容（地点搜索、品牌图层勾选、小区图层、反馈点图层、区域统计）迁入竖直栏
- [x] Task 4.3: 竖直栏顶部加收起按钮，点击切换 `mapPanelCollapsed`；收起时栏宽变为 ~14px，地图扩展；提供展开按钮恢复

## 任务 5：顶部水平分析栏
- [x] Task 5.1: 新增水平栏容器（高约 96px，`activeTab !== "admin"` 时渲染），位于地图上方，左右分两栏（grid 或 flex）
- [x] Task 5.2: 左栏迁入原 `activeTab === "site"` 选址决策控件，并新增：充电模式选择（快充/慢充，绑定 `siteChargeMode`）、拟建品牌选择（下拉，绑定 `siteBrand`）
- [x] Task 5.3: 右栏迁入原 `activeTab === "coverage"` 覆盖分析控件，并新增：自定义半径输入（300–2000m，绑定 `coverageRadius`，含"用预设"快捷）、行政区过滤下拉（绑定 `coverageDistrict`）
- [x] Task 5.4: 两栏控件紧凑横排，指标摘要用小卡片并排，避免高度溢出（必要时水平滚动）

## 任务 6：Tab 导航与兼容
- [x] Task 6.1: 保留 `map` / `coverage` / `site` / `admin` 四个 Tab；前三者不再切换面板内容，仅作为页面标题与地图交互模式提示（选址 Tab 仍触发地图点击放置虚拟站点逻辑）
- [x] Task 6.2: `activeTab === "admin"` 时隐藏竖直栏与水平栏，渲染全屏系统管理界面（保持原逻辑）

## 任务 7：验证
- [x] Task 7.1: 运行 `npm run lint`，TypeScript 检查通过
- [x] Task 7.2: 手动验证：竖直栏紧邻 Tab 栏、水平栏位于地图上方、地图不被遮挡（代码层面验证结构正确）
- [ ] Task 7.3: 手动验证：覆盖分析自定义半径 + 行政区过滤生效（结果数量随过滤变化）—— 需运行时手动测试
- [ ] Task 7.4: 手动验证：选址决策切换 chargeMode/brand 后，评估与保存方案携带正确参数 —— 需运行时手动测试

# Task Dependencies
- Task 2 依赖 Task 1（后端参数支持）
- Task 3、4、5 可并行（布局重构、竖直栏、水平栏互不依赖具体内容，但都依赖 Task 3.1 的容器结构）
- Task 6 依赖 Task 3、4、5 完成
- Task 7 依赖全部完成
