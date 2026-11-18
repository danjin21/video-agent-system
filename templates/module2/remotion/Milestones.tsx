// 모듈2 마일스톤 바 — 전체 영상 위쪽에 큰 챕터(마일스톤)와 지금 위치를 보여 주는 얇은 띠.
// assemble.py가 합본 길이만큼 투명 배경(ProRes 4444)으로 렌더해 영상 맨 위에 겹친다.
// 챕터 묶음: project.json `milestones` [{title, sections:[...]}] / 모양: design/theme.json `milestones`(디자인 키트).
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, CalculateMetadataFunction, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';

export type MilestoneProps = {
  total: number; // 합본 전체 프레임
  fps: number;
  chapters: {title: string; start: number; end: number; steps?: {label: string; start: number; end: number}[]}[];
  showFrom?: number; // 이 프레임 전에는 숨김(오프닝)
  hideAfter?: number; // 이 프레임 뒤로는 숨김(엔딩)
  style?: any; // theme.milestones (colors는 이미 hex로 풀어서 옴)
  fonts?: {family: string; weight: number; src: string}[]; // public dir 기준
};

const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export const Module2Milestones: React.FC<MilestoneProps> = (p) => {
  const f = useCurrentFrame();
  const [handle] = useState(() => delayRender('milestone fonts'));
  useEffect(() => {
    Promise.all((p.fonts || []).map((x) => new FontFace(x.family, `url("${staticFile(x.src)}")`, {weight: String(x.weight)}).load().then((ff) => { document.fonts.add(ff); }).catch(() => undefined)))
      .then(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = p.style || {};
  const W = 1920, H = st.height || 64, padX = st.padX ?? 140, gap = st.gap ?? 10, trackY = st.trackY ?? 44, lw = st.lineWidth ?? 4;
  const C = {track: st.track || '#d5dceb', fill: st.fill || '#296ef9', on: st.on || '#0b1f4b', off: st.off || '#8a94a6', dot: st.dot || '#296ef9', halo: st.halo || 'rgba(255,255,255,.85)'}; // halo: 어두운 화면(사진·파란 간지) 위에서도 읽히게 글자 테두리
  const show = p.showFrom ?? 0, hide = p.hideAfter ?? p.total;
  const vis = Math.min(interpolate(f, [show, show + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    interpolate(f, [hide - 20, hide], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  if (vis <= 0) return <AbsoluteFill />;
  const span = Math.max(1, p.chapters.reduce((a, c) => a + (c.end - c.start), 0));
  const usable = W - padX * 2 - gap * (p.chapters.length - 1);
  // 칸 너비: 길이 비례 + 최소 = 지금 챕터일 때의 굵은 이름 폭(글자가 옆 칸과 겹치지 않게). 남는 너비만 길이대로 나눈다
  const cw = (t: string) => Array.from(t).reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 0.92 : /[A-Z0-9]/.test(ch) ? 0.64 : ch === ' ' ? 0.3 : 0.52), 0);
  const minW = p.chapters.map((c) => Math.ceil(26 * cw(c.title + (c.steps ? ' · ' + c.steps.reduce((m, s) => (s.label.length > m.length ? s.label : m), '') : ''))) + 24);
  let w = p.chapters.map((c) => usable * ((c.end - c.start) / span));
  for (let it = 0; it < 4; it++) {
    const fixed = w.map((x, i) => x < minW[i]);
    const need = w.reduce((a, x, i) => a + (fixed[i] ? minW[i] - x : 0), 0);
    if (need <= 0.5) break;
    const free = w.reduce((a, x, i) => a + (fixed[i] ? 0 : x), 0);
    w = w.map((x, i) => (fixed[i] ? minW[i] : x - need * (x / Math.max(1, free))));
  }
  let x = padX;
  const segs = p.chapters.map((c, i) => {
    const s = {c, x, w: w[i]};
    x += w[i] + gap;
    return s;
  });
  return (
    <AbsoluteFill style={{opacity: vis}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {segs.map(({c, x: sx, w}, i) => {
          const cur = f >= c.start && f < c.end, done = f >= c.end;
          const prog = cur ? (f - c.start) / Math.max(1, c.end - c.start) : done ? 1 : 0;
          const lit = cur ? ease((f - c.start) / 12) : 0; // 챕터가 바뀌는 순간 글자가 살짝 커지며 진해짐
          const step = cur && c.steps ? c.steps.find((s) => f >= s.start && f < s.end) : null;
          const label = step ? `${c.title} · ${step.label}` : c.title;
          return (
            <g key={i}>
              <rect x={sx} y={trackY} width={w} height={lw} rx={lw / 2} fill={C.track} />
              <rect x={sx} y={trackY} width={w * prog} height={lw} rx={lw / 2} fill={done ? C.off : C.fill} opacity={done ? 0.55 : 1} />
              {cur && <circle cx={sx + w * prog} cy={trackY + lw / 2} r={6 + 2 * lit} fill={C.dot} />}
              {c.steps && cur && c.steps.map((s, k) => {
                const tx = sx + w * ((s.start - c.start) / Math.max(1, c.end - c.start));
                return <rect key={k} x={tx - 1} y={trackY - 4} width={2} height={lw + 8} fill={f >= s.start ? C.fill : C.track} />;
              })}
              <text x={sx} y={trackY - 12} fontFamily="Pretendard, sans-serif" fontSize={cur ? 22 + 2 * lit : 20} fontWeight={cur ? 700 : 500}
                fill={cur ? C.on : C.off} opacity={cur ? 1 : done ? 0.6 : 0.85}
                stroke={C.halo} strokeWidth={5} strokeLinejoin="round" style={{paintOrder: 'stroke'}}>{label}</text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const milestoneMetadata: CalculateMetadataFunction<MilestoneProps> = async ({props}) => ({
  durationInFrames: Math.max(1, props.total),
  fps: props.fps || 30,
  width: 1920,
  height: (props.style && props.style.height) || 64,
});
