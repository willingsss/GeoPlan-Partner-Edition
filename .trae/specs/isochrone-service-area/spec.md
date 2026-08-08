# 路网等时圈服务区 Spec

## Why
当前覆盖分析使用"圆形缓冲区"模拟充电站服务区（快充 800m / 慢充 400m），存在三方面问题：
1. **未考虑真实路网**：山河湖泊、铁路、高速、单行道等障碍被忽略，直线距离 ≠ 实际可达距离
2. **未考虑路况与出行方式**：快充用户驾车、慢充用户步行，两种场景速度差异大，圆形缓冲区无法区分
3. **学术严谨性不足**：距离缓冲区是工程估算方法，可达性研究的主流方法是"等时圈"（Isochrone），基于真实路网 + 时间阈值

本 spec 将服务区模型从"圆形缓冲区"升级为"基于真实路网的等时圈多边形"，作为方案1 的实施依据。

## 服务区参数定义依据

### 快充场景：驾车 10 分钟等时圈

| 依据来源 | 内容 |
|---------|------|
| **GB/T 51313-2018**《电动汽车分散充电设施工程技术标准》 | 城市公共快充站服务半径推荐 0.9-1.5 km |
| **《2022 中国电动汽车用户充电行为白皮书》**（中国电动汽车百人会） | 用户充电焦虑阈值 10-15 分钟；90% 用户选择快充；92% 充电地点在距常用活动点 3 km 内 |
| **城市道路平均车速** | 25-35 km/h（含红绿灯），驾车 10 分钟 ≈ 3-5 km，覆盖范围远大于 800m 圆形缓冲区 |

### 慢充场景：步行 15 分钟等时圈

| 依据来源 | 内容 |
|---------|------|
| **住建部"15 分钟社区生活圈"国土空间规划技术规范** | "构建步行 15 分钟步行可达的社区生活圈网络"，已推广至全国 |
| **步行速度换算** | 4-5 km/h × 0.25 h = 1-1.25 km |
| **慢充场景定位** | 小区/单位过夜充电，属社区级基础设施，符合 15 分钟生活圈尺度 |

### 为什么用"时间"而非"距离"

Hansen（1959）势能可达性模型（Gravity Model of Accessibility）以来，**时间替代距离**已是交通地理学的共识，原因：
- 距离缓冲区跨过山河湖泊等不可通行区域，物理上不可达
- 相同距离在不同路网密度下通行时间差异大（市区 vs 郊区）
- 路况动态变化，时间更贴近用户感知

## What Changes

### 后端（server.ts + 新增 services）
- **新增**：`server/services/amapIsochrone.ts` — 封装高德"驾车可达范围"API，返回 WGS84 GeoJSON Polygon
- **新增**：GCJ02 → WGS84 反向坐标转换函数（项目已有 WGS84→GCJ02）
- **新增**：限流控制（p-limit 风格，并发 ≤5），符合高德 QPS 限制
- **新增**：`POST /api/v1/admin/precompute-isochrones` 接口（管理员鉴权），手动触发批量预计算
- **改造**：服务器启动时**异步**预计算缺失等时圈（不阻塞主服务）
- **改造**：`/api/v1/analysis/coverage` 接口新增 `serviceAreaMode` 参数
  - `buffer`（默认，向后兼容）：圆形缓冲区
  - `isochrone`：等时圈多边形（缺失则该站点不计入）
  - `hybrid`（推荐）：等时圈为主，缺失站点回退到缓冲区
- **改造**：响应增加 `serviceAreaMode` 字段、`isochroneCoverage`（已具备等时圈的站点数 / 总站点数）

### 数据库
- **新增字段**（`t_charging_station` 表）：
  - `isochrone_fast_geom` JSON — 快充等时圈多边形（WGS84 GeoJSON）
  - `isochrone_slow_geom` JSON — 慢充等时圈多边形
  - `isochrone_fast_updated` DATETIME — 快充等时圈更新时间
  - `isochrone_slow_updated` DATETIME
  - `isochrone_status` ENUM('pending','ok','failed') DEFAULT 'pending'

### 前端（src/App.tsx）
- **新增**：覆盖分析面板"服务区模式"分段控件（缓冲区 / 等时圈 / 混合）
- **新增**：图层面板"等时圈服务区"开关（独立于"缓冲区服务区"，可同时显示对比）
- **新增**：等时圈图层样式（虚线边框 + 半透明填充，区别于缓冲区实线）
- **新增**：充电站弹窗"等时圈状态"徽章（已计算 / 计算中 / 失败）
- **新增**：管理员后台"等时圈预计算"卡片（进度条 + 手动重算按钮）

## Impact
- Affected specs: `platform-enhancement-v2`（WebGIS 标准能力）、`coverage-analysis-polish`、`site-coverage-linkage-ui`
- Affected code: `server.ts`、`src/App.tsx`、`database.sql`、新增 `server/services/amapIsochrone.ts`
- 性能影响：首次预计算约 3-4 分钟（367 站 × 2 模式 ≈ 734 次 API 调用，并发 5）；后续分析从缓存读取，耗时与缓冲区模式接近

---

## ADDED Requirements

### Requirement: 高德等时圈 API 客户端
系统 SHALL 封装高德"驾车可达范围"API，将 GCJ02 坐标转换为 WGS84 后返回 GeoJSON Polygon。

#### Scenario: 正常调用
- **WHEN** 调用 `getIsochrone(lng, lat, mode)`
- **THEN** 根据模式选择时长：快充驾车 10 分钟 / 慢充步行 15 分钟
- **AND** 调用高德 API 获取可达范围多边形（GCJ02）
- **AND** 将坐标从 GCJ02 转换为 WGS84
- **AND** 返回标准 GeoJSON Polygon Feature

#### Scenario: API 失败回退
- **WHEN** 高德 API 返回错误或超时（>10 秒）
- **THEN** 抛出 `IsochroneError`，由调用方决定是否回退到缓冲区
- **AND** 错误记录到日志，状态标记为 `failed`

### Requirement: 等时圈批量预计算
系统 SHALL 支持批量预计算所有充电站的等时圈，结果持久化到数据库。

#### Scenario: 启动时自动预计算
- **WHEN** 服务器启动且数据库中存在 `isochrone_status='pending'` 的站点
- **THEN** 异步启动预计算任务（不阻塞主服务）
- **AND** 并发控制在 5 以内（符合高德 QPS 限制）
- **AND** 每完成一站立即写回数据库
- **AND** 全部完成后日志输出统计

#### Scenario: 手动触发预计算
- **WHEN** 管理员调用 `POST /api/v1/admin/precompute-isochrones`
- **THEN** 返回当前进度（已计算/总数/失败数）
- **AND** 若已有任务在跑，返回 409 Conflict
- **AND** 否则启动新的预计算任务

### Requirement: 覆盖分析支持等时圈模式
`/api/v1/analysis/coverage` SHALL 支持 `serviceAreaMode` 参数切换服务区模型。

#### Scenario: 缓冲区模式（默认）
- **WHEN** `serviceAreaMode` 为 `buffer` 或未传
- **THEN** 使用圆形缓冲区（现有逻辑不变）
- **AND** 响应 `serviceAreaMode` 字段为 `buffer`

#### Scenario: 等时圈模式
- **WHEN** `serviceAreaMode` 为 `isochrone`
- **THEN** 仅使用已具备等时圈几何的站点
- **AND** 缺失等时圈的站点不计入分析
- **AND** 响应包含 `isochroneCoverage`（已计算站数 / 总站数）

#### Scenario: 混合模式（推荐）
- **WHEN** `serviceAreaMode` 为 `hybrid`
- **THEN** 优先使用等时圈几何
- **AND** 等时圈缺失的站点回退到圆形缓冲区
- **AND** 响应包含 `isochroneCoverage` 与 `fallbackCount`

### Requirement: 前端服务区模式切换
前端 SHALL 在覆盖分析面板提供"服务区模式"分段控件。

#### Scenario: 模式切换
- **WHEN** 用户切换服务区模式
- **THEN** 自动重新执行覆盖分析
- **AND** 等时圈模式下，地图显示等时圈多边形（虚线边框 + 半透明填充）
- **AND** 缓冲区模式下，地图显示圆形缓冲区（实线边框，现有样式）

#### Scenario: 等时圈图层独立开关
- **WHEN** 用户打开"等时圈服务区"图层开关
- **THEN** 地图叠加渲染等时圈多边形
- **AND** 该图层与"缓冲区服务区"图层可同时显示用于对比

### Requirement: 等时圈状态可视化
充电站弹窗 SHALL 显示该站的等时圈计算状态。

#### Scenario: 状态徽章
- **WHEN** 用户点击充电站查看弹窗
- **THEN** 弹窗显示"等时圈状态"徽章
  - 已计算（绿色）：`isochrone_status='ok'`
  - 计算中（黄色）：`isochrone_status='pending'`
  - 失败（红色）：`isochrone_status='failed'`
- **AND** 已计算状态显示更新时间

---

## Technical Approach

### 1. GCJ02 → WGS84 反向转换

项目已有 `wgs84ToGcj02`（[server.ts:58-85](file:///f:/学习资料/课程作业/GIS设计与开发/Git_Geoplan/GeoPlan-Partner-Edition/server.ts#L58-L85)），需补充反向函数。采用迭代法反推（不能简单做差，因转换非线性）。

### 2. 高德等时圈 API 调用

```
GET https://restapi.amap.com/v5/direction/reachable
  ?key={AMAP_KEY}
  &location={lng},{lat}
  &mode={driving|walking}
  &time={minutes}
```

返回 Polygon 多边形（GCJ02 坐标），需逐点转 WGS84。

### 3. 并发控制

简易 promise 池（避免引入新依赖）：
```typescript
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>
```

### 4. 性能优化复用

等时圈多边形同样应用已优化的 bbox 预筛 + 质心距离预筛 + 早退逻辑（[server.ts:107-142](file:///f:/学习资料/课程作业/GIS设计与开发/Git_Geoplan/GeoPlan-Partner-Edition/server.ts#L107-L142)），保证单次分析 < 10 秒。

### 5. 缓存策略

- 等时圈一经计算几乎不变（路网短期不变），持久化到数据库
- 内存缓存：启动时加载所有等时圈几何到 `chargingStations[i].isochroneFast` / `isochroneSlow`
- 失效策略：手动触发重算（admin 接口）

---

## 实施顺序（5 阶段）

### 阶段 A：数据库与模型扩展（前置基础）
- A1: 写迁移 SQL，给 `t_charging_station` 表加 5 个字段
- A2: 更新 `loadStationsFromDB` 加载等时圈几何到内存
- A3: 更新 `database.sql` 主 schema

### 阶段 B：高德等时圈 API 客户端
- B1: 实现 `gcj02ToWgs84` 反向转换函数
- B2: 新建 `server/services/amapIsochrone.ts`
- B3: 实现并发控制工具 `mapLimit`
- B4: 错误处理与重试

### 阶段 C：批量预计算与缓存
- C1: 新建 `server/scripts/precomputeIsochrones.ts`
- C2: 服务器启动时异步预计算
- C3: 实现 `POST /api/v1/admin/precompute-isochrones` 接口

### 阶段 D：覆盖分析接入等时圈
- D1: `/api/v1/analysis/coverage` 增加 `serviceAreaMode` 参数
- D2: 等时圈几何应用空间预筛优化
- D3: 响应增加 `serviceAreaMode` 与 `isochroneCoverage` 字段

### 阶段 E：前端交互
- E1: 覆盖分析面板新增"服务区模式"分段控件
- E2: 图层面板新增"等时圈服务区"开关
- E3: 等时圈图层样式（虚线 + 半透明填充）
- E4: 充电站弹窗"等时圈状态"徽章
- E5: 管理员后台"等时圈预计算"卡片
