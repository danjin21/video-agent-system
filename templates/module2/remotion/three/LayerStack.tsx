// 층 쌓기·분해 — 사업/플랫폼 구조: 아래층부터 쌓이고(at), explodeAt에 층 사이가 벌어지며, focus로 한 층만 강조
import React from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame} from 'remotion';
import {TextSprite} from './TextSprite';
import {PALETTE, appear, clamp, deg, easeInOut, easeOut} from './util';

export type Layer = {label: string; sub?: string; color?: string; at?: number};
export type LayerStackProps = {
  layers: Layer[]; // 아래층부터
  explodeAt?: number;
  explodeDur?: number;
  gap?: number; // 분해 후 층 간격
  focus?: {at: number; index: number | null}[]; // index=null이면 강조 해제
  width?: number;
  depth?: number;
  orbit?: number;
  span?: number;
};

const DEFAULT = [PALETTE.navy, PALETTE.indigo, PALETTE.blue, PALETTE.sky, '#a9c3f6'];

const CameraRig: React.FC<{angle: number; mid: number}> = ({angle, mid}) => {
  const camera = useThree((s) => s.camera);
  const d = 8.6;
  camera.position.set(Math.sin(angle) * d, mid + 2.4, Math.cos(angle) * d);
  camera.lookAt(0.9, mid, 0);
  camera.updateProjectionMatrix();
  return null;
};

export const LayerStack: React.FC<LayerStackProps> = ({layers = [], explodeAt, explodeDur = 30, gap = 1.05, focus = [], width = 3.6, depth = 2.4, orbit = 10, span = 300}) => {
  const frame = useCurrentFrame();
  const T = 0.16;
  const g0 = 0.62; // 붙어 있을 때도 라벨이 겹치지 않는 최소 간격
  const e = explodeAt == null ? 1 : easeInOut((frame - explodeAt) / explodeDur);
  const step = g0 + (gap - g0) * e;
  const mid = ((layers.length - 1) * step) / 2;
  let hi: number | null = null;
  for (const f of focus.slice().sort((a, b) => a.at - b.at)) if (frame >= f.at) hi = f.index;
  const angle = (32 + orbit * clamp(frame / Math.max(1, span))) * deg;
  return (
    <>
      <CameraRig angle={angle} mid={mid} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 8, 6]} intensity={1.5} />
      {layers.map((l, i) => {
        const a = easeOut(appear(frame, l.at, 18));
        if (a <= 0) return null;
        const y = i * step + (1 - a) * 0.9;
        const dim = hi == null || hi === i ? 1 : 0.28;
        const color = l.color || DEFAULT[i % DEFAULT.length];
        return (
          <group key={i} position={[0, y, 0]}>
            <mesh>
              <boxGeometry args={[width, T, depth]} />
              <meshStandardMaterial color={color} roughness={0.5} transparent opacity={a * dim} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(width, T, depth)]} />
              <lineBasicMaterial color="#ffffff" transparent opacity={0.5 * a * dim} />
            </lineSegments>
            <TextSprite text={l.label} position={[width / 2 + 0.5, l.sub && e > 0.5 ? 0.1 : 0, depth / 2]} height={0.26} anchor="left" depthTest={false} color={PALETTE.ink} opacity={a * (hi == null || hi === i ? 1 : 0.35)} />
            {l.sub && e > 0.5 && <TextSprite text={l.sub} position={[width / 2 + 0.5, -0.2, depth / 2]} height={0.15} anchor="left" depthTest={false} weight={500} color={PALETTE.gray} opacity={a * clamp((e - 0.5) * 2) * (hi == null || hi === i ? 1 : 0.35)} />}
          </group>
        );
      })}
    </>
  );
};
