import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

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

// 从数据库加载充电站数据 (WGS84 坐标)
async function loadStationsFromDB(): Promise<ChargingStation[]> {
  const [rows] = await dbPool.query(
    `SELECT id, name, brand, district, address, fast_chargers, slow_chargers, status, lng, lat, update_time
     FROM t_charging_station ORDER BY id`
  );
  return (rows as any[]).map((r) => ({
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
  }));
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
  // 转为 GeoJSON FeatureCollection
  const fc = {
    type: "FeatureCollection",
    features: stations.map(s => ({
      type: "Feature",
      id: s.id,
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { ...s },
    })),
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

// 充电覆盖分析：识别盲区
app.post("/api/v1/analysis/coverage", (req, res) => {
  try {
    const { chargeMode, radius, district } = req.body; // "fast" | "slow"
    // 快充: 驾车10分钟 ~800m半径; 慢充: 步行15分钟 ~400m半径
    // 优先使用传入的自定义 radius，未传时回退到 chargeMode 推导
    const serviceRadius = (typeof radius === "number" && radius > 0)
      ? radius
      : (chargeMode === "fast" ? 800 : 400);
    const activeStations = chargingStations.filter(s => s.status === "运营中" && s.brand !== "蔚来换电");

    // 行政区过滤：若指定 district（非空且非 "all"），仅分析该区社区
    const districtFilter = typeof district === "string" && district && district !== "all" ? district : null;
    const targetCommunities = districtFilter
      ? communitiesDatabase.features.filter((comm: any) => comm.properties.district === districtFilter)
      : communitiesDatabase.features;

    // 为每个运营中的充电站生成服务区缓冲区
    const serviceAreas: any[] = [];
    activeStations.forEach(station => {
      const center3857 = toEPSG3857([station.lng, station.lat]);
      const buffer = createPlanarBuffer3857(center3857, serviceRadius);
      serviceAreas.push({ station, buffer });
    });

    // 分析每个社区的覆盖情况
    const communityResults: any[] = [];
    const blindSpotFeatures: any[] = [];
    let totalCoveredPop = 0;
    let totalPopulation = 0;
    let coveredCount = 0;
    let blindSpotCount = 0;

    targetCommunities.forEach((comm: any) => {
      const commProj = projectGeometryTo3857(comm);
      const commArea = getPlanarPolygonArea3857(commProj);
      const pop = comm.properties.population_total;
      totalPopulation += pop;

      // 检查社区是否被任何服务区覆盖
      let maxCoverageRatio = 0;
      let coveredByStation: string | null = null;

      for (const { station, buffer } of serviceAreas) {
        let intersection: any = null;
        try {
          intersection = turf.intersect(turf.featureCollection([commProj, buffer]));
        } catch { intersection = null; }

        if (intersection) {
          const intersectArea = getPlanarPolygonArea3857(intersection);
          const ratio = intersectArea / commArea;
          if (ratio > maxCoverageRatio) {
            maxCoverageRatio = ratio;
            coveredByStation = station.name;
          }
        }
      }

      const coveragePercent = Math.round(maxCoverageRatio * 1000) / 10;
      const isBlindSpot = maxCoverageRatio < 0.1; // 覆盖率<10%视为盲区

      if (isBlindSpot) {
        blindSpotCount++;
        totalPopulation; // 盲区人口
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

    // 生成服务区 GeoJSON
    const serviceAreaFeatures = serviceAreas.map(({ station, buffer }) => {
      const wgs84Geom = projectGeometryTo4326(buffer.geometry);
      return turf.feature(wgs84Geom, { stationName: station.name, brand: station.brand, radius: serviceRadius });
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

    res.json({
      success: true,
      data: {
        chargeMode,
        serviceRadius,
        district: districtFilter || "all",
        serviceAreas: { type: "FeatureCollection", features: serviceAreaFeatures },
        blindSpots: { type: "FeatureCollection", features: blindSpotFeatures },
        blindSpotClusters,
        communityResults: communityResults.sort((a, b) => a.coverageRatio - b.coverageRatio),
        districtStats: Object.values(districtStats),
        summary: {
          totalCommunities: communityResults.length,
          coveredCommunities: coveredCount,
          blindSpotCommunities: blindSpotCount,
          coverageRate: communityResults.length > 0 ? Math.round((coveredCount / communityResults.length) * 1000) / 10 : 0,
          totalPopulation,
          blindSpotPopulation: communityResults.filter(c => c.isBlindSpot).reduce((s, c) => s + c.population, 0),
          totalStations: activeStations.length,
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
    if (!districtStats[d]) districtStats[d] = { district: d, stations: 0, fastChargers: 0, slowChargers: 0, brands: new Set() };
    if (!districtStats[d].communities) districtStats[d].communities = 0;
    if (!districtStats[d].population) districtStats[d].population = 0;
    districtStats[d].communities++;
    districtStats[d].population += c.properties.population_total;
  });

  const result = Object.values(districtStats).map((s: any) => ({
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
  });
}

startServer();
