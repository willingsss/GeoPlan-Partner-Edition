import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase } from "../db";
import { wgs84ToGcj02, toEPSG4326 } from "../lib/geo";
import { parseGisIntent, doGisAnalysis } from "../services/aiContext";

export default function registerAiRoutes(app: express.Express) {

// =========================================================================
// 10. AI 辅助决策接口 (SSE 流式，通过 DeepSeek API)
// =========================================================================

// 从空间数据库/内存数据生成 AI 可用的上下文摘要
function getStationStatsContext(): string {
  const total = chargingStations.length;
  const operating = chargingStations.filter(s => s.status === "运营中").length;
  const byBrand: Record<string, number> = {};
  const byDistrict: Record<string, number> = {};
  chargingStations.forEach(s => {
    byBrand[s.brand] = (byBrand[s.brand] || 0) + 1;
    byDistrict[s.district] = (byDistrict[s.district] || 0) + 1;
  });
  return `徐州市充电设施最新统计：总计${total}座，运营中${operating}座。按品牌：${Object.entries(byBrand).map(([k, v]) => `${k}${v}座`).join("，")}。按行政区：${Object.entries(byDistrict).map(([k, v]) => `${k}${v}座`).join("，")}。`;
}

function getCoverageContext(radiusMeters: number): string {
  const features = communitiesDatabase.features || [];
  const operating = chargingStations.filter(s => s.status === "运营中");
  let totalPop = 0;
  let coveredPop = 0;
  let blindPop = 0;
  let blindCount = 0;
  const blinds: { name: string; district: string; pop: number; dist: number }[] = [];

  features.forEach(f => {
    const center = turf.centroid(f);
    const pop = Number(f.properties?.population_total || 0);
    totalPop += pop;
    let minDist = Infinity;
    operating.forEach(s => {
      const d = turf.distance(center, turf.point([s.lng, s.lat]), { units: "meters" });
      if (d < minDist) minDist = d;
    });
    if (minDist <= radiusMeters) {
      coveredPop += pop;
    } else {
      blindPop += pop;
      blindCount++;
      blinds.push({
        name: f.properties?.name || "未知社区",
        district: f.properties?.district || "未知区",
        pop,
        dist: minDist,
      });
    }
  });

  const topBlinds = blinds.sort((a, b) => b.pop - a.pop).slice(0, 8);
  return `充电覆盖分析（最近运营中站点距离>${radiusMeters}m视为盲区）：社区总数${features.length}个，覆盖人口约${coveredPop.toLocaleString()}人，盲区${blindCount}个（影响人口约${blindPop.toLocaleString()}人）。人口最多的盲区：${topBlinds.map(b => `${b.name}(${b.district}, ${b.pop.toLocaleString()}人, 距最近站${b.dist >= 1000 ? `${(b.dist / 1000).toFixed(1)}km` : `${Math.round(b.dist)}m`})`).join("；")}。`;
}

function getSchemeContext(): string {
  const list = schemesDatabase.slice(0, 5);
  if (!list.length) return "当前暂无已保存选址方案。";
  return `已保存选址方案（前5）：${list.map(s => `${s.name}(${s.brand}, 人口覆盖${s.covered_population}, 社区覆盖${s.covered_communities}, 竞争避让${s.competition_score}, 社会效益${s.social_benefit})`).join("；")}。`;
}

function getFeedbackContext(): string {
  const list = feedbackDatabase.slice(0, 8);
  if (!list.length) return "当前暂无公众反馈。";
  return `近期公众反馈（前8条）：${list.map(f => `${f.type === "demand" ? "需求" : "评价"}${f.rating ? `(${f.rating}星)` : ""}：${(f.description || "").slice(0, 30)}`).join("；")}。`;
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

app.post("/api/v1/ai/chat", async (req, res) => {
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

  // GIS 意图解析与空间分析
  const gisIntent = parseGisIntent(message, userLocation);
  let gisResult: any = null;
  if (gisIntent && userLocation) {
    gisResult = doGisAnalysis(gisIntent, userLocation);
  }

  // 注入 GIS 空间分析结果到上下文
  if (gisResult) {
    enrichedContext += `\n\n【GIS 空间分析结果（已以卡片形式展示给用户）】半径${(gisResult.radius/1000).toFixed(1)}km 范围内：充电站 ${gisResult.count} 座，覆盖人口约 ${gisResult.coveredPopulation.toLocaleString()} 人，覆盖社区 ${gisResult.coveredCommunities} 个。`;
    enrichedContext += `\n\n注意：站点列表已经以可点击卡片形式展示在用户界面上了，你不需要重复列出所有站点。请用 2-3 句话做简要总结和建议，例如：告诉用户最近的是哪个站、有多少个快充站可选、覆盖情况如何等。不要编造导航路线或行驶时间。`;
  }

  try {
    if (DEEPSEEK_API_KEY) {
      // 构造对话消息：system + 历史记录（最近10轮）+ 当前用户问题
      const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      if (Array.isArray(history)) {
        messages.push(...history.slice(-10));
      }
      const currentContent = enrichedContext
        ? `上下文信息：${enrichedContext}\n\n用户问题：${message}`
        : message;
      messages.push({ role: "user", content: currentContent });

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
          temperature: 0.8,
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
      // 无 API Key 时的降级模拟回复
      const mockResponses: Record<string, string> = {
        "分布": "徐州市城区目前整合了四大品牌充电设施：\n\n**国家电网**（12座）：覆盖鼓楼区、云龙区、泉山区、铜山区，以快充为主，重点布局在交通枢纽和商业中心。\n\n**特来电**（10座）：分布较均匀，在居民区和商业区均有布局，快慢充搭配合理。\n\n**星星充电**（10座）：以慢充为主，主要分布在居民小区周边，服务老旧小区夜间充电需求。\n\n**蔚来换电站**（8座）：分布在核心商圈和交通节点，提供3分钟换电服务。\n\n总体来看，泉山区和鼓楼区充电设施较密集，铜山区和云龙区新城区覆盖相对不足。",
        "盲区": "充电盲区识别功能使用说明：\n\n1. 在「充电覆盖分析」面板选择快充或慢充模式\n2. 系统会自动为所有运营中充电站生成等时线服务区（快充800m/慢充400m）\n3. 将服务区与住宅小区面数据进行空间叠加分析\n4. 覆盖率低于10%的小区将被标记为盲区，在地图上以红色高亮显示\n5. 右侧ECharts看板会展示各行政区覆盖率、盲区数量及受影响人口\n\n当前徐州市盲区主要集中在：九里山片区、潘塘街道、高新区和西苑片区。",
        "选址": "选址决策建议：\n\n根据平台空间分析，推荐以下高价值选址区域：\n\n1. **西苑片区**（117.13, 34.26）：周边1.5km无充电站，覆盖人口约8900人，竞争避让度100分\n2. **九里山片区**（117.14, 34.29）：盲区社区，覆盖人口约6500人，社会效益显著\n3. **潘塘街道**（117.25, 34.21）：新城区盲区，覆盖人口约5400人，未来发展潜力大\n\n建议优先建设快充站，服务半径800m可最大化覆盖效果。使用「商业选址决策」面板的拖拽功能可实时评估不同位置的覆盖效果。",
      };

      // 最近站点推荐 (降级模式：基于用户位置计算距离)
      if (isNearestQuery && context && context.includes("用户当前位置")) {
        const match = context.match(/经度\s*(-?\d+\.?\d*).*?纬度\s*(-?\d+\.?\d*)/);
        if (match) {
          const userLng = parseFloat(match[1]);
          const userLat = parseFloat(match[2]);
          const sorted = chargingStations
            .filter(s => s.status === "运营中")
            .map(s => {
              const dist = turf.distance(turf.point([userLng, userLat]), turf.point([s.lng, s.lat]), { units: "meters" });
              return { ...s, dist };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 5);
          if (sorted.length > 0) {
            let reply = `根据您的当前位置（${userLng.toFixed(5)}, ${userLat.toFixed(5)}），为您推荐最近的5个充电站：\n\n`;
            sorted.forEach((s, i) => {
              const distStr = s.dist >= 1000 ? `${(s.dist / 1000).toFixed(2)}km` : `${Math.round(s.dist)}m`;
              reply += `${i + 1}. **${s.name}** (${s.brand})\n   距离: ${distStr} | 位置: ${s.district} | 快充${s.fastChargers}/慢充${s.slowChargers}\n   坐标: ${s.lng}, ${s.lat}\n\n`;
            });
            reply += `💡 提示：在地图上点击对应充电站，弹出窗口中点击"去这里"即可规划导航路线。`;
            mockResponses["最近"] = reply;
            mockResponses["附近"] = reply;
            mockResponses["离我"] = reply;
          }
        }
      }

      let response = "您好！我是GeoPlan平台AI助手。我可以帮您查询充电设施分布、解释空间分析工具、提供选址建议等。请问有什么可以帮您的？\n\n您可以使用自然语言提问，例如：\n- \"徐州市充电设施分布概况\"\n- \"如何识别充电盲区\"\n- \"推荐几个选址方案\"";

      for (const key in mockResponses) {
        if (message && message.includes(key)) {
          response = mockResponses[key];
          break;
        }
      }

      // 模拟流式输出
      const chars = response.split("");
      for (let i = 0; i < chars.length; i += 3) {
        const chunk = chars.slice(i, i + 3).join("");
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 30));
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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