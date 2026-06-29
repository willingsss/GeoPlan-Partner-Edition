# Tasks

- [x] Task 1: 后端覆盖分析增加盲区聚类
  - [x] SubTask 1.1: 在 `/api/v1/analysis/coverage` 返回前，对 `blindSpots` 计算质心并按 ≤1500m 贪心聚合
  - [x] SubTask 1.2: 输出 `blindSpotClusters`（clusterId / center / communityCount / population，按 population 降序）
  - [x] SubTask 1.3: 保留原响应字段不变，新增字段不破坏旧消费方

- [x] Task 2: 后端选址评估增加盲区判定
  - [x] SubTask 2.1: `/api/v1/analysis/evaluate-site` 从 `req.body` 读取可选 `coverageBlindSpots`（WGS84 Polygon 数组）
  - [x] SubTask 2.2: 用 turf.intersect 判断虚拟站点 bufferPoly 与任一盲区相交（bufferPoly 先投影回 WGS84）
  - [x] SubTask 2.3: 响应增加 `in_blind_spot: boolean`（未携带 coverageBlindSpots 时为 false）

- [x] Task 3: 前端覆盖分析保存聚类结果并渲染候选点
  - [x] SubTask 3.1: 新增 state `blindSpotClusters`、`lastCoverageSummary`、`lastCoverageBlindSpotsRef`
  - [x] SubTask 3.2: `runCoverageAnalysis` 成功后写入上述 state
  - [x] SubTask 3.3: 在地图上以金色定位针样式渲染聚类中心，弹窗显示人口/社区数/"在此选址"按钮
  - [x] SubTask 3.4: 候选点图层仅在 coverage Tab 可见（遵循既有 Tab 可见性规则）

- [x] Task 4: 盲区→选址一键跳转联动
  - [x] SubTask 4.1: 候选点弹窗"在此选址"按钮：`setActiveTab("site")` + `placeVirtualStation(center[0], center[1])`
  - [x] SubTask 4.2: `evaluateSite` 请求体携带 `coverageBlindSpots: lastCoverageBlindSpotsRef.current`
  - [x] SubTask 4.3: 选址面板读取 `siteMetrics.in_blind_spot`，为 true 时高亮"该选址将消除盲区"提示

- [x] Task 5: 选址面板显示盲区概况联动卡片
  - [x] SubTask 5.1: 选址 Tab 存在 `lastCoverageSummary` 时渲染"当前区域盲区概况"卡片（覆盖率/盲区社区/盲区人口 + "来自覆盖分析"角标）
  - [x] SubTask 5.2: 无覆盖分析历史时隐藏该卡片

- [x] Task 6: 重写选址决策面板 UI（卡片化 + 字号放大 + 渐变指标卡）
  - [x] SubTask 6.1: 标题栏（图标+功能名+说明）14px font-bold
  - [x] SubTask 6.2: 参数区（半径滑块/快慢充分段控件/品牌下拉/保存）13px 标签、统一 32px 高控件
  - [x] SubTask 6.3: 指标卡 4 格渐变背景 + 左侧色条 + 18px font-bold 数值
  - [x] SubTask 6.4: 已保存方案区紧凑排列

- [x] Task 7: 重写覆盖分析面板 UI（卡片化 + 候选点列表入口）
  - [x] SubTask 7.1: 标题栏 + 参数区（快慢充分段/半径输入/行政区下拉/开始分析按钮）
  - [x] SubTask 7.2: 分析摘要 4 格渐变指标卡
  - [x] SubTask 7.3: 候选点列表区（显示 top 聚类，每项含人口/社区数/"在此选址"按钮，与地图标记联动）

- [x] Task 8: 验证与收尾
  - [x] SubTask 8.1: `npm run lint` 通过
  - [x] SubTask 8.2: 启动服务，覆盖分析→切选址→盲区提示→切回 coverage 状态保留 全流程验证

# Task Dependencies
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 3]
- [Task 6] depends on [Task 5]（盲区概况卡嵌入选址面板）
- [Task 7] depends on [Task 3]（候选点列表嵌入覆盖面板）
- [Task 8] depends on [Task 6, Task 7]
