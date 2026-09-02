// DashboardStoryNav.tsx
// 数据大屏故事线导航 (现状 → 缺口 → 行动) + 深链 payload 类型定义
// 三块大屏共享: 决策大屏(现状) / 盲区攻坚(缺口) / 选址决策(行动)
import { Fragment } from "react";
import { Map, Target, Zap } from "lucide-react";

export type DashboardTarget = "main" | "blindspot" | "scheme";

// 深链 payload: 跨大屏跳转时携带的上下文
export interface DashboardJumpPayload {
  from: DashboardTarget;
  // 决策大屏 → 盲区屏: 带上盲区数字, 打开后自动定位 Top1 盲区
  blindSpotCount?: number;
  focusTopBlindSpot?: boolean;
  // 盲区屏 → 方案屏: Top3 盲区质心作为候选点高亮
  candidateSpots?: DashboardCandidateSpot[];
}

export interface DashboardCandidateSpot {
  id?: string | number;
  name: string;
  district?: string;
  population?: number;
  lng: number;
  lat: number;
}

// 计算 GeoJSON 几何 (4326) 的包围盒中心, 用作盲区质心近似
export function geometryBboxCenter(geometry: any): [number, number] | null {
  if (!geometry?.coordinates) return null;
  const coords: number[][] = [];
  const walk = (c: any) => {
    if (typeof c[0] === "number") coords.push(c);
    else (c as any[]).forEach(walk);
  };
  walk(geometry.coordinates);
  if (!coords.length) return null;
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

const STEPS: { id: DashboardTarget; label: string; icon: typeof Map; color: string }[] = [
  { id: "main", label: "现状", icon: Map, color: "#3FA98C" },
  { id: "blindspot", label: "缺口", icon: Target, color: "#E08D5A" },
  { id: "scheme", label: "行动", icon: Zap, color: "#B8862F" },
];

interface DashboardStoryNavProps {
  current: DashboardTarget;
  onNavigate: (t: DashboardTarget) => void;
}

export default function DashboardStoryNav({ current, onNavigate }: DashboardStoryNavProps) {
  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 rounded-full shrink-0"
      style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.65)" }}
    >
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const active = s.id === current;
        return (
          <Fragment key={s.id}>
            {i > 0 && <span className="mx-1 text-[10px] select-none" style={{ color: "rgba(90,123,160,0.5)" }}>→</span>}
            <button
              onClick={() => !active && onNavigate(s.id)}
              disabled={active}
              className="flex items-center gap-1 px-2.5 h-6 rounded-full text-[11px] font-medium transition-all hover:scale-105 disabled:hover:scale-100"
              style={
                active
                  ? { background: `${s.color}1F`, color: s.color, border: `1px solid ${s.color}45`, cursor: "default" }
                  : { color: "#7A8A9A", border: "1px solid transparent" }
              }
            >
              <Icon className="w-3 h-3" />
              {s.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
