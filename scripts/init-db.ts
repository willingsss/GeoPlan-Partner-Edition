import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "geoplan";

  console.log(`[初始化] 连接 MySQL ${user}@${host}:${port} ...`);
  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });

  console.log(`[初始化] 创建数据库 ${database} ...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${database}\``);

  const sqlPath = path.join(process.cwd(), "database.sql");
  console.log(`[初始化] 读取 SQL 文件: ${sqlPath}`);
  let sqlContent = fs.readFileSync(sqlPath, "utf-8");

  sqlContent = sqlContent.replace(/CREATE DATABASE[\s\S]*?USE geoplan;/i, "");
  sqlContent = sqlContent.replace(/^--.*$/gm, "");
  sqlContent = sqlContent.replace(/\/\*[\s\S]*?\*\//g, "");

  const statements = sqlContent
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`[初始化] 共 ${statements.length} 条 SQL 语句，开始执行 ...`);

  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await conn.query(stmt);
      successCount++;
    } catch (e: any) {
      console.warn(`[初始化] 第 ${i + 1} 条语句执行警告: ${e.message}`);
      console.warn(`  语句: ${stmt.slice(0, 100)}...`);
    }
  }

  console.log(`[初始化] 执行完成: 成功 ${successCount} / ${statements.length}`);

  const [tables] = await conn.query("SHOW TABLES");
  console.log(`[初始化] 数据库表列表:`);
  for (const t of tables as any[]) {
    const tableName = Object.values(t)[0];
    const [count] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``);
    console.log(`  - ${tableName}: ${(count as any[])[0].cnt} 条记录`);
  }

  await conn.end();
  console.log("[初始化] 完成！");
}

main().catch(err => {
  console.error("[初始化] 错误:", err);
  process.exit(1);
});
