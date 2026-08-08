// 直接测 db.ts 的 loadStationsFromDB
import { loadStationsFromDB } from "./server/db";
const stations = await loadStationsFromDB();
const withIso = stations.filter(s => s.isochroneFastGeom);
console.log(`加载 ${stations.length} 站, 有快充等时圈几何: ${withIso.length}`);
if (withIso[0]) console.log("样例:", withIso[0].id, withIso[0].name, "| geom type:", withIso[0].isochroneFastGeom?.type);
