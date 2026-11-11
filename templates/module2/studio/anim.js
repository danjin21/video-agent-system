// 모듈2 렌더 의미론 (정본)
// 스튜디오 미리보기와 Remotion 섹션 컴포넌트가 이 파일 하나를 같이 쓴다.
// 순수 함수만 둔다 (DOM·React 의존 없음). 단위: 좌표 px(1920×1080), 시간 frame.

export const ENTER_EFFECTS = {
  none: "없음", fade: "페이드", "fade-up": "아래에서 떠오름", "fade-down": "위에서 내려옴",
  "slide-left": "오른쪽에서 밀려옴", "slide-right": "왼쪽에서 밀려옴", "scale-in": "확대되며 등장",
  pop: "팝(커졌다 작아짐)", "wipe-right": "왼→오 닦아내기", typewriter: "타자기", "count-up": "숫자 카운트업",
};
export const EXIT_EFFECTS = {
  none: "없음(컷)", fade: "서서히 사라짐", "fade-up": "위로 사라짐", "fade-down": "아래로 사라짐",
  "slide-left": "왼쪽으로 밀려남", "slide-right": "오른쪽으로 밀려남", "scale-out": "축소되며 사라짐", "wipe-left": "왼→오 지워짐",
};
export const EMPHASIS = { pulse: "펄스", highlight: "하이라이트" };

const TIMING_KEYS = ["in", "out", "enter", "enterDur", "exit", "exitDur", "emphasis", "beat"];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

// layout 요소 + timeline 요소 + edits 덮어쓰기 → 병합된 요소 목록
export function mergeSection(layout, timeline, edits) {
  const canvas = Object.assign({ w: 1920, h: 1080, bg: "#ffffff" }, (layout && layout.canvas) || {});
  const fps = (timeline && timeline.fps) || 30;
  const duration = (timeline && timeline.duration) || 150;
  const tl = (timeline && timeline.elements) || {};
  const ed = (edits && edits.elements) || {};
  const base = ((layout && layout.elements) || []).slice();
  for (const [id, e] of Object.entries(ed)) {
    if (e && e._new && !base.find((b) => b.id === id)) base.push(Object.assign({ id }, e));
  }
  const out = [];
  for (const b of base) {
    const e = ed[b.id] || {};
    if (e._deleted) continue;
    const m = Object.assign({}, b);
    for (const [k, v] of Object.entries(e)) {
      if (k === "font" || TIMING_KEYS.includes(k) || k.startsWith("_")) continue;
      m[k] = v;
    }
    m.font = Object.assign({}, b.font || {}, e.font || {});
    const t0 = tl[b.id] || {};
    const t = {
      in: 0, out: duration, enter: "fade", enterDur: 12, exit: "none", exitDur: 12, emphasis: [],
    };
    for (const k of TIMING_KEYS) {
      if (t0[k] !== undefined) t[k] = t0[k];
      if (b[k] !== undefined && b._new) t[k] = b[k];
      if (e[k] !== undefined) t[k] = e[k];
    }
    m.t = t;
    m._edited = Object.keys(e).length > 0 && !e._new;
    m._new = !!e._new;
    out.push(m);
  }
  out.sort((a, b) => (a.z || 0) - (b.z || 0));
  return { canvas, fps, duration, elements: out };
}

// frame 시점 요소 상태
export function stateAt(el, f) {
  const t = el.t;
  const st = { visible: false, opacity: 0, tx: 0, ty: 0, scale: 1, clipL: 0, clipR: 0, text: 1, count: 1, highlight: 0 };
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
  for (const em of t.emphasis || []) {
    const dur = em.dur || 20;
    const p = (f - em.at) / dur;
    if (p < 0 || p > 1) continue;
    const s = Math.sin(Math.PI * p);
    if (em.type === "pulse") st.scale *= 1 + 0.06 * s;
    if (em.type === "highlight") st.highlight = Math.max(st.highlight, s);
  }
  return st;
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
