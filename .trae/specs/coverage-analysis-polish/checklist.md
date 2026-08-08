# Checklist

## 阶段一：后端分析能力完善

### 覆盖率分级与人口加权覆盖率
- [ ] `server.ts` line 727 空语句 BUG 已修复
- [ ] `communityResults` 每项含 `level` 字段（极差/较差/一般/良好/优秀）
- [ ] `summary.populationCoverageRate` 正确计算（已覆盖人口 / 总人口）
- [ ] `coverageLevels` 数组含 5 项，每项 `{ level, count, population }`
- [ ] 原 `coverageRate`、`blindSpots`、`blindSpotClusters` 等字段保持不变

### 服务区重叠分析
- [ ] `overlapAreas` 为 GeoJSON FeatureCollection
- [ ] 每个 Feature 含 `stations: [站名1, 站名2]`、`area: 平方米`
- [ ] `redundancyScore` 在 0-100 之间，保留 1 位小数
- [ ] 无重叠时 `overlapAreas.features` 为空数组，`redundancyScore` 为 0

### 充电站覆盖效率统计
- [ ] `stationEfficiency` 数组按 `coveredPopulation` 降序排序
- [ ] 每项含 `stationId`、`stationName`、`brand`、`coveredCommunities`、`coveredPopulation`、`avgCoverageRatio`、`loadIndex`
- [ ] 未覆盖任何社区的充电站不出现在数组中

## 阶段二：前端结果展示完善

### 地图图例组件
- [ ] `src/components/MapLegend.tsx` 已创建
- [ ] 图例位于地图左下角（`absolute left-3 bottom-3 z-10`）
- [ ] 含 4 组图例：服务区 / 重叠区 / 候选点 / 分级色阶
- [ ] 可折叠，折叠态仅显示标题栏
- [ ] 仅 `activeTab === "coverage" && coverageSummary` 时显示

### 社区分级着色
- [ ] `communityGradedStyle` 函数按 `level` 返回对应分级色
- [ ] 5 级色阶：极差#EF4444 / 较差#F59E0B / 一般#FACC15 / 良好#84CC16 / 优秀#10B981
- [ ] 填充透明度 0.35
- [ ] 覆盖分析 Tab 切换为分级样式，其他 Tab 保留原样式

### 服务区重叠图层
- [ ] `overlapSourceRef` / `overlapLayerRef` 已创建
- [ ] 斜线 pattern 填充样式（45°，#F59E0B，透明度 0.3）
- [ ] 图层可见性跟随 `activeTab === "coverage"`
- [ ] 点击重叠区显示弹窗（站名/面积）

### 盲区社区列表
- [ ] `src/components/CoverageCommunityList.tsx` 已创建
- [ ] 搜索框按社区名模糊匹配
- [ ] 排序下拉：人口降序 / 覆盖率升序 / 行政区
- [ ] 分级筛选 chips（多选）
- [ ] 分页：每页 20 条 + "加载更多"
- [ ] 点击列表项触发 `onLocate` 飞行 + 高亮

### 社区点击详情弹窗
- [ ] 点击社区弹出详情卡片
- [ ] 含：社区名 / 行政区 / 人口 / 覆盖率 / 分级 / 覆盖充电站列表
- [ ] 覆盖充电站列表按距离升序
- [ ] 盲区社区显示"在此选址"按钮

### 盲区候选点完整面板
- [ ] 移除 `.slice(0, 5)` 限制，显示全部候选点
- [ ] 候选点列表移到地图右下角浮层
- [ ] 顶部排序下拉：人口降序 / 社区数降序 / 覆盖率升序
- [ ] 每项可展开显示包含的盲区社区
- [ ] "在此选址"按钮保留

## 阶段三：交互优化

### 行政区联动飞行
- [ ] 切换行政区下拉后地图飞行到该区中心
- [ ] 飞行动画时长 800ms，zoom 12
- [ ] 选"全部行政区"飞行到徐州市中心，zoom 11

### 6 格指标卡
- [ ] 6 格指标卡：覆盖率 / 人口覆盖率 / 盲区社区 / 盲区人口 / 充电站总数 / 冗余度
- [ ] 冗余度颜色：≥30 红色 / 10-30 橙色 / <10 绿色
- [ ] 数字字号 16px font-bold

### 右侧图表面板
- [ ] 各行政区覆盖率堆叠柱图（保留）
- [ ] 覆盖率分级饼图（5 级色阶）
- [ ] 充电站效率 Top10 横向柱图
- [ ] 三个区块可折叠

### 空状态与加载态
- [ ] 无结果时显示空状态引导卡
- [ ] 分析中显示顶部进度条（0-90% 动画）
- [ ] 地图半透明遮罩 + "正在分析 N 个社区..."文案

## 阶段四：扩展能力

### 覆盖率热力图模式
- [ ] 图层面板新增"分级着色/热力图"radio
- [ ] 热力图模式用 HeatmapLayer 渲染社区质心
- [ ] 权重 = 1 - coverageRatio
- [ ] 切换时隐藏/显示对应图层

### 历史对比
- [ ] `src/components/CoverageHistoryCompare.tsx` 已创建
- [ ] 最多保留 3 条历史
- [ ] 每张卡片显示参数 + 覆盖率 + 盲区社区数 + 盲区人口 + 与当前差异
- [ ] 点击卡片临时切换地图渲染

### CSV 导出
- [ ] 水平栏"导出 CSV"按钮可用
- [ ] CSV 列：社区名 / 行政区 / 人口 / 覆盖率 / 分级 / 覆盖充电站
- [ ] UTF-8 BOM 编码（Excel 兼容）
- [ ] 文件名 `覆盖分析_YYYYMMDD_HHmm.csv`

### 打印报告
- [ ] 水平栏"打印报告"按钮可用
- [ ] 报告含：参数 / 6 格指标 / 分级统计 / Top10 盲区 / Top10 充电站效率
- [ ] `window.print()` 触发浏览器打印
- [ ] `@media print` 控制只显示报告区域

## 整体验收
- [ ] `npm run lint`（tsc --noEmit）零错误
- [ ] 浏览器中覆盖分析 Tab 进入后有空状态引导
- [ ] 点击"开始分析"后显示进度条 + 地图遮罩
- [ ] 分析完成后地图显示分级着色社区 + 服务区 + 重叠区 + 候选点
- [ ] 左下角图例显示 4 组图例
- [ ] 右侧面板显示 3 个图表（堆叠柱/分级饼/效率柱）
- [ ] 右侧面板下方显示盲区社区列表
- [ ] 6 格指标卡显示完整数据
- [ ] 切换行政区地图飞行
- [ ] 点击社区显示详情弹窗
- [ ] 切换"分级着色/热力图"模式
- [ ] 点击"导出 CSV"下载文件
- [ ] 点击"打印报告"触发打印
- [ ] 历史对比卡片显示（分析 2 次后）
- [ ] 所有 UI 文案为自然中文，无 AI 味元素
