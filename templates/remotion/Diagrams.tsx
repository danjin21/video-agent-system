// 다이어그램 키트 — 도형 + 심플 라인 아이콘. 개념을 텍스트가 아니라 '그림'으로.
// 원리: 느린 단일 트윈 금지. 여러 도형이 빠른 pop(≤0.7s)으로 연달아 등장(이벤트 밀도=역동성).
import {useCurrentFrame, interpolate, Easing} from 'remotion';

const FF = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
const BLUE = '#024ad8', INK = '#1a1a1a', CORAL = '#ff5050', GRAPH = '#636363', SOFT = '#c9e0fc';
const C = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const SOFT_LIFT = '0 2px 8px rgba(26,26,26,0.08)';

// 스냅 등장: scale 0.6→1.08→1, opacity 0→1, ~0.5s
export const pop = (f: number, s: number) => interpolate(f, [s, s + 7, s + 15], [0.6, 1.08, 1], {...C, easing: Easing.out(Easing.cubic)});
export const appear = (f: number, s: number) => interpolate(f, [s, s + 12], [0, 1], C);
const draw = (f: number, s: number, e: number, len: number) => interpolate(f, [s, e], [len, 0], {...C, easing: Easing.out(Easing.cubic)});

// ───────── 심플 라인 아이콘 ─────────
type IconName = 'dumbbell' | 'chip' | 'robot' | 'drop' | 'person' | 'flag' | 'building' | 'trend' | 'people' | 'shield';
const PATHS: Record<IconName, JSX.Element> = {
  dumbbell: <><line x1="2" y1="12" x2="22" y2="12" /><rect x="2.5" y="7" width="3.5" height="10" rx="1" /><rect x="18" y="7" width="3.5" height="10" rx="1" /></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="10" y="10" width="4" height="4" rx="0.5" /><line x1="9" y1="3" x2="9" y2="6" /><line x1="15" y1="3" x2="15" y2="6" /><line x1="9" y1="18" x2="9" y2="21" /><line x1="15" y1="18" x2="15" y2="21" /><line x1="3" y1="9" x2="6" y2="9" /><line x1="3" y1="15" x2="6" y2="15" /><line x1="18" y1="9" x2="21" y2="9" /><line x1="18" y1="15" x2="21" y2="15" /></>,
  robot: <><line x1="12" y1="2.5" x2="12" y2="5.5" /><circle cx="12" cy="2" r="1" /><rect x="5" y="5.5" width="14" height="11" rx="3" /><circle cx="9.5" cy="11" r="1.5" /><circle cx="14.5" cy="11" r="1.5" /><line x1="8.5" y1="16.5" x2="8.5" y2="20.5" /><line x1="15.5" y1="16.5" x2="15.5" y2="20.5" /></>,
  drop: <path d="M12 3 C12 3 5 11 5 15 a7 7 0 0 0 14 0 C19 11 12 3 12 3 Z" />,
  person: <><circle cx="12" cy="8" r="3.6" /><path d="M5 21 a7 7 0 0 1 14 0" /></>,
  people: <><circle cx="8.5" cy="8.5" r="3" /><circle cx="16" cy="9.5" r="2.6" /><path d="M3 21 a6 6 0 0 1 11 0" /><path d="M14.5 21 a5 5 0 0 1 6.5 -4.5" /></>,
  flag: <><line x1="5" y1="3" x2="5" y2="21" /><path d="M5 4 h12 l-3 4 l3 4 h-12 Z" /></>,
  building: <><rect x="5" y="4" width="14" height="17" rx="1" /><line x1="9" y1="8" x2="9" y2="8.5" /><line x1="15" y1="8" x2="15" y2="8.5" /><line x1="9" y1="12" x2="9" y2="12.5" /><line x1="15" y1="12" x2="15" y2="12.5" /></>,
  trend: <><polyline points="3,17 9,11 13,15 21,7" /><polyline points="15,7 21,7 21,13" /></>,
  shield: <path d="M12 3 l7 3 v6 c0 5 -3.5 7.5 -7 9 c-3.5 -1.5 -7 -4 -7 -9 v-6 Z" />,
};
export const Icon = ({name, size = 40, color = '#fff', sw = 2}: {name: IconName; size?: number; color?: string; sw?: number}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>
);

// ───────── 강조 고스트 타이포 ─────────
// 강조 키워드(숫자·핵심어)를 콘텐츠 뒤/옆에 *크게 옅게* 한 번 더. 발화 순간 등장. 여백을 채우고 메시지를 각인.
export const GhostWord = ({text, start, side = 'right', size = 460, color = BLUE, maxOpacity = 0.08}: {
  text: string; start: number; side?: 'right' | 'left' | 'center'; size?: number; color?: string; maxOpacity?: number;
}) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [start, start + 20], [0, maxOpacity], C);
  const sc = interpolate(f, [start, start + 26], [0.82, 1], {...C, easing: Easing.out(Easing.cubic)});
  const pos = side === 'right' ? {right: -40, justifyContent: 'flex-end'} : side === 'left' ? {left: -40, justifyContent: 'flex-start'} : {left: 0, right: 0, justifyContent: 'center'};
  return (
    <div style={{position: 'absolute', top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 0, ...pos}}>
      <span style={{fontFamily: FF, fontSize: size, fontWeight: 700, color, opacity: op, lineHeight: 0.9, transform: `scale(${sc})`, transformOrigin: side === 'center' ? 'center' : side, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};

// ───────── 노드 (원 + 아이콘 + 라벨) ─────────
// b1 윤곽 등장(start) → activeAt 에 채움. 도형 다수의 핵심 빌딩블록.
export const Node = ({x, y, r, start, activeAt, icon, glyph, label, sub, fill = BLUE, surface = 'white'}: {
  x: number; y: number; r: number; start: number; activeAt?: number; icon?: IconName; glyph?: string; label?: string; sub?: string; fill?: string; surface?: 'white' | 'blue';
}) => {
  const f = useCurrentFrame();
  const aAt = activeAt ?? start;
  const active = interpolate(f, [aAt, aAt + 12], [0, 1], C);
  const onBlue = surface === 'blue';
  const outline = onBlue ? SOFT : '#d6d6d6';
  const bg = `rgba(${fill === CORAL ? '255,80,80' : '2,74,216'}, ${active})`;
  const iconC = active > 0.5 ? '#fff' : outline;
  const labelC = onBlue ? '#fff' : INK;
  return (
    <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, opacity: appear(f, start), transform: `scale(${pop(f, start)})`, transformOrigin: 'center', textAlign: 'center', fontFamily: FF}}>
      <div style={{width: r * 2, height: r * 2, borderRadius: '50%', border: `3px solid ${active > 0.4 ? fill : outline}`, background: bg, boxShadow: active > 0.4 ? SOFT_LIFT : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'none'}}>
        {glyph ? <span style={{fontSize: r * 0.95, fontWeight: 700, color: iconC, lineHeight: 1}}>{glyph}</span> : icon && <Icon name={icon} size={r * 0.85} color={iconC} sw={1.8} />}
      </div>
      {label && <div style={{fontSize: 34, fontWeight: 700, color: labelC, marginTop: 18, opacity: active}}>{label}</div>}
      {sub && <div style={{fontSize: 22, fontWeight: 500, color: onBlue ? SOFT : GRAPH, marginTop: 6, opacity: active}}>{sub}</div>}
    </div>
  );
};

// 두 점 사이 커넥터(선/화살표) draw
export const Connector = ({x1, y1, x2, y2, start, color = BLUE, arrow = true, dash}: {
  x1: number; y1: number; x2: number; y2: number; start: number; color?: string; arrow?: boolean; dash?: boolean;
}) => {
  const f = useCurrentFrame();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const off = draw(f, start, start + 16, len);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ah = 14;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, overflow: 'visible', pointerEvents: 'none'}}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={dash ? '8 8' : len} strokeDashoffset={dash ? 0 : off} opacity={appear(f, start)} />
      {arrow && <path d={`M${x2},${y2} L${x2 - ah * Math.cos(ang - 0.4)},${y2 - ah * Math.sin(ang - 0.4)} M${x2},${y2} L${x2 - ah * Math.cos(ang + 0.4)},${y2 - ah * Math.sin(ang + 0.4)}`} stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" opacity={appear(f, start + 14)} />}
    </svg>
  );
};

// ───────── 저수지 — 분지 + 유입(물방울/화살표 여러 개) + 수위 상승 ─────────
export const Reservoir = ({x, y, w, h, start, fillStart, fillEnd, label, onBlue = false}: {
  x: number; y: number; w: number; h: number; start: number; fillStart: number; fillEnd: number; label?: string; onBlue?: boolean;
}) => {
  const f = useCurrentFrame();
  const op = appear(f, start);
  const level = interpolate(f, [fillStart, fillEnd], [0.12, 0.86], {...C, easing: Easing.out(Easing.cubic)}); // 수위 비율
  const waterH = h * level;
  const inflows = [0.28, 0.5, 0.72];
  const basinC = onBlue ? '#fff' : INK;
  const waterC = onBlue ? SOFT : BLUE;
  const dropC = onBlue ? '#fff' : BLUE;
  const lineC = onBlue ? 'rgba(255,255,255,0.45)' : SOFT;
  const labelC = onBlue ? SOFT : GRAPH;
  const rid = `rv${x}_${y}`;
  return (
    <div style={{position: 'absolute', left: x, top: y - 150, width: w, opacity: op, fontFamily: FF}}>
      <svg viewBox={`0 0 ${w} ${h + 150}`} width={w} height={h + 150} style={{overflow: 'visible'}}>
        {/* 유입 화살표 + 물방울 (위에서 쏟아짐) */}
        {inflows.map((p, i) => {
          const ix = w * p;
          const dy = interpolate((f - (start + 8 + i * 6)) % 26, [0, 26], [0, 60], C); // 반복 낙하
          const vis = appear(f, fillStart + i * 4);
          return (
            <g key={i} opacity={vis}>
              <line x1={ix} y1={20} x2={ix} y2={95} stroke={lineC} strokeWidth="4" strokeLinecap="round" strokeDasharray="6 10" />
              <path d={`M${ix} ${30 + dy} c0 0 -7 8 -7 12 a7 7 0 0 0 14 0 c0 -4 -7 -12 -7 -12 Z`} fill={dropC} />
            </g>
          );
        })}
        {/* 분지(U자 컨테이너) */}
        <path d={`M6 110 L6 ${110 + h} Q6 ${110 + h + 30} ${w / 2} ${110 + h + 30} Q${w - 6} ${110 + h + 30} ${w - 6} ${110 + h} L${w - 6} 110`} fill="none" stroke={basinC} strokeWidth="5" strokeLinecap="round" />
        {/* 물 (수위 상승) */}
        <clipPath id={rid}><path d={`M9 110 L9 ${110 + h} Q9 ${110 + h + 27} ${w / 2} ${110 + h + 27} Q${w - 9} ${110 + h + 27} ${w - 9} ${110 + h} L${w - 9} 110 Z`} /></clipPath>
        <rect x="0" y={110 + h + 30 - waterH} width={w} height={waterH + 30} fill={waterC} opacity="0.9" clipPath={`url(#${rid})`} />
        <rect x="0" y={110 + h + 30 - waterH} width={w} height="6" fill={onBlue ? '#fff' : SOFT} clipPath={`url(#${rid})`} />
      </svg>
      {label && <div style={{textAlign: 'center', marginTop: 12, fontSize: 26, fontWeight: 600, color: labelC}}>{label}</div>}
    </div>
  );
};

// ───────── 구르는 공 + 좁아지는 운동장 ─────────
// 공이 회전하며 구른다(생동감) → shrink 구간에 운동장 폭이 좁아지고 공이 낮은 끝으로 굴러 벽에 부딪힘.
export const RollingBall = ({start, width = 1000, tiltDeg = 9, shrinkStart, shrinkEnd, shrinkTo = 0.4, ballColor = BLUE}: {
  start: number; width?: number; tiltDeg?: number; shrinkStart?: number; shrinkEnd?: number; shrinkTo?: number; ballColor?: string;
}) => {
  const f = useCurrentFrame();
  const deg = interpolate(f, [start, start + 40], [0, tiltDeg], {...C, easing: Easing.inOut(Easing.cubic)});
  const op = appear(f, start);
  const H = 320, cx = width / 2, barY = 168, barH = 22, R = 24;
  const ss = shrinkStart ?? start + 30, se = shrinkEnd ?? start + 100;
  const hwFrac = interpolate(f, [ss, se], [1, shrinkTo], {...C, easing: Easing.inOut(Easing.cubic)});
  const hw = (width / 2) * hwFrac;
  const right = cx + hw, left = cx - hw;
  // 공: 시작 후 굴러서(roll) 오른쪽 낮은 끝으로. 끝에선 벽(right-R)에 멈춤.
  const roll = interpolate(f, [start + 20, se], [left + R + 40, right - R], {...C, easing: Easing.in(Easing.quad)});
  const bx = Math.min(roll, right - R);
  const spin = (bx - (left + R + 40)) / R * (180 / Math.PI); // 굴러간 거리 → 회전각(deg)
  const markers = [0.16, 0.34, 0.66, 0.84];
  const by = barY - R;
  return (
    <div style={{transform: `rotate(${deg}deg)`, transformOrigin: '50% 56%', opacity: op}}>
      <svg viewBox={`0 0 ${width} ${H}`} style={{width, height: H, fontFamily: FF, overflow: 'visible'}}>
        {markers.map((p, i) => { const x = left + 2 * hw * p; return <line key={i} x1={x} y1={barY} x2={x} y2={barY - 13} stroke={GRAPH} strokeWidth="2" opacity="0.4" />; })}
        <line x1={cx} y1={barY} x2={cx} y2={barY - 74} stroke={GRAPH} strokeWidth="2" />
        <path d={`M${cx},${barY - 74} l34,10 l-34,10 z`} fill={BLUE} opacity="0.5" />
        <rect x={left} y={barY} width={2 * hw} height={barH} rx="6" fill="#eef4fe" stroke={INK} strokeWidth="3" />
        {/* 공 — 회전하는 패턴(점 2개)로 구르는 느낌 */}
        <g transform={`translate(${bx},${by}) rotate(${spin})`}>
          <circle r={R} fill={ballColor} />
          <circle cx={R * 0.45} cy="0" r="4" fill="#fff" opacity="0.9" />
          <circle cx={-R * 0.45} cy="0" r="4" fill="#fff" opacity="0.5" />
        </g>
        <ellipse cx={bx} cy={barY - 2} rx={R} ry="5" fill={INK} opacity="0.12" />
      </svg>
    </div>
  );
};

// ───────── 여러 곡선이 한 점으로 수렴 ─────────
// "여러 갈래 → 하나의 결론". 각 곡선/라벨이 자기 at 프레임에 그려지며 점등 → convAt에 수렴 노드.
// items: [{name, q?, y, at}]  (name=곡선 이름, q=부제, y=좌측 시작 높이, at=등장 프레임)
export const ConvergeCurves = ({items, conv, convAt, width = 1920, height = 1080, surface = 'blue', startX = 200}: {
  items: {name: string; q?: string; y: number; at: number}[]; conv: {x: number; y: number}; convAt: number; width?: number; height?: number; surface?: 'white' | 'blue'; startX?: number;
}) => {
  const f = useCurrentFrame();
  const onBlue = surface === 'blue';
  const baseC = onBlue ? 'rgba(255,255,255,0.28)' : '#d6d6d6';
  const drawOff = (s: number) => interpolate(f, [s, s + 26], [1700, 0], {...C, easing: Easing.out(Easing.cubic)});
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
      {items.map((r) => {
        const on = f >= r.at;
        const path = `M${startX},${r.y} C${width * 0.36},${r.y} ${width * 0.52},${(r.y + conv.y) / 2} ${conv.x},${conv.y}`;
        return (
          <g key={r.name}>
            <path d={path} fill="none" stroke={on ? (onBlue ? '#fff' : BLUE) : baseC} strokeWidth={on ? 7 : 3} strokeLinecap="round" strokeDasharray="1700" strokeDashoffset={drawOff(r.at)} />
            <text x={startX - 20} y={r.y - 18} textAnchor="end" fontSize="30" fontWeight="700" fill={onBlue ? '#fff' : INK} fontFamily={FF} opacity={appear(f, r.at)}>{r.name}</text>
            {r.q && <text x={startX - 20} y={r.y + 22} textAnchor="end" fontSize="26" fontWeight="500" fill={onBlue ? SOFT : GRAPH} fontFamily={FF} opacity={appear(f, r.at)}>{r.q}</text>}
          </g>
        );
      })}
      <circle cx={conv.x} cy={conv.y} r={interpolate(f, [convAt, convAt + 15], [0, 70], C)} fill={onBlue ? '#fff' : BLUE} />
    </svg>
  );
};

// ───────── 동심원 확장 (영역이 안→밖으로 넓어짐: 공공→민간→개인) ─────────
// rings: 안쪽부터 [{label, r, at}]. 큰 원부터 깔아 작은 게 위에. 각 링이 at에 pop 등장.
export const ConcentricRings = ({cx, cy, rings, surface = 'white'}: {
  cx: number; cy: number; rings: {label: string; r: number; at: number}[]; surface?: 'white' | 'blue';
}) => {
  const f = useCurrentFrame();
  const onBlue = surface === 'blue';
  const stroke = onBlue ? '#fff' : BLUE;
  return (
    <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      {[...rings].sort((a, b) => b.r - a.r).map((ring) => {
        const sc = interpolate(f, [ring.at, ring.at + 16], [0.6, 1], {...C, easing: Easing.out(Easing.cubic)});
        return (
          <g key={ring.label} opacity={appear(f, ring.at)}>
            <circle cx={cx} cy={cy} r={ring.r * sc} fill="none" stroke={stroke} strokeWidth="3" opacity="0.55" />
            <text x={cx} y={cy - ring.r * sc + 36} textAnchor="middle" fontSize="26" fontWeight="700" fill={stroke} fontFamily={FF}>{ring.label}</text>
          </g>
        );
      })}
    </svg>
  );
};
