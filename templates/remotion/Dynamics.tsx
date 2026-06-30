// 의미화 모션(semantic motion) 공용 컴포넌트.
// 리빌 모션(≤1.5s hold)과 달리, 발화 비트 길이(start~end 프레임)에 동기화되어 1회 전개 후 정착한다.
// 한 슬라이드에 의미화 모션 주인공은 1개만. (continuity.md A0 규칙)
import {useCurrentFrame, interpolate, Easing} from 'remotion';

const FF = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif';
const BLUE = '#024ad8', INK = '#1a1a1a', GRAPH = '#636363';
const C = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const SOFT_LIFT = '0 2px 8px rgba(26,26,26,0.08)';

// 숫자 카운트업. 발화 길이에 맞춰 from→to, 마지막에 살짝 pop. 천단위 콤마.
export const CountUp = ({from, to, unit = '', start, end, color = BLUE, size = 110, weight = 700, decimals = 0}: {
  from: number; to: number; unit?: string; start: number; end: number; color?: string; size?: number; weight?: number; decimals?: number;
}) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [start, end], [from, to], {...C, easing: Easing.out(Easing.cubic)});
  const shown = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  const pop = interpolate(f, [end - 6, end, end + 8], [1, 1.05, 1], {...C, easing: Easing.out(Easing.cubic)});
  return (
    <span style={{fontFamily: FF, fontSize: size, fontWeight: weight, color, display: 'inline-block', transform: `scale(${pop})`, lineHeight: 1}}>
      {shown}{unit && <span style={{fontSize: size * 0.42, fontWeight: 600, marginLeft: 4}}>{unit}</span>}
    </span>
  );
};

// 값에 비례해 면적(=반지름 √value)이 커지는 원. 중앙에 CountUp을 겹쳐 양을 직관화.
// maxValue 기준으로 maxR(px) 매핑. 두 개를 나란히 두려면 부모에서 배치.
export const GrowCircle = ({from, to, maxValue, maxR, unit = '', start, end, label, color = BLUE, textColor = '#fff'}: {
  from: number; to: number; maxValue: number; maxR: number; unit?: string; start: number; end: number; label?: string; color?: string; textColor?: string;
}) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [start, end], [from, to], {...C, easing: Easing.out(Easing.cubic)});
  const r = Math.sqrt(Math.max(v, 0) / maxValue) * maxR;
  const d = r * 2;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', fontFamily: FF}}>
      <div style={{position: 'relative', width: maxR * 2, height: maxR * 2, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: d, height: d, borderRadius: '50%', background: color, boxShadow: SOFT_LIFT, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <CountUp from={from} to={to} unit={unit} start={start} end={end} color={textColor} size={Math.min(maxR * 0.62, 96)} />
        </div>
      </div>
      {label && <div style={{marginTop: 18, fontSize: 28, fontWeight: 600, color: GRAPH}}>{label}</div>}
    </div>
  );
};

// 메타포 — "기울어진 운동장"(uneven playing field). 측면뷰: 수평이던 운동장 바닥이 tiltDeg로 기울고,
// 공이 낮은(오른쪽) 쪽으로 굴러내린다 → "공정하지 않게 한쪽으로 쏠린 시장". 깃발·야드마커로 '운동장'을 읽히게 함.
// 디자인 톤 유지: 흰 배경 위 BLUE/INK + 연한 블루 surface. (b-roll 대신 director가 '아이콘/일러스트' 판정 시 사용)
// shrink* 를 주면, 기운 뒤 운동장 '너비'가 shrinkStart~shrinkEnd 동안 *문장 내내 계속* 줄어들고(좁아지는 시장)
// 공은 줄어드는 낮은(오른쪽) 끝을 따라 계속 미끄러진다 → dead-hold 없음. (2026-06 사용자 지적: 6악장 b3)
export const TiltField = ({start, tiltDeg = 9, width = 1000, ballColor = BLUE,
  shrinkStart, shrinkEnd, shrinkTo = 0.42}: {
  start: number; tiltDeg?: number; width?: number; ballColor?: string;
  shrinkStart?: number; shrinkEnd?: number; shrinkTo?: number;
}) => {
  const f = useCurrentFrame();
  const deg = interpolate(f, [start, start + 48], [0, tiltDeg], {...C, easing: Easing.inOut(Easing.cubic)});
  const op = interpolate(f, [start, start + 18], [0, 1], C);
  const H = 300, cx = width / 2, barY = 168, barH = 24;
  // 현재 반너비(half-width): shrink 구간 동안 full → full*shrinkTo 로 지속 감소
  const ss = shrinkStart ?? start + 38, se = shrinkEnd ?? start + 108;
  const hwFrac = interpolate(f, [ss, se], [1, shrinkTo], {...C, easing: Easing.inOut(Easing.cubic)});
  const hw = (width / 2) * hwFrac;
  const left = cx - hw, right = cx + hw;
  const markers = [0.16, 0.34, 0.66, 0.84]; // 양끝 기준 비율 → hw 줄면 가운데로 압축
  const by = barY - 22;
  return (
    <div style={{transform: `rotate(${deg}deg)`, transformOrigin: '50% 56%', opacity: op}}>
      <svg viewBox={`0 0 ${width} ${H}`} style={{width, height: H, fontFamily: FF, overflow: 'visible'}}>
        {/* 야드 마커 (양끝 사이 비율 → 좁아지면 압축) */}
        {markers.map((p, i) => { const x = left + 2 * hw * p; return (<line key={i} x1={x} y1={barY} x2={x} y2={barY - 13} stroke={GRAPH} strokeWidth="2" opacity="0.45" />); })}
        {/* 센터 깃발 */}
        <line x1={cx} y1={barY} x2={cx} y2={barY - 74} stroke={GRAPH} strokeWidth="2" />
        <path d={`M${cx},${barY - 74} l36,11 l-36,11 z`} fill={BLUE} opacity="0.55" />
        {/* 운동장 바닥 (좁아짐) */}
        <rect x={left} y={barY} width={2 * hw} height={barH} rx="6" fill="#eef4fe" stroke={INK} strokeWidth="3" />
        {/* 공: 낮은(오른쪽) 끝을 따라 계속 미끄러짐 */}
        <ellipse cx={right - 22} cy={by + 24} rx="20" ry="5" fill={INK} opacity="0.12" />
        <circle cx={right - 22} cy={by} r="20" fill={ballColor} />
      </svg>
    </div>
  );
};
