// GeoPlan 数据库连接池 + 内存数据存储（启动时从 MySQL/CSV 加载）
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";
import type { ChargingStation } from "./types";
import { OPERATOR_TO_BRAND } from "./lib/brands";
import { toEPSG4326 } from "./lib/geo";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 数据文件位于项目根 data/ 目录（本文件在 server/ 下）
const DATA_DIR = path.join(__dirname, "..", "data");

// =========================================================================
// 0. MySQL 数据库连接池
// =========================================================================
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "geoplan",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

// =========================================================================
// CSV 解析与充电站数据加载
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

// 从 charging_stations.csv 加载 (后备数据源, 坐标为 GCJ02)
const csvPath = path.join(DATA_DIR, "charging_stations.csv");
let chargingStations: ChargingStation[] = [];
if (fs.existsSync(csvPath)) {
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const csvLines = csvContent.split(/\r?\n/).filter(l => l.trim());
  chargingStations = csvLines.slice(1).map((line, idx) => {
    const fields = parseCSVLine(line);
    // 字段顺序: name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status, operator
    const name = fields[0] || `充电站${idx + 1}`;
    const operator = fields[9] || fields[1] || "state_grid";
    const brand = OPERATOR_TO_BRAND[operator] || "其他品牌";
    const lng = parseFloat(fields[2]) || 0;
    const lat = parseFloat(fields[3]) || 0;
    const fastChargers = parseInt(fields[4]) || 0;
    const slowChargers = parseInt(fields[5]) || 0;
    const address = fields[6] || "暂无地址";
    let district = fields[7] || "徐州市区";
    district = district.replace(/"/g, "").trim();
    const statusNum = parseInt(fields[8]) || 1;
    const status = statusNum === 1 ? "运营中" : "维护中";

    return {
      id: idx + 1,
      name,
      brand,
      lng,
      lat,
      fastChargers,
      slowChargers,
      address,
      status,
      district,
      updateTime: new Date().toISOString().slice(0, 10),
    };
  }).filter(s => s.lng > 0 && s.lat > 0); // 过滤无效坐标
}

// 从数据库加载充电站数据 (WGS84 坐标 + 等时圈几何)
async function loadStationsFromDB(): Promise<ChargingStation[]> {
  const [rows] = await dbPool.query(
    `SELECT id, station_code, name, brand, district, address,
            fast_chargers, slow_chargers, total_power, status, lng, lat,
            ST_AsGeoJSON(geom) AS geom_geojson,
            isochrone_fast_geom, isochrone_slow_geom, isochrone_status, isochrone_fast_updated
     FROM t_charging_station ORDER BY id`
  );
  return (rows as any[]).map((r) => {
    const base: ChargingStation = {
      id: r.id,
      name: r.name,
      brand: r.brand,
      lng: Number(r.lng),
      lat: Number(r.lat),
      fastChargers: Number(r.fast_chargers),
      slowChargers: Number(r.slow_chargers),
      address: r.address || "",
      status: r.status,
      district: r.district || "",
      updateTime: r.update_time ? new Date(r.update_time).toISOString().slice(0, 10) : "",
    };
    // 等时圈几何（预计算时已转为 WGS84 经纬度 GeoJSON；mysql2 对 JSON 字段自动解析为对象，直接使用）
    try {
      if (r.isochrone_fast_geom) base.isochroneFastGeom = r.isochrone_fast_geom;
      if (r.isochrone_slow_geom) base.isochroneSlowGeom = r.isochrone_slow_geom;
      base.isochroneStatus = r.isochrone_status || undefined;
      base.isochroneFastUpdated = r.isochrone_fast_updated ? new Date(r.isochrone_fast_updated).toISOString() : undefined;
    } catch { /* 几何解析失败则忽略 */ }
    return base;
  });
}

// =========================================================================
// 4.1 从数据库加载反馈数据
// =========================================================================
async function loadFeedbackFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(
    `SELECT id, type, description, rating, lng, lat, submitter, status, create_time
     FROM t_feedback ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    type: r.type,
    lng: Number(r.lng),
    lat: Number(r.lat),
    description: r.description || "",
    rating: r.rating != null ? Number(r.rating) : undefined,
    submitter: r.submitter || "",
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
    status: r.status,
  }));
}

// =========================================================================
// 4.2 从数据库加载方案数据
// =========================================================================
async function loadSchemesFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(
    `SELECT id, name, lng, lat, radius, brand,
            covered_population, covered_communities, blind_spot_reduction,
            competition_score, social_benefit, creator, create_time
     FROM t_scheme ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    lng: Number(r.lng),
    lat: Number(r.lat),
    radius: Number(r.radius),
    brand: r.brand,
    covered_population: Number(r.covered_population),
    covered_communities: Number(r.covered_communities),
    blind_spot_reduction: Number(r.blind_spot_reduction),
    competition_score: Number(r.competition_score),
    social_benefit: Number(r.social_benefit),
    creator: r.creator,
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
  }));
}

// =========================================================================
// 4.3 从数据库加载日志数据
// =========================================================================
async function loadLogsFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(`SELECT id, user, action, detail, ip_address, create_time FROM t_log ORDER BY id DESC LIMIT 500`);
  return (rows as any[]).map((r) => ({
    id: r.id,
    user: r.user,
    action: r.action,
    detail: r.detail,
    ip_address: r.ip_address,
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
  }));
}

// =========================================================================
// 5. 住宅小区面数据 (388个社区) —— WGS84, 从 MySQL t_community 加载
// =========================================================================
let communitiesDatabase: any = {
  type: "FeatureCollection",
  features: [],
};

async function loadCommunitiesFromDB(): Promise<any> {
  const [rows] = await dbPool.query(
    `SELECT id, name, district, subdistrict, population_total, household_count, area_gis,
            ST_AsGeoJSON(geom) AS geojson
     FROM t_community ORDER BY id`
  );
  const features = (rows as any[]).map((r) => ({
    type: "Feature",
    id: r.id,
    geometry: typeof r.geojson === "string" ? JSON.parse(r.geojson) : r.geojson,
    properties: {
      name: r.name,
      district: r.district,
      subdistrict: r.subdistrict,
      population_total: Number(r.population_total),
      household_count: Number(r.household_count),
      area_gis: Number(r.area_gis),
    },
  }));
  return { type: "FeatureCollection", features };
}

// =========================================================================
// 反馈/方案/日志 内存数据库
// =========================================================================
let feedbackDatabase: any[] = [];
let schemesDatabase: any[] = [];
let usersDatabase: any[] = [];
let systemLogs: any[] = [];

// =========================================================================
// 8. 系统用户数据 —— 从 MySQL t_user 表加载
// =========================================================================
async function loadUsersFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(
    `SELECT id, username, password_hash AS password, role, status, create_time
     FROM t_user ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    username: r.username,
    password: r.password,
    role: r.role,
    status: r.status,
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
  }));
}

// =========================================================================
// 8.1 会话管理 (简易 Token 机制，内存存储)
// =========================================================================
const sessions: Map<string, { userId: number; username: string; role: string; loginAt: number }> = new Map();

function generateToken(): string {
  return "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 解析请求中的 token (从 Authorization 头或 query 中读取)
function getTokenFromRequest(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  if (typeof req.query.token === "string") return req.query.token;
  return null;
}

export {
  dbPool, DATA_DIR, chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase,
  usersDatabase, systemLogs, sessions, generateToken, getTokenFromRequest,
  loadStationsFromDB, loadFeedbackFromDB, loadSchemesFromDB, loadLogsFromDB,
  loadCommunitiesFromDB, loadUsersFromDB,
};
