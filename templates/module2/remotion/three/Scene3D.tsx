// 3D 장면 디스패처. 요소 type="3d", scene=이름, props=장면 설정 (layout.json)
// 장면 추가 시: 파일 하나 + 아래 SCENES 등록 + studio app.js의 SCENE_DEFAULTS 기본값 추가
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {Globe} from './Globe';
import {Bars3D} from './Bars3D';
import {LayerStack} from './LayerStack';

export const SCENES: Record<string, React.FC<any>> = {globe: Globe, bars: Bars3D, layers: LayerStack};

export const Scene3D: React.FC<{scene: string; props: any; width: number; height: number; fps: number; span?: number}> = ({scene, props, width, height, span}) => {
  const C = SCENES[scene];
  if (!C) return null;
  return (
    <ThreeCanvas width={width} height={height} flat camera={{fov: 35, near: 0.1, far: 100, position: [0, 0, 5]}} gl={{antialias: true, alpha: true, preserveDrawingBuffer: true}}>
      <C span={span} {...props} />
    </ThreeCanvas>
  );
};
