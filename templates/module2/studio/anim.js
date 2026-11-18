// 모듈2 렌더 의미론 (정본)
// 스튜디오 미리보기와 Remotion 섹션 컴포넌트가 이 파일 하나를 같이 쓴다.
// 순수 함수만 둔다 (DOM·React 의존 없음). 단위: 좌표 px(1920×1080), 시간 frame.

export const ENTER_EFFECTS = {
  none: "없음", fade: "페이드", "fade-up": "아래에서 떠오름", "fade-down": "위에서 내려옴",
  "slide-left": "오른쪽에서 밀려옴", "slide-right": "왼쪽에서 밀려옴", "scale-in": "확대되며 등장",
  pop: "팝(커졌다 작아짐)", "wipe-right": "왼→오 닦아내기", typewriter: "타자기", "count-up": "숫자 카운트업", flip: "뒤집히며 등장", drop: "위에서 떨어지며 튐", "zoom-in": "크게 다가왔다 제자리",
};
export const EXIT_EFFECTS = {
  none: "없음(컷)", fade: "서서히 사라짐", "fade-up": "위로 사라짐", "fade-down": "아래로 사라짐",
  "slide-left": "왼쪽으로 밀려남", "slide-right": "오른쪽으로 밀려남", "scale-out": "축소되며 사라짐", "wipe-left": "왼→오 지워짐",
};
export const EMPHASIS = { pulse: "펄스", bounce: "통통 튐", lift: "살짝 들림", shake: "흔들림", wiggle: "갸웃", highlight: "하이라이트(빛 테두리)" };

const TIMING_KEYS = ["in", "out", "enter", "enterDur", "exit", "exitDur", "emphasis", "beat"];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeOutBack = (t) => { const c = 1.7; const x = clamp(t) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

// ================================================================== 디자인 키트 (theme)
// 프로젝트 design/theme.json — 공통 양식의 단일 출처. 요소는 값을 직접 갖지 않고 이름으로 참조한다.
//   styles.<이름>: 요소 기본값 (x·y·w·h·fill·radius·pad·valign·font{…}) — 요소에 "style":"<이름>"
//   motion.<이름>: 등장·퇴장 기본값 (enter·enterDur·exit·exitDur) — 타이밍에 "preset":"<이름>" (없으면 style 이름)
//   colors.<이름>: 색 — 어디서든 "$이름"으로 참조 (diagram props 포함)
// 우선순위: 테마 < 요소에 적힌 값 < 스튜디오 직접 편집(edits)
function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
function deepMerge(a, b) {
  const o = Object.assign({}, a || {});
  for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(o[k]) ? deepMerge(o[k], v) : v;
  return o;
}
export function resolveColors(v, colors) {
  if (typeof v === "string") return v[0] === "$" && colors && colors[v.slice(1)] ? colors[v.slice(1)] : v;
  if (Array.isArray(v)) return v.map((x) => resolveColors(x, colors));
  if (isObj(v)) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = resolveColors(x, colors); return o; }
  return v;
}
// 키트(diagram) 기본 색도 테마를 따르게
// 연출 부품 설정 (theme.components.<부품>.params) — 예: 노드 원과 라벨 사이 간격
export const KIT_PARAMS = { nodes: { labelGap: 66, subGap: 54 }, cards: { pad: 36, flip: 1 }, line: { curve: 1 } };
const KIT_PARAM_DEFAULTS = JSON.parse(JSON.stringify(KIT_PARAMS));
export function applyKitTheme(theme) {
  const c = (theme && theme.colors) || {};
  for (const k of Object.keys(KIT_COLORS)) if (c[k]) KIT_COLORS[k] = c[k];
  const comps = (theme && theme.components) || {};
  for (const k of Object.keys(KIT_PARAMS)) KIT_PARAMS[k] = Object.assign({}, KIT_PARAM_DEFAULTS[k], (comps[k] && comps[k].params) || {});
}

// layout 요소 + timeline 요소 + edits 덮어쓰기 (+ theme) → 병합된 요소 목록
export function mergeSection(layout, timeline, edits, theme) {
  const TH = theme || {}, styles = TH.styles || {}, motion = TH.motion || {}, colors = TH.colors || {};
  if (theme) applyKitTheme(theme);
  const canvas = resolveColors(Object.assign({ w: 1920, h: 1080, bg: "#ffffff" }, (layout && layout.canvas) || {}), colors);
  const fps = (timeline && timeline.fps) || 30;
  const duration = (timeline && timeline.duration) || 150;
  const tl = (timeline && timeline.elements) || {};
  const ed = (edits && edits.elements) || {};
  const base = ((layout && layout.elements) || []).slice();
  for (const [id, e] of Object.entries(ed)) {
    if (e && e._new && !base.find((b) => b.id === id)) base.push(Object.assign({ id }, e));
  }
  const out = [];
  for (const b0 of base) {
    const e = ed[b0.id] || {};
    if (e._deleted) continue;
    const st = b0.style && styles[b0.style] ? styles[b0.style] : null;
    const b = st ? deepMerge(Object.fromEntries(Object.entries(st).filter(([k]) => k !== "label" && k !== "idea")), b0) : b0;
    const m = Object.assign({}, b);
    for (const [k, v] of Object.entries(e)) {
      if (k === "font" || TIMING_KEYS.includes(k) || k.startsWith("_")) continue;
      m[k] = v;
    }
    m.font = Object.assign({}, b.font || {}, e.font || {});
    const t0 = tl[b.id] || {};
    const pre = motion[t0.preset || b0.preset || b0.style] || {};
    const t = Object.assign({
      in: 0, out: duration, enter: "fade", enterDur: 12, exit: "none", exitDur: 12, emphasis: [],
    }, Object.fromEntries(Object.entries(pre).filter(([k]) => ["enter", "enterDur", "exit", "exitDur"].includes(k))));
    for (const k of TIMING_KEYS) {
      if (t0[k] !== undefined && !(t0._presetKeys || []).includes(k)) t[k] = t0[k];
      if (b[k] !== undefined && b._new) t[k] = b[k];
      if (e[k] !== undefined) t[k] = e[k];
    }
    Object.assign(m, resolveColors({ fill: m.fill, font: m.font, props: m.props, stroke: m.stroke }, colors));
    if (m.fill === undefined) delete m.fill;
    if (m.props === undefined) delete m.props;
    if (m.stroke === undefined) delete m.stroke;
    // 키트 애니메이션 양식의 강조(emphasis: at = 등장부터 센 프레임)는 요소에 강조가 따로 없을 때 붙는다 → 같은 양식이면 전부 같은 강조
    if (!(t.emphasis || []).length && Array.isArray(pre.emphasis)) {
      t.emphasis = pre.emphasis.map((x) => Object.assign({}, x, { at: t.in + (x.at || 0), color: typeof x.color === "string" && x.color[0] === "$" ? colors[x.color.slice(1)] || x.color : x.color }));
    }
    m.t = t;
    m._edited = Object.keys(e).length > 0 && !e._new;
    m._new = !!e._new;
    out.push(m);
  }
  out.sort((a, b) => (a.z || 0) - (b.z || 0));
  beatAccents(out, (timeline && timeline.beats) || [], TH.beatAccent);
  return { canvas, fps, duration, elements: out };
}

// ---- 비트마다 움직임: 문장(비트)이 시작될 때 화면에 아무 변화가 없으면, 지금 화면의 주인공 요소에 작은 강조를 자동으로 건다.
// 2026-11-18 사용자: "모든 문장에는 비트별로 … 매순간 애니메이션이 나와서 재미있어야". 키트 theme.beatAccent로 조절/끄기.
const KIT_TIME_KEYS = ["at", "activeAt", "subAt", "valueAt", "explodeAt", "captionAt", "vsAt"];
function kitEventTimes(el) {
  const ts = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (KIT_TIME_KEYS.includes(k) && typeof x === "number") ts.push(el.t.in + x); else walk(x); } };
  walk(el.props || {});
  return ts;
}
const isAccentTarget = (e) => !(e.id === "el_title" || e.id === "el_chapter" || ["broll", "rect", "3d", "avatar", "video"].includes(e.type) ||
  (e.type === "diagram" && (["ghost", "chapter"].includes(e.kind) || (e.props && e.props.background))) ||
  ["kicker", "title", "note"].includes(e.style) || e.noAccent);
export function beatAccents(els, beats, cfg) {
  const c = Object.assign({ enabled: true, types: ["pulse", "lift", "bounce"], delay: 8, dur: 22, window: 24, every: 120 }, cfg || {});
  if (!c.enabled || !beats.length) return;
  const evs = [];
  for (const e of els) { evs.push(e.t.in); for (const m of e.t.emphasis || []) evs.push(m.at); if (e.type === "diagram") evs.push(...kitEventTimes(e)); }
  // 점검 지점: 문장 시작 + 긴 문장은 every(기본 120f=4초)마다
  const points = [];
  for (const b of beats) {
    points.push([b.start, c.delay]);
    for (let x = b.start + c.every; x < (b.end || b.start) - 45; x += c.every) points.push([x, 0]);
  }
  points.forEach(([s0, dl], i) => {
    if (evs.some((x) => x >= s0 - 6 && x <= s0 + c.window)) return;       // 이미 이 순간에 뭔가 움직인다
    const at = s0 + dl;
    const vis = els.filter((e) => isAccentTarget(e) && e.t.in <= at && at < e.t.out - c.dur);
    if (!vis.length) return;
    // 주인공 = 가장 큰 것(diagram > 큰 글자), 같으면 최근에 나온 것
    const score = (e) => (e.type === "diagram" ? 2000 : ((e.font && e.font.size) || 40) * 10) + e.t.in / 100;
    const tgt = vis.sort((a, b) => score(b) - score(a))[0];
    tgt.t.emphasis = (tgt.t.emphasis || []).concat([{ type: c.types[i % c.types.length], at, dur: c.dur, auto: true }]);
    evs.push(at);
  });
}

// frame 시점 요소 상태
export function stateAt(el, f) {
  const t = el.t;
  const st = { visible: false, opacity: 0, tx: 0, ty: 0, scale: 1, rot: 0, ry: 0, clipL: 0, clipR: 0, text: 1, count: 1, highlight: 0 };
  if (f < t.in || f >= t.out) return st;
  st.visible = true;
  st.opacity = 1;
  const pin = clamp((f - t.in) / Math.max(1, t.enterDur));
  const e = easeOut(pin);
  switch (t.enter) {
    case "fade": st.opacity *= e; break;
    case "fade-up": st.opacity *= e; st.ty += (1 - e) * 40; break;
    case "fade-down": st.opacity *= e; st.ty -= (1 - e) * 40; break;
    case "slide-left": st.opacity *= e; st.tx += (1 - e) * 120; break;
    case "slide-right": st.opacity *= e; st.tx -= (1 - e) * 120; break;
    case "scale-in": st.opacity *= e; st.scale *= 0.85 + 0.15 * e; break;
    case "pop": {
      st.opacity *= clamp(pin * 3);
      st.scale *= pin < 0.6 ? 0.6 + (1.08 - 0.6) * easeOut(pin / 0.6) : 1.08 - 0.08 * easeOut((pin - 0.6) / 0.4);
      break;
    }
    case "wipe-right": st.clipR = (1 - e) * 100; break;
    case "flip": st.opacity *= clamp(pin * 2.5); st.ry = (1 - e) * -90; break;          // 카드 뒤집히듯
    case "drop": st.opacity *= clamp(pin * 3); st.ty -= (1 - easeOutBack(pin)) * 60; break;   // 위에서 떨어지며 살짝 튐
    case "zoom-in": st.opacity *= e; st.scale *= 1.25 - 0.25 * e; break;                  // 크게 다가왔다 제자리
    case "typewriter": st.text = pin; break;
    case "count-up": st.count = e; st.opacity *= clamp(pin * 4); break;
    default: break;
  }
  if (t.exit && t.exit !== "none") {
    const x = easeIn(clamp(1 - (t.out - f) / Math.max(1, t.exitDur)));
    switch (t.exit) {
      case "fade": st.opacity *= 1 - x; break;
      case "fade-up": st.opacity *= 1 - x; st.ty -= x * 40; break;
      case "fade-down": st.opacity *= 1 - x; st.ty += x * 40; break;
      case "slide-left": st.opacity *= 1 - x; st.tx -= x * 120; break;
      case "slide-right": st.opacity *= 1 - x; st.tx += x * 120; break;
      case "scale-out": st.opacity *= 1 - x; st.scale *= 1 - 0.15 * x; break;
      case "wipe-left": st.clipL = x * 100; break;
      default: break;
    }
  }
  // 큰 요소(차트·카드 묶음)는 같은 배율이라도 화면이 크게 출렁이므로 강조 세기를 줄인다
  const amp = (el.w || 0) * (el.h || 0) > 600000 ? 0.4 : (el.w || 0) * (el.h || 0) > 250000 ? 0.7 : 1;
  for (const em of t.emphasis || []) {
    const dur = em.dur || 20;
    const p = (f - em.at) / dur;
    if (p < 0 || p > 1) continue;
    const s = Math.sin(Math.PI * p);
    if (em.type === "pulse") st.scale *= 1 + 0.06 * amp * s;
    if (em.type === "bounce") st.scale *= 1 + 0.12 * amp * Math.sin(Math.PI * p) * (1 - p) * 1.6;
    if (em.type === "lift") st.ty -= 14 * s;
    if (em.type === "shake") st.tx += 10 * Math.sin(p * Math.PI * 6) * (1 - p);
    if (em.type === "wiggle") st.rot += 3 * Math.sin(p * Math.PI * 4) * (1 - p);
    if (em.type === "highlight" && s > st.highlight) { st.highlight = s; st.highlightColor = em.color || null; }
  }
  return st;
}

// 요소 위치·크기·회전 → CSS transform (스튜디오·렌더 공용)
export function transformOf(st, k = 1) {
  return `${st.ry ? "perspective(1400px) rotateY(" + st.ry + "deg) " : ""}translate(${st.tx * k}px, ${st.ty * k}px) scale(${st.scale})${st.rot ? " rotate(" + st.rot + "deg)" : ""}`;
}

// 강조(하이라이트) 테두리 빛 — 스튜디오·렌더 공용. em.color가 있으면 그 색(키트 색), 없으면 노랑
export function emphasisShadow(st) {
  if (!st.highlight) return "";
  const c = st.highlightColor, a = 0.45 * st.highlight;
  const rgba = c && /^#[0-9a-f]{6}$/i.test(c) ? `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})` : `rgba(255,214,0,${a})`;
  return `0 0 0 ${14 * st.highlight}px ${rgba}`;
}

// 타자기·카운트업 반영한 표시 텍스트
export function displayText(text, st) {
  let s = String(text == null ? "" : text);
  if (st.text < 1) {
    const chars = Array.from(s);
    s = chars.slice(0, Math.ceil(chars.length * st.text)).join("");
  }
  if (st.count < 1) {
    s = s.replace(/\d[\d,]*(\.\d+)?/g, (m) => {
      const dec = (m.split(".")[1] || "").length;
      const v = parseFloat(m.replace(/,/g, "")) * st.count;
      const fixed = v.toFixed(dec);
      return m.includes(",") ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fixed;
    });
  }
  return s;
}

// 텍스트 강조 문법: "운용자산 [[340조 원]]" → [{text:"운용자산 ",accent:false},{text:"340조 원",accent:true}]
// 강조 색은 font.accentColor (기본 #296ef9). 타자기·카운트업은 강조 구간에도 그대로 적용.
export function richSegments(text, st) {
  const raw = String(text == null ? "" : text);
  const segs = [];
  const re = /\[\[(.+?)\]\]/g;
  let i = 0, m;
  while ((m = re.exec(raw))) {
    if (m.index > i) segs.push({ text: raw.slice(i, m.index), accent: false });
    segs.push({ text: m[1], accent: true });
    i = m.index + m[0].length;
  }
  if (i < raw.length) segs.push({ text: raw.slice(i), accent: false });
  if (!st) return segs;
  const full = { text: 1, count: st.count };
  let out = segs.map((s) => ({ text: displayText(s.text, full), accent: s.accent }));
  if (st.text < 1) {
    let left = Math.ceil(out.reduce((a, s) => a + Array.from(s.text).length, 0) * st.text);
    out = out.map((s) => { const c = Array.from(s.text); const take = Math.max(0, Math.min(c.length, left)); left -= take; return { text: c.slice(0, take).join(""), accent: s.accent }; });
  }
  return out;
}

export const fmtTime = (frame, fps = 30) => {
  const s = frame / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};

// ================================================================== 연출 키트 (diagram · broll)
// 요소 type "diagram"(kind + props) / "broll"(slot 묘사 + src). 이 파일 하나로 스튜디오 미리보기와
// Remotion 렌더가 같은 SVG를 그린다 → 미리보기 = 렌더. props 안의 모든 at/dur는 "요소 등장(in)부터 센 프레임".
// 사용법·props: templates/module2/remotion/DIRECTION_KIT.md

export const DIAGRAM_KINDS = {
  keyword: "대형 키워드 (글자 스태거)", ghost: "고스트 타이포", banner: "하단 배너 (pop+shine)",
  stat: "큰 숫자 카운트업", bars: "막대 차트", line: "선 차트", nodes: "노드·연결선 다이어그램",
  table: "표 + 행 하이라이트", cards: "키워드 카드 공개", arrow: "성장 화살표", chapter: "챕터 간지",
  zoomReveal: "사진 줌아웃 공개", split: "두 화면 맞붙기", gallery: "사진 그리드", compare: "전·후 비교 슬라이더", stack: "사진 쌓기",
};
// 사진 경로 → 실제 URL (스튜디오는 /files/…, Remotion은 staticFile). 각 쪽이 시작할 때 setMediaResolver로 바꿔 끼운다
let MEDIA = (s) => s;
export function setMediaResolver(fn) { MEDIA = fn || ((s) => s); }
// diagram 안의 사진 경로 목록 (Remotion이 프레임 그리기 전에 미리 불러오기용)
export function diagramMedia(el) {
  const p = el.props || {}, out = [];
  const add = (x) => { if (x && x.src) out.push(x.src); };
  add(p); add(p.left); add(p.right); add(p.before); add(p.after);
  (p.images || []).forEach(add);
  return out.filter(Boolean);
}
let SVG_ID = "d";   // 한 화면에 diagram이 여러 개여도 clipPath id가 겹치지 않게 (diagramSVG가 요소 id로 바꿈)
export const KIT_COLORS = { blue: "#296ef9", navy: "#0b1f4b", coral: "#ff5050", gray: "#8a94a6", soft: "#eef3ff", line: "#d5dceb", white: "#ffffff" };
const KC = KIT_COLORS;
const FONT = "Pretendard, sans-serif";

const xesc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lin = (f, at, dur) => clamp((f - (at || 0)) / Math.max(1, dur || 1));
const eo = (f, at, dur) => easeOut(lin(f, at, dur));
// pop: 0.6 → 1.08 → 1.0, ≤ dur 프레임 (기본 12f = 0.4s)
function popS(f, at, dur = 12) {
  const p = lin(f, at, dur);
  if (p <= 0) return { o: 0, s: 0.6 };
  const s = p < 0.6 ? 0.6 + 0.48 * easeOut(p / 0.6) : 1.08 - 0.08 * easeOut((p - 0.6) / 0.4);
  return { o: clamp(p * 3), s };
}
const countText = (txt, f, at, dur) => displayText(txt, { text: 1, count: eo(f, at, dur) });
function tspans(text, x, lh) {
  return String(text == null ? "" : text).split("\n").map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${xesc(l)}</tspan>`).join("");
}
// ---- 배치 검사용 위치 기록 (layout_audit.mjs) — 평소에는 꺼져 있다
let COLLECT = null;
export function measureText(text, size, lh = 1.25) {
  const lines = String(text == null ? "" : text).replace(/<[^>]+>/g, "").split(/\n/);
  const w = Math.max(0, ...lines.map((l) => Array.from(l).reduce((a, c) => a + charW(c) * size, 0)));
  return { w, h: lines.length * size * lh, lines: lines.length };
}
function rec(p) { if (COLLECT) COLLECT.push(p); }
function recText(x, y, text, o) {
  if (!COLLECT || (o.opacity != null && o.opacity < 0.3)) return;
  const size = o.size || 36, m = measureText(text, size, o.lh || 1.25);
  const x0 = o.anchor === "middle" ? x - m.w / 2 : o.anchor === "end" ? x - m.w : x;
  const y0 = o.base === "central" ? y - (m.h / 2) : y - size * 0.8;
  COLLECT.push({ kind: "text", text: String(text).replace(/<[^>]+>/g, "").slice(0, 30), x: x0, y: y0, w: m.w, h: o.base === "central" ? m.h : size + (m.lines - 1) * size * (o.lh || 1.25), own: o.own });
}
const T = (x, y, text, o = {}) => (recText(x, y, text, o), Tsvg(x, y, text, o));
const Tsvg = (x, y, text, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size || 36}" font-weight="${o.weight || 600}" fill="${o.color || KC.navy}" text-anchor="${o.anchor || "start"}"` +
  `${o.opacity != null ? ` opacity="${o.opacity}"` : ""}${o.ls != null ? ` letter-spacing="${o.ls}"` : ""}${o.tr ? ` transform="${o.tr}"` : ""} dominant-baseline="${o.base || "alphabetic"}">${o.raw ? text : tspans(text, x, (o.size || 36) * (o.lh || 1.25))}</text>`;
// 글자 폭 근사 (em). 한글 0.9, 대문자 0.68, 소문자 0.56, 숫자 0.6, 공백 0.28
const charW = (c) => (/[가-힣]/.test(c) ? 0.9
  : /[ilj']/.test(c) ? 0.25 : /[I.,:;!|]/.test(c) ? 0.3 : /[tfr]/.test(c) ? 0.36 : /[mw]/.test(c) ? 0.84 : /[MW]/.test(c) ? 0.9
  : /[A-Z]/.test(c) ? 0.68 : /[a-z]/.test(c) ? 0.56 : /[0-9]/.test(c) ? 0.6 : c === " " ? 0.26 : 0.45);
const scaleAt = (cx, cy, s) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;

// ---- 사진 칸: 사진이 있으면 꽉 채워(slice) 둥근 모서리로 자르고, 없으면 '사진 자리' 표시(기획이 화면에서 보이게)
// o: {rx, label, labelSize, labelOn:"below"|"inside"|false, zoom(1), fx/fy(0~1 초점), blur(px), own}
let IMG_N = 0;
function photo(x, y, w, h, src, o = {}) {
  const id = `${SVG_ID}p${IMG_N++}`, rx = o.rx == null ? 18 : o.rx, z = o.zoom || 1;
  const fx = o.fx == null ? 0.5 : o.fx, fy = o.fy == null ? 0.5 : o.fy;
  const iw = w * z, ih = h * z, ix = x - (iw - w) * fx, iy = y - (ih - h) * fy;
  if (!o.bg) rec({ kind: "rect", x, y, w, h, own: o.own });
  let body;
  const url = src ? MEDIA(src) : "";
  if (url) {
    const blur = o.blur > 0.3 ? `<filter id="${id}f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${o.blur}"/></filter>` : "";
    body = `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>${blur}</defs>` +
      `<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0a1530"/>` +
      `<image href="${xesc(url)}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice"${blur ? ` filter="url(#${id}f)"` : ""}/></g>`;
  } else {
    const lines = [];
    for (let k = -h; k < w; k += 70) lines.push(`<line x1="${x + k}" y1="${y + h}" x2="${x + k + h}" y2="${y}" stroke="#fff" stroke-opacity="0.06" stroke-width="2"/>`);
    body = `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>` +
      `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2f5c"/><stop offset="1" stop-color="#0a1530"/></linearGradient></defs>` +
      `<g clip-path="url(#${id})"><g transform="${scaleAt(x + w / 2, y + h / 2, z)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}g)"/>${lines.join("")}</g></g>` +
      // 배경 사진 자리는 글자를 가리지 않게 아래쪽에(b-roll 자리표시와 같은 자리), 그 밖은 칸 가운데
      (o.noText ? "" : Tsvg(x + w / 2, o.bg ? y + h - 120 : y + h / 2, "사진 자리" + (o.slot ? " · " + o.slot : ""), { size: Math.max(16, Math.min(34, w / 14)), weight: 600, color: "rgba(255,255,255,.6)", anchor: "middle", base: "central" }));
  }
  if (o.label && o.labelOn === "inside") {
    const ls = o.labelSize || Math.max(22, Math.min(40, w / 12));
    body += `<g clip-path="url(#${id})"><rect x="${x}" y="${y + h - ls * 2.2}" width="${w}" height="${ls * 2.2}" fill="#0a1530" opacity="0.55"/></g>` +
      T(x + w / 2, y + h - ls * 1.1, o.label, { size: ls, weight: 700, color: "#fff", anchor: "middle", base: "central", own: o.own });
  } else if (o.label && o.labelOn !== false) {
    body += T(x + w / 2, y + h + (o.labelSize || 32) + 18, o.label, { size: o.labelSize || 32, weight: 700, color: o.labelColor || KC.navy, anchor: "middle", own: o.own });
  }
  return body;
}

// 배경으로 깐 사진 위 글자가 읽히게 어둡게 덮기. p.dim(0~1), p.dimColor
const dimLayer = (w, h, p, o = 1) => (p.dim ? `<rect width="${w}" height="${h}" fill="${p.dimColor || "#0a1530"}" opacity="${p.dim * o}"/>` : "");

const KIT = {
  // ---- 사진·미디어 (reactvideoeditor/remotion-templates Image & Media 움직임을 키트로 옮김, MIT) ----
  // 사진 줌아웃 공개: 크게 당겨진 흐린 사진이 제자리로 빠지며 초점이 맞는다. props: src, slot, at, dur(45), from(1.35), blur(14), fx/fy, rx(0=화면 가득), caption, captionAt, captionSize, drift(0.06), driftDur(600), dim(0~1), background(true=글자 뒤 배경, 배치 검사 제외)
  zoomReveal(w, h, p, f) {
    const at = p.at || 0, g = eo(f, at, p.dur || 45), o = eo(f, at, 10);
    // drift: 공개가 끝난 뒤에도 천천히 더 다가간다(배경으로 오래 깔 때 정지 화면이 되지 않게). driftDur 프레임 동안 +drift
    const dr = p.drift ? p.drift * lin(f, at + (p.dur || 45), p.driftDur || 600) : 0;
    const z = (p.from || 1.35) + (1 - (p.from || 1.35)) * g + dr;
    let out = `<g opacity="${o}">` + photo(0, 0, w, h, p.src, { rx: p.rx == null ? 0 : p.rx, zoom: z, fx: p.fx, fy: p.fy, blur: (p.blur == null ? 14 : p.blur) * (1 - g), slot: p.slot, own: "photo", bg: p.background }) + dimLayer(w, h, p, g) + `</g>`;
    if (p.caption) {
      const co = eo(f, p.captionAt != null ? p.captionAt : at + (p.dur || 45) - 10, 14), cs = p.captionSize || 64;
      out += `<rect x="0" y="${h - cs * 3}" width="${w}" height="${cs * 3}" fill="#0a1530" opacity="${0.5 * co}"/>` +
        T(w / 2, h - cs * 1.4, p.caption, { size: cs, weight: 700, color: "#fff", anchor: "middle", base: "central", opacity: co, tr: `translate(0 ${(1 - co) * 20})`, own: "photo" });
    }
    return out;
  },
  // 두 화면 맞붙기: 왼쪽·오른쪽 사진이 바깥에서 밀려와 가운데서 만난다. props: left{src,label,slot}, right{src,label,slot}, at, dur(22), stagger(6), gap(16), rx, labelOn("inside"|"below"), vs("VS" 등 가운데 글자), vsAt
  split(w, h, p, f) {
    const at = p.at || 0, dur = p.dur || 22, gap = p.gap == null ? 16 : p.gap, pw = (w - gap) / 2;
    const lab = p.labelOn || "inside", ph = lab === "below" ? h - 70 : h;
    const side = (s, i) => {
      const g = eo(f, at + i * (p.stagger == null ? 6 : p.stagger), dur); if (g <= 0) return "";
      const x = i ? pw + gap : 0, dx = (i ? 1 : -1) * (1 - g) * (pw + 60);
      return `<g transform="translate(${dx} 0)" opacity="${clamp(g * 2)}">` + photo(x, 0, pw, ph, (s || {}).src, { rx: p.rx == null ? 18 : p.rx, label: (s || {}).label, labelOn: lab, slot: (s || {}).slot, own: "side" + i, bg: p.background }) + `</g>`;
    };
    let out = side(p.left, 0) + side(p.right, 1) + dimLayer(w, h, p, eo(f, at + dur, 12));
    if (p.vs) {
      const a = popS(f, p.vsAt != null ? p.vsAt : at + dur + 6, 12), cy = ph / 2;
      out += `<g opacity="${a.o}" transform="${scaleAt(w / 2, cy, a.s)}"><circle cx="${w / 2}" cy="${cy}" r="58" fill="${p.vsColor || KC.coral}"/>` +
        T(w / 2, cy, p.vs, { size: 40, weight: 700, color: "#fff", anchor: "middle", base: "central", own: "vs" }) + `</g>`;
      rec({ kind: "circle", x: w / 2 - 58, y: cy - 58, w: 116, h: 116, own: "vs" });
    }
    return out;
  },
  // 사진 그리드: 칸마다 차례로 커지며 나타난다. props: images[{src,label,slot}], cols(3), rows(자동), at, stagger(6), gap(18), rx, labelOn("inside"|"below"|false), highlight{index,at}
  gallery(w, h, p, f) {
    const im = p.images || [], cols = p.cols || 3, rows = p.rows || Math.ceil(im.length / cols) || 1, gap = p.gap == null ? 18 : p.gap;
    const lab = p.labelOn == null ? "inside" : p.labelOn, extra = lab === "below" ? 60 : 0;
    const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows - extra;
    const hl = p.highlight && f >= p.highlight.at ? eo(f, p.highlight.at, 12) : 0;
    return im.map((s, i) => {
      const a = popS(f, (p.at || 0) + i * (p.stagger == null ? 6 : p.stagger), 14); if (!a.o) return "";
      const c = i % cols, r = Math.floor(i / cols), x = c * (cw + gap), y = r * (ch + extra + gap);
      const dim = hl && p.highlight.index !== i ? 1 - 0.6 * hl : 1;
      return `<g opacity="${a.o * dim}" transform="${scaleAt(x + cw / 2, y + ch / 2, a.s)}">` + photo(x, y, cw, ch, s.src, { rx: p.rx == null ? 14 : p.rx, label: s.label, labelOn: lab, labelSize: p.labelSize, slot: s.slot, own: "g" + i, bg: p.background, noText: p.background }) + `</g>`;
    }).join("") + dimLayer(w, h, p, eo(f, (p.at || 0) + im.length * (p.stagger == null ? 6 : p.stagger), 14)) +
      // 배경 그리드는 칸마다 '사진 자리'를 쓰면 위 글자와 부딪힌다 → 빈 칸 안내를 화면 아래 한 줄로
      (p.background && im.some((s) => !s.src) ? Tsvg(w / 2, h - 60, "사진 자리 · " + (p.slot || im.filter((s) => !s.src).map((s) => (s.slot || "").split(" · ").pop()).join(", ")), { size: 24, weight: 600, color: "rgba(255,255,255,.5)", anchor: "middle", base: "central" }) : "");
  },
  // 전·후 비교 슬라이더: 구분선이 움직이며 '전' 위로 '후'가 드러난다. props: before{src,label,slot}, after{src,label,slot}, at, dur(40), from(0.92), to(0.5), rx, color
  compare(w, h, p, f) {
    const at = p.at || 0, g = eo(f, at + 8, p.dur || 40), o = eo(f, at, 10);
    const pos = (p.from == null ? 0.92 : p.from) + ((p.to == null ? 0.5 : p.to) - (p.from == null ? 0.92 : p.from)) * g, x = w * pos;
    const id = `${SVG_ID}cmp`, col = p.color || "#fff", rx = p.rx == null ? 18 : p.rx;
    const b = p.before || {}, a = p.after || {};
    let out = `<g opacity="${o}">` + photo(0, 0, w, h, a.src, { rx, slot: a.slot || "후", own: "cmp" }) +
      `<defs><clipPath id="${id}"><rect x="0" y="0" width="${x}" height="${h}"/></clipPath></defs>` +
      `<g clip-path="url(#${id})">` + photo(0, 0, w, h, b.src, { rx, slot: b.slot || "전", own: "cmp" }) + `</g>` +
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${col}" stroke-width="6"/>` +
      `<circle cx="${x}" cy="${h / 2}" r="34" fill="${col}"/><polygon points="${x - 22},${h / 2} ${x - 8},${h / 2 - 12} ${x - 8},${h / 2 + 12}" fill="${KC.navy}"/><polygon points="${x + 22},${h / 2} ${x + 8},${h / 2 - 12} ${x + 8},${h / 2 + 12}" fill="${KC.navy}"/>`;
    const lo = eo(f, at + 12, 12), pill = (tx, t, anchor) => {
      const ls = 30, tw = measureText(t, ls).w + 44, px = anchor === "start" ? tx : tx - tw;
      return `<rect x="${px}" y="28" width="${tw}" height="56" rx="28" fill="#0a1530" opacity="${0.7 * lo}"/>` + T(px + tw / 2, 56, t, { size: ls, weight: 700, color: "#fff", anchor: "middle", base: "central", opacity: lo, own: "cmp" });
    };
    if (b.label) out += pill(28, b.label, "start");
    if (a.label) out += pill(w - 28, a.label, "end");
    return out + `</g>`;
  },
  // 사진 쌓기: 사진이 위에서 떨어지며 살짝 돌아간 채 겹겹이 쌓인다(맨 마지막이 맨 위). props: images[{src,label,slot}], at, stagger(12), rot([-7,5,-3,4,-1]), spread(40), photoW, photoH, frame(true=흰 테두리), labelOn("below")
  stack(w, h, p, f) {
    const im = p.images || [], rots = p.rot || [-7, 5, -3, 4, -1], spread = p.spread == null ? 40 : p.spread;
    const pw = p.photoW || w * 0.62, phh = p.photoH || h * 0.78, fr = p.frame === false ? 0 : 16;
    return im.map((s, i) => {
      const at = (p.at || 0) + i * (p.stagger == null ? 12 : p.stagger), g = eo(f, at, 16); if (g <= 0) return "";
      const n = im.length, off = (i - (n - 1) / 2) * spread, cx = w / 2 + off, cy = h / 2 - (p.labelOn === "below" ? 30 : 0);
      const rot = rots[i % rots.length] * (0.4 + 0.6 * g), dy = (1 - g) * -160, sc = 1.12 - 0.12 * g;
      const x = cx - pw / 2, y = cy - phh / 2;
      const top = i === n - 1;
      return `<g opacity="${clamp(g * 2)}" transform="translate(0 ${dy}) rotate(${rot} ${cx} ${cy}) ${scaleAt(cx, cy, sc)}">` +
        (fr ? `<rect x="${x - fr}" y="${y - fr}" width="${pw + fr * 2}" height="${phh + fr * 2}" rx="10" fill="#fff" stroke="${KC.line}" stroke-width="2"/>` : "") +
        photo(x, y, pw, phh, s.src, { rx: fr ? 4 : 16, label: top ? s.label : null, labelOn: p.labelOn || "inside", slot: s.slot, own: "st" }) + `</g>`;
    }).join("");
  },

  // 결정타 단어를 화면 가득. props: text, size(220), color, at, perLetter(2), align(center|left), sub, subAt
  keyword(w, h, p, f) {
    const size = p.size || 220, chars = Array.from(p.text || ""), per = p.perLetter == null ? 2 : p.perLetter;
    const cws = chars.map((c) => size * charW(c)), total = cws.reduce((a, b) => a + b, 0);
    const x0 = p.align === "left" ? 0 : (w - total) / 2, y = h / 2 + size * 0.34 - (p.sub ? size * 0.25 : 0);
    let acc = 0;
    let out = chars.map((c, i) => {
      const a = popS(f, (p.at || 0) + i * per, 12);
      const cx = x0 + acc + cws[i] / 2; acc += cws[i];
      return a.o ? T(cx, y, c, { size, weight: p.weight || 700, color: p.color || KC.blue, anchor: "middle", opacity: a.o, tr: scaleAt(cx, y - size * 0.35, a.s), ls: -2, own: "word" }) : "";
    }).join("");
    if (p.sub) {
      const o = eo(f, p.subAt != null ? p.subAt : (p.at || 0) + chars.length * per + 6, 12);
      out += T(p.align === "left" ? 0 : w / 2, y + size * 0.55 + 22, p.sub, { size: p.subSize || 44, weight: 600, color: p.subColor || KC.navy, anchor: p.align === "left" ? "start" : "middle", opacity: o });
    }
    return out;
  },
  // 콘텐츠 뒤 대형 옅은 단어. props: text, size(360), color, at, maxOpacity(0.08)
  ghost(w, h, p, f) {
    const o = eo(f, p.at, 15) * (p.maxOpacity || 0.08), s = 1.04 - 0.04 * eo(f, p.at, 20);
    return T(w / 2, h / 2 + (p.size || 360) * 0.35, p.text, { size: p.size || 360, weight: 700, color: p.color || KC.blue, anchor: "middle", opacity: o, tr: scaleAt(w / 2, h / 2, s), ls: -6 });
  },
  // 한 줄 정리 배너. props: text, at, fill, color, size(40), rx(모서리, 기본 h/2.6 — 화면 가로 띠는 0), wipe(true면 pop 대신 왼→오로 펼침)
  banner(w, h, p, f) {
    const rx = p.rx != null ? p.rx : h / 2.6;
    const a = p.wipe ? { o: eo(f, p.at, 6), s: 1 } : popS(f, p.at, 14), sh = lin(f, (p.at || 0) + 12, 20);
    const id = "bn" + Math.round(w) + Math.round(h), wp = p.wipe ? eo(f, p.at, 14) : 1;
    if (p.wipe && wp < 1) {
      return `<g opacity="${a.o}"><rect width="${w * wp}" height="${h}" rx="${rx}" fill="${p.fill || KC.blue}"/></g>`;
    }
    return `<g opacity="${a.o}" transform="${scaleAt(w / 2, h / 2, a.s)}"><defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${rx}"/></clipPath>` +
      `<linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
      `<rect width="${w}" height="${h}" rx="${rx}" fill="${p.fill || KC.blue}"/>` +
      (sh > 0 && sh < 1 ? `<g clip-path="url(#${id})"><rect x="${-h * 2 + sh * (w + h * 4)}" y="${-h}" width="${h * 1.6}" height="${h * 3}" fill="url(#${id}g)" transform="rotate(20 ${w / 2} ${h / 2})"/></g>` : "") +
      T(w / 2, h / 2, p.text, { size: p.size || 40, weight: 700, color: p.color || "#fff", anchor: "middle", base: "central" }) + `</g>`;
  },
  // 큰 숫자 카운트업. props: value("4,178"), unit("억 원"), label, delta("+2배"), at, dur(24), size(200), color, align(center|left)
  stat(w, h, p, f) {
    const size = p.size || 200, at = p.at || 0, dur = p.dur || 24, left = p.align === "left";
    const x = left ? 0 : w / 2, anchor = left ? "start" : "middle", y = h / 2 + size * 0.3;
    const o = eo(f, at, 8);
    let out = p.label ? T(x, y - size * 0.95, p.label, { size: p.labelSize || 40, weight: 600, color: KC.gray, anchor, opacity: eo(f, at - 6, 10) }) : "";
    const unit = p.unit ? `<tspan font-size="${size * 0.36}" font-weight="600" dx="12">${xesc(p.unit)}</tspan>` : "";
    out += T(x, y, xesc(countText(p.value, f, at, dur)) + unit, { size, weight: 700, color: p.color || KC.blue, anchor, opacity: o, raw: true, ls: -4 });
    if (p.delta) {
      const a = popS(f, at + dur, 12), dy = y + size * 0.42;
      out += `<g opacity="${a.o}" transform="${scaleAt(x, dy, a.s)}">` + T(x, dy + 18, p.delta, { size: p.deltaSize || 48, weight: 700, color: p.deltaColor || KC.coral, anchor }) + `</g>`;
    }
    return out;
  },
  // 막대 차트. props: bars[{label,value,display,at,highlight}], max, color, highlightColor, grow(18), valueSize, labelSize, annotate{from,to,text,at}
  bars(w, h, p, f) {
    const bars = p.bars || [], n = Math.max(1, bars.length), max = p.max || Math.max(1, ...bars.map((b) => b.value || 0));
    const top = 70, base = h - 64, gap = w / n, bw = Math.min(gap * 0.56, p.barWidth || 150);
    let out = `<line x1="0" x2="${w}" y1="${base}" y2="${base}" stroke="${KC.line}" stroke-width="3"/>`;
    const tops = [];
    bars.forEach((b, i) => {
      const at = b.at || 0, g = eo(f, at, p.grow || 18), cx = gap * (i + 0.5);
      const bh = (base - top) * (b.value / max) * g, col = b.highlight ? p.highlightColor || KC.blue : p.color || "#b9c6de";
      // add: 막대 위에 얹히는 증가분 {value, label, at, color, dur} — 기존 막대가 다 선 뒤 위로 자란다
      const ad = b.add, ag = ad ? eo(f, ad.at, ad.dur || 20) : 0, ah = ad ? (base - top) * (ad.value / max) * ag : 0;
      const fullTop = base - (base - top) * ((b.value + (ad ? ad.value : 0)) / max);
      tops.push([cx, fullTop]);
      if (f >= at) { out += `<rect x="${cx - bw / 2}" y="${base - bh}" width="${bw}" height="${bh}" rx="10" fill="${col}"/>`; rec({ kind: "rect", x: cx - bw / 2, y: base - bh, w: bw, h: bh, own: "bar" + i }); }
      if (ad && ag > 0) {
        const y0 = base - bh - ah, acol = ad.color || KC.coral;
        out += `<rect x="${cx - bw / 2}" y="${y0}" width="${bw}" height="${ah + 10}" rx="10" fill="${acol}"/>`;
        if (ad.label) {
          const lo = eo(f, (ad.at || 0) + (ad.dur || 20) - 6, 10);
          // 라벨은 막대 바로 옆에 (연결선은 leader:true일 때만)
          if (ad.leader) out += `<line x1="${cx + bw / 2 + 12}" y1="${y0 + ah / 2}" x2="${cx + bw / 2 + 48}" y2="${y0 + ah / 2}" stroke="${acol}" stroke-width="4" opacity="${lo}"/>`;
          out += T(cx + bw / 2 + (ad.leader ? 60 : 24), y0 + ah / 2, ad.label, { size: ad.size || 44, weight: 700, color: acol, base: "central", opacity: lo });
        }
      }
      out += T(cx, base + 46, b.label, { size: p.labelSize || 32, weight: 600, color: KC.gray, anchor: "middle", opacity: eo(f, at - 4, 8) });
      const vAt = b.valueAt != null ? b.valueAt : at, disp = b.display != null ? b.display : String(b.value);
      if (f >= vAt && disp) out += T(cx, base - bh - ah - 18, countText(disp, f, vAt, b.valueDur || p.grow || 18), { size: p.valueSize || (b.highlight ? 48 : 36), weight: 700, color: b.highlight ? p.highlightColor || KC.blue : KC.navy, anchor: "middle", own: "bar" + i });
    });
    const an = p.annotate;
    if (an && tops[an.from] && tops[an.to]) {
      // 증가 화살표: 두 막대 사이 빈 곳(막대 윗면 바로 아래)에서 → 값 라벨을 가로지르지 않게. 라벨은 화살표 가운데 위
      const [x1, y1] = tops[an.from], [x2, y2] = tops[an.to];
      const ax1 = x1 + bw / 2 + 22, ax2 = x2 - bw / 2 - 22, ay1 = y1 + 36, ay2 = y2 + 36;
      const room = ax2 - ax1, base_ls = an.size || 44, w1 = measureText(an.text, 1).w;
      const fit = Math.min(base_ls, Math.floor((room - 12) / Math.max(0.1, w1)));
      const inside = fit >= 30, ls = inside ? fit : base_ls;
      const lx = (ax1 + ax2) / 2, ly = inside ? Math.min(ay1, ay2) - 26 : Math.min(...tops.map((t) => t[1])) - (p.valueSize || 48) - 40;
      out += KIT.arrow(w, h, { x1: ax1, y1: ay1, x2: ax2, y2: ay2, at: an.at, label: an.text, labelX: lx, labelY: ly, labelSize: ls, color: KC.coral, width: 8, own: "annot" }, f);
    }
    return out;
  },
  // 선 차트. props: series[{points:[v..],color,at,dur,name,dash}], labels[...], min, max, markers[{series,i,text,at}], shade{from,to,at,color}
  line(w, h, p, f) {
    const ser = p.series || [], all = ser.flatMap((s) => s.points || []);
    const mn = p.min != null ? p.min : Math.min(...all), mx = p.max != null ? p.max : Math.max(...all);
    const L = 20, R = w - 20, Tp = 40, B = h - 60, cnt = Math.max(2, ...ser.map((s) => (s.points || []).length));
    const X = (i) => L + (R - L) * (i / (cnt - 1)), Y = (v) => B - (B - Tp) * ((v - mn) / Math.max(1e-9, mx - mn));
    let out = `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="${KC.line}" stroke-width="3"/>`;
    if (p.shade) {
      const o = eo(f, p.shade.at, 12);
      out += `<rect x="${X(p.shade.from)}" y="${Tp}" width="${X(p.shade.to) - X(p.shade.from)}" height="${B - Tp}" fill="${p.shade.color || KC.coral}" opacity="${0.1 * o}"/>`;
    }
    (p.labels || []).forEach((l, i) => { out += T(X(i), B + 44, l, { size: 28, weight: 600, color: KC.gray, anchor: "middle" }); });
    ser.forEach((s) => {
      const pts = (s.points || []).map((v, i) => [X(i), Y(v)]);
      const g = eo(f, s.at, s.dur || 30);
      if (g <= 0) return;
      // 곡선(기본): 점들을 부드럽게 잇는다(Catmull-Rom → 베지어). 길이는 곡선을 잘게 나눠 잰다 — 그려지는 속도가 일정하게
      const curve = (s.curve != null ? s.curve : p.curve != null ? p.curve : KIT_PARAMS.line.curve) && pts.length > 2;
      let d = "M" + pts[0].join(","), len = 0;
      const samp = [[pts[0][0], pts[0][1], 0]];   // 선 위 점들(누적 길이) — 따라가는 점 위치용
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
        if (curve) {
          const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
          d += ` C${c1.join(",")} ${c2.join(",")} ${p2.join(",")}`;
          let prev = p1;
          for (let k = 1; k <= 12; k++) {
            const t = k / 12, u = 1 - t;
            const q = [u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]];
            len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; samp.push([q[0], q[1], len]);
          }
        } else { d += ` L${p2.join(",")}`; len += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); samp.push([p2[0], p2[1], len]); }
      }
      out += `<path d="${d}" fill="none" stroke="${s.color || KC.blue}" stroke-width="${s.width || 7}" stroke-linecap="round" stroke-linejoin="round"` +
        ` stroke-dasharray="${len} ${len}" stroke-dashoffset="${len * (1 - g)}"/>`;
      // 선 끝에 따라가는 점 — 그리는 동안 '지금 여기'가 보이게
      if (g < 1 && s.dot !== false) {
        const L = g * len, j = Math.max(1, samp.findIndex((q) => q[2] >= L)), a = samp[j - 1], b = samp[j] || a, r = b[2] > a[2] ? (L - a[2]) / (b[2] - a[2]) : 0;
        out += `<circle cx="${a[0] + (b[0] - a[0]) * r}" cy="${a[1] + (b[1] - a[1]) * r}" r="${(s.width || 7) * 1.4}" fill="${s.color || KC.blue}"/>`;
      }
      if (s.name && g >= 1) out += T(pts[pts.length - 1][0] - 8, pts[pts.length - 1][1] - 22, s.name, { size: 28, weight: 700, color: s.color || KC.blue, anchor: "end" });
    });
    (p.markers || []).forEach((m) => {
      const s = ser[m.series || 0]; if (!s || !s.points) return;
      const a = popS(f, m.at, 12), x = X(m.i), y = Y(s.points[m.i]);
      out += `<g opacity="${a.o}" transform="${scaleAt(x, y, a.s)}"><circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="${m.color || KC.coral}" stroke-width="6"/>` +
        T(x, y - 34, m.text, { size: 30, weight: 700, color: m.color || KC.coral, anchor: "middle" }) + `</g>`;
    });
    return out;
  },
  // 노드 다이어그램. props: nodes[{id,x,y,r,label,sub,glyph,at,activeAt,fill}], links[{from,to,at,dur,arrow,color}]
  nodes(w, h, p, f) {
    const map = {}; (p.nodes || []).forEach((n) => { map[n.id] = n; });
    const lg = p.labelGap != null ? p.labelGap : KIT_PARAMS.nodes.labelGap, sg = p.subGap != null ? p.subGap : KIT_PARAMS.nodes.subGap;
    let out = "";
    (p.links || []).forEach((l) => {
      const a = map[l.from], b = map[l.to]; if (!a || !b) return;
      const g = eo(f, l.at, l.dur || 14); if (g <= 0) return;
      const ang = Math.atan2(b.y - a.y, b.x - a.x), ra = a.r || 70, rb = (b.r || 70) + (l.arrow ? 10 : 0);
      const x1 = a.x + Math.cos(ang) * ra, y1 = a.y + Math.sin(ang) * ra, x2 = b.x - Math.cos(ang) * rb, y2 = b.y - Math.sin(ang) * rb;
      const xe = x1 + (x2 - x1) * g, ye = y1 + (y2 - y1) * g, col = l.color || KC.blue;
      rec({ kind: "line", x1, y1, x2: xe, y2: ye, wd: 5, own: "link" });
      out += `<line x1="${x1}" y1="${y1}" x2="${xe}" y2="${ye}" stroke="${col}" stroke-width="5" stroke-linecap="round"${l.dash ? ' stroke-dasharray="12 12"' : ""}/>`;
      if (l.arrow && g >= 1) out += `<polygon points="0,-12 22,0 0,12" fill="${col}" transform="translate(${x2} ${y2}) rotate(${(ang * 180) / Math.PI})"/>`;
    });
    (p.nodes || []).forEach((n) => {
      const a = popS(f, n.at, 12); if (!a.o) return;
      const r = n.r || 70, act = n.activeAt != null ? eo(f, n.activeAt, 10) : n.active === false ? 0 : 1;
      const fill = n.fill || KC.blue;
      rec({ kind: "circle", x: n.x - r, y: n.y - r, w: r * 2, h: r * 2, own: "n:" + n.id });
      out += `<g opacity="${a.o}" transform="${scaleAt(n.x, n.y, a.s)}"><circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${KC.soft}" stroke="${fill}" stroke-width="5"/>` +
        `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" opacity="${act}"/>` +
        (n.glyph ? T(n.x, n.y, n.glyph, { size: n.glyphSize || r * 0.62, weight: 700, color: act > 0.5 ? "#fff" : fill, anchor: "middle", base: "central", own: "n:" + n.id }) : "") +
        (n.label ? T(n.x, n.y + r + lg, n.label, { size: n.labelSize || 34, weight: 700, color: KC.navy, anchor: "middle", own: "n:" + n.id }) : "") +
        (n.sub ? T(n.x, n.y + r + lg + sg, n.sub, { size: 26, weight: 500, color: KC.gray, anchor: "middle", own: "n:" + n.id }) : "") + `</g>`;
    });
    return out;
  },
  // 표 + 말하는 행 하이라이트. props: cols[], rows[[...]], colW[], at, rowStagger(4), highlights[{row,at}], rowH(84), accentCol
  table(w, h, p, f) {
    const cols = p.cols || [], rows = p.rows || [], rh = p.rowH || 84, hh = 70;
    const cw = p.colW || cols.map(() => w / Math.max(1, cols.length)), xs = [];
    for (let j = 0, acc = 0; j < cw.length; j++) { xs.push(acc); acc += cw[j]; }
    let out = `<rect width="${w}" height="${hh}" rx="12" fill="${KC.soft}" opacity="${eo(f, p.at, 10)}"/>`;
    cols.forEach((c, j) => { out += T(xs[j] + cw[j] / 2, hh / 2, c, { size: 28, weight: 700, color: KC.gray, anchor: "middle", base: "central", opacity: eo(f, p.at, 10) }); });
    const hl = (p.highlights || []).filter((x) => f >= x.at).pop();
    if (hl) {
      const prev = (p.highlights || []).filter((x) => x.at < hl.at).pop();
      const g = eo(f, hl.at, 10), y0 = prev ? hh + prev.row * rh : hh + hl.row * rh, y = y0 + (hh + hl.row * rh - y0) * g;
      out += `<rect x="-8" y="${y + 4}" width="${w + 16}" height="${rh - 8}" rx="12" fill="${KC.blue}" opacity="${prev ? 1 : g}"/>`;
    }
    rows.forEach((r, i) => {
      const o = eo(f, (p.at || 0) + 6 + i * (p.rowStagger == null ? 4 : p.rowStagger), 10), y = hh + i * rh + rh / 2;
      const on = hl && hl.row === i && eo(f, hl.at, 10) > 0.5;
      out += `<line x1="0" x2="${w}" y1="${hh + (i + 1) * rh}" y2="${hh + (i + 1) * rh}" stroke="${KC.line}" stroke-width="2" opacity="${o}"/>`;
      r.forEach((c, j) => { out += T(xs[j] + cw[j] / 2, y, c, { size: p.cellSize || 32, weight: j === (p.accentCol == null ? -1 : p.accentCol) || on ? 700 : 500, color: on ? "#fff" : j === p.accentCol ? KC.blue : KC.navy, anchor: "middle", base: "central", opacity: o }); });
    });
    return out;
  },
  // 키워드 카드 공개. props: cards[{num,title,sub,at,icon}], gap(36), accent, focus{index,at}, pad(36), align("auto"|"left"|"center"), titleSize(52), subSize(28)
  //   제목·부제는 카드 안쪽 여백(pad) 안에 들어가게 자동으로 줄인다(최소 30/20). 카드가 좁으면(<340px) 번호·제목을 가운데로 — 2026-11-18 사용자: '대체 Co-GP' 간격
  cards(w, h, p, f) {
    const cs = p.cards || [], n = Math.max(1, cs.length), gap = p.gap || 36, cw = (w - gap * (n - 1)) / n;
    const center = p.align === "center" || ((p.align || "auto") === "auto" && cw < 340);
    const pad = Math.min(p.pad == null ? KIT_PARAMS.cards.pad : p.pad, Math.max(24, Math.round(cw * 0.12)));
    const room = cw - pad * 2;
    // 글자 맞추기: 한 줄로 들어가는 크기 → 최소 크기보다 작아지면 띄어쓰기에서 두 줄로 나눠 다시 맞춘다
    const sizeFor = (t, want) => Math.min(want, Math.floor(room / Math.max(0.01, measureText(t, 1).w)));
    const split2 = (t) => {
      if (!t || t.includes("\n")) return t;
      const ws = t.split(" "); if (ws.length < 2) return t;
      let best = t, bw = 1e9;
      for (let k = 1; k < ws.length; k++) { const c = ws.slice(0, k).join(" ") + "\n" + ws.slice(k).join(" "), mw = measureText(c, 1).w; if (mw < bw) { bw = mw; best = c; } }
      return best;
    };
    const layoutText = (t, want, min) => {
      if (!t) return { t, size: want };
      const one = sizeFor(t, want);
      if (one >= min) return { t, size: one };
      const two = split2(t), s2 = sizeFor(two, want);
      return s2 > one ? { t: two, size: Math.max(min * 0.8, s2) } : { t, size: Math.max(min * 0.8, one) };
    };
    // 한 화면의 카드 제목·부제는 같은 크기로(가장 빡빡한 카드 기준) → 들쭉날쭉하지 않게
    const tl = cs.map((c) => layoutText(c.title, p.titleSize || 52, 36)), sl = cs.map((c) => layoutText(c.sub, p.subSize || 28, 22));
    const tsz = Math.min(...tl.map((x) => x.size)), ssz = Math.min(...sl.map((x) => x.size));
    const form = (x, size) => (x.t && x.t.includes("\n") && sizeFor(x.t.replace("\n", " "), size) >= size ? x.t.replace("\n", " ") : x.t);
    // focus: {index,at} 하나 또는 [{index,at}, …] — 말하는 카드만 밝고 나머지는 흐림. index:null이면 모두 밝게
    const fl = [].concat(p.focus || []).filter((x) => x && f >= x.at).sort((a, b) => a.at - b.at);
    const cur = fl[fl.length - 1], prev = fl[fl.length - 2];
    const fo = cur ? eo(f, cur.at, 12) : 0;
    const dimOf = (i) => {
      if (!cur || cur.index == null) return prev && prev.index != null && i !== prev.index ? 1 - 0.65 * (1 - fo) : 1;
      const now = i === cur.index ? 1 : 0.35, was = !prev || prev.index == null || i === prev.index ? 1 : 0.35;
      return was + (now - was) * fo;
    };
    return cs.map((c, i) => {
      const at = c.at || 0, flip = (p.flip == null ? KIT_PARAMS.cards.flip : p.flip) ? 1 : 0;
      const g = flip ? eo(f, at, 22) : eo(f, at, 14); if (g <= 0) return "";
      const x = i * (cw + gap), dim = dimOf(i), own = "card" + i, col = c.color || p.accent || KC.blue;
      // 뒤집기: 카드 뒷면(색 면 + 번호)이 보이다가 가로로 돌아 앞면이 나온다 (SVG에는 3D가 없어 가로 배율로 표현)
      const th = flip ? 180 * (1 - g) : 0, sx = Math.max(0.02, Math.abs(Math.cos((th * Math.PI) / 180))), cxm = x + cw / 2;
      if (flip && th > 90) {
        return `<g opacity="${clamp(g * 4) * dim}" transform="translate(${cxm} 0) scale(${sx} 1) translate(${-cxm} 0)"><rect x="${x}" y="0" width="${cw}" height="${h}" rx="22" fill="${col}"/>` +
          (c.num ? Tsvg(cxm, h / 2, c.num, { size: Math.min(96, cw * 0.4), weight: 700, color: "#fff", anchor: "middle", base: "central" }) : "") + `</g>`;
      }
      const flipTr = flip && th > 0 ? `translate(${cxm} 0) scale(${sx} 1) translate(${-cxm} 0)` : `translate(0 ${(1 - g) * 50})`;
      const tx = center ? x + cw / 2 : x + pad, anchor = center ? "middle" : "start";
      const title = form(tl[i], tsz), sub = form(sl[i], ssz), tLines = String(title || "").split("\n").length;
      const ty = h * 0.58 - (tLines - 1) * tsz * 1.2 / 2;
      rec({ kind: "frame", x, y: 0, w: cw, h, pad, own });
      return `<g opacity="${(flip ? 1 : g) * dim}" transform="${flipTr}"><rect x="${x}" y="0" width="${cw}" height="${h}" rx="22" fill="#fff" stroke="${KC.line}" stroke-width="2"/>` +
        `<rect x="${x}" y="0" width="${cw}" height="10" rx="5" fill="${col}"/>` +
        (c.num ? T(center ? x + cw / 2 : x + cw - pad, 84, c.num, { size: 52, weight: 700, color: col, anchor: center ? "middle" : "end", opacity: 0.85, own }) : "") +
        (c.icon && !center ? T(x + pad, 96, c.icon, { size: 60, weight: 700, color: col, own }) : "") +
        T(tx, ty, title, { size: tsz, weight: 700, color: KC.navy, anchor, lh: 1.2, own }) +
        (c.sub ? T(tx, ty + (tLines - 1) * tsz * 1.2 + tsz * 0.6 + 40, sub, { size: ssz, weight: 500, color: KC.gray, lh: 1.4, anchor, own }) : "") + `</g>`;
    }).join("");
  },
  // 성장 화살표 draw. props: x1,y1,x2,y2(요소 안 좌표, 기본 왼아래→오른위), at, dur(16), color, width(10), label
  arrow(w, h, p, f) {
    const x1 = p.x1 != null ? p.x1 : 20, y1 = p.y1 != null ? p.y1 : h - 20, x2 = p.x2 != null ? p.x2 : w - 40, y2 = p.y2 != null ? p.y2 : 40;
    const g = eo(f, p.at, p.dur || 16); if (g <= 0) return "";
    const xe = x1 + (x2 - x1) * g, ye = y1 + (y2 - y1) * g, ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, col = p.color || KC.blue, wd = p.width || 10;
    rec({ kind: "line", x1, y1, x2: xe, y2: ye, wd, own: p.own });
    let out = `<line x1="${x1}" y1="${y1}" x2="${xe}" y2="${ye}" stroke="${col}" stroke-width="${wd}" stroke-linecap="round"/>` +
      `<polygon points="0,${-wd * 2} ${wd * 3.4},0 0,${wd * 2}" fill="${col}" transform="translate(${xe} ${ye}) rotate(${ang})"/>`;
    if (p.label) { const a = popS(f, (p.at || 0) + (p.dur || 16), 12); out += `<g opacity="${a.o}">` + T(p.labelX != null ? p.labelX : (x1 + x2) / 2, p.labelY != null ? p.labelY : Math.min(y1, y2) - 20, p.label, { size: p.labelSize || 44, weight: 700, color: col, anchor: "middle", own: p.own }) + `</g>`; }
    return out;
  },
  // 챕터 간지 (화면 가득). props: num("01"), title, sub, at, onBlue(true면 파란 면)
  chapter(w, h, p, f) {
    const at = p.at || 0, blue = !!p.onBlue, fg = blue ? "#fff" : KC.blue, tc = blue ? "#fff" : KC.navy;
    let out = blue ? `<rect width="${w}" height="${h}" fill="${KC.blue}" opacity="${eo(f, at, 8)}"/>` : "";
    const a = popS(f, at, 14);
    if (p.num) out += `<g opacity="${a.o}" transform="${scaleAt(w / 2, h / 2 - 90, a.s)}">` + T(w / 2, h / 2 - 40, p.num, { size: p.numSize || 200, weight: 700, color: fg, anchor: "middle", ls: -4 }) + `</g>`;
    if (p.title) out += T(w / 2, h / 2 + (p.num ? 110 : 30), p.title, { size: p.titleSize || 84, weight: 700, color: tc, anchor: "middle", opacity: eo(f, at + 8, 14), ls: -1 });
    if (p.sub) out += T(w / 2, h / 2 + (p.num ? 190 : 110), p.sub, { size: 36, weight: 500, color: blue ? "rgba(255,255,255,.8)" : KC.gray, anchor: "middle", opacity: eo(f, at + 16, 14) });
    return out;
  },
};

// 배치 검사: diagram 하나가 그리는 글자·선·도형의 화면 좌표 목록 (요소 x·y 만큼 옮김)
export function collectDiagram(el, lf) {
  COLLECT = [];
  try { diagramSVG(el, lf); } finally { /* keep */ }
  const out = COLLECT.map((p) => p.kind === "line" ? Object.assign({}, p, { x1: p.x1 + el.x, x2: p.x2 + el.x, y1: p.y1 + el.y, y2: p.y2 + el.y })
    : Object.assign({}, p, { x: p.x + el.x, y: p.y + el.y }));
  COLLECT = null;
  return out;
}

// diagram 요소 → SVG 문자열. lf = 요소 등장부터 센 프레임 (편집 모드는 큰 값을 넘겨 최종 상태를 본다)
export function diagramSVG(el, lf) {
  const w = el.w, h = el.h, fn = KIT[el.kind];
  SVG_ID = "d" + String(el.id || el.kind || "x").replace(/[^A-Za-z0-9_-]/g, "");
  IMG_N = 0;
  const body = fn ? fn(w, h, el.props || {}, lf) : T(w / 2, h / 2, "알 수 없는 diagram kind: " + el.kind, { size: 32, color: KC.coral, anchor: "middle" });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" style="overflow:visible;display:block">${body}</svg>`;
}

// b-roll 카메라 움직임 (실사·자리표시 공통). props.camera: {zoomFrom:1, zoomTo:1.08, panX:0, panY:0, rotate:0}
export function brollCamera(el, lf, span) {
  const c = (el.props && el.props.camera) || { zoomFrom: 1, zoomTo: 1.06 };
  const t = clamp(lf / Math.max(1, span));
  const s = (c.zoomFrom == null ? 1 : c.zoomFrom) + ((c.zoomTo == null ? 1.06 : c.zoomTo) - (c.zoomFrom == null ? 1 : c.zoomFrom)) * t;
  const rot = (c.rotate || 0) * t, th = Math.abs((rot * Math.PI) / 180), w = el.w || 1920, hh = el.h || 1080;
  // 회전해도 모서리가 비지 않게 덮는 배율 + 팬 이동만큼 여유
  const cover = Math.max(Math.cos(th) + (hh / w) * Math.sin(th), Math.cos(th) + (w / hh) * Math.sin(th));
  const tx = (c.panX || 0) * t, ty = (c.panY || 0) * t, pan = 1 + 2 * Math.max(Math.abs(tx) / w, Math.abs(ty) / hh);
  return { scale: s * cover * pan, tx, ty, rotate: rot };
}

// 실사 영상이 아직 없을 때의 자리표시 (초안·최종 모두 표시 → 기획이 화면에서 보인다)
export function brollSVG(el, lf, span) {
  const w = el.w, h = el.h, cam = brollCamera(el, lf, span), id = "bg" + Math.round(w) + "x" + Math.round(h);
  const lines = [];
  for (let x = -h; x < w; x += 90) lines.push(`<line x1="${x}" y1="${h}" x2="${x + h}" y2="0" stroke="#fff" stroke-opacity="0.05" stroke-width="2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2f5c"/><stop offset="1" stop-color="#0a1530"/></linearGradient></defs>` +
    `<g transform="translate(${w / 2 + cam.tx} ${h / 2 + cam.ty}) rotate(${cam.rotate}) scale(${cam.scale}) translate(${-w / 2} ${-h / 2})"><rect width="${w}" height="${h}" fill="url(#${id})"/>${lines.join("")}</g>` +
    `<rect x="48" y="44" width="250" height="52" rx="26" fill="#fff" fill-opacity="0.14"/>` +
    T(173, 70, "B-ROLL 자리", { size: 26, weight: 700, color: "#fff", anchor: "middle", base: "central" }) +
    T(w / 2, h - 150, el.slot || "(장면 묘사 없음)", { size: 34, weight: 600, color: "rgba(255,255,255,.78)", anchor: "middle" }) +
    (el.query ? T(w / 2, h - 100, "검색어: " + el.query, { size: 24, weight: 500, color: "rgba(255,255,255,.5)", anchor: "middle" }) : "") +
    `</svg>`;
}
