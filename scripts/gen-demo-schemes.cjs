// 生成选址示例方案: 清除旧方案 → 评估 5 点位 → 正式命名保存
const BASE = "http://localhost:3000";

async function main() {
  // 登录
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "投资商_王总", password: "123456" }),
  });
  const login = await loginRes.json();
  if (!login.success) throw new Error("登录失败: " + login.message);
  const H = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
  console.log(`登录: ${login.user.username} (${login.user.role})`);

  // 1. 删除全部旧方案
  const listRes = await fetch(`${BASE}/api/v1/schemes`, { headers: { Authorization: H.Authorization } });
  const list = await listRes.json();
  console.log(`现有方案 ${list.data.length} 个, 开始删除...`);
  for (const s of list.data) {
    const del = await fetch(`${BASE}/api/v1/schemes/${s.id}`, { method: "DELETE", headers: { Authorization: H.Authorization } });
    const dj = await del.json();
    console.log(`  删除 #${s.id} ${s.name}: ${dj.success}`);
  }

  // 2. 五个候选点位 (徐州, WGS84)
  const points = [
    { name: "市中心彭城广场商圈", lng: 117.1853, lat: 34.2618 },
    { name: "九里湖北新兴片区",   lng: 117.1680, lat: 34.2930 },
    { name: "高铁东站商务区",     lng: 117.3120, lat: 34.2550 },
    { name: "云龙湖东居住区",     lng: 117.1600, lat: 34.2500 },
    { name: "铜山大学城片区",     lng: 117.1840, lat: 34.1960 },
  ];

  // 3. 逐点评估 + 保存
  const saved = [];
  for (const p of points) {
    const ev = await (await fetch(`${BASE}/api/v1/analysis/evaluate-site`, {
      method: "POST", headers: H,
      body: JSON.stringify({ lng: p.lng, lat: p.lat, radius: 1000, chargeMode: "fast" }),
    })).json();
    if (!ev.success) { console.log(`评估失败 ${p.name}: ${ev.message}`); continue; }
    const m = ev.data.metrics;
    console.log(`评估 ${p.name}: 覆盖人口=${m.covered_population} 覆盖社区=${m.covered_communities} 竞争=${m.competition_score} 社会效益=${m.social_benefit} 盲区内=${ev.data.in_blind_spot}`);

    const sv = await (await fetch(`${BASE}/api/v1/schemes`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        name: p.name, lng: p.lng, lat: p.lat, radius: 1000, brand: "国家电网",
        metrics: m,
        roi: { fastChargers: 4, slowChargers: 4, coveredPopulation: m.covered_population },
      }),
    })).json();
    if (sv.success) {
      console.log(`  保存 #${sv.data.id} ${sv.data.name} [区=${sv.data.district}]`);
      saved.push({ id: sv.data.id, name: p.name, district: sv.data.district, ...m, in_blind_spot: ev.data.in_blind_spot });
    } else {
      console.log(`  保存失败 ${p.name}: ${sv.message}`);
    }
  }

  // 4. 最终列表
  const final = await (await fetch(`${BASE}/api/v1/schemes`, { headers: { Authorization: H.Authorization } })).json();
  console.log(`\n=== 最终方案列表 (共 ${final.data.length} 个) ===`);
  for (const s of final.data) {
    console.log(`#${s.id} ${s.name} | ${s.district} | 覆盖人口=${s.covered_population} 社区=${s.covered_communities} 竞争=${s.competition_score} 效益=${s.social_benefit}`);
  }
  console.log("\nSAVED_JSON=" + JSON.stringify(saved));
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
