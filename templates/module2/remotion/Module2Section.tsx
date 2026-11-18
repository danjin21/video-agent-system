// 모듈2 데이터 구동 섹션 컴포지션.
// layout.json + timeline.json + edits.json 을 props로 받아 그린다. 값은 .tsx에 하드코딩하지 않는다.
// 요소 상태 계산은 스튜디오 미리보기와 같은 anim.js를 쓴다 → 미리보기 = 렌더.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, CalculateMetadataFunction, Img, OffthreadVideo, Sequence, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {mergeSection, richSegments, stateAt, displayText, diagramSVG, brollSVG, brollCamera, setMediaResolver, diagramMedia, emphasisShadow, transformOf} from './anim.js';
import {Scene3D} from './three/Scene3D';

export type SectionProps = {
  layout: any;
  timeline: any;
  edits: any;
  sectionDir: string; // 프로젝트(public dir) 기준 섹션 폴더, 예: sections/s03
  fonts: {family: string; weight: number; src: string}[]; // src: public dir 기준
  audio: {src: string; at: number}[];
  withAudio: boolean;
  draft: boolean; // true면 아직 없는 아바타·차트 자리에 표시를 그린다
  theme?: any; // 프로젝트 design/theme.json (디자인 키트) — 스튜디오 미리보기와 같은 값
};

export const sectionMetadata: CalculateMetadataFunction<SectionProps> = ({props}) => {
  const m = mergeSection(props.layout, props.timeline, props.edits, props.theme);
  return {durationInFrames: Math.max(1, m.duration), fps: m.fps, width: m.canvas.w, height: m.canvas.h};
};

const resolve = (src: string, sectionDir: string) => {
  if (!src) return '';
  if (/^(https?:|data:)/.test(src)) return src;
  if (src.startsWith('global_assets/') || src.startsWith('sections/')) return staticFile(src);
  return staticFile(`${sectionDir}/${src}`);
};

const useFonts = (fonts: SectionProps['fonts'], families: {family: string; weight: number}[]) => {
  const [handle] = useState(() => delayRender('module2 fonts'));
  useEffect(() => {
    const loads = fonts.map((f) => {
      const ff = new FontFace(f.family, `url("${staticFile(f.src)}")`, {weight: String(f.weight)});
      return ff.load().then((x) => {
        document.fonts.add(x);
      }).catch(() => undefined);
    });
    Promise.all(loads)
      .then(() => Promise.all(families.map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`).catch(() => undefined))))
      .then(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

// diagram 안의 사진(zoomReveal·split·gallery·compare·stack)은 SVG <image>라 Remotion이 기다려 주지 않는다 → 프레임 그리기 전에 전부 불러 둔다
const useMedia = (srcs: string[]) => {
  const [handle] = useState(() => (srcs.length ? delayRender('module2 photos') : null));
  useEffect(() => {
    if (handle === null) return;
    Promise.all(srcs.map((u) => new Promise<void>((ok) => {
      const im = new Image();
      im.onload = () => (im.decode ? im.decode().catch(() => undefined).then(() => ok()) : ok());
      im.onerror = () => ok();
      im.src = u;
    }))).then(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const Placeholder: React.FC<{label: string}> = ({label}) => (
  <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b778c', fontSize: 36,
    border: '4px dashed #9aa6b8', borderRadius: 12, background: 'rgba(255,255,255,.35)', boxSizing: 'border-box', fontFamily: 'Pretendard'}}>{label}</div>
);

const Element: React.FC<{el: any; frame: number; p: SectionProps; fps: number}> = ({el, frame, p, fps}) => {
  const st = stateAt(el, frame);
  if (!st.visible) return null;
  const f = el.font || {};
  const style: React.CSSProperties = {
    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z || 0, boxSizing: 'border-box',
    background: el.fill || 'transparent', borderRadius: el.radius || 0, padding: el.pad || 0,
    whiteSpace: 'pre-wrap', wordBreak: 'keep-all',
    fontFamily: f.family ? `"${f.family}", Pretendard, sans-serif` : undefined, fontWeight: f.weight, fontSize: f.size,
    color: f.color, textAlign: f.align || 'left', lineHeight: f.lineHeight, letterSpacing: f.letterSpacing != null ? f.letterSpacing : undefined,
    opacity: st.opacity, transform: transformOf(st),
    clipPath: st.clipL || st.clipR ? `inset(-20px ${st.clipR}% -20px ${st.clipL}%)` : undefined,
    boxShadow: emphasisShadow(st) || undefined,
  };
  if (el.type === 'text' && el.valign) {
    style.display = 'flex';
    style.alignItems = ({top: 'flex-start', middle: 'center', bottom: 'flex-end'} as any)[el.valign] || 'flex-start';
    style.justifyContent = ({left: 'flex-start', center: 'center', right: 'flex-end'} as any)[f.align] || 'flex-start';
  }
  const local = <T,>(node: T) => (
    <Sequence from={el.t.in} durationInFrames={Math.max(1, el.t.out - el.t.in)} layout="none">{node as any}</Sequence>
  );
  let content: React.ReactNode = null;
  if (el.type === 'text') {
    const raw: string = el.text || '';
    content = raw.includes('[[')
      ? <div>{richSegments(raw, st).map((s, i) => s.accent ? <span key={i} style={{color: f.accentColor || '#296ef9'}}>{s.text}</span> : <React.Fragment key={i}>{s.text}</React.Fragment>)}</div>
      : <div>{displayText(raw, st)}</div>;
  } else if (el.type === 'image') {
    content = el.src ? <Img src={resolve(el.src, p.sectionDir)} style={{width: '100%', height: '100%', objectFit: el.fit || 'cover', display: 'block'}} /> : (p.draft ? <Placeholder label="이미지" /> : null);
  } else if (el.type === 'video' || el.type === 'avatar') {
    content = el.src && el.srcExists !== false
      ? local(<OffthreadVideo muted src={resolve(el.src, p.sectionDir)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />)
      : (p.draft ? <Placeholder label={el.text || (el.type === 'avatar' ? '아바타 (HeyGen 생성 전)' : '영상')} /> : null);
  } else if (el.type === 'diagram') {
    // 연출 키트: anim.js가 만든 SVG를 그대로 (스튜디오 미리보기와 같은 함수)
    content = <div style={{width: '100%', height: '100%', overflow: 'visible'}} dangerouslySetInnerHTML={{__html: diagramSVG(el, frame - el.t.in)}} />;
  } else if (el.type === 'broll') {
    const span = el.t.out - el.t.in, lf = frame - el.t.in;
    if (el.src && el.srcExists !== false) {
      const cam = brollCamera(el, lf, span);
      content = local(<div style={{width: '100%', height: '100%', overflow: 'hidden'}}>
        <OffthreadVideo muted src={resolve(el.src, p.sectionDir)} style={{width: '100%', height: '100%', objectFit: 'cover',
          transform: `translate(${cam.tx}px, ${cam.ty}px) rotate(${cam.rotate}deg) scale(${cam.scale})`}} />
      </div>);
    } else {
      // 실사가 아직 없으면 초안·최종 모두 자리표시 (기획이 화면에 보이게)
      content = <div style={{width: '100%', height: '100%', overflow: 'hidden'}} dangerouslySetInnerHTML={{__html: brollSVG(el, lf, span)}} />;
    }
  } else if (el.type === '3d') {
    content = local(<Scene3D scene={el.scene} props={el.props || {}} width={el.w} height={el.h} fps={fps} span={el.t.out - el.t.in} />);
  } else if (el.type === 'rect') {
    content = null;
  } else {
    content = p.draft ? <Placeholder label={`${el.type}${el.spec ? ': ' + el.spec : ''}`} /> : null;
  }
  return <div style={style}>{content}</div>;
};

export const Module2Section: React.FC<SectionProps> = (p) => {
  const frame = useCurrentFrame();
  const m = mergeSection(p.layout, p.timeline, p.edits, p.theme);
  const families = Array.from(new Map(m.elements.filter((e: any) => e.font && e.font.family).map((e: any) => [`${e.font.family}|${e.font.weight || 400}`, {family: e.font.family, weight: e.font.weight || 400}])).values()) as any;
  useFonts(p.fonts, families);
  setMediaResolver((src: string) => resolve(src, p.sectionDir));
  const photos = Array.from(new Set(m.elements.filter((e: any) => e.type === 'diagram').flatMap((e: any) => diagramMedia(e)).map((s: string) => resolve(s, p.sectionDir)))) as string[];
  useMedia(photos);
  return (
    <AbsoluteFill style={{background: m.canvas.bg, overflow: 'hidden'}}>
      {m.elements.map((el: any) => <Element key={el.id} el={el} frame={frame} p={p} fps={m.fps} />)}
      {p.withAudio && p.audio.map((a, i) => (
        <Sequence key={i} from={a.at} layout="none"><Audio src={resolve(a.src, p.sectionDir)} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
