// GeoPlan 服务端入口：Express 配置 + 路由挂载 + 启动
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  dbPool, chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase,
  usersDatabase, systemLogs, loadStationsFromDB, loadCommunitiesFromDB, loadUsersFromDB,
  loadFeedbackFromDB, loadSchemesFromDB, loadLogsFromDB,
} from "./db";
import { precomputeAsync } from "./services/isochronePrecompute";
import registerAuthRoutes from "./routes/auth";
import registerDataRoutes from "./routes/data";
import registerAdminRoutes from "./routes/admin";
import registerAnalysisRoutes from "./routes/analysis";
import registerSchemesRoutes from "./routes/schemes";
import registerStatsRoutes from "./routes/stats";
import registerAiRoutes from "./routes/ai";
import registerExportRoutes from "./routes/export";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

app.use(express.json({ limit: "10mb" }));

// =========================================================================
// 路由挂载（各子系统）
// =========================================================================
registerAuthRoutes(app);
registerDataRoutes(app);
registerAnalysisRoutes(app);
registerSchemesRoutes(app);
registerStatsRoutes(app);
registerAdminRoutes(app);
registerAiRoutes(app);
registerExportRoutes(app);

// =========================================================================
// 服务器启动
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
      chargingStations.splice(0, chargingStations.length, ...stations);
      console.log(`[GeoPlan] 充电站数据已从数据库加载: ${stations.length} 条 (WGS84)`);
    } else {
      console.log("[GeoPlan] 数据库无充电站数据，使用 CSV 后备 (GCJ02)");
    }
    if (communities.features.length > 0) {
      communitiesDatabase.features = communities.features;
      console.log(`[GeoPlan] 社区数据已从数据库加载: ${communities.features.length} 条 (WGS84)`);
    } else {
      console.log("[GeoPlan] 数据库无社区数据");
    }
    const dbUsers = await loadUsersFromDB();
    if (dbUsers.length > 0) {
      usersDatabase.splice(0, usersDatabase.length, ...dbUsers);
      console.log(`[GeoPlan] 用户数据已从数据库加载: ${dbUsers.length} 条`);
    }
    const fb = await loadFeedbackFromDB();
    feedbackDatabase.splice(0, feedbackDatabase.length, ...fb);
    console.log(`[GeoPlan] 反馈数据已从数据库加载: ${fb.length} 条`);
    const sc = await loadSchemesFromDB();
    schemesDatabase.splice(0, schemesDatabase.length, ...sc);
    console.log(`[GeoPlan] 方案数据已从数据库加载: ${sc.length} 条`);
    const lg = await loadLogsFromDB();
    systemLogs.splice(0, systemLogs.length, ...lg);
    console.log(`[GeoPlan] 日志数据已从数据库加载: ${lg.length} 条`);
  } catch (err: any) {
    console.warn(`[GeoPlan] 数据库加载失败，使用 CSV 后备数据: ${err.message}`);
  }

  // Fallback: 数据库未连接或无用户时，填充 demo 用户 (与前端 DEMO_ACCOUNTS 一致)
  if (usersDatabase.length === 0) {
    usersDatabase.push(
      { id: 1, username: "admin", password: "admin123", role: "管理员", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
      { id: 2, username: "车主_张先生", password: "123456", role: "新能源车主", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
      { id: 3, username: "投资商_王总", password: "123456", role: "投资商", status: "正常", create_time: new Date().toLocaleString("zh-CN") },
    );
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
