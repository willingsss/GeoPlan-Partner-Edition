// =========================================================================
// 覆盖分析参数配置（统一常量，避免硬编码散落）
// =========================================================================
// 设计依据：
//   - 快充：用户驾车专程补电，半径反映"愿意开多远去快充站"
//           依据 GB/T 51313-2018 + 用户充电行为白皮书，取 1000 m 作为驾车补电半径
//   - 慢充：用户驻地/目的地顺便充电（小区/办公楼/商场停车场），半径反映"覆盖社区范围"
//           依据住建部"15 分钟生活圈"步行半径，取 400 m
//
// 等时圈场景（amapIsochrone.ts 中独立配置，与本缓冲区半径解耦）：
//   - 快充等时圈：驾车 10 分钟
//   - 慢充等时圈：步行 15 分钟
// =========================================================================

export const COVERAGE_RADIUS = {
  fast: 1000,  // 快充驾车补电半径（米）
  slow: 400,   // 慢充目的地覆盖半径（米）
} as const;

export type ChargeMode = keyof typeof COVERAGE_RADIUS;

// 根据充电模式获取缓冲区半径
export function getCoverageRadius(chargeMode: ChargeMode | "fast" | "slow" | string): number {
  return chargeMode === "slow" ? COVERAGE_RADIUS.slow : COVERAGE_RADIUS.fast;
}
