/**
 * 高德POI爬取脚本 - 获取徐州市真实充电站数据
 * 运行: npx tsx scripts/fetch-poi.ts
 */
import fs from "fs";
import path from "path";

const AMAP_KEY = "54bdabe8248cc003873f883aa3952941";
const CITY = "徐州";
const KEYWORD = "充电站";
const PAGE_SIZE = 20; // 高德API最大每页20条

interface AmapPoi {
  id: string;
  name: string;
  type: string;
  typecode: string;
  address: string;
  location: string; // "lng,lat"
  adname: string; // 行政区
  adcode: string;
  pname: string;
  cityname: string;
  tel: string;
}

interface AmapResponse {
  status: string;
  count: string;
  pois: AmapPoi[];
  info: string;
}

// 根据名称识别品牌
function detectBrand(name: string): string {
  if (name.includes("国家电网") || name.includes("国网") || name.includes("e充电")) return "国家电网";
  if (name.includes("特来电") || name.includes("特锐德")) return "特来电";
  if (name.includes("星星充电") || name.includes("星星")) return "星星充电";
  if (name.includes("蔚来") || name.includes("NIO") || name.includes("换电")) return "蔚来换电";
  if (name.includes("中国石化") || name.includes("中石化")) return "中国石化";
  if (name.includes("中国石油") || name.includes("中石油")) return "中国石油";
  if (name.includes("特斯拉") || name.includes("Tesla")) return "特斯拉";
  if (name.includes("小桔充电") || name.includes("滴滴")) return "小桔充电";
  if (name.includes("云快充")) return "云快充";
  if (name.includes("电能侠")) return "电能侠";
  if (name.includes("闪得") || name.includes("闪得能源")) return "闪得能源";
  return "其他品牌";
}

// 根据行政区名称标准化
function normalizeDistrict(adname: string, name: string, address: string): string {
  if (adname.includes("泉山")) return "泉山区";
  if (adname.includes("云龙")) return "云龙区";
  if (adname.includes("鼓楼")) return "鼓楼区";
  if (adname.includes("铜山")) return "铜山区";
  if (adname.includes("贾汪")) return "贾汪区";
  // 从名称/地址推断
  const text = name + address;
  if (text.includes("泉山")) return "泉山区";
  if (text.includes("云龙")) return "云龙区";
  if (text.includes("鼓楼")) return "鼓楼区";
  if (text.includes("铜山")) return "铜山区";
  return adname || "徐州市区";
}

async function fetchAllPois(): Promise<AmapPoi[]> {
  const allPois: AmapPoi[] = [];
  let page = 1;
  const maxPages = 30; // 高德API最多返回400条(20页)，但总数显示600，需翻页

  console.log(`开始爬取徐州市充电站POI数据...`);

  while (page <= maxPages) {
    const url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(KEYWORD)}&city=${encodeURIComponent(CITY)}&citylimit=true&offset=${PAGE_SIZE}&page=${page}&extensions=all`;
    
    try {
      const resp = await fetch(url);
      const data: AmapResponse = await resp.json();
      
      if (data.status !== "1") {
        console.error(`第${page}页请求失败: ${data.info}`);
        break;
      }

      if (!data.pois || data.pois.length === 0) {
        console.log(`第${page}页无数据，爬取完成`);
        break;
      }

      allPois.push(...data.pois);
      console.log(`第${page}页: 获取 ${data.pois.length} 条，累计 ${allPois.length}/${data.count}`);

      if (data.pois.length < PAGE_SIZE) {
        console.log("已到最后一页，爬取完成");
        break;
      }

      page++;
      // 高德API QPS限制，每页间隔200ms
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`第${page}页异常:`, e);
      break;
    }
  }

  return allPois;
}

async function main() {
  const pois = await fetchAllPois();
  console.log(`\n共爬取 ${pois.length} 条充电站POI数据`);

  // 去重（按POI id）
  const seen = new Set<string>();
  const unique = pois.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  console.log(`去重后: ${unique.length} 条`);

  // 过滤无效坐标
  const valid = unique.filter(p => p.location && p.location.includes(","));
  console.log(`有效坐标: ${valid.length} 条`);

  // 转换为平台数据格式
  const stations = valid.map((p, idx) => {
    const [lng, lat] = p.location.split(",").map(Number);
    const brand = detectBrand(p.name);
    const district = normalizeDistrict(p.adname, p.name, p.address);
    
    return {
      id: idx + 1,
      name: p.name,
      brand,
      lng,
      lat,
      fastChargers: 0, // POI数据无桩数信息，设为0
      slowChargers: 0,
      address: p.address || p.adname || "暂无地址",
      status: "运营中",
      district,
      updateTime: new Date().toISOString().slice(0, 10),
      tel: p.tel || "",
      amapId: p.id,
    };
  });

  // 品牌统计
  const brandStats: Record<string, number> = {};
  stations.forEach(s => {
    brandStats[s.brand] = (brandStats[s.brand] || 0) + 1;
  });
  console.log("\n品牌分布:");
  Object.entries(brandStats).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}座`);
  });

  // 行政区统计
  const districtStats: Record<string, number> = {};
  stations.forEach(s => {
    districtStats[s.district] = (districtStats[s.district] || 0) + 1;
  });
  console.log("\n行政区分布:");
  Object.entries(districtStats).sort((a, b) => b[1] - a[1]).forEach(([d, count]) => {
    console.log(`  ${d}: ${count}座`);
  });

  // 保存为JSON
  const outputPath = path.join(process.cwd(), "real_stations.json");
  fs.writeFileSync(outputPath, JSON.stringify(stations, null, 2), "utf-8");
  console.log(`\n数据已保存到: ${outputPath}`);
}

main().catch(console.error);
