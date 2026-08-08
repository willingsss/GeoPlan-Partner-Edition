// =========================================================================
// districtBoundary: 行政区真实边界服务
// 来源: 高德行政区划查询 API (官方行政区划边界, GCJ02) → 转 WGS84
// 用途: 覆盖分析时划定真实行政区可视化界限 (替代社区 union 近似轮廓)
// =========================================================================

// GCJ02 -> WGS84 (与 amapIsochrone 同款算法)
function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  const PI = 3.1415926535897932384626;
  const A = 6378245.0;
  const EE = 0.00669342162296594323;
  function transformLat(x: number, y: number): number {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  }
  function transformLng(x: number, y: number): number {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
    return ret;
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng - dLng, lat - dLat];
}

const cache = new Map<string, any | null>();

// 徐州各区行政区划代码 (adcode 唯一, 避免"鼓楼区"等重名区匹配到其他城市)
// 320300=徐州市, 鼓楼320302/云龙320303/贾汪320305/泉山320311/铜山320312
const XUZHOU_ADCODES: Record<string, string> = {
  "鼓楼区": "320302",
  "云龙区": "320303",
  "贾汪区": "320305",
  "泉山区": "320311",
  "铜山区": "320312",
};

/**
 * 获取行政区的真实边界 (WGS84 GeoJSON 几何)
 * 优先高德官方行政区划边界, 失败返回 null
 */
export async function fetchDistrictBoundary(district: string): Promise<any | null> {
  if (cache.has(district)) return cache.get(district) ?? null;

  try {
    const key = process.env.VITE_AMAP_KEY;
    if (!key) { cache.set(district, null); return null; }
    // 用 adcode 查询 (唯一), 无 adcode 时回退区名 (仅徐州市区无歧义区名无歧义)
    const query = XUZHOU_ADCODES[district] || district;
    const url = `https://restapi.amap.com/v3/config/district?keywords=${encodeURIComponent(query)}&subdistrict=0&extensions=all&key=${key}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    const polyline: string | undefined = data.districts?.[0]?.polyline;
    if (!polyline) { cache.set(district, null); return null; }

    // 解析 polyline: "|" 分隔多个环, ";" 分隔点, "," 分隔经纬度 (GCJ02)
    const rings = polyline
      .split("|")
      .filter(Boolean)
      .map(ring => ring.split(";").map(pt => {
        const [lng, lat] = pt.split(",").map(Number);
        return gcj02ToWgs84(lng, lat);
      }));

    const boundary = rings.length > 1
      ? { type: "MultiPolygon", coordinates: rings.map(r => [r]) }
      : { type: "Polygon", coordinates: [rings[0]] };

    cache.set(district, boundary);
    return boundary;
  } catch (e) {
    console.error(`[districtBoundary] 获取 ${district} 边界失败:`, (e as Error).message);
    cache.set(district, null);
    return null;
  }
}

// 预取所有徐州行政区边界 (启动时预热, 避免分析时逐个请求)
export async function prefetchAllDistrictBoundaries(districts: string[]): Promise<void> {
  for (const d of districts) {
    await fetchDistrictBoundary(d);
  }
}
