// 3D 키트 공용 — 모든 움직임은 frame의 순수 함수 (렌더 재현성)
import * as THREE from 'three';

export const deg = Math.PI / 180;
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
// 팝: 0.6 → 1.08 → 1 (2D anim.js의 pop과 같은 곡선)
export const pop = (t: number) => {
  const p = clamp(t);
  return p < 0.6 ? 0.6 + 0.48 * easeOut(p / 0.6) : 1.08 - 0.08 * easeOut((p - 0.6) / 0.4);
};
export const appear = (frame: number, at: number | undefined, dur = 12) => (at == null ? 1 : clamp((frame - at) / dur));

export const PALETTE = {navy: '#0b1f4b', indigo: '#3d3dbf', blue: '#296ef9', sky: '#7aa7ff', pale: '#dbe6fb', ink: '#18202e', gray: '#556074', floor: '#eef2f8'};

// 위도·경도 → 구 표면 좌표 (y 위쪽)
export const latLon = (lat: number, lon: number, r = 1) => {
  const phi = (90 - lat) * deg;
  const th = (lon + 180) * deg;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

// 키프레임 [{at, ...값}] 사이를 dur 프레임 동안 easeInOut으로 보간
export function keyframes<T extends Record<string, number>>(frames: (T & {at: number; dur?: number})[], frame: number, base: T, wrapKeys: string[] = []): T {
  const list = (frames || []).slice().sort((a, b) => a.at - b.at);
  let cur: T = {...base};
  for (const k of list) {
    if (frame < k.at) break;
    const p = easeInOut((frame - k.at) / (k.dur || 40));
    const next: Record<string, number> = {...cur};
    for (const key of Object.keys(base)) {
      const to = (k as Record<string, number>)[key];
      if (to == null) continue;
      let from = (cur as Record<string, number>)[key];
      if (wrapKeys.includes(key)) {
        let d = to - from;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        next[key] = from + d * p;
        from = next[key];
      } else next[key] = from + (to - from) * p;
    }
    cur = next as T;
  }
  return cur;
}
