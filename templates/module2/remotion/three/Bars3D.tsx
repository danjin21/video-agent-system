// 입체 막대 — 실적: 막대가 말하는 시점(at)에 자라고 값이 카운트업, 강조 막대는 진한 파랑, 마지막에 추이선
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame} from 'remotion';
import {displayText} from '../anim.js';
import {TextSprite} from './TextSprite';
import {PALETTE, appear, clamp, deg, easeOut} from './util';

export type Bar = {label: string; value: number; display?: string; at?: number; highlight?: boolean; color?: string};
export type Bars3DProps = {
  bars: Bar[];
  max?: number;
  unit?: string; // display가 없을 때 값 뒤에 붙일 단위
  height?: number; // 최대 막대 높이(월드)
  trend?: boolean | number; // true면 마지막 막대 뒤, 숫자면 그 프레임에 추이선
  orbit?: number; // 장면 전체 동안 카메라가 도는 각도
  span?: number; // 장면 길이(프레임) — Scene3D가 넣어줌
};

const CameraRig: React.FC<{angle: number; dist: number; h: number; target: number}> = ({angle, dist, h, target}) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(Math.sin(angle) * dist, h, Math.cos(angle) * dist);
  camera.lookAt(0, target, 0);
  camera.updateProjectionMatrix();
  return null;
};

const Trend: React.FC<{pts: THREE.Vector3[]; progress: number}> = ({pts, progress}) => {
  const SEG = 80, RAD = 8;
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEG, 0.03, RAD, false), [pts]);
  const count = Math.floor(clamp(progress) * SEG) * RAD * 6;
  geo.setDrawRange(0, count);
  if (count <= 0) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={PALETTE.navy} toneMapped={false} />
    </mesh>
  );
};

export const Bars3D: React.FC<Bars3DProps> = ({bars = [], max, unit = '', height = 2.6, trend = false, orbit = 16, span = 300}) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, bars.length);
  const W = 0.7, GAP = 0.55;
  const total = n * W + (n - 1) * GAP;
  const top = max || Math.max(...bars.map((b) => b.value), 1);
  const xs = bars.map((_, i) => -total / 2 + W / 2 + i * (W + GAP));
  const lastAt = Math.max(0, ...bars.map((b) => b.at || 0));
  const trendAt = typeof trend === 'number' ? trend : lastAt + 30;
  const tops = useMemo(() => bars.map((b, i) => new THREE.Vector3(xs[i], (b.value / top) * height + 0.04, 0)), [bars, top, height]); // eslint-disable-line react-hooks/exhaustive-deps
  const angle = (-20 + orbit * clamp(frame / Math.max(1, span))) * deg;
  const dist = Math.max(5.6, total * 1.05 + 2.9);
  return (
    <>
      <CameraRig angle={angle} dist={dist} h={height * 0.7 + 0.5} target={height * 0.38} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} />
      <directionalLight position={[-5, 3, -2]} intensity={0.5} />
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[total + 1.2, 0.06, 2.4]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={1} />
      </mesh>
      {bars.map((b, i) => {
        const g = easeOut(appear(frame, b.at, 26));
        const h = Math.max(0.001, (b.value / top) * height * g);
        const color = b.color || (b.highlight ? PALETTE.blue : '#a9c3f6');
        const shown = appear(frame, b.at, 8);
        const valueText = b.display ? displayText(b.display, {text: 1, count: g}) : `${displayText(String(b.value), {text: 1, count: g})}${unit}`;
        return (
          <group key={i}>
            <mesh position={[xs[i], h / 2, 0]} scale={[1, h, 1]}>
              <boxGeometry args={[W, 1, W]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
            </mesh>
            <TextSprite text={valueText} position={[xs[i], h + 0.16, 0]} height={0.24} anchor="bottom" color={b.highlight ? PALETTE.blue : PALETTE.ink} opacity={shown} depthTest={false} />
            <TextSprite text={b.label} position={[xs[i], 0.0, 1.32]} height={0.16} anchor="top" color={PALETTE.gray} weight={600} opacity={shown} depthTest={false} />
          </group>
        );
      })}
      {trend !== false && bars.length > 1 && <Trend pts={tops} progress={easeOut((frame - trendAt) / 30)} />}
    </>
  );
};
