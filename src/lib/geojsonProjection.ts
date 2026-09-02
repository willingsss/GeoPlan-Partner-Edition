// geojsonProjection.ts
// GeoJSON → OpenLayers Feature 读取辅助 (与主页面 App.tsx 的 readFeaturesFromWGS84/readFeaturesFromGCJ02 逻辑一致)
// 背景: 高德底图为 GCJ02 坐标系; 后端小区/盲区等数据为 WGS84, 上图前必须转换; 充电站源自高德POI 已是 GCJ02
import GeoJSON from "ol/format/GeoJSON";
import { wgs84ToGcj02 } from "./coordinate";

// 深拷贝 GeoJSON 并将其坐标 WGS84 → GCJ02, 再投影到 EPSG:3857
export const readFeaturesFromWGS84 = (geojson: any): any[] => {
  const converted = JSON.parse(JSON.stringify(geojson));
  const convertCoord = (coord: number[]) => {
    const [lng, lat] = wgs84ToGcj02(coord[0], coord[1]);
    coord[0] = lng;
    coord[1] = lat;
  };
  const walk = (geom: any) => {
    if (!geom) return;
    if (geom.type === "Point") convertCoord(geom.coordinates);
    else if (geom.type === "LineString" || geom.type === "MultiPoint") geom.coordinates.forEach((c: any) => convertCoord(c));
    else if (geom.type === "Polygon" || geom.type === "MultiLineString") geom.coordinates.forEach((ring: any) => ring.forEach((c: any) => convertCoord(c)));
    else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly: any) => poly.forEach((ring: any) => ring.forEach((c: any) => convertCoord(c))));
  };
  if (converted.type === "FeatureCollection") {
    converted.features.forEach((f: any) => walk(f.geometry));
  } else if (converted.type === "Feature") {
    walk(converted.geometry);
  } else {
    walk(converted);
  }
  return new GeoJSON().readFeatures(converted, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
};

// 读取已是 GCJ02 坐标的数据 (如高德POI充电站), 直接投影不做转换
export const readFeaturesFromGCJ02 = (geojson: any): any[] => {
  return new GeoJSON().readFeatures(geojson, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
};
