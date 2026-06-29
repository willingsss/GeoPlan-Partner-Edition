# Checklist

## 后端覆盖分析接口参数扩展
- [x] `/api/v1/analysis/coverage` 从 `req.body` 解构 `radius` 与 `district`
- [x] `serviceRadius = parseFloat(radius) || (chargeMode === "fast" ? 800 : 400)` 优先使用传入 radius
- [x] 传入 `district`（非空且非 "all"）时，`communitiesDatabase` 仅保留该区社区，统计/盲区基于过滤后数据
- [x] `/api/v1/analysis/evaluate-site` 的 `radius` 优先级正确（`parseFloat(radius) || chargeMode 推导`）

## 前端 state 与参数传递
- [x] 新增 state：`coverageRadius`、`coverageDistrict`、`siteChargeMode`、`siteBrand`、`mapPanelCollapsed`
- [x] `runCoverageAnalysis` 请求体包含 `chargeMode`、`radius`（可选）、`district`
- [x] `evaluateSite` 请求体 `chargeMode` 来自 `siteChargeMode`（不再硬编码 `"fast"`）
- [x] `saveScheme` 请求体 `brand` 来自 `siteBrand`（不再硬编码 `"国家电网"`）

## 主布局容器重构
- [x] 右侧主区域改为横向 flex：Tab 栏 → 地图展示竖直栏 → 主区（水平栏 + 地图）
- [x] 删除原 `data-panel-area` 浮动面板节点及其内部三个 `activeTab` 分支
- [x] 删除"展开功能面板"浮动按钮及 `panelCollapsed` 联动 zoom 偏移逻辑
- [x] 地图容器从 `absolute inset-0` 改为 `flex-1 relative`，位于水平栏下方
- [x] `activeTab === "admin"` 时隐藏竖直栏与水平栏，渲染全屏管理界面

## 地图展示竖直栏
- [x] 竖直栏宽约 280px，紧邻左侧 Tab 栏右侧，`activeTab !== "admin"` 时渲染
- [x] 栏内包含：地点搜索、品牌图层勾选、小区图层、反馈点图层、区域统计
- [x] 顶部收起按钮切换 `mapPanelCollapsed`，收起时栏宽 ~14px 并提供展开按钮
- [x] 竖直栏不遮挡地图（地图宽度 = 总宽 - Tab 栏 - 竖直栏）

## 顶部水平分析栏
- [x] 水平栏高约 96px（h-24），位于地图上方，`activeTab !== "admin"` 时渲染
- [x] 左栏：选址决策控件（服务半径滑块、充电模式选择、拟建品牌选择、实时指标、保存方案、方案对比）
- [x] 右栏：覆盖分析控件（充电模式、自定义半径输入、行政区过滤、开始分析、分析摘要）
- [x] 控件紧凑横排，不溢出水平栏高度

## Tab 导航与兼容
- [x] `map`/`coverage`/`site` Tab 不再切换面板内容，仅作标题与地图交互模式提示
- [x] 选址 Tab 仍触发地图点击放置虚拟站点逻辑（`activeTabRef.current === "site"` 检查保留）
- [x] `admin` Tab 渲染全屏系统管理界面，隐藏竖直栏与水平栏（地图通过 `display: none` 隐藏）

## 验证
- [x] `npm run lint` TypeScript 检查通过（exit 0，无错误）
- [x] Grep 验证：无 `data-panel-area` 残留
- [x] Grep 验证：无 `panelCollapsed` 残留（含声明、引用、zoom useEffect）
- [x] Grep 验证：无硬编码 `chargeMode: "fast"`（evaluateSite 已绑定 `siteChargeMode`）
- [x] Grep 验证：无硬编码 `brand: "国家电网"`（saveScheme 已绑定 `siteBrand`）
- [x] 代码层面验证：竖直栏紧邻 Tab 栏、水平栏位于地图上方、地图不被遮挡
- [ ] 运行时手动验证：覆盖分析自定义半径 + 行政区过滤生效（结果数量随过滤变化）
- [ ] 运行时手动验证：选址决策切换 chargeMode/brand 后，评估与保存方案携带正确参数
