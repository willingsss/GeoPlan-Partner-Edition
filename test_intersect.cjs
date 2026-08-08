const turf = require('@turf/turf');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'geoplan';
  const conn = await mysql.createConnection({ host, user, password, database });

  // 取第一个社区
  const [rows] = await conn.execute('SELECT name, ST_AsGeoJSON(geom) as geojson FROM t_community LIMIT 1');
  const commGeo = typeof rows[0].geojson === 'string' ? JSON.parse(rows[0].geojson) : rows[0].geojson;
  console.log('=== 社区数据 ===');
  console.log('社区名:', rows[0].name);
  console.log('geometry type:', commGeo.type);
  console.log('coords[0][0..2]:', JSON.stringify(commGeo.coordinates[0].slice(0, 3)));

  // 取第一个非蔚来换电充电站
  const [stas] = await conn.execute("SELECT name, lng, lat FROM t_charging_station WHERE brand != '蔚来换电' LIMIT 1");
  const station = stas[0];
  console.log('\n=== 充电站数据 ===');
  console.log('站名:', station.name, 'lng:', station.lng, 'lat:', station.lat);

  // 投影到 EPSG:3857
  function to3857(lng, lat) {
    const x = (lng * 20037508.34) / 180;
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return [x, y];
  }

  // 创建缓冲区
  console.log('\n=== to3857 调试 ===');
  console.log('station.lng type:', typeof station.lng, 'value:', station.lng);
  console.log('station.lat type:', typeof station.lat, 'value:', station.lat);
  const lngNum = Number(station.lng);
  const latNum = Number(station.lat);
  console.log('lngNum:', lngNum, 'latNum:', latNum);
  const testY = Math.log(Math.tan(((90 + latNum) * Math.PI) / 360)) / (Math.PI / 180);
  console.log('testY before scale:', testY);
  console.log('testY after scale:', (testY * 20037508.34) / 180);
  const [cx, cy] = to3857(lngNum, latNum);
  console.log('to3857 result:', [cx, cy]);
  const ring = [];
  for (let i = 0; i < 65; i++) {
    const t = (i * 2 * Math.PI) / 64;
    ring.push([cx + 800 * Math.cos(t), cy + 800 * Math.sin(t)]);
  }
  const buffer = turf.polygon([ring]);
  console.log('\n=== 缓冲区 ===');
  console.log('center 3857:', cx, cy);
  console.log('buffer coords[0..2]:', JSON.stringify(ring.slice(0, 3)));

  // 投影社区到 3857
  const commProj = JSON.parse(JSON.stringify(commGeo));
  turf.coordEach({ type: 'Feature', geometry: commProj }, (c) => {
    const [x, y] = to3857(c[0], c[1]);
    c[0] = x;
    c[1] = y;
  });
  console.log('\n=== 投影后社区 ===');
  console.log('type:', commProj.type);
  console.log('coords[0][0..2]:', JSON.stringify(commProj.coordinates[0].slice(0, 3)));

  // 测试 intersect
  const commFeature = turf.feature(commProj);
  console.log('\n=== intersect 测试 ===');
  console.log('commFeature.type:', commFeature.type);
  console.log('commFeature.geometry.type:', commFeature.geometry.type);
  console.log('buffer.type:', buffer.type);
  console.log('buffer.geometry.type:', buffer.geometry.type);

  try {
    const fc = turf.featureCollection([commFeature, buffer]);
    console.log('fc.features.length:', fc.features.length);
    const result = turf.intersect(fc);
    console.log('intersect result:', result ? (result.geometry ? result.geometry.type : 'NO GEOMETRY') : 'NULL');
    if (result && result.geometry) {
      console.log('result coords sample:', JSON.stringify(result.geometry.coordinates).substring(0, 200));
    }
  } catch (e) {
    console.log('intersect error:', e.message);
  }

  // 测试用 turf.booleanOverlap
  try {
    const overlap = turf.booleanOverlap(commFeature, buffer);
    console.log('booleanOverlap:', overlap);
  } catch (e) {
    console.log('booleanOverlap error:', e.message);
  }

  // 测试用 turf.booleanContains
  try {
    const contains = turf.booleanContains(buffer, turf.centroid(commFeature));
    console.log('buffer contains comm centroid:', contains);
  } catch (e) {
    console.log('booleanContains error:', e.message);
  }

  // 遍历所有充电站，找与第一个社区最近的站
  console.log('\n=== 遍历充电站找最近的 ===');
  const [allStations] = await conn.execute("SELECT name, lng, lat FROM t_charging_station WHERE brand != '蔚来换电'");
  let minDist = Infinity;
  let nearestStation = null;
  const commCentroid = turf.centroid(turf.feature(commGeo));
  for (const s of allStations) {
    const dist = turf.distance(commCentroid, turf.point([Number(s.lng), Number(s.lat)]));
    if (dist < minDist) {
      minDist = dist;
      nearestStation = s;
    }
  }
  console.log('最近充电站:', nearestStation.name, 'lng:', nearestStation.lng, 'lat:', nearestStation.lat);
  console.log('距离:', minDist.toFixed(2), 'km');

  if (minDist < 2) {
    // 测试最近充电站与社区的 intersect
    const [nx, ny] = to3857(Number(nearestStation.lng), Number(nearestStation.lat));
    const nearRing = [];
    for (let i = 0; i < 65; i++) {
      const t = (i * 2 * Math.PI) / 64;
      nearRing.push([nx + 800 * Math.cos(t), ny + 800 * Math.sin(t)]);
    }
    const nearBuffer = turf.polygon([nearRing]);
    const nearInter = turf.intersect(turf.featureCollection([commFeature, nearBuffer]));
    console.log('最近站 intersect:', nearInter ? nearInter.geometry.type : 'NULL');
  }

  await conn.end();
})().catch(e => console.error(e));
