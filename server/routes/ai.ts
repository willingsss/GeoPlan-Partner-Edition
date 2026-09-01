import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase } from "../db";
import { wgs84ToGcj02, toEPSG4326 } from "../lib/geo";
import { parseGisIntent, doGisAnalysis, resolveGisIntentByLLM } from "../services/aiContext";
import { getCommunityCentroids, nearestStation } from "../services/spatialIndex";
import { streamMockAiResponse } from "../services/aiMock";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export default function registerAiRoutes(app: express.Express) {

// =========================================================================
// 10. AI 辅助决策接口 (SSE 流式，通过 DeepSeek API)
// =========================================================================

// ===== 上下文结果缓存（TTL 30s 自动失效，避免重复全量计算）=====
function memoizeTtl<A extends any[], R>(fn: (...args: A) => R, ttlMs = 30_000): (...args: A) => R {
  const cache = new Map<string, { value: R; expiresAt: number }>();
  return (...args: A) => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now < hit.expiresAt) return hit.value;
    const value = fn(...args);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  };
}

// 从空间数据库/内存数据生成 AI 可用的上下文摘要
const getStationStatsContext = memoizeTtl((): string => {
  const total = chargingStations.length;
  const operating = chargingStations.filter(s => s.status === "运营中").length;
  const byBrand: Record<string, number> = {};
  const byDistrict: Record<string, number> = {};
  chargingStations.forEach(s => {
    byBrand[s.brand] = (byBrand[s.brand] || 0) + 1;
    byDistrict[s.district] = (byDistrict[s.district] || 0) + 1;
  });
  return `徐州市充电设施最新统计：总计${total}座，运营中${operating}座。按品牌：${Object.entries(byBrand).map(([k, v]) => `${k}${v}座`).join("，")}。按行政区：${Object.entries(byDistrict).map(([k, v]) => `${k}${v}座`).join("，")}。`;
});

const getCoverageContext = memoizeTtl((radiusMeters: number): string => {
  const centroids = getCommunityCentroids();
  let totalPop = 0;
  let coveredPop = 0;
  let blindPop = 0;
  let blindCount = 0;
  const blinds: { name: string; district: string; pop: number; dist: number }[] = [];

  for (const comm of centroids) {
    const pop = comm.population;
    totalPop += pop;
    // R-tree 最近邻替代逐站全量遍历（O(N) → O(log N)）
    const nearest = nearestStation(comm.centroid[0], comm.centroid[1], s => s.status === "运营中");
    const minDist = nearest
      ? turf.distance(turf.point(comm.centroid), turf.point([nearest.lng, nearest.lat]), { units: "meters" })
      : Infinity;
    if (minDist <= radiusMeters) {
      coveredPop += pop;
    } else {
      blindPop += pop;
      blindCount++;
      blinds.push({
        name: comm.feature.properties?.name || "未知社区",
        district: comm.feature.properties?.district || "未知区",
        pop,
        dist: minDist,
      });
    }
  }

  const topBlinds = blinds.sort((a, b) => b.pop - a.pop).slice(0, 8);
  return `充电覆盖分析（最近运营中站点距离>${radiusMeters}m视为盲区）：社区总数${centroids.length}个，覆盖人口约${coveredPop.toLocaleString()}人，盲区${blindCount}个（影响人口约${blindPop.toLocaleString()}人）。人口最多的盲区：${topBlinds.map(b => `${b.name}(${b.district}, ${b.pop.toLocaleString()}人, 距最近站${b.dist >= 1000 ? `${(b.dist / 1000).toFixed(1)}km` : `${Math.round(b.dist)}m`})`).join("；")}。`;
});

const getSchemeContext = memoizeTtl((): string => {
  const list = schemesDatabase.slice(0, 5);
  if (!list.length) return "当前暂无已保存选址方案。";
  return `已保存选址方案（前5）：${list.map(s => `${s.name}(${s.brand}, 人口覆盖${s.covered_population}, 社区覆盖${s.covered_communities}, 竞争避让${s.competition_score}, 社会效益${s.social_benefit})`).join("；")}。`;
});

const getFeedbackContext = memoizeTtl((): string => {
  const list = feedbackDatabase.slice(0, 8);
  if (!list.length) return "当前暂无公众反馈。";
  return `近期公众反馈（前8条）：${list.map(f => `${f.type === "demand" ? "需求" : "评价"}${f.rating ? `(${f.rating}星)` : ""}：${(f.description || "").slice(0, 30)}`).join("；")}。`;
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
// 与前端 useAiAssistant 的 HISTORY_LIMIT 保持一致
const AI_HISTORY_LIMIT = 8;

app.post("/api/v1/ai/chat", rateLimit({ windowMs: 60_000, max: 30 }), requireAuth, async (req, res) => {
  const { message, context, history, userLocation } = req.body;

  // 设置 SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const systemPrompt = `你是GeoPlan新能源充电设施规划与决策支持平台的AI助手，服务于徐州市城区。
你可以帮助用户：
1. 查询徐州市充电设施分布概况（国家电网、特来电、星星充电、蔚来换电四大品牌）
2. 解释充电覆盖分析、盲区识别、等时线服务区等空间分析工具的使用方法
3. 为投资商提供选址建议，分析覆盖人口、竞争环境、社会效益等维度
4. 解读Text-to-GIS自然语言空间检索功能
5. 回答新能源汽车充电相关问题
6. 当用户提供位置时，推荐距离用户最近的充电站
7. **GIS 交互功能**：当上下文信息中包含【GIS 空间分析结果】时，站点列表已经以可点击卡片形式展示在用户界面上了，你不需要重复列出所有站点，只需用2-3句话做简要总结和建议即可。不要在回复中使用 [station:ID] 或 [gis:...] 等标记格式。

徐州市主要行政区：泉山区、云龙区、鼓楼区、铜山区。
请用简洁专业的中文回答，适当使用要点列表。`;

  // 根据用户问题类型，注入空间数据库中的真实统计/空间分析上下文
  let enrichedContext = context || "";
  const lowerMsg = (message || "").toLowerCase();
  if (/分布|品牌|概况|多少|充电站|统计/.test(lowerMsg)) {
    enrichedContext += "\n\n" + getStationStatsContext();
  }
  if (/盲区|覆盖|覆盖率/.test(lowerMsg)) {
    const radius = lowerMsg.includes("慢充") ? 400 : 800;
    enrichedContext += "\n\n" + getCoverageContext(radius);
  }
  if (/选址|方案|推荐.*选址|投资/.test(lowerMsg)) {
    enrichedContext += "\n\n" + getSchemeContext();
  }
  if (/反馈|评价|公众|用户.*说/.test(lowerMsg)) {
    enrichedContext += "\n\n" + getFeedbackContext();
  }

  // 检测用户是否在询问"最近站点"类问题，并提供按距离排序后的充电站数据作为上下文
  const isNearestQuery = message && (message.includes("最近") || message.includes("附近") || message.includes("离我") || message.includes("导航"));
  if (isNearestQuery && chargingStations.length > 0) {
    const operatingStations = chargingStations.filter(s => s.status === "运营中");
    const locationMatch = enrichedContext.match(/经度\s*(-?\d+\.?\d*).*?纬度\s*(-?\d+\.?\d*)/);
    let stationList = "";

    if (locationMatch) {
      const userLng = parseFloat(locationMatch[1]);
      const userLat = parseFloat(locationMatch[2]);
      const sorted = operatingStations
        .map(s => ({
          ...s,
          dist: turf.distance(
            turf.point([userLng, userLat]),
            turf.point([s.lng, s.lat]),
            { units: "meters" }
          ),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5);

      stationList = sorted
        .map(s => {
          const distStr = s.dist >= 1000 ? `${(s.dist / 1000).toFixed(2)}km` : `${Math.round(s.dist)}m`;
          return `${s.name}(${s.brand}, ${s.district}, ${s.address}, 距离${distStr}, 快充${s.fastChargers}/慢充${s.slowChargers}, 坐标${s.lng},${s.lat})`;
        })
        .join("; ");
      enrichedContext += `\n\n用户当前位置：经度${userLng.toFixed(6)}, 纬度${userLat.toFixed(6)}。已按距离由近到远排序的附近运营中充电站：${stationList}`;
    } else {
      stationList = operatingStations
        .slice(0, 20)
        .map(s => `${s.name}(${s.brand}, ${s.district}, 经度${s.lng}, 纬度${s.lat}, 快充${s.fastChargers}/慢充${s.slowChargers})`)
        .join("; ");
      enrichedContext += `\n\n徐州市运营中充电站列表（共${operatingStations.length}座）：${stationList}`;
    }
    enrichedContext += `\n\n请根据上面已排序的真实数据，推荐最近的3-5个充电站。要求：\n- 必须直接使用列表中给出的距离，不要自行估算或重新计算；\n- 每个站点只列出名称、距离、地址、快充/慢充数量；\n- 不要编造具体的“导航建议”、转弯路线或行驶时间；\n- 最后一句话可简要提示最近的是哪个站；\n- 回答要口语化、简洁，每次不要使用固定格式和套话。`;
  }

  // GIS 意图解析与空间分析：优先 DeepSeek function calling，失败回退到正则
  const gisIntent = (await resolveGisIntentByLLM(message)) ?? parseGisIntent(message, userLocation);
  let gisResult: any = null;
  if (gisIntent) {
    // nearby 需用户位置才有意义；district/brand/coverage 可在无定位时用默认中心
    if (gisIntent.type !== "nearby" || userLocation) {
      gisResult = doGisAnalysis(gisIntent, userLocation);
    }
  }

  // 注入 GIS 空间分析结果到上下文（按意图类型生成不同摘要，避免误解）
  if (gisResult) {
    let summary: string;
    if (gisIntent!.type === "brand") {
      summary = `【GIS 空间分析结果（已以卡片形式展示给用户）】${gisResult.brand} 品牌在徐州市共有充电站 ${gisResult.count} 座。`;
    } else if (gisIntent!.type === "district") {
      summary = `【GIS 空间分析结果（已以卡片形式展示给用户）】${gisResult.district} 共有充电站 ${gisResult.count} 座${gisIntent!.fastOnly ? "（仅快充）" : ""}，覆盖人口约 ${gisResult.coveredPopulation.toLocaleString()} 人，覆盖社区 ${gisResult.coveredCommunities} 个。`;
    } else {
      summary = `【GIS 空间分析结果（已以卡片形式展示给用户）】半径${(gisResult.radius / 1000).toFixed(1)}km 范围内：充电站 ${gisResult.count} 座，覆盖人口约 ${gisResult.coveredPopulation.toLocaleString()} 人，覆盖社区 ${gisResult.coveredCommunities} 个。`;
    }
    enrichedContext += `\n\n${summary}`;
    enrichedContext += `\n\n注意：站点列表已经以可点击卡片形式展示在用户界面上了，你不需要重复列出所有站点。请用 2-3 句话做简要总结和建议，例如：告诉用户最近的是哪个站、有多少个快充站可选、覆盖情况如何等。不要编造导航路线或行驶时间。`;
  }

  try {
    if (DEEPSEEK_API_KEY) {
      // 构造对话消息：system + 历史记录（最近 AI_HISTORY_LIMIT 轮）+ 当前用户问题
      const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      if (Array.isArray(history)) {
        messages.push(...history.slice(-AI_HISTORY_LIMIT));
      }
      const currentContent = enrichedContext
        ? `上下文信息：${enrichedContext}\n\n用户问题：${message}`
        : message;
      messages.push({ role: "user", content: currentContent });

      // 事实/统计类问题降温度，减少随机性，提高确定性
      const isFactQuery = /覆盖|盲区|多少|数量|几座|统计|概况|分布|计数/.test(lowerMsg);
      const temperature = isFactQuery || gisResult ? 0.2 : 0.8;

      const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          stream: true,
          temperature,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("[AI] DeepSeek API 错误:", resp.status, errText);
        res.write(`data: ${JSON.stringify({ content: `DeepSeek API 错误 (${resp.status})` })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("无法获取响应流");

      // 如果有 GIS 分析结果，先发送结构化数据事件
      if (gisResult) {
        const gisPayload = {
          type: gisIntent.type,
          radius: gisResult.radius,
          center: gisResult.center,
          count: gisResult.count,
          coveredPopulation: gisResult.coveredPopulation,
          coveredCommunities: gisResult.coveredCommunities,
          district: gisResult.district,
          brand: gisResult.brand,
          stations: gisResult.stations.slice(0, 10).map((s: any) => ({
            id: s.id,
            name: s.name,
            brand: s.brand,
            lng: s.lng,
            lat: s.lat,
            address: s.address,
            district: s.district,
            fastChargers: s.fastChargers,
            slowChargers: s.slowChargers,
            distanceKm: s.distanceKm != null ? Number(s.distanceKm.toFixed(2)) : undefined,
          })),
        };
        res.write(`data: ${JSON.stringify({ gisResult: gisPayload })}\n\n`);
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const json = JSON.parse(jsonStr);
              const text = json.choices?.[0]?.delta?.content || "";
              if (text) {
                res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
              }
            } catch {}
          }
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } else {
      // 无 API Key 时的降级模拟回复（逻辑抽离到 aiMock 服务）
      await streamMockAiResponse(res, message, context, isNearestQuery);
    }
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  }
  res.end();
});

// =========================================================================
// 10.5 路线规划接口 (调用高德驾车路径规划 API 获取真实路线)
// =========================================================================
app.get("/api/v1/route", async (req, res) => {
  const { fromLng, fromLat, toLng, toLat } = req.query;
  const fLng = parseFloat(fromLng as string);
  const fLat = parseFloat(fromLat as string);
  const tLng = parseFloat(toLng as string);
  const tLat = parseFloat(toLat as string);
  if (isNaN(fLng) || isNaN(fLat) || isNaN(tLng) || isNaN(tLat)) {
    return res.status(400).json({ success: false, message: "坐标参数无效" });
  }
  const key = process.env.VITE_AMAP_KEY || "";
  if (!key) {
    return res.status(500).json({ success: false, message: "高德 API Key 未配置" });
  }
  try {
    const [gO_lng, gO_lat] = wgs84ToGcj02(fLng, fLat);
    const [gD_lng, gD_lat] = wgs84ToGcj02(tLng, tLat);
    const gcjOrigin = `${gO_lng},${gO_lat}`;
    const gcjDest = `${gD_lng},${gD_lat}`;
    const url = `https://restapi.amap.com/v3/direction/driving?key=${key}&origin=${gcjOrigin}&destination=${gcjDest}&extensions=all&strategy=0&output=json`;
    console.log("[Route] 请求高德驾车API:", url);
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status !== "1") {
      console.warn("[Route] 高德API返回失败:", data.info, data.infocode);
      return res.json({
        success: false,
        message: `高德驾车规划失败: ${data.info || "未知错误"}`,
        data: null,
      });
    }
    if (!data.route?.paths?.length) {
      console.warn("[Route] 高德API无路径返回:", JSON.stringify(data.route));
      return res.json({ success: false, message: "高德API未返回路径", data: null });
    }
    const route = data.route.paths[0];
    const steps = route.steps || [];
    console.log("[Route] 高德返回路径:", steps.length, "个路段, 距离:", route.distance, "米, 时间:", route.duration, "秒");
    const gcjPoints: [number, number][] = [];
    const navSteps: { instruction: string; road: string; distance: number; duration: number; action: string }[] = [];
    for (const step of steps) {
      if (step.polyline) {
        const segs = step.polyline.split(";");
        for (const seg of segs) {
          const [x, y] = seg.split(",");
          const lng = parseFloat(x);
          const lat = parseFloat(y);
          if (!isNaN(lng) && !isNaN(lat)) gcjPoints.push([lng, lat]);
        }
      }
      navSteps.push({
        instruction: step.instruction || "",
        road: step.road || "",
        distance: parseInt(step.distance) || 0,
        duration: parseInt(step.duration) || 0,
        action: (Array.isArray(step.action) ? step.action[0] : step.action || ""),
      });
    }
    console.log("[Route] 解析路径点:", gcjPoints.length, "个");
    if (gcjPoints.length < 2) {
      return res.json({ success: false, message: "路径点太少", data: null });
    }
    res.json({
      success: true,
      data: {
        path: gcjPoints,
        steps: navSteps,
        distance: parseInt(route.distance) || Math.round(turf.distance(turf.point([fLng, fLat]), turf.point([tLng, tLat]), { units: "meters" })),
        duration: parseInt(route.duration) || 0,
        source: "amap",
      },
    });
  } catch (e: any) {
    console.error("[Route] 高德API请求异常:", e.message, e.stack);
    res.json({ success: false, message: e.message, data: null });
  }
});

// =========================================================================
// 10.6 地点搜索接口 (调用高德地理编码/POI搜索 API)
// =========================================================================
app.get("/api/v1/places/search", async (req, res) => {
  const { keyword } = req.query;
  if (!keyword || (keyword as string).trim().length === 0) {
    return res.json({ success: false, message: "请输入搜索关键词" });
  }
  const key = process.env.VITE_AMAP_KEY || "";
  if (!key) {
    return res.status(500).json({ success: false, message: "高德 API Key 未配置" });
  }
  try {
    const results: any[] = [];
    const kw = encodeURIComponent(keyword as string);

    // 地理编码 (地址转坐标)
    const geoResp = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${kw}&city=320300&output=json`);
    const geoData = await geoResp.json();
    if (geoData.status === "1" && geoData.geocodes?.length > 0) {
      geoData.geocodes.forEach((g: any) => {
        const [lng, lat] = (g.location || "0,0").split(",").map(Number);
        results.push({ name: g.formatted_address || g.address, lng, lat, address: g.formatted_address || "", district: g.district || "", type: "address" });
      });
    }

    // POI 搜索 (地标/场所名)
    const poiResp = await fetch(`https://restapi.amap.com/v3/place/text?key=${key}&keywords=${kw}&city=320300&output=json&offset=8`);
    const poiData = await poiResp.json();
    if (poiData.status === "1" && poiData.pois?.length > 0) {
      const existing = new Set(results.map(r => r.name));
      poiData.pois.forEach((p: any) => {
        const [lng, lat] = (p.location || "0,0").split(",").map(Number);
        if (!existing.has(p.name)) {
          results.push({ name: p.name, lng, lat, address: p.address || "", district: (p.pname || "") + (p.cityname || "") + (p.adname || ""), type: "poi" });
          existing.add(p.name);
        }
      });
    }

    res.json({ success: true, data: results.slice(0, 8) });
  } catch (e: any) {
    console.error("[Place Search] 高德API请求异常:", e.message);
    res.json({ success: false, message: e.message, data: [] });
  }
});

// =========================================================================
}