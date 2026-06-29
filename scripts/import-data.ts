// =========================================================================
// 数据导入脚本：将充电桩 CSV (GCJ02) 和社区 CSV (WGS84) 导入 MySQL 数据库
// 充电站坐标: GCJ02 → WGS84 转换后入库 (统一存储 WGS84)
// 社区坐标: WGS84 原值入库
// 运行: npx tsx scripts/import-data.ts
// =========================================================================
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// =========================================================================
// 1. GCJ02 ↔ WGS84 坐标转换 (与 App.tsx 中算法一致)
// =========================================================================
const PI = 3.1415926535897932384626;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

// GCJ02 -> WGS84 (迭代逼近法)
function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
  const dLng = lng - gcjLng;
  const dLat = lat - gcjLat;
  return [lng + dLng, lat + dLat];
}

// =========================================================================
// 2. CSV 解析 (支持带引号的字段)
// =========================================================================
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// operator 英文代码 -> 中文品牌名映射
const OPERATOR_TO_BRAND: Record<string, string> = {
  state_grid: "国家电网",
  star_charge: "星星充电",
  teld: "特来电",
  nio_swap: "蔚来换电",
};

// =========================================================================
// 3. 主导入流程
// =========================================================================
async function main() {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "geoplan";

  console.log(`[导入脚本] 连接 MySQL ${user}@${host}:${port}/${database} ...`);
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  console.log("[导入脚本] 数据库连接成功");

  // -------------------------------------------------------------------------
  // 3.1 清空旧数据
  // -------------------------------------------------------------------------
  console.log("[导入脚本] 清空 t_charging_station 和 t_community 旧数据 ...");
  await conn.query("DELETE FROM t_charging_station");
  await conn.query("DELETE FROM t_community");

  // -------------------------------------------------------------------------
  // 3.2 导入充电站数据 (charging_stations.csv, GCJ02 → WGS84)
  // -------------------------------------------------------------------------
  const stationsCsvPath = path.join(process.cwd(), "data", "charging_stations.csv");
  console.log(`[导入脚本] 读取充电站 CSV: ${stationsCsvPath}`);
  const stationsCsv = fs.readFileSync(stationsCsvPath, "utf-8");
  const stationLines = stationsCsv.split(/\r?\n/).filter(l => l.trim());

  let stationCount = 0;
  for (let i = 1; i < stationLines.length; i++) {
    const fields = parseCSVLine(stationLines[i]);
    // 字段: name, brand(operator), lng, lat, fast_count, slow_count, address, district, status, operator
    const name = fields[0] || `充电站${i}`;
    const operator = fields[9] || fields[1] || "state_grid";
    const brand = OPERATOR_TO_BRAND[operator] || "其他品牌";
    const gcjLng = parseFloat(fields[2]) || 0;
    const gcjLat = parseFloat(fields[3]) || 0;
    if (gcjLng <= 0 || gcjLat <= 0) continue;

    // GCJ02 → WGS84 转换
    const [wgsLng, wgsLat] = gcj02ToWgs84(gcjLng, gcjLat);
    const fastChargers = parseInt(fields[4]) || 0;
    const slowChargers = parseInt(fields[5]) || 0;
    const address = fields[6] || "暂无地址";
    let district = (fields[7] || "徐州市区").replace(/"/g, "").trim();
    const statusNum = parseInt(fields[8]) || 1;
    const status = statusNum === 1 ? "运营中" : "维护中";
    const stationCode = `XZ-${operator.toUpperCase().slice(0, 3)}-${String(i).padStart(4, "0")}`;

    // MySQL 9.x SRID 4326 坐标轴顺序: (lat, lon)
    const geomWkt = `POINT(${wgsLat.toFixed(6)} ${wgsLng.toFixed(6)})`;

    await conn.execute(
      `INSERT INTO t_charging_station
        (station_code, name, brand, district, address, fast_chargers, slow_chargers, total_power, status, lng, lat, geom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326))`,
      [stationCode, name, brand, district, address, fastChargers, slowChargers, 0, status,
       wgsLng.toFixed(6), wgsLat.toFixed(6), geomWkt]
    );
    stationCount++;
  }
  console.log(`[导入脚本] 充电站导入完成: ${stationCount} 条`);

  // -------------------------------------------------------------------------
  // 3.3 导入社区数据 (全量小区面_含模拟字段_已估算.json, WGS84 原值, 不做坐标转换)
  // -------------------------------------------------------------------------
  const communitiesJsonPath = path.join(process.cwd(), "data", "全量小区面_含模拟字段_已估算.json");
  console.log(`[导入脚本] 读取社区 JSON: ${communitiesJsonPath}`);
  const communitiesJson = JSON.parse(fs.readFileSync(communitiesJsonPath, "utf-8"));
  const communityFeatures = communitiesJson.features || [];
  console.log(`[导入脚本] JSON 含 ${communityFeatures.length} 个住区要素`);

  // 计算多边形面积 (球面近似, 平方米)
  function polygonArea(coords: number[][]): number {
    if (!coords || coords.length < 3) return 0;
    let area = 0;
    const R = 6378137;
    const n = coords.length;
    for (let i = 0; i < n - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      area += (lng2 - lng1) * (2 + Math.sin(lat1 * PI / 180) + Math.sin(lat2 * PI / 180));
    }
    area = Math.abs(area * R * R / 2);
    return area;
  }

  let communityCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < communityFeatures.length; i++) {
    const feat = communityFeatures[i];
    const props = feat.properties || {};
    const geom = feat.geometry;

    if (!geom || !geom.coordinates) {
      skippedCount++;
      continue;
    }

    const name = (props.name_1 || props.csv_name || props.name || "").trim();
    if (!name) {
      skippedCount++;
      continue;
    }

    const district = (props.adname || "未知").trim();
    const areaGis = Number(props.area_sqm) || 0;
    const population = parseInt(props.population) || 0;
    const buildingCount = parseInt(props.building_count) || 0;
    let householdCount = 0;
    if (population > 0) {
      householdCount = Math.round(population / 3);
    } else if (areaGis > 0) {
      householdCount = Math.round(areaGis / 120);
    }

    let polygonCoords: number[][] = [];
    if (geom.type === "Polygon") {
      polygonCoords = geom.coordinates[0] || [];
    } else if (geom.type === "MultiPolygon") {
      let maxArea = 0;
      for (const poly of geom.coordinates) {
        const a = polygonArea(poly[0] || []);
        if (a > maxArea) {
          maxArea = a;
          polygonCoords = poly[0] || [];
        }
      }
    }

    if (polygonCoords.length < 3) {
      skippedCount++;
      continue;
    }

    const wgsCoords = polygonCoords.map(([glng, glat]) => [glng, glat] as [number, number]);

    let pop = population;
    let hhCount = householdCount;
    if (pop > 50000) pop = 50000;
    if (hhCount > 15000) hhCount = 15000;

    const ring = wgsCoords.map(([wlng, wlat]) => `${wlat.toFixed(6)} ${wlng.toFixed(6)}`);
    const first = ring[0];
    if (ring[ring.length - 1] !== first) {
      ring.push(first);
    }
    const polygonWkt = `POLYGON((${ring.join(", ")}))`;

    const communityCode = `XZ-CM-${String(i + 1).padStart(4, "0")}`;

    try {
      await conn.execute(
        `INSERT INTO t_community
          (community_code, name, district, subdistrict, population_total, household_count, area_gis, geom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326))`,
        [communityCode, name, district, "未知街道", pop, hhCount, areaGis, polygonWkt]
      );
      communityCount++;
    } catch (err: any) {
      console.warn(`[导入脚本] 第 ${i + 1} 条 "${name}" 入库失败: ${err.message}`);
      skippedCount++;
    }
  }
  console.log(`[导入脚本] 社区导入完成: ${communityCount} 条 (跳过 ${skippedCount} 条)`);

  // -------------------------------------------------------------------------
  // 3.4 验证导入结果
  // -------------------------------------------------------------------------
  const [stationRows] = await conn.query("SELECT COUNT(*) AS cnt FROM t_charging_station");
  const [communityRows] = await conn.query("SELECT COUNT(*) AS cnt FROM t_community");
  console.log(`[导入脚本] 数据库验证: 充电站 ${(stationRows as any[])[0].cnt} 条, 社区 ${(communityRows as any[])[0].cnt} 条`);

  await conn.end();
  console.log("[导入脚本] 导入完成，数据库连接已关闭");
}

main().catch((err) => {
  console.error("[导入脚本] 错误:", err);
  process.exit(1);
});
