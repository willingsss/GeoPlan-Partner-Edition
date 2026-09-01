// =========================================================================
// aiMock: 无 DeepSeek API Key 时的降级模拟回复（从 ai.ts 抽离，保持路由精简）
// =========================================================================
import type { Response } from "express";
import * as turf from "@turf/turf";
import { chargingStations } from "../db";

export async function streamMockAiResponse(
  res: Response,
  message: string,
  context?: string,
  isNearestQuery = false
): Promise<void> {
  const mockResponses: Record<string, string> = {
    "分布": "徐州市城区目前整合了四大品牌充电设施：\n\n**国家电网**（12座）：覆盖鼓楼区、云龙区、泉山区、铜山区，以快充为主，重点布局在交通枢纽和商业中心。\n\n**特来电**（10座）：分布较均匀，在居民区和商业区均有布局，快慢充搭配合理。\n\n**星星充电**（10座）：以慢充为主，主要分布在居民小区周边，服务老旧小区夜间充电需求。\n\n**蔚来换电站**（8座）：分布在核心商圈和交通节点，提供3分钟换电服务。\n\n总体来看，泉山区和鼓楼区充电设施较密集，铜山区和云龙区新城区覆盖相对不足。",
    "盲区": "充电盲区识别功能使用说明：\n\n1. 在「充电覆盖分析」面板选择快充或慢充模式\n2. 系统会自动为所有运营中充电站生成等时线服务区（快充800m/慢充400m）\n3. 将服务区与住宅小区面数据进行空间叠加分析\n4. 覆盖率低于10%的小区将被标记为盲区，在地图上以红色高亮显示\n5. 右侧ECharts看板会展示各行政区覆盖率、盲区数量及受影响人口\n\n当前徐州市盲区主要集中在：九里山片区、潘塘街道、高新区和西苑片区。",
    "选址": "选址决策建议：\n\n根据平台空间分析，推荐以下高价值选址区域：\n\n1. **西苑片区**（117.13, 34.26）：周边1.5km无充电站，覆盖人口约8900人，竞争避让度100分\n2. **九里山片区**（117.14, 34.29）：盲区社区，覆盖人口约6500人，社会效益显著\n3. **潘塘街道**（117.25, 34.21）：新城区盲区，覆盖人口约5400人，未来发展潜力大\n\n建议优先建设快充站，服务半径800m可最大化覆盖效果。使用「商业选址决策」面板的拖拽功能可实时评估不同位置的覆盖效果。",
  };

  // 最近站点推荐（降级模式：基于用户位置计算距离）
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