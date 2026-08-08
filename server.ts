import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { precomputeAsync, getPrecomputeProgress } from "./server/services/isochronePrecompute";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

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
// 1. 空间坐标投影变换 (EPSG:4326 <=> EPSG:3857)
// =========================================================================
function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

function toEPSG3857(coord: [number, number]): [number, number] {
  const [lng, lat] = coord;
  const x = (lng * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
}

function toEPSG4326(coord: [number, number]): [number, number] {
  const [x, y] = coord;
  const lng = (x * 180) / 20037508.34;
  let lat = (y * 180) / 20037508.34;
  lat = (360 * clamp(Math.atan(Math.exp((lat * Math.PI) / 180)), 0, Math.PI) / Math.PI) - 90;
  return [lng, lat];
}

// WGS84 -> GCJ-02 坐标转换 (用于调用高德 API)
function wgs84ToGcj02(lng: number, lat: number): [number, number] {
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
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

function projectGeometryTo3857(geom: any): any {
  const cloned = JSON.parse(JSON.stringify(geom));
  turf.coordEach(cloned, (coord) => {
    const projected = toEPSG3857([coord[0], coord[1]]);
    coord[0] = projected[0];
    coord[1] = projected[1];
  });
  return cloned;
}

function projectGeometryTo4326(geom: any): any {
  const cloned = JSON.parse(JSON.stringify(geom));
  turf.coordEach(cloned, (coord) => {
    const projected = toEPSG4326([coord[0], coord[1]]);
    coord[0] = projected[0];
    coord[1] = projected[1];
  });
  return cloned;
}

// =========================================================================
// 1.1 空间索引与几何缓存工具（覆盖分析性能优化用）
// =========================================================================
// 矩形 bbox: [minX, minY, maxX, maxY]
type BBox = [number, number, number, number];

// 矩形快速相交判定（不接触视为不相交）
function bboxIntersect(b1: BBox, b2: BBox): boolean {
  return !(b1[2] < b2[0] || b1[0] > b2[2] || b1[3] < b2[1] || b1[1] > b2[3]);
}

// 计算几何在 EPSG:3857 下的 bbox（懒缓存到 feature 上）
function getCachedBBox3857(feature: any): BBox {
  if (!feature._bbox3857) {
    const projected = projectGeometryTo3857(feature);
    const bbox = turf.bbox(projected); // [minX, minY, maxX, maxY]
    feature._bbox3857 = bbox;
    feature._proj3857 = projected;
  }
  return feature._bbox3857;
}

// 计算几何在 EPSG:3857 下的质心（懒缓存到 feature 上）
function getCachedCentroid3857(feature: any): [number, number] {
  if (!feature._centroid3857) {
    const bbox = getCachedBBox3857(feature);
    // 用 bbox 中心近似质心（更快，社区面足够规则）
    feature._centroid3857 = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }
  return feature._centroid3857;
}

// 取已缓存的 3857 投影几何（必须先调用 getCachedBBox3857）
function getCachedProj3857(feature: any): any {
  return feature._proj3857;
}

// =========================================================================
// 2. 平面多边形面积计算 (鞋带定理, EPSG:3857)
// =========================================================================
function getPlanarPolygonArea3857(poly: any): number {
  if (!poly || !poly.geometry) return 0;
  const geomType = poly.geometry.type;
  if (geomType === "Polygon") {
    return getSingleRingArea3857(poly.geometry.coordinates[0]);
  } else if (geomType === "MultiPolygon") {
    let total = 0;
    for (const polygonCoords of poly.geometry.coordinates) {
      total += getSingleRingArea3857(polygonCoords[0]);
    }
    return total;
  }
  return 0;
}

function getSingleRingArea3857(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

// =========================================================================
// 3. 在 EPSG:3857 下创建圆形缓冲区面 (模拟等时线服务区)
// =========================================================================
function createPlanarBuffer3857(center3857: [number, number], radiusMeters: number, steps: number = 64): any {
  const [centerX, centerY] = center3857;
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i * 2 * Math.PI) / steps;
    const x = centerX + radiusMeters * Math.cos(theta);
    const y = centerY + radiusMeters * Math.sin(theta);
    ring.push([x, y]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return turf.polygon([ring]);
}

// =========================================================================
// 4. 真实数据：徐州市充电设施点数据 (367座, 来源于高德地图POI搜索)
// 坐标系: 数据库统一存储 WGS84 (导入时已从 GCJ02 转换)
// 数据源: MySQL t_charging_station 表 (启动时加载)，CSV 作为后备
// =========================================================================
interface ChargingStation {
  id: number;
  name: string;
  brand: string;
  lng: number;
  lat: number;
  fastChargers: number;
  slowChargers: number;
  address: string;
  status: string;
  district: string;
  updateTime: string;
  operator?: string;
  // 等时圈服务区（基于真实路网的可达范围）
  isochroneFastGeom?: any;      // 快充等时圈多边形 (WGS84 GeoJSON Polygon)
  isochroneSlowGeom?: any;      // 慢充等时圈多边形
  isochroneFastUpdated?: string;
  isochroneSlowUpdated?: string;
  isochroneStatus?: "pending" | "ok" | "partial" | "failed";
}

// operator 英文代码 -> 中文品牌名映射
const OPERATOR_TO_BRAND: Record<string, string> = {
  state_grid: "国家电网",
  star_charge: "星星充电",
  teld: "特来电",
  nio_swap: "蔚来换电",
};

// 简易CSV解析（支持带引号的字段）
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
const csvPath = path.join(__dirname, "data", "charging_stations.csv");
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
    // 清理district中可能的引号残留
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
    `SELECT id, name, brand, district, address, fast_chargers, slow_chargers, status, lng, lat, update_time,
            isochrone_fast_geom, isochrone_slow_geom,
            isochrone_fast_updated, isochrone_slow_updated, isochrone_status
     FROM t_charging_station ORDER BY id`
  );
  return (rows as any[]).map((r) => {
    // mysql2 对 JSON 字段可能返回对象或字符串，统一为对象
    const parseJson = (v: any): any | undefined => {
      if (v == null) return undefined;
      if (typeof v === "string") { try { return JSON.parse(v); } catch { return undefined; } }
      return v;
    };
    // 等时圈几何在数据库中以 Geometry 存储, 统一包装为 Feature 以兼容预计算内存格式
    // (saveStationIsochrone 存的是 geom.geometry, 服务器重启后从 DB 加载需还原为 Feature)
    const parseIsochroneGeom = (v: any): any | undefined => {
      const geom = parseJson(v);
      if (!geom) return undefined;
      if (geom.type === "Feature") return geom;
      if (geom.type === "Polygon" || geom.type === "MultiPolygon") return turf.feature(geom);
      return undefined;
    };
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      lng: Number(r.lng),
      lat: Number(r.lat),
      fastChargers: Number(r.fast_chargers),
      slowChargers: Number(r.slow_chargers),
      address: r.address,
      status: r.status == 1 ? "运营中" : "维护中",
      district: r.district,
      updateTime: r.update_time ? new Date(r.update_time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      isochroneFastGeom: parseIsochroneGeom(r.isochrone_fast_geom),
      isochroneSlowGeom: parseIsochroneGeom(r.isochrone_slow_geom),
      isochroneFastUpdated: r.isochrone_fast_updated ? new Date(r.isochrone_fast_updated).toISOString() : undefined,
      isochroneSlowUpdated: r.isochrone_slow_updated ? new Date(r.isochrone_slow_updated).toISOString() : undefined,
      isochroneStatus: r.isochrone_status || "pending",
    };
  });
}

// =========================================================================
// 4.1 从数据库加载反馈数据
// =========================================================================
async function loadFeedbackFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(
    `SELECT id, type, description, rating, lng, lat, submitter, contact, status, create_time FROM t_feedback ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
    id: r.id, type: r.type, description: r.description, rating: r.rating,
    lng: Number(r.lng), lat: Number(r.lat),
    submitter: r.submitter, contact: r.contact, status: r.status,
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
  }));
}

// =========================================================================
// 4.2 从数据库加载方案数据
// =========================================================================
async function loadSchemesFromDB(): Promise<any[]> {
  const [rows] = await dbPool.query(
    `SELECT id, name, lng, lat, radius, brand, covered_population, covered_communities, blind_spot_reduction, competition_score, social_benefit, creator, create_time FROM t_scheme ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
    id: r.id, name: r.name, lng: Number(r.lng), lat: Number(r.lat),
    radius: r.radius, brand: r.brand,
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
  const [rows] = await dbPool.query(
    `SELECT id, user, action, detail, ip_address, create_time FROM t_log ORDER BY id DESC LIMIT 100`
  );
  return (rows as any[]).map((r) => ({
    id: r.id, user: r.user, action: r.action, detail: r.detail,
    create_time: r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "",
  }));
}

// =========================================================================
// 5. 住宅小区面数据 (388个社区, 来源于 data/communities.csv)
// 坐标系: WGS84
// 数据源: MySQL t_community 表 (启动时加载)
// =========================================================================
let communitiesDatabase: any = {
  type: "FeatureCollection",
  features: [],
};

// 从数据库加载社区数据 (WGS84 坐标, 返回 GeoJSON FeatureCollection)
async function loadCommunitiesFromDB(): Promise<any> {
  const [rows] = await dbPool.query(
    `SELECT id, name, district, subdistrict, population_total, household_count, area_gis,
            ST_AsGeoJSON(geom) AS geojson
     FROM t_community ORDER BY id`
  );
  const features = (rows as any[]).map((r) => ({
    type: "Feature",
    id: r.id,
    // ST_AsGeoJSON 返回 JSON 类型, mysql2 可能已解析为对象
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
// 6. 公众反馈点数据 (暂无数据，保留功能框架)
//    用户提交的反馈会动态添加到此处
// =========================================================================
interface FeedbackPoint {
  id: number;
  type: "demand" | "evaluation";
  lng: number;
  lat: number;
  stationId?: number;
  description: string;
  rating?: number;
  submitter: string;
  create_time: string;
  status: "pending" | "approved" | "rejected";
}

let feedbackDatabase: any[] = [];

// =========================================================================
// 7. 内存方案存储 (商业选址方案)
// =========================================================================
interface SavedScheme {
  id: number;
  name: string;
  lng: number;
  lat: number;
  radius: number;
  brand: string;
  covered_population: number;
  covered_communities: number;
  blind_spot_reduction: number;
  competition_score: number;
  social_benefit: number;
  creator: string;
  create_time: string;
}

let schemesDatabase: any[] = [];

// =========================================================================
// 8. 系统用户数据
// 数据源: MySQL t_user 表 (启动时加载)
// =========================================================================
let usersDatabase: any[] = [];

// 从数据库加载用户数据
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

let systemLogs: any[] = [];

// =========================================================================
// 8.1 会话管理 (简易 Token 机制，内存存储)
// =========================================================================
const sessions: Map<string, { userId: number; username: string; role: string; loginAt: number }> = new Map();

function generateToken(): string {
  return "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 解析请求中的 token (从 Authorization 头或 query 中读取)
function getTokenFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  if (typeof req.query.token === "string") return req.query.token;
  return null;
}

// 鉴权中间件：校验登录状态
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: "未登录或会话已过期" });
  }
  const session = sessions.get(token)!;
  // 会话有效期 12 小时
  if (Date.now() - session.loginAt > 12 * 60 * 60 * 1000) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: "会话已过期，请重新登录" });
  }
  (req as any).currentUser = {
    id: session.userId,
    username: session.username,
    role: session.role,
  };
  next();
}

// 鉴权中间件：校验角色
function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).currentUser;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: "权限不足，无法访问此功能" });
    }
    next();
  };
}

// =========================================================================
// 9. API 路由
// =========================================================================

// -------------------------------------------------------------------------
// 9.0 认证相关接口 (登录 / 登出 / 获取当前用户)
// -------------------------------------------------------------------------
app.post("/api/v1/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "请输入用户名和密码" });
  }
  const user = usersDatabase.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: "用户名或密码错误" });
  }
  if (user.status !== "正常") {
    return res.status(403).json({ success: false, message: "账号已被禁用，请联系管理员" });
  }
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    loginAt: Date.now(),
  });
  // 记录登录日志
  systemLogs.unshift({
    id: systemLogs.length + 1,
    user: user.username,
    action: "登录系统",
    create_time: new Date().toLocaleString("zh-CN"),
    detail: `${user.role}登录系统`,
  });
  try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [user.username, "登录系统", `${user.role}登录系统`]); } catch (e) {}
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, status: user.status, create_time: user.create_time },
  });
});

app.post("/api/v1/auth/logout", (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) sessions.delete(token);
  res.json({ success: true, message: "已退出登录" });
});

app.get("/api/v1/auth/current", requireAuth, (req, res) => {
  const cur = (req as any).currentUser;
  const user = usersDatabase.find(u => u.id === cur.userId);
  if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
  res.json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role, status: user.status, create_time: user.create_time },
  });
});

// 获取所有充电站
app.get("/api/v1/stations", (req, res) => {
  const { brand, district } = req.query;
  let stations = [...chargingStations];
  if (brand && brand !== "全部") {
    stations = stations.filter(s => s.brand === brand);
  }
  if (district && district !== "全部") {
    stations = stations.filter(s => s.district === district);
  }
  // 转为 GeoJSON FeatureCollection (剔除等时圈几何字段避免响应过大, 仅保留状态/时间)
  const fc = {
    type: "FeatureCollection",
    features: stations.map(s => {
      // 解构剔除重型几何字段, 其余属性原样下发
      const { isochroneFastGeom, isochroneSlowGeom, ...rest } = s;
      return {
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { ...rest },
      };
    }),
  };
  res.json({ success: true, data: fc });
});

// 获取所有住宅小区
app.get("/api/v1/communities", (req, res) => {
  const updatedFeatures = communitiesDatabase.features.map((f: any) => {
    const projected = projectGeometryTo3857(f);
    const area = getPlanarPolygonArea3857(projected);
    return { ...f, properties: { ...f.properties, area_gis: Math.round(area * 100) / 100 } };
  });
  res.json({ success: true, data: { type: "FeatureCollection", features: updatedFeatures } });
});

// 获取公众反馈数据
app.get("/api/v1/feedback", (req, res) => {
  const fc = {
    type: "FeatureCollection",
    features: feedbackDatabase.map(f => ({
      type: "Feature",
      id: f.id,
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: { ...f },
    })),
  };
  res.json({ success: true, data: fc });
});

// 违法违禁关键词列表 (命中则自动驳回)
const FORBIDDEN_KEYWORDS = [
  // 政治敏感
  "反动", "颠覆", "分裂", "独立", "政变", "暴动", "游行示威",
  // 暴力恐怖
  "恐怖", "爆炸", "袭击", "杀人", "砍人", "纵火", "投毒", "绑架",
  // 违法犯罪
  "贩毒", "吸毒", "赌博", "诈骗", "洗钱", "贿赂", "走私", "偷渡",
  "枪支", "弹药", "管制刀具", "假币", "传销",
  // 色情低俗
  "色情", "卖淫", "嫖娼", "裸聊", "一夜情", "约炮", "黄网",
  // 人身攻击/侮辱
  "傻逼", "操你", "草泥马", "去死", "滚蛋", "废物", "贱人", "婊子",
  // 其他
  "邪教", "传销", "黑客攻击", "翻墙", "VPN",
];

// 检测文本是否包含违禁词
function containsForbiddenKeyword(text: string): { hit: boolean; keyword?: string } {
  if (!text) return { hit: false };
  const lower = text.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { hit: true, keyword: kw };
    }
  }
  return { hit: false };
}

// 获取指定充电站的反馈列表 (用于站点悬浮窗展示)
app.get("/api/v1/feedback/by-station/:stationId", (req, res) => {
  const stationId = parseInt(req.params.stationId);
  const list = feedbackDatabase.filter(f => f.stationId === stationId);
  res.json({ success: true, data: list });
});

// 提交公众反馈 (自动审核: 命中违禁词自动驳回, 否则待审核)
app.post("/api/v1/feedback", async (req, res) => {
  const { type, lng, lat, description, rating, submitter, contact } = req.body;
  // 徐州经纬度红线校验
  if (lng < 116.36 || lng > 118.67 || lat < 33.72 || lat > 34.97) {
    return res.status(400).json({ success: false, message: "坐标超出徐州市范围，已被红线拦截" });
  }
  // 违禁词自动审核
  const check = containsForbiddenKeyword(description || "");
  const status = check.hit ? "rejected" : "pending";
  try {
    const [result] = await dbPool.query(
      `INSERT INTO t_feedback (type, description, rating, lng, lat, submitter, contact, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type || "demand", description || "", rating || null, parseFloat(lng), parseFloat(lat), submitter || "匿名用户", contact || null, status]
    );
    const newFeedback = {
      id: (result as any).insertId,
      type: type || "demand",
      description: description || "",
      rating: rating || null,
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      submitter: submitter || "匿名用户",
      contact: contact || null,
      status,
      create_time: new Date().toLocaleString("zh-CN"),
    };
    feedbackDatabase.push(newFeedback);
    const message = check.hit
      ? `反馈包含违禁词"${check.keyword}"，已被系统自动驳回`
      : "反馈提交成功，等待管理员审核";
    res.json({ success: true, data: newFeedback, message });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 审核反馈 (管理员专用)
app.post("/api/v1/feedback/:id/review", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body; // "approved" | "rejected"
  try {
    await dbPool.query("UPDATE t_feedback SET status=? WHERE id=?", [status, id]);
    const fb = feedbackDatabase.find(f => f.id === id);
    if (fb) fb.status = status;
    const cur = (req as any).currentUser;
    systemLogs.unshift({
      id: systemLogs.length + 1,
      user: cur.username,
      action: "审核反馈",
      create_time: new Date().toLocaleString("zh-CN"),
      detail: `反馈#${id} ${status === "approved" ? "审核通过" : "已驳回"}`,
    });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "审核反馈", `反馈#${id} ${status === "approved" ? "审核通过" : "已驳回"}`]); } catch (e) {}
    res.json({ success: true, data: fb || { id, status }, message: `反馈已${status === "approved" ? "通过" : "驳回"}` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 等时圈预计算管理接口
// =========================================================================
// 查询预计算进度
app.get("/api/v1/admin/isochrone-progress", (req, res) => {
  const progress = getPrecomputeProgress();
  const totalStations = chargingStations.length;
  const okCount = chargingStations.filter(s => s.isochroneStatus === "ok").length;
  const partialCount = chargingStations.filter(s => s.isochroneStatus === "partial").length;
  const pendingCount = chargingStations.filter(s => s.isochroneStatus === "pending").length;
  const failedCount = chargingStations.filter(s => s.isochroneStatus === "failed").length;
  res.json({
    success: true,
    data: {
      ...progress,
      stats: {
        total: totalStations,
        ok: okCount,
        partial: partialCount,
        pending: pendingCount,
        failed: failedCount,
      },
    },
  });
});

// 手动触发预计算（仅对 pending/failed 站点）
app.post("/api/v1/admin/precompute-isochrones", async (req, res) => {
  const progress = getPrecomputeProgress();
  if (progress.running) {
    return res.status(409).json({
      success: false,
      message: "已有预计算任务在执行中",
      data: progress,
    });
  }
  const { force } = req.body || {};
  const targets = (force
    ? chargingStations
    : chargingStations.filter(s => s.isochroneStatus === "pending" || s.isochroneStatus === "failed")
  ).map(s => ({ id: s.id, lng: s.lng, lat: s.lat, fastChargers: s.fastChargers, slowChargers: s.slowChargers }));

  if (targets.length === 0) {
    return res.json({ success: true, message: "无待计算站点", data: getPrecomputeProgress() });
  }
  precomputeAsync(dbPool, targets, { force, memoryStations: chargingStations });
  res.json({
    success: true,
    message: `已触发 ${targets.length} 座站点的等时圈预计算`,
    data: getPrecomputeProgress(),
  });
});

// 充电覆盖分析：识别盲区
app.post("/api/v1/analysis/coverage", (req, res) => {
  try {
    const { chargeMode, radius, district, serviceAreaMode } = req.body; // "fast" | "slow"
    // serviceAreaMode: "buffer"（默认，圆形缓冲区）/ "isochrone"（路网等时圈）/ "hybrid"（混合，缺失回退缓冲区）
    const saMode: "buffer" | "isochrone" | "hybrid" = ["buffer", "isochrone", "hybrid"].includes(serviceAreaMode)
      ? serviceAreaMode
      : "buffer";
    // 快充: 驾车10分钟 ~800m半径; 慢充: 步行15分钟 ~400m半径
    // 优先使用传入的自定义 radius，未传时回退到 chargeMode 推导
    const serviceRadius = (typeof radius === "number" && radius > 0)
      ? radius
      : (chargeMode === "fast" ? 800 : 400);
    // 覆盖分析纳入所有有效坐标的充电站 (含维护中, 因为规划分析需考虑全部基础设施)
    // 仅排除蔚来换电 (换电站与充电站服务模式不同) 和坐标无效的站点
    const activeStations = chargingStations.filter(s => s.brand !== "蔚来换电" && s.lng > 0 && s.lat > 0);

    // 行政区过滤：若指定 district（非空且非 "all"），仅分析该区社区
    const districtFilter = typeof district === "string" && district && district !== "all" ? district : null;
    const targetCommunities = districtFilter
      ? communitiesDatabase.features.filter((comm: any) => comm.properties.district === districtFilter)
      : communitiesDatabase.features;

    // 为每个运营中的充电站生成服务区
    // 三种模式：buffer（圆形缓冲区，默认）/ isochrone（路网等时圈，缺失不计入）/ hybrid（优先等时圈，缺失回退缓冲区）
    const isFast = chargeMode !== "slow";
    const serviceRadiusSq = serviceRadius * serviceRadius;
    const serviceAreas: any[] = [];
    let isochroneCoverageCount = 0;
    let fallbackCount = 0;

    for (const station of activeStations) {
      const center3857 = toEPSG3857([station.lng, station.lat]);

      // 尝试取等时圈几何
      const isochroneGeomWgs84 = isFast ? station.isochroneFastGeom : station.isochroneSlowGeom;
      let useIsochrone = false;

      if (saMode === "isochrone" || saMode === "hybrid") {
        if (isochroneGeomWgs84 && isochroneGeomWgs84.geometry) {
          // 等时圈几何是 WGS84，需投影到 3857 以便后续叠置
          const isochroneProj = projectGeometryTo3857(isochroneGeomWgs84);
          const isochroneBbox = turf.bbox(isochroneProj);
          const isochroneCenter: [number, number] = [
            (isochroneBbox[0] + isochroneBbox[2]) / 2,
            (isochroneBbox[1] + isochroneBbox[3]) / 2,
          ];
          serviceAreas.push({
            station,
            buffer: isochroneProj,
            center: isochroneCenter,
            bbox: isochroneBbox as BBox,
            source: "isochrone",
          });
          isochroneCoverageCount++;
          useIsochrone = true;
        } else if (saMode === "isochrone") {
          // 严格等时圈模式：缺失则跳过该站点
          continue;
        }
      }

      if (!useIsochrone) {
        // 回退到圆形缓冲区
        const buffer = createPlanarBuffer3857(center3857, serviceRadius);
        const bbox: BBox = [
          center3857[0] - serviceRadius, center3857[1] - serviceRadius,
          center3857[0] + serviceRadius, center3857[1] + serviceRadius,
        ];
        serviceAreas.push({ station, buffer, center: center3857, bbox, source: "buffer" });
        if (saMode === "hybrid") fallbackCount++;
      }
    }

    // 服务区重叠分析：双层循环求交，识别冗余覆盖区域
    // 性能优化：用质心距离预筛（两圆心距 > 2r 必不相交）+ bbox 快速判定
    const overlapFeatures: any[] = [];
    let totalOverlapArea = 0;
    for (let i = 0; i < serviceAreas.length; i++) {
      const sa1 = serviceAreas[i];
      for (let j = i + 1; j < serviceAreas.length; j++) {
        const sa2 = serviceAreas[j];
        // 快速判定：质心距离 > 2r 必不相交
        const dx = sa1.center[0] - sa2.center[0];
        const dy = sa1.center[1] - sa2.center[1];
        if (dx * dx + dy * dy > 4 * serviceRadiusSq) continue;
        // 快速判定：bbox 不相交
        if (!bboxIntersect(sa1.bbox, sa2.bbox)) continue;

        let intersection: any = null;
        try {
          intersection = turf.intersect(turf.featureCollection([sa1.buffer, sa2.buffer]));
        } catch { intersection = null; }
        if (intersection) {
          const overlapArea = getPlanarPolygonArea3857(intersection);
          if (overlapArea > 0) {
            // 累加重叠面积（含多重重叠，作为冗余度近似指标）
            totalOverlapArea += overlapArea;
            overlapFeatures.push(turf.feature(
              projectGeometryTo4326(intersection.geometry),
              {
                stations: [sa1.station.name, sa2.station.name],
                area: Math.round(overlapArea),
              }
            ));
          }
        }
      }
    }
    // 服务区总面积（EPSG:3857 平面面积之和）
    const totalServiceArea = serviceAreas.reduce((sum, s) => sum + getPlanarPolygonArea3857(s.buffer), 0);
    // 冗余度 = Σ重叠面积 / Σ服务区面积 × 100，保留 1 位小数；总面积为 0 时记 0
    const redundancyScore = totalServiceArea > 0
      ? Math.round((totalOverlapArea / totalServiceArea) * 1000) / 10
      : 0;
    const overlapAreas = { type: "FeatureCollection", features: overlapFeatures };

    // 分析每个社区的覆盖情况
    // 性能优化：① 懒缓存社区的 3857 投影/bbox/质心（多次分析复用）
    //         ② bbox 快速判定 + 质心距离预筛，跳过远距离服务区
    //         ③ 覆盖率 ≥0.95 时早退（视为基本完全覆盖）
    const communityResults: any[] = [];
    const blindSpotFeatures: any[] = [];
    let totalCoveredPop = 0;
    let totalPopulation = 0;
    let coveredCount = 0;
    let blindSpotCount = 0;

    targetCommunities.forEach((comm: any) => {
      const commBbox = getCachedBBox3857(comm);
      const commProj = getCachedProj3857(comm);
      const commCentroid = getCachedCentroid3857(comm);
      const commArea = getPlanarPolygonArea3857(commProj);
      const pop = comm.properties.population_total;
      totalPopulation += pop;

      // 社区外接圆半径近似（bbox 对角线一半），用于质心距离预筛
      const commHalfDiag = Math.hypot(
        (commBbox[2] - commBbox[0]) / 2,
        (commBbox[3] - commBbox[1]) / 2
      );
      const maxSearchDist = serviceRadius + commHalfDiag;
      const maxSearchDistSq = maxSearchDist * maxSearchDist;

      // 检查社区是否被任何服务区覆盖
      let maxCoverageRatio = 0;
      let coveredByStation: string | null = null;

      for (const sa of serviceAreas) {
        // 快速判定1：bbox 不相交则跳过
        if (!bboxIntersect(commBbox, sa.bbox)) continue;
        // 快速判定2：质心距离 > (serviceRadius + commHalfDiag) 则跳过
        const dx = sa.center[0] - commCentroid[0];
        const dy = sa.center[1] - commCentroid[1];
        if (dx * dx + dy * dy > maxSearchDistSq) continue;

        // 精确求交
        let intersection: any = null;
        try {
          intersection = turf.intersect(turf.featureCollection([commProj, sa.buffer]));
        } catch { intersection = null; }

        if (intersection) {
          const intersectArea = getPlanarPolygonArea3857(intersection);
          const ratio = intersectArea / commArea;
          if (ratio > maxCoverageRatio) {
            maxCoverageRatio = ratio;
            coveredByStation = sa.station.name;
          }
          // 早退：已找到 ≥95% 覆盖，无需继续（视为基本完全覆盖）
          if (maxCoverageRatio >= 0.95) break;
        }
      }

      const coveragePercent = Math.round(maxCoverageRatio * 1000) / 10;
      const isBlindSpot = maxCoverageRatio < 0.1; // 覆盖率<10%视为盲区

      // 根据覆盖率百分比计算分级（极差/较差/一般/良好/优秀）
      let level: string;
      if (coveragePercent < 10) level = "极差";
      else if (coveragePercent < 30) level = "较差";
      else if (coveragePercent < 60) level = "一般";
      else if (coveragePercent < 90) level = "良好";
      else level = "优秀";

      if (isBlindSpot) {
        blindSpotCount++;
        blindSpotFeatures.push({
          type: "Feature",
          id: comm.id,
          geometry: comm.geometry,
          properties: {
            ...comm.properties,
            coverage_ratio: coveragePercent,
            is_blind_spot: true,
          },
        });
      } else {
        coveredCount++;
        totalCoveredPop += Math.round(pop * maxCoverageRatio);
      }

      communityResults.push({
        id: comm.id,
        name: comm.properties.name,
        district: comm.properties.district,
        population: pop,
        coverageRatio: coveragePercent,
        level,
        isBlindSpot,
        coveredBy: coveredByStation,
      });
    });

    // 按行政区统计
    const districtStats: any = {};
    communityResults.forEach(c => {
      if (!districtStats[c.district]) {
        districtStats[c.district] = { district: c.district, total: 0, covered: 0, blindSpot: 0, population: 0, blindSpotPop: 0 };
      }
      districtStats[c.district].total++;
      districtStats[c.district].population += c.population;
      if (c.isBlindSpot) {
        districtStats[c.district].blindSpot++;
        districtStats[c.district].blindSpotPop += c.population;
      } else {
        districtStats[c.district].covered++;
      }
    });

    // 生成服务区 GeoJSON (附带 source 字段: isochrone / buffer, 供前端差异化渲染)
    const serviceAreaFeatures = serviceAreas.map(({ station, buffer, source }) => {
      const wgs84Geom = projectGeometryTo4326(buffer.geometry);
      return turf.feature(wgs84Geom, {
        stationName: station.name,
        brand: station.brand,
        radius: serviceRadius,
        source: source || "buffer",
        mode: saMode,
      });
    });

    // 盲区聚类：基于质心距离的贪心聚合（质心距离≤1500米归入同一聚类）
    const blindSpotClustersRaw: any[] = [];
    blindSpotFeatures.forEach((feature: any) => {
      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      const pop = Number(feature.properties?.population_total || 0);

      // 贪心寻找质心距离≤1500米的已有聚类
      let targetCluster: any = null;
      for (const cluster of blindSpotClustersRaw) {
        const d = turf.distance(centroid, turf.point(cluster._center), { units: "meters" });
        if (d <= 1500) {
          targetCluster = cluster;
          break;
        }
      }

      if (targetCluster) {
        targetCluster._lngSum += lng;
        targetCluster._latSum += lat;
        targetCluster.communityCount += 1;
        targetCluster.population += pop;
        targetCluster._center = [
          targetCluster._lngSum / targetCluster.communityCount,
          targetCluster._latSum / targetCluster.communityCount,
        ];
      } else {
        blindSpotClustersRaw.push({
          _lngSum: lng,
          _latSum: lat,
          _center: [lng, lat],
          communityCount: 1,
          population: pop,
        });
      }
    });

    // 按 population 降序排序并格式化输出（center 保留6位小数）
    const blindSpotClusters = blindSpotClustersRaw
      .sort((a, b) => b.population - a.population)
      .map((c, idx) => ({
        clusterId: idx + 1,
        center: [
          Number((c._lngSum / c.communityCount).toFixed(6)),
          Number((c._latSum / c.communityCount).toFixed(6)),
        ],
        communityCount: c.communityCount,
        population: c.population,
      }));

    // 充电站覆盖效率统计：按 stationId 聚合各站覆盖的社区与人口
    const stationByName = new Map(activeStations.map(s => [s.name, s]));
    const stationById = new Map(activeStations.map(s => [s.id, s]));
    const stationEfficiencyMap = new Map<string, {
      stationId: number;
      stationName: string;
      brand: string;
      fastChargers: number;
      slowChargers: number;
      coveredCommunities: number;
      coveredPopulation: number;
      coverageRatioSum: number;
    }>();
    communityResults.forEach(c => {
      if (c.coveredBy === null) return;
      // 从 activeStations 中按 name 匹配对应的充电站对象
      const station = stationByName.get(c.coveredBy);
      if (!station) return;
      const key = String(station.id);
      let entry = stationEfficiencyMap.get(key);
      if (!entry) {
        entry = {
          stationId: station.id,
          stationName: station.name,
          brand: station.brand,
          fastChargers: station.fastChargers,
          slowChargers: station.slowChargers,
          coveredCommunities: 0,
          coveredPopulation: 0,
          coverageRatioSum: 0,
        };
        stationEfficiencyMap.set(key, entry);
      }
      entry.coveredCommunities += 1;
      entry.coveredPopulation += c.population;
      entry.coverageRatioSum += c.coverageRatio;
    });

    // 计算 loadIndex（负荷指数，复用 /api/v1/analysis/heatmap 算法）
    // loadIndex = (快充×2 + 慢充×1) × (1 + 覆盖人口/10000) / (1 + 竞品距离衰减)
    const stationEfficiency: any[] = Array.from(stationEfficiencyMap.values()).map((e: any) => {
      const station = stationById.get(e.stationId);
      if (!station) return null;
      const stationPt = turf.point([station.lng, station.lat]);
      // 竞品距离衰减：找最近的其他品牌充电站，距离 km，衰减 = 1 / (1 + distance)
      let minCompetitorDist = Infinity;
      chargingStations.forEach(other => {
        if (other.id === station.id || other.brand === station.brand) return;
        const d = turf.distance(stationPt, turf.point([other.lng, other.lat]), { units: "kilometers" });
        if (d < minCompetitorDist) minCompetitorDist = d;
      });
      // 简化实现：找不到竞品时衰减记 0
      const competitorDecay = minCompetitorDist === Infinity ? 0 : 1 / (1 + minCompetitorDist);
      const base = e.fastChargers * 2 + e.slowChargers * 1;
      const loadIndex = Math.round((base * (1 + e.coveredPopulation / 10000) / (1 + competitorDecay)) * 100) / 100;
      return {
        stationId: e.stationId,
        stationName: e.stationName,
        brand: e.brand,
        fastChargers: e.fastChargers,
        slowChargers: e.slowChargers,
        coveredCommunities: e.coveredCommunities,
        coveredPopulation: e.coveredPopulation,
        avgCoverageRatio: e.coveredCommunities > 0 ? Math.round((e.coverageRatioSum / e.coveredCommunities) * 10) / 10 : 0,
        loadIndex,
      };
    }).filter((x: any) => x !== null)
      .sort((a: any, b: any) => b.coveredPopulation - a.coveredPopulation);

    // 覆盖率分级统计：按 level 分组，顺序为 极差/较差/一般/良好/优秀
    const levelOrder = ["极差", "较差", "一般", "良好", "优秀"];
    const coverageLevels = levelOrder.map(level => {
      const items = communityResults.filter(c => c.level === level);
      return {
        level,
        count: items.length,
        population: items.reduce((s: number, c: any) => s + c.population, 0),
      };
    });

    res.json({
      success: true,
      data: {
        chargeMode,
        serviceRadius,
        district: districtFilter || "all",
        serviceAreas: { type: "FeatureCollection", features: serviceAreaFeatures },
        overlapAreas,
        redundancyScore,
        blindSpots: { type: "FeatureCollection", features: blindSpotFeatures },
        blindSpotClusters,
        communityResults: communityResults.sort((a, b) => a.coverageRatio - b.coverageRatio),
        coverageLevels,
        districtStats: Object.values(districtStats),
        stationEfficiency,
        summary: {
          totalCommunities: communityResults.length,
          coveredCommunities: coveredCount,
          blindSpotCommunities: blindSpotCount,
          coverageRate: communityResults.length > 0 ? Math.round((coveredCount / communityResults.length) * 1000) / 10 : 0,
          populationCoverageRate: totalPopulation > 0 ? Math.round((totalCoveredPop / totalPopulation) * 1000) / 10 : 0,
          totalPopulation,
          blindSpotPopulation: communityResults.filter(c => c.isBlindSpot).reduce((s, c) => s + c.population, 0),
          totalStations: activeStations.length,
          redundancyScore,
        },
        // 服务区模式信息
        serviceAreaMode: saMode,
        isochroneCoverage: {
          covered: isochroneCoverageCount,
          total: activeStations.length,
          fallback: fallbackCount,
          ratio: activeStations.length > 0
            ? Math.round((isochroneCoverageCount / activeStations.length) * 1000) / 10
            : 0,
        },
      },
    });
  } catch (error: any) {
    console.error("覆盖分析错误:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 虚拟站点选址评估 (拖拽实时计算)
app.post("/api/v1/analysis/evaluate-site", requireAuth, requireRole("投资商", "管理员"), (req, res) => {
  try {
    const { lng, lat, radius, chargeMode, coverageBlindSpots } = req.body;
    const radiusMeters = parseFloat(radius) || (chargeMode === "fast" ? 800 : 400);
    const center3857 = toEPSG3857([parseFloat(lng), parseFloat(lat)]);
    const bufferPoly = createPlanarBuffer3857(center3857, radiusMeters);
    const bufferArea = getPlanarPolygonArea3857(bufferPoly);

    // 判定选址缓冲区是否落入覆盖盲区（盲区几何为 WGS84，需将缓冲区投影至4326后再判定相交）
    let inBlindSpot = false;
    if (Array.isArray(coverageBlindSpots) && coverageBlindSpots.length > 0) {
      const bufferPolyWgs84 = turf.feature(projectGeometryTo4326(bufferPoly.geometry));
      for (const blindGeom of coverageBlindSpots) {
        let intersects = false;
        try {
          intersects = !!turf.intersect(turf.featureCollection([bufferPolyWgs84, turf.feature(blindGeom)]));
        } catch {
          intersects = false;
        }
        if (intersects) {
          inBlindSpot = true;
          break;
        }
      }
    }

    // 计算覆盖的社区
    const coveredCommunities: any[] = [];
    let coveredPopulation = 0;
    const intersectionFeatures: any[] = [];

    communitiesDatabase.features.forEach((comm: any) => {
      const commProj = projectGeometryTo3857(comm);
      const commArea = getPlanarPolygonArea3857(commProj);

      let intersection: any = null;
      try {
        intersection = turf.intersect(turf.featureCollection([commProj, bufferPoly]));
      } catch { intersection = null; }

      if (intersection) {
        const intersectArea = getPlanarPolygonArea3857(intersection);
        if (intersectArea > 1) {
          const ratio = intersectArea / commArea;
          const affectedPop = Math.round(comm.properties.population_total * ratio);
          coveredPopulation += affectedPop;

          const wgs84Geom = projectGeometryTo4326(intersection.geometry);
          intersectionFeatures.push(turf.feature(wgs84Geom, {
            community_name: comm.properties.name,
            coverage_ratio: Math.round(ratio * 1000) / 10,
            affected_pop: affectedPop,
          }));

          coveredCommunities.push({
            id: comm.id,
            name: comm.properties.name,
            district: comm.properties.district,
            population: comm.properties.population_total,
            coverageRatio: Math.round(ratio * 1000) / 10,
            affectedPopulation: affectedPop,
          });
        }
      }
    });

    // 竞争环境分析：周边1km内现有充电站
    const nearbyStations = chargingStations.filter(s => {
      const dist = turf.distance(turf.point([parseFloat(lng), parseFloat(lat)]), turf.point([s.lng, s.lat]), { units: "meters" });
      return dist < 1500;
    });

    // 计算竞争避让度 (周边站越少，分数越高)
    const competitionScore = Math.max(0, Math.round(100 - nearbyStations.length * 12));

    // 盲区消除率 (覆盖社区数 / 总社区数)
    const totalCommunities = communitiesDatabase.features.length;
    const blindSpotReduction = totalCommunities > 0
      ? Math.round((coveredCommunities.length / totalCommunities) * 1000) / 10
      : 0;

    // 社会效益评分
    const socialBenefit = Math.min(100, Math.round((coveredPopulation / 200) ));

    const bufferWgs84 = turf.feature(projectGeometryTo4326(bufferPoly.geometry), {
      radius: radiusMeters,
      area_sqm: Math.round(bufferArea),
    });

    res.json({
      success: true,
      data: {
        point: { lng: parseFloat(lng), lat: parseFloat(lat) },
        radius: radiusMeters,
        bufferGeometry: bufferWgs84,
        in_blind_spot: inBlindSpot,
        intersections: { type: "FeatureCollection", features: intersectionFeatures },
        covered_communities: coveredCommunities,
        covered_population: coveredPopulation,
        nearbyStations: nearbyStations.map(s => ({ name: s.name, brand: s.brand, distance: Math.round(turf.distance(turf.point([parseFloat(lng), parseFloat(lat)]), turf.point([s.lng, s.lat]), { units: "meters" })) })),
        metrics: {
          covered_population: coveredPopulation,
          covered_communities: coveredCommunities.length,
          blind_spot_reduction: blindSpotReduction,
          competition_score: competitionScore,
          social_benefit: socialBenefit,
          nearby_station_count: nearbyStations.length,
        },
      },
    });
  } catch (error: any) {
    console.error("选址评估错误:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存选址方案
app.post("/api/v1/schemes", requireAuth, requireRole("投资商", "管理员"), async (req, res) => {
  const { name, lng, lat, radius, brand, metrics } = req.body;
  const creator = (req as any).currentUser?.username || "";
  const coveredPopulation = metrics?.coveredPopulation || 0;
  const coveredCommunities = metrics?.coveredCommunities || 0;
  const blindSpotReduction = metrics?.blindSpotReduction || 0;
  const competitionScore = metrics?.competitionScore || 0;
  const socialBenefit = metrics?.socialBenefit || 0;
  try {
    const [result]: any = await dbPool.query(
      `INSERT INTO t_scheme (name, lng, lat, radius, brand, covered_population, covered_communities, blind_spot_reduction, competition_score, social_benefit, creator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name || "未命名方案", parseFloat(lng), parseFloat(lat), parseFloat(radius), brand || "国家电网", coveredPopulation, coveredCommunities, blindSpotReduction, competitionScore, socialBenefit, creator]
    );
    const scheme = {
      id: result.insertId,
      name: name || "未命名方案",
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      radius: parseFloat(radius),
      brand: brand || "国家电网",
      covered_population: coveredPopulation,
      covered_communities: coveredCommunities,
      blind_spot_reduction: blindSpotReduction,
      competition_score: competitionScore,
      social_benefit: socialBenefit,
      creator,
      create_time: new Date().toLocaleString("zh-CN"),
    };
    schemesDatabase.push(scheme);
    res.json({ success: true, data: scheme, message: "方案保存成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 获取所有方案
app.get("/api/v1/schemes", (req, res) => {
  res.json({ success: true, data: schemesDatabase });
});

// 删除方案
app.delete("/api/v1/schemes/:id", requireAuth, requireRole("投资商", "管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_scheme WHERE id=?", [id]);
    const idx = schemesDatabase.findIndex(s => s.id === id);
    if (idx >= 0) schemesDatabase.splice(idx, 1);
    res.json({ success: true, message: "方案已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 区域统计查询
app.get("/api/v1/stats/regions", (req, res) => {
  const districtStats: any = {};
  chargingStations.forEach(s => {
    if (!districtStats[s.district]) {
      districtStats[s.district] = { district: s.district, stations: 0, fastChargers: 0, slowChargers: 0, brands: new Set() };
    }
    districtStats[s.district].stations++;
    districtStats[s.district].fastChargers += s.fastChargers;
    districtStats[s.district].slowChargers += s.slowChargers;
    districtStats[s.district].brands.add(s.brand);
  });

  communitiesDatabase.features.forEach((c: any) => {
    const d = c.properties.district;
    if (!d || d === "未知" || d === "未知区") return;  // 跳过无效行政区
    if (!districtStats[d]) districtStats[d] = { district: d, stations: 0, fastChargers: 0, slowChargers: 0, brands: new Set() };
    if (!districtStats[d].communities) districtStats[d].communities = 0;
    if (!districtStats[d].population) districtStats[d].population = 0;
    districtStats[d].communities++;
    districtStats[d].population += c.properties.population_total;
  });

  // 过滤掉无效行政区 (null / 空字符串 / "未知"), 避免下拉框出现 "未知" 选项
  const result = Object.values(districtStats)
    .filter((s: any) => s.district && s.district !== "未知" && s.district !== "未知区" && s.district.trim() !== "")
    .map((s: any) => ({
    ...s,
    brands: s.brands.size,
    brandList: Array.from(s.brands),
  }));

  res.json({ success: true, data: result });
});

// 用户管理接口 (管理员专用)
app.get("/api/v1/users", requireAuth, requireRole("管理员"), (req, res) => {
  res.json({ success: true, data: usersDatabase.map(u => ({ ...u, password: "******" })) });
});

// 新增用户 (管理员专用)
app.post("/api/v1/users", requireAuth, requireRole("管理员"), async (req, res) => {
  const { username, password, role, status } = req.body;
  if (!username || !password || !role) return res.status(400).json({ success: false, message: "参数不完整" });
  if (usersDatabase.find(u => u.username === username)) return res.status(400).json({ success: false, message: "用户名已存在" });
  try {
    const [result]: any = await dbPool.query(
      `INSERT INTO t_user (username, password_hash, role, status) VALUES (?, ?, ?, ?)`,
      [username, password, role, status || "正常"]
    );
    const newUser = {
      id: result.insertId, username, password, role, status: status || "正常",
      create_time: new Date().toLocaleString("zh-CN"),
    };
    usersDatabase.push(newUser);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "新增用户", create_time: new Date().toLocaleString("zh-CN"), detail: `新增用户 ${username} (${role})` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "新增用户", `新增用户 ${username} (${role})`]); } catch (e) {}
    res.json({ success: true, data: { ...newUser, password: "******" }, message: "用户创建成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 修改用户 (管理员专用)
app.put("/api/v1/users/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const u = usersDatabase.find(u => u.id === id);
  if (!u) return res.status(404).json({ success: false, message: "用户不存在" });
  const { username, password, role, status } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];
    if (username) { updates.push("username=?"); params.push(username); }
    if (password) { updates.push("password_hash=?"); params.push(password); }
    if (role) { updates.push("role=?"); params.push(role); }
    if (status) { updates.push("status=?"); params.push(status); }
    if (updates.length > 0) {
      params.push(id);
      await dbPool.query(`UPDATE t_user SET ${updates.join(",")} WHERE id=?`, params);
    }
    if (username) u.username = username;
    if (password) u.password = password;
    if (role) u.role = role;
    if (status) u.status = status;
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "修改用户", create_time: new Date().toLocaleString("zh-CN"), detail: `修改用户 ${u.username}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "修改用户", `修改用户 ${u.username}`]); } catch (e) {}
    res.json({ success: true, data: { ...u, password: "******" }, message: "用户信息已更新" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除用户 (管理员专用)
app.delete("/api/v1/users/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const idx = usersDatabase.findIndex(u => u.id === id);
  if (idx < 0) return res.status(404).json({ success: false, message: "用户不存在" });
  if (usersDatabase[idx].username === "admin") return res.status(400).json({ success: false, message: "不能删除超级管理员" });
  try {
    await dbPool.query("DELETE FROM t_user WHERE id=?", [id]);
    const removed = usersDatabase.splice(idx, 1)[0];
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除用户", create_time: new Date().toLocaleString("zh-CN"), detail: `删除用户 ${removed.username}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除用户", `删除用户 ${removed.username}`]); } catch (e) {}
    res.json({ success: true, message: "用户已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 系统日志接口 (管理员专用, 从 MySQL 读取最新100条)
app.get("/api/v1/logs", requireAuth, requireRole("管理员"), async (req, res) => {
  try {
    const logs = await loadLogsFromDB();
    res.json({ success: true, data: logs });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== 充电站管理接口 (管理员专用) =====
// 新增充电站
app.post("/api/v1/stations", requireAuth, requireRole("管理员"), async (req, res) => {
  const { name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status } = req.body;
  if (!name || !brand || !lng || !lat) return res.status(400).json({ success: false, message: "参数不完整" });
  try {
    const [result]: any = await dbPool.query(
      `INSERT INTO t_charging_station (name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status, update_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [name, brand, parseFloat(lng), parseFloat(lat), fast_chargers || 0, slow_chargers || 0, address || "", district || "", status || "运营中"]
    );
    const newStation: ChargingStation = {
      id: result.insertId, name, brand, lng: parseFloat(lng), lat: parseFloat(lat),
      fastChargers: fast_chargers || 0, slowChargers: slow_chargers || 0,
      address: address || "", district: district || "", status: status || "运营中",
      operator: "", updateTime: new Date().toISOString().split("T")[0],
    };
    chargingStations.push(newStation);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "新增充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `新增 ${name} (${brand})` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "新增充电站", `新增 ${name} (${brand})`]); } catch (e) {}
    res.json({ success: true, data: newStation, message: "充电站创建成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 修改充电站
app.put("/api/v1/stations/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status } = req.body;
  try {
    await dbPool.query(
      `UPDATE t_charging_station SET name=?, brand=?, lng=?, lat=?, fast_chargers=?, slow_chargers=?, address=?, district=?, status=?, update_time=CURDATE() WHERE id=?`,
      [name, brand, parseFloat(lng), parseFloat(lat), fast_chargers, slow_chargers, address, district, status, id]
    );
    const s = chargingStations.find(s => s.id === id);
    if (s) {
      Object.assign(s, { name, brand, lng: parseFloat(lng), lat: parseFloat(lat), fastChargers: fast_chargers, slowChargers: slow_chargers, address, district, status, updateTime: new Date().toISOString().split("T")[0] });
    }
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "修改充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `修改 ${name}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "修改充电站", `修改 ${name}`]); } catch (e) {}
    res.json({ success: true, message: "充电站信息已更新" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除充电站
app.delete("/api/v1/stations/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_charging_station WHERE id=?", [id]);
    const idx = chargingStations.findIndex(s => s.id === id);
    const removed = idx >= 0 ? chargingStations.splice(idx, 1)[0] : null;
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `删除 ${removed?.name || id}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除充电站", `删除 ${removed?.name || id}`]); } catch (e) {}
    res.json({ success: true, message: "充电站已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== 反馈管理接口 (管理员专用) =====
// 获取全部反馈列表
app.get("/api/v1/feedback/all", requireAuth, requireRole("管理员"), (req, res) => {
  res.json({ success: true, data: feedbackDatabase });
});

// 删除反馈
app.delete("/api/v1/feedback/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_feedback WHERE id=?", [id]);
    const idx = feedbackDatabase.findIndex(f => f.id === id);
    if (idx >= 0) feedbackDatabase.splice(idx, 1);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除反馈", create_time: new Date().toLocaleString("zh-CN"), detail: `删除反馈#${id}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除反馈", `删除反馈#${id}`]); } catch (e) {}
    res.json({ success: true, message: "反馈已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 清空违禁反馈
app.delete("/api/v1/feedback/rejected/clear", requireAuth, requireRole("管理员"), async (req, res) => {
  try {
    await dbPool.query("DELETE FROM t_feedback WHERE status='rejected'");
    feedbackDatabase = await loadFeedbackFromDB();
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "清空违禁反馈", create_time: new Date().toLocaleString("zh-CN"), detail: "清空所有违禁反馈" });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "清空违禁反馈", "清空所有违禁反馈"]); } catch (e) {}
    res.json({ success: true, message: "已清空所有违禁反馈" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 9.9 GIS 意图解析与空间分析
// =========================================================================

function parseGisIntent(message: string, userLocation?: { lng: number; lat: number }): {
  type: string;
  radius?: number;
  center?: [number, number];
  district?: string;
  brand?: string;
  fastOnly?: boolean;
} | null {
  if (!message) return null;
  const msg = message;

  // 1. 附近 Nkm / N公里 / Nkm内 / 半径 N 公里 / 半径 Nkm
  const nearbyPatterns = [
    /附近\s*(\d+(?:\.\d+)?)\s*(?:km|公里)/i,
    /(\d+(?:\.\d+)?)\s*(?:km|公里)\s*内/i,
    /半径\s*(\d+(?:\.\d+)?)\s*(?:km|公里)/i,
    /半径\s*(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*km/i,
  ];
  for (const pattern of nearbyPatterns) {
    const match = msg.match(pattern);
    if (match) {
      const radius = parseFloat(match[1]) * 1000;
      return { type: "nearby", radius };
    }
  }

  // 2. 覆盖分析
  if (/覆盖分析|覆盖多少小区|覆盖多少人口|范围内/.test(msg)) {
    return { type: "coverage" };
  }

  // 3. 行政区查询（铜山区、泉山区等）
  const districtMatch = msg.match(/(铜山区|泉山区|鼓楼区|云龙区|贾汪区|睢宁县)/);
  if (districtMatch) {
    const fastOnly = /快充/.test(msg);
    return { type: "district", district: districtMatch[1], fastOnly };
  }

  // 4. 品牌查询（国家电网、特来电、星星充电）
  const brandMatch = msg.match(/(国家电网|特来电|星星充电)/);
  if (brandMatch) {
    return { type: "brand", brand: brandMatch[1] };
  }

  return null;
}

function doGisAnalysis(intent: ReturnType<typeof parseGisIntent>, userLocation?: { lng: number; lat: number }): {
  stations: ChargingStation[];
  count: number;
  coveredPopulation: number;
  coveredCommunities: number;
  radius: number;
  center: [number, number];
  district?: string;
  brand?: string;
} | null {
  if (!intent) return null;

  const XUZHOU_CENTER: [number, number] = [117.2, 34.2];

  // nearby 和 coverage 类型：基于缓冲区的空间分析
  if (intent.type === "nearby" || intent.type === "coverage") {
    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : XUZHOU_CENTER;
    const radius = intent.radius || 3000;
    // 筛选在圆内的充电站（用 turf.pointInCircle 做不等式判断，更可靠）
    const circle = turf.circle(center, radius / 1000, { units: "kilometers" });
    const stationsInCircle = chargingStations.filter(s => {
      const pt = turf.point([s.lng, s.lat]);
      return turf.booleanPointInPolygon(pt, circle);
    });

    // 计算每个站点到中心的距离并排序
    const centerPt = turf.point(center);
    const stationsWithDist = stationsInCircle.map(s => ({
      ...s,
      distanceKm: Number(turf.distance(centerPt, turf.point([s.lng, s.lat]), { units: "kilometers" }).toFixed(2)),
    }));
    stationsWithDist.sort((a, b) => a.distanceKm - b.distanceKm);

    // 筛选覆盖的社区（社区质心在圆内且距离在半径内）
    let coveredPopulation = 0;
    let coveredCommunities = 0;

    communitiesDatabase.features.forEach((comm: any) => {
      const centroid = turf.centroid(comm);
      const dist = turf.distance(centerPt, centroid, { units: "meters" });
      if (dist <= radius && turf.booleanPointInPolygon(centroid, circle)) {
        coveredPopulation += comm.properties.population_total || 0;
        coveredCommunities++;
      }
    });

    return { stations: stationsWithDist, count: stationsWithDist.length, coveredPopulation, coveredCommunities, radius, center };
  }

  // district 类型：按行政区过滤
  if (intent.type === "district") {
    let stations = chargingStations.filter(s => s.district === intent.district);
    if (intent.fastOnly) {
      stations = stations.filter(s => s.fastChargers > 0);
    }
    const districtCommunities = communitiesDatabase.features.filter(
      (c: any) => c.properties.district === intent.district
    );
    const coveredPopulation = districtCommunities.reduce(
      (sum: number, c: any) => sum + (c.properties.population_total || 0), 0
    );
    return {
      stations,
      count: stations.length,
      coveredPopulation,
      coveredCommunities: districtCommunities.length,
      radius: 0,
      center: XUZHOU_CENTER,
      district: intent.district,
    };
  }

  // brand 类型：按品牌过滤
  if (intent.type === "brand") {
    const stations = chargingStations.filter(s => s.brand === intent.brand);
    return {
      stations,
      count: stations.length,
      coveredPopulation: 0,
      coveredCommunities: 0,
      radius: 0,
      center: XUZHOU_CENTER,
      brand: intent.brand,
    };
  }

  return null;
}

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
// 10.7 充电站负荷热度分析 (阶段二 任务 2.1)
// 计算: 负荷指数 = (fastChargers * 2 + slowChargers * 1) * (1 + 周边人口因子) / (1 + 竞品距离衰减)
// =========================================================================
function getLoadLevel(load: number): "低" | "中" | "高" | "超载" {
  if (load < 5) return "低";
  if (load < 15) return "中";
  if (load < 30) return "高";
  return "超载";
}

app.post("/api/v1/analysis/heatmap", (req, res) => {
  try {
    const { district } = req.body || {};
    const districtFilter = typeof district === "string" && district && district !== "all" ? district : null;
    const targetStations = districtFilter
      ? chargingStations.filter(s => s.district === districtFilter)
      : chargingStations;

    // 预计算所有社区质心 (WGS84), 用于缓冲区内人口统计
    const communityCentroids = communitiesDatabase.features.map((comm: any) => ({
      comm,
      centroid: turf.centroid(comm),
      pop: Number(comm.properties?.population_total || 0),
    }));

    const stations = targetStations.map(station => {
      const stationPt = turf.point([station.lng, station.lat]);
      // 周边人口因子: 800m 缓冲区内社区人口总和 / 10000
      const buffer800 = turf.circle(stationPt, 0.8, { units: "kilometers" });
      let nearbyPop = 0;
      communityCentroids.forEach(({ centroid, pop }) => {
        if (turf.booleanPointInPolygon(centroid, buffer800)) {
          nearbyPop += pop;
        }
      });
      const populationFactor = nearbyPop / 10000;

      // 竞品距离衰减: 找最近的其他品牌充电站, 距离 km
      let minCompetitorDist = Infinity;
      chargingStations.forEach(other => {
        if (other.id === station.id || other.brand === station.brand) return;
        const d = turf.distance(stationPt, turf.point([other.lng, other.lat]), { units: "kilometers" });
        if (d < minCompetitorDist) minCompetitorDist = d;
      });
      const competitorDecay = minCompetitorDist === Infinity ? 0 : 1 / (1 + minCompetitorDist);

      const base = (station.fastChargers * 2 + station.slowChargers * 1);
      const load = Math.round((base * (1 + populationFactor) / (1 + competitorDecay)) * 100) / 100;

      return {
        id: station.id,
        lng: station.lng,
        lat: station.lat,
        name: station.name,
        brand: station.brand,
        district: station.district,
        fastChargers: station.fastChargers,
        slowChargers: station.slowChargers,
        load,
        level: getLoadLevel(load),
      };
    });

    res.json({
      success: true,
      data: {
        district: districtFilter || "all",
        stations,
      },
    });
  } catch (error: any) {
    console.error("负荷热力分析错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.8 投资回报 ROI 估算 (阶段二 任务 2.3)
// 建站成本 = fastChargers * 80000 + slowChargers * 30000 + 土地成本 200000
// 年收益 = coveredPopulation * 0.05 * 1.5 * 365 * 0.3
// 回收周期 = 建站成本 / 年收益
// =========================================================================
app.post("/api/v1/analysis/roi", (req, res) => {
  try {
    const { fastChargers, slowChargers, coveredPopulation } = req.body || {};
    const fast = parseInt(fastChargers) || 0;
    const slow = parseInt(slowChargers) || 0;
    const pop = parseInt(coveredPopulation) || 0;

    const fastCost = fast * 80000;
    const slowCost = slow * 30000;
    const landCost = 200000;
    const cost = fastCost + slowCost + landCost;

    const demandRate = 0.05;        // 需求率 (车辆渗透)
    const unitPrice = 1.5;          // 客单价 (元)
    const conversionRate = 0.3;     // 转化率
    const annualRevenue = Math.round(pop * demandRate * unitPrice * 365 * conversionRate);

    const paybackYears = annualRevenue > 0 ? Math.round((cost / annualRevenue) * 100) / 100 : -1;

    res.json({
      success: true,
      data: {
        cost,
        costBreakdown: { fast: fastCost, slow: slowCost, land: landCost },
        annualRevenue,
        revenueBreakdown: {
          population: pop,
          demandRate,
          unitPrice,
          conversionRate,
        },
        paybackYears,
      },
    });
  } catch (error: any) {
    console.error("ROI 估算错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.9 多方案深度对比矩阵 (阶段二 任务 2.2)
// 输入: { schemeIds: [id1, id2] } 返回 6 维度评分 + 归一化得分
// =========================================================================
function computeSchemeMetrics(scheme: any): {
  coverageRate: number;
  coveredPopulation: number;
  coveredCommunities: number;
  competitionScore: number;
  roi: number;
  blindSpotReduction: number;
} {
  // 重新基于站点位置计算覆盖率: 站点半径内覆盖社区数 / 总社区数
  const stationPt = turf.point([Number(scheme.lng), Number(scheme.lat)]);
  const radius = Number(scheme.radius) || 800;
  const buffer = turf.circle(stationPt, radius / 1000, { units: "kilometers" });

  let coveredCommunities = 0;
  let coveredPopulation = 0;
  const totalCommunities = communitiesDatabase.features.length || 1;

  communitiesDatabase.features.forEach((comm: any) => {
    const centroid = turf.centroid(comm);
    if (turf.booleanPointInPolygon(centroid, buffer)) {
      coveredCommunities++;
      coveredPopulation += Number(comm.properties?.population_total || 0);
    }
  });

  const coverageRate = Math.round((coveredCommunities / totalCommunities) * 1000) / 10;

  // 竞争避让度: 周边 1.5km 内其他品牌站数衰减
  let nearbyCount = 0;
  chargingStations.forEach(s => {
    if (s.brand === scheme.brand) return;
    const d = turf.distance(stationPt, turf.point([s.lng, s.lat]), { units: "meters" });
    if (d < 1500) nearbyCount++;
  });
  const competitionScore = Math.max(0, Math.round(100 - nearbyCount * 12));

  // ROI 估算 (按方案覆盖人口估算)
  const fast = 4;  // 默认假设 4 快充 (无字段时)
  const slow = 4;  // 默认假设 4 慢充
  const cost = fast * 80000 + slow * 30000 + 200000;
  const annualRevenue = coveredPopulation * 0.05 * 1.5 * 365 * 0.3;
  const roi = annualRevenue > 0 ? Math.round((annualRevenue / cost) * 100) / 100 : 0;

  return {
    coverageRate,
    coveredPopulation,
    coveredCommunities,
    competitionScore,
    roi,
    blindSpotReduction: Number(scheme.blind_spot_reduction) || 0,
  };
}

app.post("/api/v1/analysis/compare", (req, res) => {
  try {
    const { schemeIds } = req.body || {};
    if (!Array.isArray(schemeIds) || schemeIds.length !== 2) {
      return res.status(400).json({ success: false, message: "请选择两个方案进行对比" });
    }
    const s1 = schemesDatabase.find(s => s.id === Number(schemeIds[0]));
    const s2 = schemesDatabase.find(s => s.id === Number(schemeIds[1]));
    if (!s1 || !s2) {
      return res.status(404).json({ success: false, message: "方案不存在" });
    }

    const m1 = computeSchemeMetrics(s1);
    const m2 = computeSchemeMetrics(s2);

    // 6 维度: 覆盖率/覆盖人口/覆盖社区/竞争避让/ROI/盲区消除
    const dimensions = [
      { key: "coverageRate",      label: "覆盖率",     value1: m1.coverageRate,        value2: m2.coverageRate },
      { key: "coveredPopulation", label: "覆盖人口",   value1: m1.coveredPopulation,   value2: m2.coveredPopulation },
      { key: "coveredCommunities",label: "覆盖社区",   value1: m1.coveredCommunities,  value2: m2.coveredCommunities },
      { key: "competitionScore",  label: "竞争避让",   value1: m1.competitionScore,    value2: m2.competitionScore },
      { key: "roi",               label: "ROI",        value1: m1.roi,                 value2: m2.roi },
      { key: "blindSpotReduction",label: "盲区消除",   value1: m1.blindSpotReduction,  value2: m2.blindSpotReduction },
    ];

    // 百分制归一化 (max-min 归一化到 0-100)
    const dimensionsWithScore = dimensions.map(d => {
      const max = Math.max(d.value1, d.value2);
      const min = Math.min(d.value1, d.value2);
      const range = max - min;
      const score1 = range === 0 ? 50 : Math.round(((d.value1 - min) / range) * 100);
      const score2 = range === 0 ? 50 : Math.round(((d.value2 - min) / range) * 100);
      return { ...d, score1, score2 };
    });

    // 综合得分 (6 维度百分制平均)
    const totalScore1 = dimensionsWithScore.reduce((sum, d) => sum + d.score1, 0) / 6;
    const totalScore2 = dimensionsWithScore.reduce((sum, d) => sum + d.score2, 0) / 6;

    // 推荐方案
    const recommendId = totalScore1 >= totalScore2 ? s1.id : s2.id;
    const recommendName = totalScore1 >= totalScore2 ? s1.name : s2.name;
    const winnerScore = Math.max(totalScore1, totalScore2);
    const loserScore = Math.min(totalScore1, totalScore2);
    const reason = `综合得分 ${winnerScore.toFixed(1)} vs ${loserScore.toFixed(1)}，"${recommendName}" 在 6 维度归一化对比中整体领先，建议优先采纳。`;

    res.json({
      success: true,
      data: {
        schemes: [
          { id: s1.id, name: s1.name, lng: s1.lng, lat: s1.lat, radius: s1.radius, brand: s1.brand, metrics: m1, totalScore: Math.round(totalScore1 * 10) / 10 },
          { id: s2.id, name: s2.name, lng: s2.lng, lat: s2.lat, radius: s2.radius, brand: s2.brand, metrics: m2, totalScore: Math.round(totalScore2 * 10) / 10 },
        ],
        dimensions: dimensionsWithScore,
        recommendation: { id: recommendId, name: recommendName, reason },
      },
    });
  } catch (error: any) {
    console.error("方案对比错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.10 区域竞争态势分析 (阶段二 任务 2.4)
// 返回: 品牌市占率 / 各行政区品牌分布 / 饱和度 / 空白市场
// =========================================================================
app.post("/api/v1/analysis/competition", (req, res) => {
  try {
    // 1. 品牌市占率
    const brandCount: Record<string, number> = {};
    chargingStations.forEach(s => {
      brandCount[s.brand] = (brandCount[s.brand] || 0) + 1;
    });
    const total = chargingStations.length || 1;
    const brandShare = Object.entries(brandCount)
      .map(([brand, count]) => ({ brand, count, percentage: Math.round((count / total) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);

    // 2. 各行政区品牌分布
    const districtMap: Record<string, Record<string, number>> = {};
    chargingStations.forEach(s => {
      if (!districtMap[s.district]) districtMap[s.district] = {};
      districtMap[s.district][s.brand] = (districtMap[s.district][s.brand] || 0) + 1;
    });
    const districtDistribution = Object.entries(districtMap).map(([district, brands]) => ({
      district,
      brands,
    }));

    // 3. 饱和度: 各行政区充电站密度 (座/km²) - 用社区总面积近似
    const districtArea: Record<string, number> = {};
    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties?.district;
      if (!d) return;
      // 用 turf 计算多边形面积 (平方公里)
      try {
        const areaKm2 = turf.area(c) / 1_000_000;
        districtArea[d] = (districtArea[d] || 0) + (areaKm2 > 0 ? areaKm2 : 0);
      } catch {}
    });
    const stationByDistrict: Record<string, number> = {};
    chargingStations.forEach(s => {
      stationByDistrict[s.district] = (stationByDistrict[s.district] || 0) + 1;
    });
    const allDistricts = new Set([...Object.keys(districtArea), ...Object.keys(stationByDistrict)]);
    const saturation = Array.from(allDistricts).map(d => {
      const area = districtArea[d] || 0;
      const count = stationByDistrict[d] || 0;
      return {
        district: d,
        stationsPerKm2: area > 0 ? Math.round((count / area) * 100) / 100 : 0,
        stationCount: count,
        areaKm2: Math.round(area * 100) / 100,
      };
    }).sort((a, b) => b.stationsPerKm2 - a.stationsPerKm2);

    // 4. 空白市场: 复用覆盖分析的盲区聚类逻辑
    // 找出所有"无充电站覆盖"的社区, 贪心聚类
    const operatingStations = chargingStations.filter(s => s.status === "运营中");
    const blindSpotFeatures: any[] = [];
    communitiesDatabase.features.forEach((comm: any) => {
      const centroid = turf.centroid(comm);
      let minDist = Infinity;
      operatingStations.forEach(s => {
        const d = turf.distance(centroid, turf.point([s.lng, s.lat]), { units: "meters" });
        if (d < minDist) minDist = d;
      });
      // 1.5km 内无充电站视为空白市场
      if (minDist > 1500) {
        blindSpotFeatures.push(comm);
      }
    });

    // 贪心聚类 (质心距离 ≤ 1500m)
    const clusters: any[] = [];
    blindSpotFeatures.forEach((feature: any) => {
      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      let target: any = null;
      for (const c of clusters) {
        const d = turf.distance(centroid, turf.point(c._center), { units: "meters" });
        if (d <= 1500) { target = c; break; }
      }
      if (target) {
        target._lngSum += lng;
        target._latSum += lat;
        target.communityCount += 1;
        target._center = [target._lngSum / target.communityCount, target._latSum / target.communityCount];
      } else {
        clusters.push({
          _lngSum: lng, _latSum: lat, _center: [lng, lat], communityCount: 1,
        });
      }
    });

    const blankMarkets = clusters
      .sort((a, b) => b.communityCount - a.communityCount)
      .slice(0, 10)
      .map((c, idx) => ({
        clusterId: idx + 1,
        center: [
          Number(c._center[0].toFixed(6)),
          Number(c._center[1].toFixed(6)),
        ] as [number, number],
        communityCount: c.communityCount,
      }));

    res.json({
      success: true,
      data: {
        brandShare,
        districtDistribution,
        saturation,
        blankMarkets,
      },
    });
  } catch (error: any) {
    console.error("竞争态势分析错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.11 充电桩缺口预测 (阶段二 任务 2.5)
// 需求桩数 = 人口 * 0.05 (车辆渗透率) * 0.3 (日充电频次) / 30 (单桩日服务能力)
// 现有桩数 = 该区所有充电站的 fastChargers + slowChargers 总和
// =========================================================================
app.post("/api/v1/analysis/gap-prediction", (req, res) => {
  try {
    // 按行政区统计人口与现有桩数
    const districtPop: Record<string, number> = {};
    const districtChargers: Record<string, number> = {};

    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties?.district;
      if (!d) return;
      districtPop[d] = (districtPop[d] || 0) + Number(c.properties?.population_total || 0);
    });
    chargingStations.forEach(s => {
      districtChargers[s.district] = (districtChargers[s.district] || 0) + s.fastChargers + s.slowChargers;
    });

    const allDistricts = new Set([...Object.keys(districtPop), ...Object.keys(districtChargers)]);
    const districts = Array.from(allDistricts).map(name => {
      const population = districtPop[name] || 0;
      const currentChargers = districtChargers[name] || 0;
      const demandChargers = Math.round((population * 0.05 * 0.3) / 30);
      const gap = demandChargers - currentChargers;
      return { name, population, currentChargers, demandChargers, gap };
    }).sort((a, b) => b.gap - a.gap);

    // Top 10 缺口最大
    const topGap = districts.slice(0, 10);

    res.json({
      success: true,
      data: {
        districts,
        topGap,
      },
    });
  } catch (error: any) {
    console.error("缺口预测错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.12 方案报告 PDF 导出 (阶段二 任务 2.6)
// 后端只返回方案完整数据, 前端组装打印 HTML 后调用 window.print()
// =========================================================================
app.post("/api/v1/export/scheme-pdf", (req, res) => {
  try {
    const { schemeId } = req.body || {};
    if (!schemeId) {
      return res.status(400).json({ success: false, message: "缺少 schemeId 参数" });
    }
    const scheme = schemesDatabase.find(s => s.id === Number(schemeId));
    if (!scheme) {
      return res.status(404).json({ success: false, message: "方案不存在" });
    }

    // 重新计算指标
    const metrics = computeSchemeMetrics(scheme);

    // ROI 估算
    const fast = 4, slow = 4; // 默认假设 4 快充 + 4 慢充
    const cost = fast * 80000 + slow * 30000 + 200000;
    const annualRevenue = Math.round(metrics.coveredPopulation * 0.05 * 1.5 * 365 * 0.3);
    const paybackYears = annualRevenue > 0 ? Math.round((cost / annualRevenue) * 100) / 100 : -1;

    // 周边站点列表 (1.5km 内)
    const stationPt = turf.point([Number(scheme.lng), Number(scheme.lat)]);
    const nearbyStations = chargingStations
      .map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        district: s.district,
        fastChargers: s.fastChargers,
        slowChargers: s.slowChargers,
        distance: Math.round(turf.distance(stationPt, turf.point([s.lng, s.lat]), { units: "meters" })),
      }))
      .filter(s => s.distance < 3000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    // AI 建议 (基于指标的简易建议)
    const advice: string[] = [];
    if (metrics.coverageRate < 10) advice.push("覆盖率偏低, 建议适当扩大服务半径或调整选址位置");
    if (metrics.competitionScore > 70) advice.push("竞争避让度较高, 周边竞品较少, 市场空间充足");
    else advice.push("周边竞争较激烈, 建议差异化定位 (如主打快充或夜间慢充)");
    if (paybackYears > 0 && paybackYears < 5) advice.push(`回收周期约 ${paybackYears} 年, 投资回报良好`);
    else if (paybackYears >= 5) advice.push(`回收周期约 ${paybackYears} 年, 建议优化规模或选址`);
    advice.push("建议持续关注公众反馈与实际利用率, 动态调整运营策略");

    res.json({
      success: true,
      data: {
        scheme: {
          id: scheme.id,
          name: scheme.name,
          lng: scheme.lng,
          lat: scheme.lat,
          radius: scheme.radius,
          brand: scheme.brand,
          creator: scheme.creator,
          create_time: scheme.create_time,
        },
        metrics,
        roi: {
          cost,
          costBreakdown: { fast: fast * 80000, slow: slow * 30000, land: 200000 },
          annualRevenue,
          paybackYears,
        },
        nearbyStations,
        advice,
        exportTime: new Date().toLocaleString("zh-CN"),
      },
    });
  } catch (error: any) {
    console.error("方案报告导出错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.13 决策大屏聚合接口 (阶段三 任务 3.1)
// 返回所有 KPI 与图表数据, 供前端 Dashboard.tsx 一次拉取
// =========================================================================
app.get("/api/v1/stats/dashboard", async (req, res) => {
  try {
    // ----- KPI 指标 -----
    const totalStations = chargingStations.length;
    const totalFast = chargingStations.reduce((s, x) => s + (x.fastChargers || 0), 0);
    const totalSlow = chargingStations.reduce((s, x) => s + (x.slowChargers || 0), 0);
    const totalPorts = totalFast + totalSlow;

    // 覆盖率 = 已覆盖社区数 / 总社区数
    const totalCommunities = communitiesDatabase.features.length || 0;
    const coveredCommunities = communitiesDatabase.features.filter((c: any) => c.properties.coverageRatio > 0).length;
    const blindSpotCommunities = totalCommunities - coveredCommunities;
    const coverageRate = totalCommunities > 0 ? Math.round((coveredCommunities / totalCommunities) * 1000) / 10 : 0;

    // 今日新增反馈 (按日期字符串匹配)
    const todayStr = new Date().toLocaleDateString("zh-CN");
    const todayFeedback = feedbackDatabase.filter(f => {
      const t = f.create_time || "";
      return t.includes(todayStr) || t.includes(new Date().toISOString().slice(0, 10));
    }).length;

    // ----- 品牌市占率 -----
    const brandMap: Record<string, number> = {};
    chargingStations.forEach(s => {
      brandMap[s.brand] = (brandMap[s.brand] || 0) + 1;
    });
    const brandShare = Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ----- 行政区分布 -----
    const districtMap: Record<string, { stations: number; ports: number; communities: number; population: number }> = {};
    chargingStations.forEach(s => {
      if (!districtMap[s.district]) districtMap[s.district] = { stations: 0, ports: 0, communities: 0, population: 0 };
      districtMap[s.district].stations++;
      districtMap[s.district].ports += (s.fastChargers || 0) + (s.slowChargers || 0);
    });
    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties.district;
      if (!districtMap[d]) districtMap[d] = { stations: 0, ports: 0, communities: 0, population: 0 };
      districtMap[d].communities++;
      districtMap[d].population += Number(c.properties.population_total || 0);
    });
    const districtDist = Object.entries(districtMap).map(([district, v]) => ({ district, ...v }));

    // ----- 增长趋势 (近 12 个月, 按方案 create_time 与站点 update_time 简易聚合) -----
    const months: { month: string; stations: number; schemes: number; feedback: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const st = chargingStations.filter(s => (s.updateTime || "").startsWith(key)).length;
      const sc = schemesDatabase.filter(s => (s.create_time || "").includes(key) || (s.create_time || "").includes(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`)).length;
      const fb = feedbackDatabase.filter(f => (f.create_time || "").includes(key) || (f.create_time || "").includes(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`)).length;
      months.push({ month: key, stations: st, schemes: sc, feedback: fb });
    }

    // ----- Top5 盲区社区 (按人口降序) -----
    const topBlindSpots = communitiesDatabase.features
      .filter((c: any) => !c.properties.coverageRatio || c.properties.coverageRatio === 0)
      .map((c: any) => ({
        id: c.properties.id,
        name: c.properties.name,
        district: c.properties.district,
        population: Number(c.properties.population_total || 0),
      }))
      .sort((a, b) => b.population - a.population)
      .slice(0, 5);

    // ----- 滚动条: 实时反馈 + 日志 -----
    const feedItems = feedbackDatabase
      .slice(-20)
      .reverse()
      .map(f => ({
        type: f.type === "evaluation" ? "评价" : "需求",
        content: (f.description || "").slice(0, 60),
        submitter: f.submitter || "匿名",
        time: f.create_time || "",
      }));
    const logItems = systemLogs.slice(0, 10).map(l => ({
      type: "日志",
      content: `${l.action} - ${l.detail || ""}`.slice(0, 60),
      submitter: l.user,
      time: l.create_time || "",
    }));
    const ticker = [...feedItems, ...logItems];

    // ----- 站点 GeoJSON (供大屏地图渲染) -----
    const stationsFC = {
      type: "FeatureCollection",
      features: chargingStations.map(s => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { id: s.id, name: s.name, brand: s.brand, district: s.district, fast: s.fastChargers, slow: s.slowChargers },
      })),
    };

    // 尝试更新数据库中的实时统计 (失败则忽略)
    res.json({
      success: true,
      data: {
        kpi: {
          totalStations,
          totalPorts,
          totalFast,
          totalSlow,
          coverageRate,
          blindSpotCommunities,
          todayFeedback,
          totalCommunities,
          totalPopulation: communitiesDatabase.features.reduce((s: number, c: any) => s + Number(c.properties.population_total || 0), 0),
        },
        brandShare,
        districtDist,
        growthTrend: months,
        topBlindSpots,
        ticker,
        stations: stationsFC,
        updateTime: new Date().toLocaleString("zh-CN"),
      },
    });
  } catch (e: any) {
    console.error("大屏聚合接口错误:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 10.14 多维统计报表接口 (阶段三 任务 3.2)
// 支持 query 参数 district / brand / chargeMode / status, 返回交叉透视数据
// =========================================================================
app.get("/api/v1/stats/report", (req, res) => {
  try {
    const { district, brand, chargeMode, status } = req.query;
    // 1. 过滤充电站
    let filtered = chargingStations.slice();
    if (district && district !== "all") filtered = filtered.filter(s => s.district === district);
    if (brand && brand !== "all") filtered = filtered.filter(s => s.brand === brand);
    if (status && status !== "all") filtered = filtered.filter(s => s.status === status);
    if (chargeMode && chargeMode !== "all") {
      if (chargeMode === "fast") filtered = filtered.filter(s => s.fastChargers > 0);
      else if (chargeMode === "slow") filtered = filtered.filter(s => s.slowChargers > 0);
    }

    // 2. 交叉透视: 行=行政区, 列=品牌, 值=充电站数 / 充电桩数
    const districtsSet = Array.from(new Set(filtered.map(s => s.district)));
    const brandsSet = Array.from(new Set(filtered.map(s => s.brand)));
    const pivot: { district: string; rows: Record<string, number>; total: number; ports: number }[] = [];
    districtsSet.forEach(d => {
      const rows: Record<string, number> = {};
      let total = 0, ports = 0;
      brandsSet.forEach(b => {
        const count = filtered.filter(s => s.district === d && s.brand === b).length;
        rows[b] = count;
        total += count;
      });
      ports = filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0);
      pivot.push({ district: d, rows, total, ports });
    });
    pivot.sort((a, b) => b.total - a.total);

    // 3. 品牌汇总
    const brandSummary = brandsSet.map(b => ({
      brand: b,
      stations: filtered.filter(s => s.brand === b).length,
      ports: filtered.filter(s => s.brand === b).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
    })).sort((a, b) => b.stations - a.stations);

    // 4. 行政区汇总
    const districtSummary = districtsSet.map(d => ({
      district: d,
      stations: filtered.filter(s => s.district === d).length,
      ports: filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
      brands: new Set(filtered.filter(s => s.district === d).map(s => s.brand)).size,
    })).sort((a, b) => b.stations - a.stations);

    res.json({
      success: true,
      data: {
        total: filtered.length,
        totalPorts: filtered.reduce((s, x) => s + x.fastChargers + x.slowChargers, 0),
        brands: brandsSet,
        districts: districtsSet,
        pivot,
        brandSummary,
        districtSummary,
        filter: { district: district || "all", brand: brand || "all", chargeMode: chargeMode || "all", status: status || "all" },
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 10.15 报表 CSV 导出接口 (阶段三 任务 3.2.4)
// 返回交叉透视表的 CSV 文件
// =========================================================================
app.get("/api/v1/export/report-csv", (req, res) => {
  try {
    const { district, brand, chargeMode, status } = req.query;
    let filtered = chargingStations.slice();
    if (district && district !== "all") filtered = filtered.filter(s => s.district === district);
    if (brand && brand !== "all") filtered = filtered.filter(s => s.brand === brand);
    if (status && status !== "all") filtered = filtered.filter(s => s.status === status);
    if (chargeMode && chargeMode !== "all") {
      if (chargeMode === "fast") filtered = filtered.filter(s => s.fastChargers > 0);
      else if (chargeMode === "slow") filtered = filtered.filter(s => s.slowChargers > 0);
    }
    const brandsSet = Array.from(new Set(filtered.map(s => s.brand)));
    const districtsSet = Array.from(new Set(filtered.map(s => s.district)));

    // CSV 表头: 行政区,品牌1,品牌2,...,合计,充电桩合计
    const header = ["行政区", ...brandsSet, "合计", "充电桩合计"];
    const lines: string[] = [header.join(",")];
    districtsSet.forEach(d => {
      const row: (string | number)[] = [d];
      let total = 0;
      brandsSet.forEach(b => {
        const c = filtered.filter(s => s.district === d && s.brand === b).length;
        row.push(c);
        total += c;
      });
      const ports = filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0);
      row.push(total, ports);
      lines.push(row.join(","));
    });
    // 合计行
    const totalRow: (string | number)[] = ["合计"];
    let grand = 0;
    brandsSet.forEach(b => {
      const c = filtered.filter(s => s.brand === b).length;
      totalRow.push(c);
      grand += c;
    });
    totalRow.push(grand, filtered.reduce((s, x) => s + x.fastChargers + x.slowChargers, 0));
    lines.push(totalRow.join(","));

    // 加 BOM 头让 Excel 正确识别 UTF-8
    const csv = "\uFEFF" + lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=geoplan-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 11. Vite + Express 服务器启动
// =========================================================================
async function startServer() {
  // 从数据库加载充电站和社区数据 (失败则保留 CSV 后备数据)
  try {
    console.log("[GeoPlan] 正在从数据库加载数据 ...");
    const [stations, communities] = await Promise.all([
      loadStationsFromDB(),
      loadCommunitiesFromDB(),
    ]);
    if (stations.length > 0) {
      chargingStations = stations;
      console.log(`[GeoPlan] 充电站数据已从数据库加载: ${stations.length} 条 (WGS84)`);
    } else {
      console.log("[GeoPlan] 数据库无充电站数据，使用 CSV 后备 (GCJ02)");
    }
    if (communities.features.length > 0) {
      communitiesDatabase = communities;
      console.log(`[GeoPlan] 社区数据已从数据库加载: ${communities.features.length} 条 (WGS84)`);
    } else {
      console.log("[GeoPlan] 数据库无社区数据");
    }
    const dbUsers = await loadUsersFromDB();
    if (dbUsers.length > 0) {
      usersDatabase = dbUsers;
      console.log(`[GeoPlan] 用户数据已从数据库加载: ${dbUsers.length} 条`);
    }
    feedbackDatabase = await loadFeedbackFromDB();
    console.log(`[GeoPlan] 反馈数据已从数据库加载: ${feedbackDatabase.length} 条`);
    schemesDatabase = await loadSchemesFromDB();
    console.log(`[GeoPlan] 方案数据已从数据库加载: ${schemesDatabase.length} 条`);
    systemLogs = await loadLogsFromDB();
    console.log(`[GeoPlan] 日志数据已从数据库加载: ${systemLogs.length} 条`);
  } catch (err: any) {
    console.warn(`[GeoPlan] 数据库加载失败，使用 CSV 后备数据: ${err.message}`);
  }

  // Fallback: 数据库未连接或无用户时，填充 demo 用户 (与前端 DEMO_ACCOUNTS 一致)
  if (usersDatabase.length === 0) {
    usersDatabase = [
      { id: 1, username: "admin", password: "admin123", role: "管理员", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
      { id: 2, username: "车主_张先生", password: "123456", role: "新能源车主", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
      { id: 3, username: "投资商_王总", password: "123456", role: "投资商", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
    ];
    console.warn("[GeoPlan] 使用 fallback 用户数据 (3 个 demo 账号) — 请配置 MySQL 以启用完整功能");
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GeoPlan 充电设施规划平台] 服务已启动: http://localhost:${PORT}`);
    console.log(`[GeoPlan] AI助手: ${DEEPSEEK_API_KEY ? "DeepSeek已连接" : "降级模式(无DeepSeek API Key)"}`);

    // 异步预计算等时圈（不阻塞主服务）
    // 仅对 isochrone_status='pending' 的站点计算，已计算的跳过
    const pendingStations = chargingStations
      .filter(s => s.isochroneStatus === "pending" || s.isochroneStatus === "failed")
      .map(s => ({ id: s.id, lng: s.lng, lat: s.lat, fastChargers: s.fastChargers, slowChargers: s.slowChargers }));
    if (pendingStations.length > 0) {
      console.log(`[GeoPlan] 检测到 ${pendingStations.length} 座站点待计算等时圈，后台异步开始...`);
      precomputeAsync(dbPool, pendingStations, { memoryStations: chargingStations });
    } else {
      const okCount = chargingStations.filter(s => s.isochroneStatus === "ok").length;
      console.log(`[GeoPlan] 等时圈已全部就绪（${okCount}/${chargingStations.length} 座站点）`);
    }
  });
}

startServer();
