import { AMAP_JS_API_VERSION } from "../config/map";

declare global {
  interface Window {
    AMap?: any;
    __amapLoaderPromise?: Promise<any>;
  }
}

export interface AmapLocation {
  lng: number;
  lat: number;
  accuracy?: number;
  address?: string;
}

function getAmapKey(): string {
  return import.meta.env.VITE_AMAP_KEY || "";
}

export function loadAmap(): Promise<any> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (window.__amapLoaderPromise) return window.__amapLoaderPromise;

  const key = getAmapKey();
  if (!key) {
    return Promise.reject(new Error("缺少 VITE_AMAP_KEY，请在 .env 中配置高德 Web JS API Key"));
  }

  window.__amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=${AMAP_JS_API_VERSION}&key=${encodeURIComponent(key)}&plugin=AMap.Geolocation`;
    script.async = true;
    script.onerror = () => reject(new Error("高德地图 API 加载失败，请检查网络或 API Key"));
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      else reject(new Error("高德地图 API 未正确初始化"));
    };
    document.head.appendChild(script);
  });

  return window.__amapLoaderPromise;
}

export async function locateWithAmap(): Promise<AmapLocation> {
  const AMap = await loadAmap();

  return new Promise((resolve, reject) => {
    AMap.plugin("AMap.Geolocation", () => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        noIpLocate: false,
        zoomToAccuracy: false,
        needAddress: true,
      });

      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === "complete" && result?.position) {
          resolve({
            lng: result.position.getLng(),
            lat: result.position.getLat(),
            accuracy: result.accuracy,
            address: result.formattedAddress,
          });
          return;
        }

        reject(new Error(result?.message || result?.info || "定位失败"));
      });
    });
  });
}
