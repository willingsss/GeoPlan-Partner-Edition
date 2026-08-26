// =========================================================================
// Style 缓存工具: 避免每次平移/缩放都 new Style() 产生 GC 压力
// =========================================================================
// 用法: 用 Map 按 feature 属性 hash 缓存已生成的 Style 对象
// 注意: 透明空样式 (隐藏用) 单独缓存, 不与正常样式混淆
// =========================================================================

import { Style, Fill, Stroke, Text, Circle as CircleStyle } from "ol/style";

// 透明空样式: 用于"隐藏此 feature"的场景 (单例复用, 避免重复 new)
export const EMPTY_STYLE = new Style({});

// LRU 风格的 Map (超容量自动删除最旧项)
const DEFAULT_MAX = 4096;
const caches = new Map<string, Map<string, Style>>();

function ensureCache(scope: string, max = DEFAULT_MAX): Map<string, Style> {
  let m = caches.get(scope);
  if (!m) {
    m = new Map();
    (m as any)._max = max;
    caches.set(scope, m);
  }
  return m;
}

function lruSet(scope: Map<string, Style>, key: string, value: Style) {
  // 容量超限时删除最旧项 (Map 第一个键)
  if (scope.size >= ((scope as any)._max || DEFAULT_MAX)) {
    const oldest = scope.keys().next().value;
    if (oldest !== undefined) scope.delete(oldest);
  }
  scope.set(key, value);
}

// 缓存或获取 Style: 命中返回已有, 未命中调用 factory 生成并缓存
export function cacheStyle(scope: string, key: string, factory: () => Style): Style {
  const m = ensureCache(scope);
  const hit = m.get(key);
  if (hit) return hit;
  const s = factory();
  lruSet(m, key, s);
  return s;
}

// 清空指定 scope 的缓存 (供图层重置/分析切换调用)
export function clearStyleCache(scope?: string) {
  if (scope) caches.delete(scope);
  else caches.clear();
}

// 工具: 把社区人口映射为颜色字符串 (供 communityStyle 复用)
export function populationToFillColor(pop: number): string {
  if (pop > 14000) return "rgba(0,200,150,0.14)";
  if (pop > 10000) return "rgba(0,200,150,0.10)";
  return "rgba(0,200,150,0.06)";
}
