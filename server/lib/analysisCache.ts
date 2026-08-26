// =========================================================================
// 覆盖分析结果 LRU 缓存
// =========================================================================
// 用途: 相同参数 (chargeMode/radius/district/serviceAreaMode) 60 秒内复用结果,
//       避免反复点击"开始分析"触发重复的几何求交计算
//
// 实现: 简易 LRU (Map 按插入顺序天然有序, 超容量删除最旧项)
// =========================================================================

interface CacheEntry {
  value: any;
  expireAt: number;  // 过期时间戳 (ms)
}

const CACHE_TTL_MS = 60 * 1000;       // 60 秒过期
const CACHE_MAX_SIZE = 32;            // 最多保留 32 条参数组合

const store = new Map<string, CacheEntry>();

// 生成缓存 key (顺序无关的字符串拼接, 保证参数一致即命中)
export function buildCacheKey(params: {
  chargeMode?: string;
  radius?: number;
  district?: string;
  serviceAreaMode?: string;
}): string {
  return [
    params.chargeMode || "fast",
    typeof params.radius === "number" && params.radius > 0 ? params.radius : "auto",
    params.district || "all",
    params.serviceAreaMode || "buffer",
  ].join("|");
}

export function getFromCache(key: string): any | null {
  const entry = store.get(key);
  if (!entry) return null;
  // 嶯性检查: 已过期则删除
  if (Date.now() > entry.expireAt) {
    store.delete(key);
    return null;
  }
  // LRU: 重新插入到末尾 (Map 按插入顺序迭代)
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function setToCache(key: string, value: any): void {
  // 容量上限: 超出删除最旧项 (Map 的第一个键)
  if (store.size >= CACHE_MAX_SIZE) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expireAt: Date.now() + CACHE_TTL_MS });
}

// 主动清空 (供数据更新/清除场景调用)
export function clearAnalysisCache(): void {
  store.clear();
}
