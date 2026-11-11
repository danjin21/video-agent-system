// 지구본 거점 — 글로벌 전략: 본사(home)에서 진출 지역으로 연결선이 그려지고 거점이 팝업, 지구본이 말하는 지역으로 회전
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame} from 'remotion';
import {TextSprite} from './TextSprite';
import {PALETTE, appear, clamp, deg, easeOut, keyframes, latLon, pop} from './util';

export type GlobeMarker = {lat: number; lon: number; label: string; at?: number; home?: boolean; color?: string};
export type GlobeProps = {
  markers: GlobeMarker[];
  focus?: {at: number; lat?: number; lon?: number; zoom?: number; dur?: number}[]; // 회전·줌 키프레임
  start?: {lat: number; lon: number; zoom?: number};
  arcDur?: number; // 연결선이 그려지는 프레임 수 (거점 at 직전에 끝남)
  spin?: number; // 프레임당 추가 자전(도), 기본 0.05
  color?: string;
  gridColor?: string;
  accent?: string;
  labelSize?: number;
};

const Grid: React.FC<{color: string}> = ({color}) => {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const r = 1.002;
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon < 360; lon += 4) {
        const a = latLon(lat, lon, r), b = latLon(lat, lon + 4, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      for (let lat = -88; lat < 88; lat += 4) {
        const a = latLon(lat, lon, r), b = latLon(lat + 4, lon, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.75} />
    </lineSegments>
  );
};

const Arc: React.FC<{a: THREE.Vector3; b: THREE.Vector3; progress: number; color: string}> = ({a, b, progress, color}) => {
  const SEG = 64, RAD = 8;
  const geo = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 1 + 0.32 * a.distanceTo(b);
    const curve = new THREE.QuadraticBezierCurve3(a, mid.normalize().multiplyScalar(lift), b);
    return new THREE.TubeGeometry(curve, SEG, 0.009, RAD, false);
  }, [a, b]);
  const count = Math.floor(clamp(progress) * SEG) * RAD * 6;
  geo.setDrawRange(0, count);
  if (count <= 0) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
};

const Marker: React.FC<{m: GlobeMarker; frame: number; arcDur: number; accent: string; labelSize: number}> = ({m, frame, accent, labelSize}) => {
  const pos = useMemo(() => latLon(m.lat, m.lon, 1), [m.lat, m.lon]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const t = appear(frame, m.at, 14);
  if (t <= 0) return null;
  const s = pop(t);
  const color = m.color || (m.home ? PALETTE.navy : accent);
  const pulse = m.at == null ? 0 : ((frame - m.at) % 45) / 45;
  const label = pos.clone().multiplyScalar(1.07);
  return (
    <group>
      <mesh position={pos} scale={s}>
        <sphereGeometry args={[m.home ? 0.045 : 0.035, 24, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={pos.clone().multiplyScalar(1.003)} quaternion={quat} scale={1 + pulse * 1.6}>
        <ringGeometry args={[0.05, 0.062, 48]} />
        <meshBasicMaterial color={color} transparent opacity={(1 - pulse) * 0.8 * t} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
      </mesh>
      <TextSprite text={m.label} position={[label.x, label.y, label.z]} height={labelSize} anchor="bottom" color={m.home ? '#ffffff' : '#ffffff'} bg={color} opacity={clamp(t * 1.5)} />
    </group>
  );
};

const CameraRig: React.FC<{zoom: number}> = ({zoom}) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(0, 0, 4.4 / zoom);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return null;
};

export const Globe: React.FC<GlobeProps> = ({markers = [], focus = [], start, arcDur = 30, spin = 0.05, color = '#eef4ff', gridColor = '#a9c1ee', accent = PALETTE.blue, labelSize = 0.085}) => {
  const frame = useCurrentFrame();
  const home = markers.find((m) => m.home);
  const first = start || (home ? {lat: home.lat, lon: home.lon, zoom: 1} : {lat: 20, lon: 120, zoom: 1});
  const v = keyframes(focus as never, frame, {lat: first.lat, lon: first.lon, zoom: first.zoom || 1}, ['lon']);
  const ry = Math.PI / 2 - (v.lon + 180) * deg - spin * deg * frame;
  const rx = clamp(v.lat, -60, 60) * deg;
  const homePos = useMemo(() => (home ? latLon(home.lat, home.lon, 1) : null), [home]);
  const ends = useMemo(() => markers.map((m) => latLon(m.lat, m.lon, 1)), [markers]);
  return (
    <>
      <CameraRig zoom={v.zoom} />
      <ambientLight intensity={2.4} />
      <directionalLight position={[-2, 3, 6]} intensity={0.9} />
      <group rotation={[rx, ry, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} />
        </mesh>
        <Grid color={gridColor} />
        {homePos && markers.map((m, i) => (m.home || m.at == null ? null : (
          <Arc key={'a' + i} a={homePos} b={ends[i]} progress={easeOut((frame - (m.at - arcDur)) / arcDur)} color={accent} />
        )))}
        {markers.map((m, i) => <Marker key={'m' + i} m={m} frame={frame} arcDur={arcDur} accent={accent} labelSize={labelSize} />)}
      </group>
      <mesh scale={1.07}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
};
