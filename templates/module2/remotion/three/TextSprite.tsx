// 3D 공간의 한글 라벨 (캔버스 텍스처 스프라이트, 항상 카메라를 향함)
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';

type Props = {
  text: string;
  position: [number, number, number];
  height?: number; // 월드 단위 글자 높이
  color?: string;
  weight?: number;
  font?: string;
  opacity?: number;
  anchor?: 'center' | 'left' | 'right' | 'bottom' | 'top';
  bg?: string; // 배경 알약 색 (선택)
  depthTest?: boolean;
};

const ANCHOR: Record<string, [number, number]> = {center: [0.5, 0.5], left: [0, 0.5], right: [1, 0.5], bottom: [0.5, 0], top: [0.5, 1]};

export const TextSprite: React.FC<Props> = ({text, position, height = 0.2, color = '#18202e', weight = 700, font = 'Pretendard', opacity = 1, anchor = 'center', bg, depthTest = true}) => {
  const {tex, aspect} = useMemo(() => {
    const px = 96;
    const pad = bg ? px * 0.45 : px * 0.12;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const spec = `${weight} ${px}px "${font}", Pretendard, sans-serif`;
    ctx.font = spec;
    const w = Math.ceil(ctx.measureText(text).width + pad * 2);
    const h = Math.ceil(px * 1.4);
    c.width = Math.max(4, w);
    c.height = h;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    if (bg) {
      g.fillStyle = bg;
      const r = h / 2;
      g.beginPath();
      g.moveTo(r, 0); g.lineTo(c.width - r, 0); g.arc(c.width - r, r, r, -Math.PI / 2, Math.PI / 2);
      g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    }
    g.font = spec;
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(text, c.width / 2, h / 2 + px * 0.04);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return {tex: t, aspect: c.width / c.height};
  }, [text, color, weight, font, bg]);
  useEffect(() => () => tex.dispose(), [tex]);
  if (opacity <= 0.001 || !text) return null;
  return (
    <sprite position={position} scale={[height * 1.4 * aspect, height * 1.4, 1]} center={ANCHOR[anchor]} renderOrder={10}>
      <spriteMaterial map={tex} transparent opacity={opacity} depthWrite={false} depthTest={depthTest} toneMapped={false} />
    </sprite>
  );
};
