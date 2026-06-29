# AI 自然语言转 GIS 分析功能 Spec

## Why
当前 AI 助手只能文字回答，无法将自然语言意图转化为真实的 GIS 空间操作（缓冲区分析、叠置分析），用户需要手动在地图上操作，体验割裂。AI 推荐的充电站也只是文字，无法一键跳转到地图对应位置。

## What Changes
- **新增**：AI 自然语言 → GIS 操作指令解析（缓冲区分析、叠置分析）
- **新增**：AI 回复中站点名称可点击，点击后地图飞到对应站点位置并弹出详情
- **新增**：GIS 操作结果回写 AI 回复（如"共找到 12 座充电站"）
- **改造**：AI 面板支持展示 GIS 分析结论，不再只是纯文字

## Impact
- Affected specs: AI 辅助决策子系统
- Affected code: `server.ts`（AI 接口）、`src/App.tsx`（AI 面板 UI + 地图联动）

---

## ADDED Requirements

### Requirement: 自然语言 GIS 意图解析
系统 SHALL 能够解析用户自然语言中的 GIS 意图，将其转化为空间分析操作。

#### Scenario: 缓冲区分析
- **WHEN** 用户说"展示我附近 5km 的充电站"或"5 公里范围内有哪些站"
- **THEN** 系统提取用户位置和半径，执行以用户位置为中心、半径 5km 的缓冲区分析（`turf.circle`），筛选出范围内所有充电站，在 AI 回复中展示结果

#### Scenario: 叠置分析
- **WHEN** 用户说"5km 范围内覆盖了多少小区"或"这个范围内有多少人"
- **THEN** 系统以用户位置 5km 为缓冲，与社区面数据做叠置分析，返回覆盖人口/社区数量

#### Scenario: 范围查询
- **WHEN** 用户说"铜山区有多少充电站"或"泉山区快充站"
- **THEN** 系统按行政区/品牌/充电类型过滤chargingStations，返回统计

### Requirement: AI 回复中站点可点击跳转
系统 SHALL 在 AI 回复中为每个充电站生成可点击链接，点击后地图飞到该站位置并弹出详情。

#### Scenario: 点击跳转
- **WHEN** AI 回复包含 `[station:1234]` 格式的标记（1234 为站点 id）
- **THEN** 前端将其渲染为带下划线的链接，格式如 `国家电网(国网徐州泉山大学路亚朵酒店充电站)`
- **AND** 用户点击后，地图视角飞至该站坐标，弹出充电站详情模态框

### Requirement: GIS 分析结果融入 AI 回复
系统 SHALL 将真实的空间分析结果数字注入 AI 回复上下文。

#### Scenario: 分析数据注入
- **WHEN** AI 处理"附近 5km 充电站"类问题时
- **THEN** 后端先执行 turf 缓冲区 + 筛选，得出真实站点数量/人口/社区数
- **AND** 将"共找到 N 座充电站，覆盖人口约 X 人"等数据作为上下文传给 DeepSeek
- **AND** AI 回复末尾标注 `[gis:N:pop:P:comm:C]` 指令，供前端渲染交互

### Requirement: AI 面板 GIS 结果展示
系统 SHALL 在 AI 面板中优雅展示 GIS 分析结果（不只是一段文字）。

#### Scenario: 分析结论卡片
- **WHEN** AI 回复包含 GIS 分析结论
- **THEN** 前端识别 `[gis:...]` 标记，渲染为小型分析结论卡片（站点数、覆盖人口等）
- **AND** 卡片底部提供"在地图上查看"按钮，点击执行对应 GIS 可视化

---

## MODIFIED Requirements

### Requirement: AI 辅助决策接口
原有的 `/api/v1/ai/chat` 接口 SHALL 支持解析 GIS 意图并注入真实分析数据。

#### Modified Scenario
- **WHEN** AI 接口收到用户消息
- **THEN** 后端先做 GIS 意图匹配（附近 Nkm、覆盖分析、区域统计等）
- **AND** 执行 turf 空间分析
- **AND** 将分析结果注入 `enrichedContext`
- **AND** 在返回的 content 中嵌入 `[station:ID]` 和 `[gis:...]` 标记供前端渲染

---

## Technical Approach

### 后端（server.ts）
1. 新增 `parseGisIntent(message)`：正则匹配"附近 Nkm"、"半径 N"、"覆盖分析"等模式，返回 `{ type, radius?, center?, filters? }`
2. 新增 `doGisAnalysis(intent, userLocation)`：执行 turf.circle 缓冲区 → turf.booleanPointInPolygon 筛选 → 统计
3. AI 接口在发 DeepSeek 请求前调用 `doGisAnalysis`，将结果注入 `enrichedContext`
4. AI 回复中嵌入标记：`[station:ID]`（站点跳转）、`[gis:stations:N:pop:P:comm:C]`（GIS 结论）

### 前端（src/App.tsx）
1. `renderAiContent` 升级：识别 `[station:ID]` → 渲染为 `<button className="underline text-[#00C896]" onClick={() => flyToStation(ID)}>`
2. `flyToStation(id)` 函数：根据 id 从 chargingStations 找到坐标，飞图 + 弹详情
3. `renderAiContent` 识别 `[gis:...]` → 渲染为分析结论样式卡片
