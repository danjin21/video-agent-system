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
export const EMPHASIS = { zoom: "한 번 확대", pulse: "펄스", bounce: "통통 튐", lift: "살짝 들림", shake: "흔들림", wiggle: "갸웃", echo: "메아리 흔들림", highlight: "하이라이트(빛 테두리)" };

const TIMING_KEYS = ["in", "out", "enter", "enterDur", "exit", "exitDur", "emphasis", "beat"];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // 천천히-빠르게-천천히 (카메라 전환)
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
export const KIT_PARAMS = { nodes: { labelGap: 66, subGap: 64, linkColor: "#8a94a6", linkDash: 1, linkFlow: 1.2, arrowGap: 10, flipDur: 16, labelMin: 40, labelWeight: 800, iconColor: 1 }, cards: { pad: 36, flip: 1 }, line: { curve: 1 }, stat: { deltaScale: 0.3, deltaMin: 48, deltaWeight: 800 },
  bars3d: { rx: -22, ry: -32, zoom: 0.8, depth: 0.8, perspective: 3600 }, cards3d: { mode: "fold", fold: 18, foldZoom: 0.9, rx: 16, ry: -20, zoom: 0.86, perspective: 3600 },
  wordSwarm: { count: 100, size: 120 }, globe: { radius: 0.4 } };
const KIT_PARAM_DEFAULTS = JSON.parse(JSON.stringify(KIT_PARAMS));
export function applyKitTheme(theme) {
  const c = (theme && theme.colors) || {};
  for (const k of Object.keys(KIT_COLORS)) if (c[k]) KIT_COLORS[k] = c[k];
  const comps = (theme && theme.components) || {};
  for (const k of Object.keys(KIT_PARAMS)) KIT_PARAMS[k] = Object.assign({}, KIT_PARAM_DEFAULTS[k], (comps[k] && comps[k].params) || {});
  const fam = theme && theme.font && theme.font.family;
  FONT = fam && fam !== "Pretendard" ? `'${fam}', Pretendard, sans-serif` : "Pretendard, sans-serif";
  const th = (theme && theme.textHighlight) || {};
  setTextHighlightDefault(Object.assign({}, th, th.color && th.color[0] === "$" ? { color: c[th.color.slice(1)] || th.color } : {}));
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
    if (Array.isArray(m.hl)) m.hl = m.hl.map((x) => Object.assign({}, x, typeof x.color === "string" && x.color[0] === "$" ? { color: colors[x.color.slice(1)] || x.color } : {}));
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
// stackBuild center:true — 시선은 항상 화면 가운데 (2026-11-20 사용자).
// 첫 블록이 가운데 높이에 놓이고, 다음 블록은 위에서 내려와 그 위에 얹히면서 더미 전체가 한 칸씩 내려가 새 블록이 늘 가운데.
// mapAt에 더미가 아래로 빠지고 미국 지도가 가운데에 나타나 왼쪽부터 파랗게 물든다. cy(요소 안 가운데 높이, 기본 h/2)
function stackCenter(w, h, p, f) {
  const bs = p.blocks || [], col = p.color || KC.blue;
  const bw = Math.min(620, w * 0.4), bh = 96, gap = 8, dx = 60, dy = 34, cx = w / 2, cy = p.cy != null ? p.cy : h / 2;
  const mapAt = p.mapAt != null ? p.mapAt : (bs.length ? (bs[bs.length - 1].at || 0) + 60 : 60);
  const land = bs.map((b) => eio(lin(f, b.at || 0, 20)));
  const K = land.reduce((a, x) => a + x, 0);
  const out_ = eio(lin(f, mapAt - 10, 30));          // 지도 나올 때 더미가 아래로 빠짐
  const shades = [col, shade(col, -0.15), mixHex(col, "#ffffff", 0.25)];
  let out = `<g transform="translate(0 ${(out_ * (h + 200)).toFixed(1)})" opacity="${(1 - out_).toFixed(3)}">`;
  bs.forEach((b, i) => {
    const d = land[i]; if (d <= 0) return;
    const y = cy - bh / 2 + (K - 1 - i) * (bh + gap) - (1 - d) * 360, x = cx - bw / 2, c = shades[i % 3];
    out += `<g opacity="${clamp(d * 3).toFixed(3)}">` +
      `<path d="M ${x + bw} ${y} L ${x + bw + dx} ${y - dy} L ${x + bw + dx} ${y + bh - dy} L ${x + bw} ${y + bh} Z" fill="${shade(c, -0.25)}"/>` +
      `<path d="M ${x} ${y} L ${x + dx} ${y - dy} L ${x + bw + dx} ${y - dy} L ${x + bw} ${y} Z" fill="${shade(c, 0.28)}"/>` +
      `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${c}"/>` +
      badgeIcon(b.icon, x + 58, y + bh / 2, 66, 0, c, b.img) +
      Tsvg(x + 110, y + bh / 2, b.label || "", { size: 42, weight: 800, color: "#fff", base: "central" }) + `</g>`;
    if (d >= 1) rec({ kind: "rect", x, y, w: bw, h: bh, own: "blk" + i });
    // money:true — 양옆에서 지폐가 날아와 블록으로 빨려 들어간다 (손익 기반, 2026-11-20 사용자)
    if (b.money) {
      const at = b.at || 0, ty = cy - bh / 2 + (K - 1 - i) * (bh + gap) + bh / 2;
      for (let k = 0; k < 10; k++) {
        const left = k % 2 === 0, t0 = at - 18 + k * 3, q = eio(lin(f, t0, 22)), vis = clamp(lin(f, t0, 4)) * (1 - clamp(lin(f, t0 + 20, 6)));
        if (vis <= 0) continue;
        const sx = left ? -260 - (k % 3) * 70 : w + 260 + (k % 3) * 70, sy = ty + ((k % 5) - 2) * 70;
        const bx = sx + (cx + (left ? -bw * 0.25 : bw * 0.25) - sx) * q, by = sy + (ty - sy) * q, rot = (left ? 1 : -1) * (30 - 30 * q) + ((k % 3) - 1) * 8;
        out += `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${rot.toFixed(1)})" opacity="${vis.toFixed(2)}">` +
          `<rect x="-46" y="-25" width="92" height="50" rx="6" fill="${IC.green}" stroke="#1f7a4d" stroke-width="3"/>` +
          `<circle r="12" fill="none" stroke="#ffffff" stroke-width="4"/><circle cx="-31" r="4" fill="#ffffff"/><circle cx="31" r="4" fill="#ffffff"/></g>`;
      }
    }
  });
  out += `</g>`;
  const ma = eo(f, mapAt, 20);
  if (ma > 0) {
    const mw = w * 0.42, mh = mw * 0.6, mx = (w - mw) / 2, my = cy - mh / 2 + 10;   // 가운데, 위 머리말과 안 겹치게
    const dd = US_PATH.map(([lo, la], k) => `${k ? "L" : "M"} ${(mx + ((lo + 125) / 58) * mw).toFixed(1)} ${(my + ((49.5 - la) / 25.5) * mh).toFixed(1)}`).join(" ") + " Z";
    const fill = eio(lin(f, mapAt + 20, 50)), id = SVG_ID + "usc";
    out += `<defs><clipPath id="${id}"><rect x="${mx - 10}" y="${my - 10}" width="${(mw + 20) * fill}" height="${mh + 20}"/></clipPath></defs>` +
      `<g opacity="${ma}"><path d="${dd}" fill="#fff" stroke="${col}" stroke-width="5" stroke-linejoin="round"/><path d="${dd}" fill="${col}" clip-path="url(#${id})"/></g>`;
    if (p.mapLabel) out += T(w / 2, my + mh + 64, p.mapLabel, { size: 50, weight: 800, color: col, anchor: "middle", opacity: eo(f, mapAt + 40, 14) });
    // flag:true — 지도 우측 상단에 성조기 원 (2026-11-20 사용자)
    if (p.flag) {
      const fa = eo(f, mapAt + 30, 14), R = 64, fx = mx + mw + 10, fy = my + 6, fid = SVG_ID + "usflag";
      if (fa > 0) {
        let st = "";
        for (let s = 0; s < 13; s++) st += `<rect x="${fx - R}" y="${(fy - R + (s * 2 * R) / 13).toFixed(1)}" width="${2 * R}" height="${((2 * R) / 13 + 0.5).toFixed(1)}" fill="${s % 2 ? "#ffffff" : "#b22234"}"/>`;
        let stars = "";
        for (let r_ = 0; r_ < 4; r_++) for (let c_ = 0; c_ < 5; c_++) stars += `<circle cx="${(fx - R + 10 + c_ * 12 + (r_ % 2) * 6).toFixed(1)}" cy="${(fy - R + 12 + r_ * 13).toFixed(1)}" r="2.6" fill="#ffffff"/>`;
        out += `<defs><clipPath id="${fid}"><circle cx="${fx}" cy="${fy}" r="${R}"/></clipPath></defs>` +
          `<g opacity="${fa}"><g clip-path="url(#${fid})">${st}<rect x="${fx - R}" y="${fy - R}" width="${R * 1.15}" height="${(2 * R * 7) / 13}" fill="#3c3b6e"/>${stars}</g>` +
          `<circle cx="${fx}" cy="${fy}" r="${R}" fill="none" stroke="#ffffff" stroke-width="6"/><circle cx="${fx}" cy="${fy}" r="${R + 3}" fill="none" stroke="${KC.line}" stroke-width="2"/></g>`;
      }
    }
  }
  return out;
}
// nodes 노드 단계 확대: grow{at, steps:3, to:1.4, every:16, dur:10} — 톡·톡·톡 세 번에 걸쳐 커진 뒤 그 크기로 머문다
// (2026-11-20 사용자: 개인투자자 비중이 커지는 느낌으로 '개인' 원이 1·2·3번 커지게). at은 요소 등장부터 센 프레임
function nodeGrow(n, f) {
  const g = n && n.grow; if (!g) return 1;
  const steps = g.steps || 3, every = g.every || 16, dur = g.dur || 10, to = g.to || 1.4;
  let k = 0, bump = 0;
  for (let i = 0; i < steps; i++) {
    const q = lin(f, (g.at || 0) + i * every, dur);
    k += easeOut(q) / steps;
    bump = Math.max(bump, Math.sin(Math.PI * q) * (q < 1 ? 1 : 0));
  }
  return 1 + (to - 1) * k + 0.05 * bump;
}
const CHART_KINDS = new Set(["line", "bars", "bars3d", "rings", "stackBuild", "stat"]);
export function beatAccents(els, beats, cfg) {
  const c = Object.assign({ enabled: true, types: ["pulse", "lift", "bounce"], delay: 8, dur: 22, window: 24, every: 120 }, cfg || {});
  if (!c.enabled || !beats.length) return;
  const evs = [];
  for (const e of els) { evs.push(e.t.in); for (const m of e.t.emphasis || []) evs.push(m.at); if (e.type === "diagram") evs.push(...kitEventTimes(e)); }
  // 한 요소는 한 번만 강조 (2026-11-20 사용자: "한번 강조하면 한번만. 애니메이션을 몇 번 쓰면 어색해")
  //  — 수동 강조가 있거나 자동 강조를 한 번 받은 요소는 다시 고르지 않는다. once:false 면 예전처럼 반복.
  //  — 그래프(선·막대 등)는 스스로 그려지며 올라가므로 자동 강조 대상에서 뺀다 ("그래프는 그만 확대").
  const once = c.once !== false;
  const done = new Set(els.filter((e) => (e.t.emphasis || []).length || (e.type === "diagram" && CHART_KINDS.has(e.kind))).map((e) => e.id));
  // 점검 지점: 문장 시작 + 긴 문장은 every(기본 120f=4초)마다
  const points = [];
  for (const b of beats) {
    points.push([b.start, c.delay]);
    for (let x = b.start + c.every; x < (b.end || b.start) - 45; x += c.every) points.push([x, 0]);
  }
  points.forEach(([s0, dl], i) => {
    if (evs.some((x) => x >= s0 - 6 && x <= s0 + c.window)) return;       // 이미 이 순간에 뭔가 움직인다
    const at = s0 + dl;
    const vis = els.filter((e) => isAccentTarget(e) && e.t.in <= at && at < e.t.out - c.dur && !(once && done.has(e.id)));
    if (!vis.length) return;
    // 주인공 = 가장 큰 것(diagram > 큰 글자), 같으면 최근에 나온 것
    const score = (e) => (e.type === "diagram" ? 2000 : ((e.font && e.font.size) || 40) * 10) + e.t.in / 100;
    const tgt = vis.sort((a, b) => score(b) - score(a))[0];
    tgt.t.emphasis = (tgt.t.emphasis || []).concat([{ type: c.types[i % c.types.length], at, dur: c.dur, auto: true }]);
    done.add(tgt.id);
    evs.push(at);
  });
}

// frame 시점 요소 상태
export function stateAt(el, f) {
  const t = el.t;
  const st = { visible: false, opacity: 0, tx: 0, ty: 0, scale: 1, rot: 0, ry: 0, clipL: 0, clipR: 0, text: 1, count: 1, highlight: 0, echo: 0 };
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
    if (em.type === "zoom") st.scale *= 1 + (em.amount || 0.08) * s;   // 큰 묶음도 줄이지 않고 한 번 확대 (다 나온 뒤 한 번. 2026-11-20)
    if (em.type === "bounce") st.scale *= 1 + 0.12 * amp * Math.sin(Math.PI * p) * (1 - p) * 1.6;
    if (em.type === "lift") st.ty -= 14 * s;
    if (em.type === "shake") st.tx += 10 * Math.sin(p * Math.PI * 6) * (1 - p);
    if (em.type === "wiggle") st.rot += 3 * Math.sin(p * Math.PI * 4) * (1 - p);
    if (em.type === "echo") {                                   // 메아리: 흔들리면서 잔상이 양옆으로 퍼지며 사라짐
      st.tx += 9 * Math.sin(p * Math.PI * 8) * (1 - p);
      st.scale *= 1 + 0.05 * amp * s;
      // 숫자 카드(stat)는 SVG 안에서 숫자에만 잔상을 그린다(라벨까지 번지지 않게) — ECHO_SELF
      if (!(el.type === "diagram" && ECHO_SELF.has(el.kind)) && s > st.echo) { st.echo = s; st.echoP = p; st.echoColor = em.color || null; }
    }
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

const ECHO_SELF = new Set(["stat"]);
// 요소의 메아리 강조 진행 (diagram 안에서 직접 그리는 종류용): {s:세기 0~1, p:진행 0~1, color} 또는 null
function echoAt(el, f) {
  let best = null;
  for (const em of (el.t && el.t.emphasis) || []) {
    if (em.type !== "echo") continue;
    const p = (f - em.at) / (em.dur || 40);
    if (p < 0 || p > 1) continue;
    const s = Math.sin(Math.PI * p);
    if (!best || s > best.s) best = { s, p, color: em.color };
  }
  return best;
}

// 메아리 강조 잔상 — CSS filter drop-shadow 겹(스튜디오·렌더 공용). 요소 모양 그대로 양옆으로 3겹 퍼지며 옅어진다
export function emphasisFilter(st) {
  if (!st.echo) return "";
  const c = st.echoColor && /^#[0-9a-f]{6}$/i.test(st.echoColor) ? st.echoColor : "#296ef9";
  const rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(",");
  const out = [];
  for (let k = 1; k <= 3; k++) {
    const d = Math.round((10 + 34 * st.echoP) * k), a = (0.42 * st.echo / k).toFixed(3);
    out.push(`drop-shadow(${d}px 0 0 rgba(${rgb},${a}))`, `drop-shadow(${-d}px 0 0 rgba(${rgb},${a}))`);
  }
  return out.join(" ");
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

// ================================================================== 글자 하이라이트 (장표 안 강조 단어)
// 요소 hl: [{text:"어떤 환경", color:"$blue", effect:"shine", at(섹션 프레임), dur}] — at이 없으면 처음부터 강조된 모습.
// 디자인 키트 textHighlight {color, effect, dur} 이 기본값. 스튜디오 인스펙터 '하이라이트 글자'에서 고르고, 디자인 스크립트는 kit.hl().
export const HL_EFFECTS = { sweep: "처음부터 색 + 말할 때 흰 빛 훑기", shine: "색 바뀌며 반짝", color: "색만 바뀜", marker: "형광펜 밑줄", pop: "톡 커졌다 제자리", glow: "빛 번짐" };
const HL_DEFAULT = { color: "#296ef9", effect: "color", dur: 18 };   // 기본은 색만 바뀜 (2026-11-19 사용자)
function hexRgb(c) {
  if (/^#[0-9a-f]{3}$/i.test(c)) c = "#" + c.slice(1).split("").map((x) => x + x).join("");
  return /^#[0-9a-f]{6}$/i.test(c || "") ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null;
}
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  if (!A || !B) return t < 0.5 ? a : b;
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const hesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/\n/g, "<br>");
// 글자 요소 → HTML (스튜디오·렌더 공용). [[강조]]와 hl을 함께 처리. f = 섹션 프레임
export function textHTML(el, st, f) {
  const font = el.font || {}, base = font.color || KC.navy, accent = font.accentColor || KC.blue;
  const segs = richSegments(el.text || "", st);          // 타자기·카운트업 반영
  const plain = segs.map((s) => s.text).join("");
  // 글자 단위 표시: 0 = 보통, -1 = [[강조]], k+1 = hl[k]
  const mark = new Array(plain.length).fill(0);
  let pos = 0;
  segs.forEach((s) => { if (s.accent) for (let i = 0; i < s.text.length; i++) mark[pos + i] = -1; pos += s.text.length; });
  const hls = (el.hl || []).map((x) => Object.assign({}, HL_DEFAULT, x));
  hls.forEach((x, k) => {
    if (!x.text) return;
    const i = plain.indexOf(x.text);
    if (i >= 0) for (let j = i; j < i + x.text.length; j++) mark[j] = k + 1;
  });
  let out = "", i = 0;
  while (i < plain.length) {
    let j = i; while (j < plain.length && mark[j] === mark[i]) j++;
    const txt = plain.slice(i, j), m = mark[i];
    if (m === 0) out += hesc(txt);
    else if (m === -1) out += `<span style="color:${accent}">${hesc(txt)}</span>`;
    else out += hlSpan(txt, hls[m - 1], base, f);
    i = j;
  }
  return out;
}
function hlSpan(txt, x, base, f) {
  const to = x.color && x.color[0] === "$" ? KC[x.color.slice(1)] || HL_DEFAULT.color : x.color || HL_DEFAULT.color;
  const dur = x.dur || 18, p = x.at == null || x.effect === "sweep" ? 1 : easeOut(lin(f, x.at, dur));
  const col = mixHex(base, to, p), rgb = (hexRgb(to) || [41, 110, 249]).join(",");
  let css = `color:${col};`;
  if (x.effect === "sweep") {                      // 처음부터 강조색. 말하는 순간(at) 흰 빛줄기가 왼→오로 한 번 훑고 지나간다 (2026-11-20 사용자)
    const q = x.at == null ? -1 : lin(f, x.at, 26);
    if (q > 0 && q < 1) {
      const c = Math.round(-25 + 150 * easeOut(q));
      // 흰 선만 지나간다 — 파란 번짐(blur) 없음 (2026-11-20 사용자: "블러 효과 내지 마, 색만 바꾸고 흰 선만")
      css = `color:transparent;-webkit-text-fill-color:transparent;background:linear-gradient(100deg, ${col} 0%, ${col} ${c - 8}%, #ffffff ${c - 2}%, #ffffff ${c + 2}%, ${col} ${c + 8}%, ${col} 100%);-webkit-background-clip:text;background-clip:text;`;
    }
  } else if (x.effect === "shine" && x.at != null) {      // 색이 바뀐 뒤 빛줄기가 왼→오로 한 번 지나간다
    const q = lin(f, x.at + dur * 0.5, 22);
    if (q > 0 && q < 1) {
      const c = Math.round(-20 + 140 * q);
      css = `color:transparent;-webkit-text-fill-color:transparent;background:linear-gradient(100deg, ${col} 0%, ${col} ${c - 14}%, #ffffff ${c}%, ${col} ${c + 14}%, ${col} 100%);-webkit-background-clip:text;background-clip:text;`;
    }
    // 빛 번짐(blur) 없음 — 2026-11-20 사용자: "블러로 된 것(빛나는 파란색)은 다 빼"
  } else if (x.effect === "marker") {              // 형광펜이 왼→오로 칠해진다
    css += `background:linear-gradient(transparent 60%, rgba(${rgb},0.22) 60%) no-repeat;background-size:${(p * 100).toFixed(1)}% 100%;`;
  } else if (x.effect === "pop") {
    const q = x.at == null ? 1 : lin(f, x.at, 16);
    css += `display:inline-block;transform:scale(${(1 + 0.14 * Math.sin(Math.PI * q) * (q < 1 ? 1 : 0)).toFixed(3)});`;
  }   // glow(빛 번짐)는 2026-11-20 사용자 요청으로 없앰 → 색만 바뀜
  return `<span style="${css}">${hesc(txt)}</span>`;
}
// 부품 안 글자의 단어 하이라이트 (cards3d 부제 등): hls [{text, at(요소 안 프레임), color, effect}] — 기본 sweep(처음부터 색 + 말할 때 흰 선)
function hlText(text, hls, base, f) {
  const items = (hls || []).map((x) => Object.assign({ color: "$blue", effect: "sweep", dur: 18 }, typeof x === "string" ? { text: x } : x));
  if (!items.length) return hesc(text);
  const mark = new Array(text.length).fill(0);
  items.forEach((x, k) => { const i = text.indexOf(x.text); if (i >= 0) for (let j = i; j < i + x.text.length; j++) mark[j] = k + 1; });
  let out = "", i = 0;
  while (i < text.length) {
    let j = i; while (j < text.length && mark[j] === mark[i]) j++;
    const t = text.slice(i, j);
    out += mark[i] ? hlSpan(t, items[mark[i] - 1], base, f) : hesc(t);
    i = j;
  }
  return out;
}
export function setTextHighlightDefault(o) { Object.assign(HL_DEFAULT, o || {}); }

// ================================================================== 연출 키트 (diagram · broll)
// 요소 type "diagram"(kind + props) / "broll"(slot 묘사 + src). 이 파일 하나로 스튜디오 미리보기와
// Remotion 렌더가 같은 SVG를 그린다 → 미리보기 = 렌더. props 안의 모든 at/dur는 "요소 등장(in)부터 센 프레임".
// 사용법·props: templates/module2/remotion/DIRECTION_KIT.md

// 3D 지구용 거친 대륙 윤곽 [lon,lat] — 실제 지도 데이터(global_assets/geo/world_land.json)가 없을 때만 쓰는 임시 윤곽. 한반도는 조금 더 자세히.
const WORLD_COARSE = [
  [[-168,66],[-160,71],[-140,70],[-128,70],[-115,68],[-95,72],[-82,73],[-78,63],[-94,60],[-90,57],[-80,52],[-65,60],[-60,55],[-55,50],[-66,45],[-70,42],[-76,38],[-76,35],[-81,31],[-80,25],[-83,29],[-90,30],[-97,27],[-97,22],[-92,18],[-87,21],[-88,16],[-83,10],[-79,9],[-81,8],[-86,12],[-92,14],[-100,17],[-106,23],[-112,29],[-110,23],[-115,30],[-118,34],[-123,38],[-124,42],[-124,48],[-130,54],[-138,59],[-148,61],[-155,59],[-162,55],[-158,58],[-165,62]],
  [[-80,9],[-77,8],[-72,12],[-62,11],[-52,5],[-50,0],[-44,-2],[-35,-5],[-35,-9],[-39,-14],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-62,-41],[-65,-45],[-68,-50],[-69,-55],[-73,-53],[-75,-47],[-73,-40],[-71,-30],[-70,-18],[-76,-14],[-81,-6],[-80,-2],[-78,2],[-77,7]],
  [[-17,21],[-16,15],[-17,12],[-13,8],[-8,4],[-3,5],[5,6],[9,4],[9,-1],[12,-6],[13,-12],[12,-17],[15,-27],[18,-34],[20,-35],[26,-34],[32,-29],[35,-24],[35,-19],[40,-15],[40,-10],[39,-5],[42,0],[48,5],[51,11],[44,11],[43,13],[39,16],[37,22],[35,27],[33,31],[29,31],[20,32],[19,30],[10,34],[10,37],[3,37],[-2,35],[-6,36],[-10,30],[-13,28]],
  [[-10,36],[-9,43],[-2,44],[-4,48],[2,51],[8,54],[10,57],[5,58],[5,62],[14,67],[20,70],[28,71],[40,67],[44,68],[55,69],[68,70],[73,72],[80,73],[90,75],[104,78],[113,74],[130,72],[140,72],[150,71],[160,70],[170,70],[180,69],[180,65],[173,61],[163,60],[160,54],[156,51],[155,57],[143,59],[137,54],[141,52],[140.5,48.5],[138,46],[135.5,43.7],[132.4,43.2],[131,42.7],[130.6,42.4],[129.7,41.5],[129.7,40.9],[128.6,40.3],[127.5,39.7],[127.5,39.3],[128.4,38.6],[129.4,37],[129.5,35.9],[129.3,35.2],[128.6,35],[127.5,34.6],[126.4,34.4],[126.3,35.1],[126.6,35.9],[126.8,36.6],[126.2,36.9],[126.6,37.6],[125.6,37.8],[125.1,38.5],[125.3,39.5],[124.4,39.9],[122.3,40.5],[121,40.9],[119.3,39.4],[117.7,38.9],[118.8,37.4],[120.7,37.8],[122.5,37.2],[120.3,36],[119.2,34.8],[120.6,33.3],[121.9,31.7],[121.9,29.9],[121.3,28.2],[119.6,25.8],[118.1,24.5],[116.5,22.9],[114.2,22.3],[111,21.5],[110.4,20.4],[109.7,21.5],[108,21.6],[106.7,20.7],[105.8,19],[106.6,17.4],[108.8,15.4],[109.2,12],[107,10.5],[105,8.6],[103,10.5],[100,13.5],[99.5,9],[101,6.5],[103.5,1.3],[101,3],[98,8],[98.5,13],[97.5,17],[94,17],[94,21],[92,22.5],[89,21.8],[86.5,20],[80,15],[80,10],[77.5,8],[76,10],[73,17],[72.7,21],[69,22.5],[67,24.8],[61.5,25.2],[57,25.7],[56.3,26.5],[52,27.8],[50,30],[48,30],[48.5,28],[51.5,24],[56,26],[59.8,22.4],[57.5,19],[55,17],[52,16],[45,13],[43,13],[39,21],[35,28],[34.5,29.5],[34,31],[35,33],[36,36],[30,36.5],[27,37],[26,39.5],[26,40.8],[23,40],[23.5,38],[21,37],[20,39.8],[19,42],[13.5,45.5],[12.4,44.2],[16,41],[18.5,40],[16,38],[15.5,40],[12,42],[10,44],[7,43.6],[3.2,43],[3,41.8],[0.5,40.8],[-0.3,38.6],[-2,36.8],[-5.5,36],[-9,37]],
  [[130,31],[131.5,31.5],[132,33.8],[135,33.5],[136.9,34.5],[139.8,35],[140.9,36.9],[141,38.3],[142,39.6],[141.4,41.4],[140,40.5],[139.8,39],[138.5,37.8],[136.9,37],[136,35.7],[133,35.5],[131,34.4],[129.6,33.3]],
  [[140,41.5],[141.2,41.8],[143.3,42],[145.5,43.3],[144.4,44.1],[141.9,45.5],[141.6,44.4],[140.4,43.3],[139.8,42.5]],
  [[142,46],[143.5,46.8],[143,49],[144.5,49],[142.8,54.3],[142,51.5]],
  [[-5.7,50],[1.4,51.2],[1.7,52.7],[0,53.5],[-1.5,55],[-2,57.6],[-3,58.6],[-5,58.6],[-6.2,56.7],[-5.6,55.3],[-3,54.5],[-3.4,53.4],[-4.7,52.8],[-5.2,51.7],[-3.5,51.4]],
  [[-6,52],[-6,54],[-7.5,55.2],[-10,54.2],[-10,51.6],[-8,51.6]],
  [[-73,78],[-60,82],[-30,83],[-20,81],[-20,72],[-24,70],[-32,68],[-40,65],[-43,60],[-48,61],[-53,66],[-55,70],[-60,76],[-70,77]],
  [[-24,65.5],[-22,66.4],[-16,66.5],[-13.5,65],[-18,63.4],[-22,63.8]],
  [[114,-22],[114,-26],[115,-34],[118,-35],[124,-33.5],[131,-31.5],[135,-34.8],[138,-35],[140,-38],[146,-39],[150,-37.5],[153,-31],[153,-25],[149,-20],[146,-18.5],[145,-14.5],[143,-10.8],[141.5,-13],[141.5,-17],[139,-17],[136,-15],[136.8,-12],[132,-11.5],[129,-15],[126,-14],[122,-18],[120,-20]],
  [[109,1.5],[110,-1.5],[111,-3],[114.5,-3.8],[116.5,-2.5],[118,1],[119,5],[117,7],[115.5,5],[113,3]],
  [[95.2,5.6],[98,4],[103.5,-1],[106,-3],[106,-5.8],[104.5,-5.9],[101,-2.5],[97.5,1.5]],
  [[105.2,-6.8],[108,-6.3],[111,-6.6],[114.5,-7.7],[112,-8.5],[108,-7.8]],
  [[131,-1.5],[134,-1],[138,-1.7],[141,-2.6],[145,-4.5],[147.5,-6],[150,-10.3],[147,-10],[143.5,-9],[141,-9.1],[138,-8.4],[135,-4.5],[132.5,-4]],
  [[120,18.5],[122.2,18.5],[122,16],[124,13],[124.5,12.5],[125.5,10],[126.5,7.5],[125.5,6],[123.5,7.5],[122,7],[123,10],[121,12.5],[120.5,14.5],[119.8,16]],
  [[120.1,23],[120.9,22],[121.9,24.6],[121.5,25.3],[120.5,24.3]],
  [[44,-25],[47,-25],[49.5,-17],[50.5,-15.5],[49.3,-12],[47.5,-14],[44,-17]],
  [[172.7,-34.5],[174.5,-36.5],[178.5,-37.7],[176.8,-40],[175,-41.6],[173,-41],[172,-43.5],[168.5,-46.6],[166.5,-46],[169,-43.5],[172.5,-40.5]],
  [[126.2,33.2],[126.9,33.3],[126.9,33.55],[126.3,33.5]],
];
// 다각형 변을 3°마다 잘게 (지구 곡면을 따라 휘게) — 결과는 캐시
const DENSE = new WeakMap();
function densify(poly) {
  if (DENSE.has(poly)) return DENSE.get(poly);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  DENSE.set(poly, out);
  return out;
}

export const DIAGRAM_KINDS = {
  keyword: "대형 키워드 (글자 스태거)", ghost: "고스트 타이포", banner: "하단 배너 (pop+shine)",
  stat: "큰 숫자 카운트업", bars: "막대 차트", line: "선 차트", nodes: "노드·연결선 다이어그램",
  table: "표 + 행 하이라이트", cards: "키워드 카드 공개", arrow: "성장 화살표", chapter: "챕터 간지",
  zoomReveal: "사진 줌아웃 공개", split: "두 화면 맞붙기", gallery: "사진 그리드", compare: "전·후 비교 슬라이더", stack: "사진 쌓기",
  bars3d: "3D 쿼터뷰 막대 (2D→3D 전환)", cards3d: "3D 뒤집기 카드 (기울며 뒤집기)",
  rankRise: "순위 상승 (입체 막대 + 물결 화살표)", rings: "과녁 고리 (한 겹씩 넓어지는 영역)", panels3: "3분할 빗면 패널 (움직이는 아이콘)", stackBuild: "블록 쌓기 → 미국 지도 물들기",
  wordSwarm: "글자 폭증 비행 (한 단어가 100개로 → 카메라가 휘며 통과)", horizon: "경계 넘어 수평선·태양 (단어→선→지평선)", globe: "3D 지구 (다가가며 회전 → 한반도에서 화살표)", orgChart: "조직도 그리기 (선이 그려지고 부서에 파란색)",
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
  (p.nodes || []).forEach((n) => { if (n.img) out.push(n.img); });
  return out.filter(Boolean);
}
let SVG_ID = "d";   // 한 화면에 diagram이 여러 개여도 clipPath id가 겹치지 않게 (diagramSVG가 요소 id로 바꿈)
export const KIT_COLORS = { blue: "#296ef9", navy: "#0b1f4b", coral: "#ff5050", gray: "#8a94a6", soft: "#eef3ff", line: "#d5dceb", white: "#ffffff", purple: "#7a3ff2" };
const KC = KIT_COLORS;
let FONT = "Pretendard, sans-serif";   // 디자인 키트 font.family (applyKitTheme) — 키트 그림·아이콘 글자 전체

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
// 색 밝기 조절 (3D 면 음영): k<0 어둡게, k>0 밝게
const shade = (c, k) => {
  if (!/^#[0-9a-f]{6}$/i.test(c || "")) return c;
  return "#" + [1, 3, 5].map((i) => { const v = parseInt(c.slice(i, i + 2), 16); return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, "0"); }).join("");
};
// ---- 노드 아이콘 (움직이는 선화). 100×100 상자 기준으로 그린 뒤 (cx,cy)·크기 s로 옮긴다. t = 아이콘이 나온 뒤 프레임
// name: money(지폐) · globe(지구본) · robot(로봇) · people(이야기하는 사람들) · app(앱 아이콘, img) · pc(컴퓨터) · market(가게)
export const NODE_ICONS = { money: "지폐", globe: "지구본", robot: "로봇", people: "이야기하는 사람들", app: "앱 아이콘(이미지)", pc: "컴퓨터", market: "가게·마켓",
  person: "사람", usperson: "미국인(성조기)", account: "계좌(통장)", youtube: "동영상 플랫폼", phone: "휴대폰", megaphone: "확성기(소통)", building: "건물(본사)",
  flag: "빨간 깃발", docpen: "문서와 펜", dumbbell: "아령 드는 손(독자 역량)", handshake: "악수(협업)", team: "전담조직(사람들)" };
// 색 아이콘 팔레트 (color 모드: 연한 원 위에 진한 윤곽 + 색 면). 흰 모드는 색 면 없이 흰 선만
const IC = { green: "#2dbd7e", gold: "#ffb321", red: "#ff4d55", sky: "#5aa9ff", skin: "#ffd3ad", gray: "#c7d0de", paper: "#ffffff", navy: "#0b1f4b", blue: "#296ef9", teal: "#22c3c3" };
function nodeIcon(name, cx, cy, s, t, fg, bg, img, color) {
  const sw = 6, F = (c) => (color ? c : "none");   // 색 면 (흰 모드에선 없음)
  const S = (d, fl) => `stroke="${fg}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="${fl || "none"}"${d || ""}`;
  const solid = (c) => (color ? c : fg);           // 흰 모드에선 흰 면, 색 모드에선 색 면
  const hole = color ? "#fff" : bg;                 // 면 위에 뚫린 무늬 색
  let g = "";
  if (name === "money") {
    const a = Math.sin(t * 0.12) * 7, up = Math.sin(t * 0.1) * 4;
    const bill = (tr, front) => `<g transform="${tr}"><rect x="-40" y="-23" width="80" height="46" rx="6" ${front ? `fill="${solid(IC.green)}"${color ? ` stroke="${fg}" stroke-width="${sw}"` : ""}` : S("", F("#bdf0d6"))}/>` +
      `<circle cx="0" cy="0" r="11" ${front ? `fill="${color ? "#fff" : "none"}" stroke="${front && !color ? bg : fg}" stroke-width="5"` : S()}/>` +
      `<circle cx="-27" cy="0" r="3.5" fill="${front ? hole : fg}"/><circle cx="27" cy="0" r="3.5" fill="${front ? hole : fg}"/></g>`;
    g = bill(`translate(-6 10) rotate(${-14 - a})`, false) + bill(`translate(6 ${-8 + up}) rotate(${8 + a})`, true);
  } else if (name === "lock") {   // 자물쇠 — 보안·접근권한 (2026-11-20)
    const sh = Math.max(0, Math.sin(t * 0.08)) * 3;
    g = `<path d="M -20 -6 L -20 -22 Q -20 -42 0 -42 Q 20 -42 20 -22 L 20 ${-6 - sh}" ${S()}/>` +
      `<rect x="-32" y="-8" width="64" height="50" rx="9" ${S("", F(IC.gold))}/>` +
      `<circle cx="0" cy="12" r="7" fill="${color ? fg : fg}"/><line x1="0" y1="14" x2="0" y2="28" ${S()}/>`;
  } else if (name === "book") {   // 펼친 책 — 교육·지식
    g = `<path d="M 0 -26 Q -18 -36 -40 -32 L -40 26 Q -18 22 0 32 Z" ${S("", F(IC.sky))}/>` +
      `<path d="M 0 -26 Q 18 -36 40 -32 L 40 26 Q 18 22 0 32 Z" ${S("", F("#ffffff"))}/>` +
      `<line x1="-30" y1="-14" x2="-10" y2="-10" ${S(' stroke-width="4"')}/><line x1="-30" y1="0" x2="-10" y2="4" ${S(' stroke-width="4"')}/>` +
      `<line x1="10" y1="-10" x2="30" y2="-14" ${S(' stroke-width="4"')}/><line x1="10" y1="4" x2="30" y2="0" ${S(' stroke-width="4"')}/>`;
  } else if (name === "globe") {
    const R = 40;
    g = `<circle r="${R}" ${S("", F(IC.sky))}/>` + (color ? `<path d="M -22 -22 Q -6 -30 4 -18 Q 10 -6 -4 2 Q -18 8 -24 -6 Z M 8 10 Q 22 4 28 16 Q 24 30 10 28 Q 2 20 8 10 Z" fill="${IC.green}" opacity=".9"/>` : "") +
      `<line x1="${-R}" y1="0" x2="${R}" y2="0" ${S()}/>` +
      `<path d="M ${-R * 0.87} -20 L ${R * 0.87} -20 M ${-R * 0.87} 20 L ${R * 0.87} 20" ${S(' stroke-width="4"')}/>`;
    for (let k = 0; k < 3; k++) {   // 경선이 돌아가며 지구본이 자전하는 느낌
      const ph = t * 0.05 + (k * Math.PI) / 3, rx = Math.abs(Math.cos(ph)) * R;
      if (rx > 2) g += `<ellipse rx="${rx.toFixed(1)}" ry="${R}" ${S(' stroke-width="4"')} opacity="${(0.45 + 0.55 * Math.abs(Math.sin(ph))).toFixed(2)}"/>`;
    }
  } else if (name === "robot") {
    const tilt = Math.sin(t * 0.08) * 6, blink = t % 70 > 64 ? 0.15 : 1, led = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.15));
    g = `<g transform="rotate(${tilt} 0 10)"><line x1="0" y1="-30" x2="0" y2="-42" ${S()}/><circle cx="0" cy="-47" r="6" fill="${solid(IC.red)}" opacity="${led.toFixed(2)}"/>` +
      `<rect x="-32" y="-30" width="64" height="48" rx="12" ${S("", F(IC.gray))}/>` +
      `<ellipse cx="-13" cy="-8" rx="6" ry="${6 * blink}" fill="${color ? IC.blue : fg}"/><ellipse cx="13" cy="-8" rx="6" ry="${6 * blink}" fill="${color ? IC.blue : fg}"/>` +
      `<line x1="-11" y1="7" x2="11" y2="7" ${S()}/><line x1="-38" y1="-12" x2="-38" y2="0" ${S()}/><line x1="38" y1="-12" x2="38" y2="0" ${S()}/></g>` +
      `<rect x="-22" y="24" width="44" height="18" rx="6" ${S("", F(IC.sky))}/>`;
  } else if (name === "people") {
    const shirt = [IC.sky, IC.gold, IC.green];
    const person = (x, y, k) => `<path d="M ${x - 17} ${y + 20} Q ${x} ${y - 4} ${x + 17} ${y + 20} Z" ${S("", F(shirt[k]))}/><circle cx="${x}" cy="${y - 10}" r="10" ${S("", F(IC.skin))}/>`;
    const bub = (x, y, on, flip) => {   // 말풍선이 번갈아 톡 떠오른다
      if (on <= 0) return "";
      const sc = 0.6 + 0.4 * easeOutBack(on), bc = color ? (flip ? IC.blue : IC.gold) : fg;
      return `<g transform="translate(${x} ${y}) scale(${sc.toFixed(3)})" opacity="${clamp(on * 2).toFixed(2)}"><rect x="-17" y="-12" width="34" height="22" rx="8" fill="${bc}"/>` +
        `<path d="M ${flip ? 6 : -6} 9 L ${flip ? 12 : -12} 18 L ${flip ? -2 : 2} 9 Z" fill="${bc}"/>` +
        [-8, 0, 8].map((d) => `<circle cx="${d}" cy="-1" r="2.6" fill="${hole}"/>`).join("") + `</g>`;
    };
    const cyc = (t % 90) / 90;
    g = person(-28, 18, 0) + person(28, 18, 1) + person(0, 8, 2) +
      bub(-26, -32, cyc < 0.5 ? clamp(cyc * 6) : 0, false) + bub(28, -36, cyc >= 0.5 ? clamp((cyc - 0.5) * 6) : 0, true);
  } else if (name === "app") {
    const b = 1 + 0.05 * Math.sin(t * 0.14), id = SVG_ID + "ic" + (IMG_N++);
    const src = img ? MEDIA(img) : null;
    g = `<g transform="scale(${b.toFixed(3)})"><defs><clipPath id="${id}"><rect x="-38" y="-38" width="76" height="76" rx="18"/></clipPath></defs>` +
      `<rect x="-38" y="-38" width="76" height="76" rx="18" fill="#fff"/>` +
      (src ? `<image href="${xesc(src)}" x="-38" y="-38" width="76" height="76" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`
        : `<text x="0" y="0" font-family="${FONT}" font-size="40" font-weight="800" fill="${bg}" text-anchor="middle" dominant-baseline="central">App</text>`) +
      `<rect x="-38" y="-38" width="76" height="76" rx="18" fill="none" stroke="${fg}" stroke-width="3"/></g>`;
  } else if (name === "pc") {
    const lc = [IC.blue, IC.green, IC.gold];
    const ln = (k, y) => { const p = (t * 0.025 + k * 0.33) % 1; return `<line x1="-30" y1="${y}" x2="${-30 + 12 + 46 * p}" y2="${y}" stroke="${color ? lc[k] : fg}" stroke-width="5" stroke-linecap="round"/>`; };
    g = `<rect x="-44" y="-34" width="88" height="58" rx="7" ${S("", F("#e9f3ff"))}/>` + ln(0, -18) + ln(1, -5) + ln(2, 8) +
      `<line x1="0" y1="24" x2="0" y2="36" ${S()}/><line x1="-20" y1="38" x2="20" y2="38" ${S()}/>`;
  } else if (name === "market") {
    const wv = Math.sin(t * 0.12) * 2.5;
    let aw = `M -44 -22 L 44 -22`;
    for (let k = 0; k < 4; k++) { const x0 = 44 - k * 22; aw += ` Q ${x0 - 11} ${-6 + wv} ${x0 - 22} -22`; }
    g = `<path d="M -36 -8 L -36 36 L 36 36 L 36 -8" ${S("", F("#fff4e0"))}/>` +
      `<path d="M -40 -22 L -34 -38 L 34 -38 L 40 -22 Z" ${S("", F(IC.red))}/><path d="${aw}" ${S("", F(IC.red))}/>` +
      `<line x1="-14" y1="-38" x2="-18" y2="-22" stroke="${color ? "#fff" : fg}" stroke-width="5"/><line x1="14" y1="-38" x2="18" y2="-22" stroke="${color ? "#fff" : fg}" stroke-width="5"/>` +
      `<rect x="-10" y="10" width="20" height="26" rx="2" ${S("", F(IC.sky))}/>` +
      `<rect x="-30" y="2" width="14" height="12" rx="2" ${S(' stroke-width="4"', F(IC.sky))}/><rect x="16" y="2" width="14" height="12" rx="2" ${S(' stroke-width="4"', F(IC.sky))}/>`;
  } else if (name === "person") {
    const b = Math.sin(t * 0.1) * 2;
    g = `<g transform="translate(0 ${b.toFixed(2)})"><path d="M -30 38 Q 0 -4 30 38 Z" ${S("", F(IC.sky))}/><circle cx="0" cy="-16" r="16" ${S("", F(IC.skin))}/></g>`;
  } else if (name === "usperson") {   // 미국인: 사람 + 작은 성조기
    const wv = Math.sin(t * 0.18) * 3;
    g = `<path d="M -38 38 Q -10 -2 18 38 Z" ${S("", F(IC.sky))}/><circle cx="-10" cy="-14" r="15" ${S("", F(IC.skin))}/>` +
      `<line x1="22" y1="-40" x2="22" y2="10" ${S(' stroke-width="4"')}/>` +
      `<path d="M 22 -40 Q 32 ${-44 + wv} 44 -40 L 44 -20 Q 32 ${-24 + wv} 22 -20 Z" fill="${color ? "#fff" : fg}"${color ? ` stroke="${fg}" stroke-width="2"` : ""}/>` +
      `<path d="M 30 -34 L 44 -34 M 30 -28 L 44 -28" stroke="${color ? IC.red : bg}" stroke-width="2.4"/><rect x="22" y="-40" width="8" height="9" fill="${color ? IC.blue : bg}" opacity=".9"/>`;
  } else if (name === "account") {    // 계좌: 통장 + 동전이 톡
    const c = (t % 50) / 50, cy = -30 - 18 * Math.sin(Math.PI * c);
    g = `<rect x="-36" y="-22" width="72" height="54" rx="6" ${S("", F(IC.green))}/><line x1="-36" y1="-6" x2="36" y2="-6" ${S(' stroke-width="4"')}/>` +
      `<line x1="-24" y1="10" x2="6" y2="10" ${S(' stroke-width="4"')}/><line x1="-24" y1="20" x2="16" y2="20" ${S(' stroke-width="4"')}/>` +
      `<circle cx="22" cy="${cy.toFixed(1)}" r="9" fill="${solid(IC.gold)}"/><text x="22" y="${(cy + 0.5).toFixed(1)}" font-family="${FONT}" font-size="11" font-weight="800" fill="${color ? fg : bg}" text-anchor="middle" dominant-baseline="central">$</text>`;
  } else if (name === "youtube") {    // 동영상 플랫폼: 빨간 둥근 사각 + 재생
    const p = 1 + 0.06 * Math.sin(t * 0.16);
    g = `<g transform="scale(${p.toFixed(3)})"><rect x="-38" y="-27" width="76" height="54" rx="16" fill="#ff0033"/><path d="M -9 -14 L 16 0 L -9 14 Z" fill="#fff"/></g>`;
  } else if (name === "phone") {      // 휴대폰: 화면에 앱 칸이 차례로 켜진다
    const k = Math.floor(t / 8) % 5, ac = [IC.red, IC.gold, IC.green, IC.blue];
    g = `<rect x="-24" y="-42" width="48" height="84" rx="9" ${S("", F("#e9f3ff"))}/><line x1="-6" y1="32" x2="6" y2="32" ${S(' stroke-width="4"')}/>` +
      [0, 1, 2, 3].map((i) => `<rect x="${-14 + (i % 2) * 16}" y="${-30 + Math.floor(i / 2) * 18}" width="12" height="12" rx="3" fill="${color ? ac[i] : fg}" opacity="${i < k ? 1 : 0.3}"/>`).join("");
  } else if (name === "megaphone") {  // 확성기: 소리 물결이 퍼진다
    g = `<path d="M -36 -10 L -14 -10 L 22 -30 L 22 30 L -14 10 L -36 10 Z" ${S("", F(IC.gold))}/><path d="M -24 10 L -18 32" ${S()}/>`;
    for (let k = 0; k < 3; k++) { const q = ((t * 0.04 + k / 3) % 1); g += `<path d="M ${30 + q * 18} ${-14 - q * 10} Q ${38 + q * 22} 0 ${30 + q * 18} ${14 + q * 10}" stroke="${color ? IC.red : fg}" stroke-width="4" stroke-linecap="round" fill="none" opacity="${(1 - q).toFixed(2)}"/>`; }
  } else if (name === "building") {   // 본사 건물: 창문 불이 켜진다
    let w = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const on = ((r * 3 + c + Math.floor(t / 6)) % 5) !== 0; w += `<rect x="${-18 + c * 13}" y="${-30 + r * 14}" width="8" height="8" rx="1.5" fill="${color ? IC.gold : fg}" opacity="${on ? 1 : 0.3}"/>`; }
    g = `<path d="M -28 40 L -28 -40 L 28 -40 L 28 40 Z" ${S("", F(IC.gray))}/><line x1="-40" y1="40" x2="40" y2="40" ${S()}/>` + w;
  } else if (name === "flag") {       // 빨간 깃발이 펄럭
    const wv = Math.sin(t * 0.2) * 5;
    g = `<line x1="-22" y1="-40" x2="-22" y2="40" ${S()}/><path d="M -22 -38 Q 0 ${-46 + wv} 26 -36 L 26 -4 Q 0 ${-14 + wv} -22 -6 Z" fill="#ff3b3b" stroke="${fg}" stroke-width="3"/>`;
  } else if (name === "docpen") {     // 문서에 펜이 쓴다
    const q = (t % 60) / 60;
    g = `<path d="M -28 -40 L 14 -40 L 30 -24 L 30 40 L -28 40 Z" ${S("", F(IC.paper))}/><path d="M 14 -40 L 14 -24 L 30 -24" ${S(' stroke-width="4"')}/>` +
      `<line x1="-16" y1="-18" x2="16" y2="-18" ${S(' stroke-width="4"')}/><line x1="-16" y1="-4" x2="${(-16 + 30 * Math.min(1, q * 1.2)).toFixed(1)}" y2="-4" stroke="${color ? IC.blue : fg}" stroke-width="4" stroke-linecap="round"/>` +
      `<g transform="translate(${(-16 + 30 * Math.min(1, q * 1.2)).toFixed(1)} -6) rotate(35)"><rect x="-4" y="-34" width="8" height="30" rx="2" fill="${solid(IC.gold)}"/><path d="M -4 -4 L 0 4 L 4 -4 Z" fill="${fg}"/></g>`;
  } else if (name === "dumbbell") {   // 손이 아령을 들어 올린다
    const lift = Math.abs(Math.sin(t * 0.1)) * 16;
    g = `<g transform="translate(0 ${(-lift).toFixed(1)})"><line x1="-26" y1="-18" x2="26" y2="-18" ${S()}/>` +
      `<rect x="-38" y="-30" width="10" height="24" rx="3" fill="${solid(IC.red)}"/><rect x="28" y="-30" width="10" height="24" rx="3" fill="${solid(IC.red)}"/>` +
      `<path d="M -10 -10 Q -12 6 -8 18 L 10 18 Q 14 6 10 -10 Z" ${S("", F(IC.skin))}/></g><path d="M -8 ${(18 - lift).toFixed(1)} L -10 40 M 10 ${(18 - lift).toFixed(1)} L 12 40" ${S()}/>`;
  } else if (name === "handshake") {  // 협업: 두 소매 + 맞잡은 손이 위아래로 흔들린다
    const sh = Math.sin(t * 0.25) * 4;
    g = `<g transform="translate(0 ${sh.toFixed(1)}) rotate(-8)"><rect x="-48" y="-14" width="16" height="28" rx="3" fill="${solid(IC.blue)}"/><rect x="32" y="-14" width="16" height="28" rx="3" fill="${solid(IC.gold)}"/>` +
      `<path d="M -32 -12 Q -8 -26 16 -12 L 32 -12 L 32 12 Q 8 24 -16 12 L -32 12 Z" fill="${solid(IC.skin)}"${color ? ` stroke="${fg}" stroke-width="4"` : ""}/>` +
      `<path d="M -8 -10 Q -2 0 -8 10 M 2 -12 Q 8 0 2 12 M 12 -10 Q 18 0 12 10" stroke="${color ? fg : bg}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  } else if (name === "team") {       // 전담조직: 사람 셋
    const shirt = [IC.sky, IC.green, IC.gold];
    const person = (x, y, s, k) => `<path d="M ${x - 15 * s} ${y + 18 * s} Q ${x} ${y - 2 * s} ${x + 15 * s} ${y + 18 * s} Z" ${S("", F(shirt[k]))}/><circle cx="${x}" cy="${y - 10 * s}" r="${9 * s}" ${S("", F(IC.skin))}/>`;
    const hop = (k) => Math.max(0, Math.sin(t * 0.15 - k * 1.2)) * 4;
    g = person(-26, 16 - hop(0), 1, 0) + person(26, 16 - hop(2), 1, 1) + person(0, 4 - hop(1), 1.15, 2);
  } else return "";
  return `<g transform="translate(${cx} ${cy}) scale(${(s / 100).toFixed(4)})">${g}</g>`;
}
// 진한 바탕(패널·블록) 위 아이콘: 흰 원판 + 색 아이콘 (키트 iconColor=0이면 예전처럼 흰 선)
function badgeIcon(name, cx, cy, s, t, bgCol, img) {
  if (!KIT_PARAMS.nodes.iconColor) return nodeIcon(name, cx, cy, s, t, "#fff", bgCol, img, false);
  return `<circle cx="${cx}" cy="${cy}" r="${(s * 0.56).toFixed(1)}" fill="#fff"/>` + nodeIcon(name, cx, cy, s * 0.8, t, KC.navy, bgCol, img, true);
}
// 아이콘 여러 개(icon: ["globe","building","flag"]) → 원 안에 나란히 작게, 차례로 톡
function nodeIcons(n, cx, cy, s, t, fg, bg, color) {
  const list = [].concat(n.icon || (n.img ? "app" : []));
  if (list.length <= 1) return nodeIcon(list[0], cx, cy, s, t, fg, bg, n.img, color);
  const k = list.length, ss = s * (k === 2 ? 0.62 : 0.5), step = ss * 0.92;
  return list.map((nm, i) => {
    const a = popS(t, i * 6, 10), x = cx + (i - (k - 1) / 2) * step, y = cy + (k === 3 && i === 1 ? -ss * 0.18 : 0);
    return a.o ? `<g opacity="${a.o}" transform="${scaleAt(x, y, a.s)}">${nodeIcon(nm, x, y, ss, t - i * 6, fg, bg, n.img, color)}</g>` : "";
  }).join("");
}

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
    let acc = 0, bg = "";
    // bgGhost: 글자가 다 뜬 뒤, 같은 단어를 뒤에 아주 크고 옅게 한 번 더 (배경이 휑하지 않게). true 또는 {at, opacity(0.07), scale}
    if (p.bgGhost) {
      const g = p.bgGhost === true ? {} : p.bgGhost, gat = g.at != null ? g.at : (p.at || 0) + chars.length * per + 14;
      // 띄어쓰기가 있으면 두 줄로 쌓아 화면을 크게 채운다 (Beyond / Connection)
      const words = String(p.text || "").split(" "), k = Math.ceil(words.length / 2);
      const lines = g.stack === false || words.length < 2 ? [p.text] : [words.slice(0, k).join(" "), words.slice(k).join(" ")];
      const em = Math.max(...lines.map((l) => measureText(l, 1).w)), lh = 1.0;
      const gs = Math.min(size * (g.scale || 2.4), (1920 * 0.86) / Math.max(0.01, em)), o = eo(f, gat, 24) * (g.opacity || 0.07);
      const drift = 1 + 0.05 * clamp((f - gat) / 300);   // 천천히 다가오는 느낌
      const y0 = h / 2 - ((lines.length - 1) * gs * lh) / 2 + gs * 0.34;
      if (o > 0) bg = Tsvg(w / 2, y0, lines.join("\n"), { size: gs, weight: 800, color: g.color || p.color || KC.blue, anchor: "middle", opacity: o.toFixed(3), tr: scaleAt(w / 2, h / 2, drift), ls: -6, lh });
    }
    let out = bg + chars.map((c, i) => {
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
    let out = p.label ? T(x, y - size * 1.02, p.label, { size: p.labelSize || 40, weight: 600, color: KC.gray, anchor, opacity: eo(f, at - 6, 10) }) : "";
    const unit = p.unit ? `<tspan font-size="${size * 0.36}" font-weight="600" dx="12">${xesc(p.unit)}</tspan>` : "";
    const num = xesc(countText(p.value, f, at, dur)) + unit;
    if (p._echo) {   // 메아리: 숫자 잔상 3겹이 바깥으로 퍼지며 옅어진다
      const e = p._echo, ec = (typeof e.color === "string" && e.color[0] === "$" ? KC[e.color.slice(1)] : e.color) || p.color || KC.blue, cy = y - size * 0.35;
      for (let k = 3; k >= 1; k--) {
        const sc = 1 + k * (0.05 + 0.13 * e.p);
        out += `<g opacity="${((0.4 * e.s) / k).toFixed(3)}" transform="${scaleAt(x, cy, sc)}">` + T(x, y, num, { size, weight: 700, color: ec, anchor, raw: true, ls: -4 }) + `</g>`;
      }
    }
    out += T(x, y, num, { size, weight: 700, color: p.color || KC.blue, anchor, opacity: o, raw: true, ls: -4 });
    if (p.delta) {
      const a = popS(f, at + dur, 12), dy = y + size * 0.42;
      // 증감 칩 글자: 숫자 크기에 비례(deltaScale, 최소 deltaMin) + 굵게(deltaWeight) — 키트 components.stat.params
      const K = KIT_PARAMS.stat, ds = p.deltaSize || Math.max(K.deltaMin, Math.round(size * K.deltaScale));
      out += `<g opacity="${a.o}" transform="${scaleAt(x, dy, a.s)}">` + T(x, dy + Math.round(ds * 0.55), p.delta, { size: ds, weight: p.deltaWeight || K.deltaWeight, color: p.deltaColor || KC.coral, anchor }) + `</g>`;
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
    if (an && tops[an.from] && tops[an.to] && an.style !== "arrow") {
      // 증가 점선 (기본, 2026-11-20 사용자: "빨간 화살표 없어 보여, 점선으로"): 앞 막대 높이에서 점선이 옆 막대까지 그어지고,
      // 늘어난 부분만 강조색 점선 상자 + 옆에 증가율. 화살표 방식은 style:"arrow"
      const [x1, y1] = tops[an.from], [x2, y2] = tops[an.to], col = p.highlightColor || KC.blue;
      const g = eo(f, an.at, 16), g2 = eo(f, (an.at || 0) + 14, 14), xa = x1 - bw / 2, xb = xa + (x2 + bw / 2 - xa) * g;
      if (g > 0) out += `<line x1="${xa}" y1="${y1}" x2="${xb}" y2="${y1}" stroke="${KC.gray}" stroke-width="4" stroke-dasharray="14 10"/>`;
      if (g2 > 0 && y1 > y2) {
        out += `<rect x="${x2 - bw / 2}" y="${y2}" width="${bw}" height="${y1 - y2}" rx="8" fill="${col}" fill-opacity="${(0.18 * g2).toFixed(3)}" stroke="#ffffff" stroke-width="5" stroke-dasharray="12 9" opacity="${g2}"/>`;
        out += T(x2 + bw / 2 + 28, (y1 + y2) / 2, an.text || "", { size: an.size || 52, weight: 800, color: col, base: "central", opacity: g2, own: "annot" });
      }
    } else if (an && tops[an.from] && tops[an.to]) {
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
      // 연결선 기본 = 회색 점선, 점선 무늬가 화살표 쪽으로 계속 흐른다(화살표 머리는 고정). 머리는 원 테두리 밖에 (2026-11-19 사용자)
      const K = KIT_PARAMS.nodes, head = 22, gapA = l.arrow ? head + (K.arrowGap == null ? 10 : K.arrowGap) + 3 : 6;
      const ang = Math.atan2(b.y - a.y, b.x - a.x), ra = (a.r || 70) * nodeGrow(a, f) + 6, rb = (b.r || 70) * nodeGrow(b, f) + gapA;
      const x1 = a.x + Math.cos(ang) * ra, y1 = a.y + Math.sin(ang) * ra, x2 = b.x - Math.cos(ang) * rb, y2 = b.y - Math.sin(ang) * rb;
      const xe = x1 + (x2 - x1) * g, ye = y1 + (y2 - y1) * g, col = l.color || K.linkColor || KC.gray;
      const dash = l.dash != null ? l.dash : K.linkDash, flow = l.flow != null ? l.flow : K.linkFlow;
      rec({ kind: "line", x1, y1, x2: xe, y2: ye, wd: 5, own: "link" });
      out += `<line x1="${x1}" y1="${y1}" x2="${xe}" y2="${ye}" stroke="${col}" stroke-width="5" stroke-linecap="round"` +
        (dash ? ` stroke-dasharray="14 12" stroke-dashoffset="${(-(f * (flow || 0)) % 26).toFixed(1)}"` : "") + `/>`;
      if (l.arrow && g >= 1) out += `<polygon points="0,-12 ${head},0 0,12" fill="${col}" stroke="${col}" stroke-width="2" stroke-linejoin="round" transform="translate(${x2} ${y2}) rotate(${(ang * 180) / Math.PI})"/>`;
    });
    (p.nodes || []).forEach((n) => {
      // 노드는 기본으로 조용히 페이드 — 노드마다 톡 커지면 "확대가 몇 번씩" (2026-11-20 사용자). 예전 톡 등장은 pop:true
      const a = p.pop === true ? popS(f, n.at, 12) : { o: eo(f, n.at, 12), s: 1 }; if (!a.o) return;
      const r = n.r || 70, act = n.activeAt != null ? eo(f, n.activeAt, 10) : n.active === false ? 0 : 1;
      const fill = n.fill || KC.blue;
      rec({ kind: "circle", x: n.x - r, y: n.y - r, w: r * 2, h: r * 2, own: "n:" + n.id });
      // 아이콘(icon·img): flipAt이 있으면 원이 가로로 뒤집히며 글자 → 움직이는 아이콘, 없으면 처음부터 아이콘
      const hasIc = !!(n.icon || n.img), fa = hasIc && n.flipAt != null ? n.flipAt : null;
      const fp = fa == null ? (hasIc ? 1 : 0) : lin(f, fa, KIT_PARAMS.nodes.flipDur || 16);
      const fsx = fa == null ? 1 : Math.max(0.02, Math.abs(Math.cos(Math.PI * fp))), showIc = hasIc && fp >= 0.5;
      const fg = act > 0.5 ? "#fff" : fill, icT = f - (fa == null ? n.at || 0 : fa);
      // 색 아이콘(키트 iconColor): 아이콘 면은 연한 원 + 원 색 테두리, 아이콘은 진한 윤곽 + 색 면 (2026-11-19 사용자: 흰색 말고 색)
      const colorIc = showIc && (n.iconColor != null ? n.iconColor : KIT_PARAMS.nodes.iconColor);
      // orb: 입체 구슬(빛 받는 쪽 밝게 + 반사광 + 바닥 그림자) 위에 흰 아이콘 — 3D 느낌 (2026-11-20 사용자: "아이콘 3D로")
      const orb = p.orb || n.orb, gid = SVG_ID + "orb" + String(n.id).replace(/\W/g, "");
      const inner = orb
        ? `<defs><radialGradient id="${gid}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${mixHex(fill, "#ffffff", 0.55)}"/><stop offset=".55" stop-color="${fill}"/><stop offset="1" stop-color="${shade(fill, -0.35)}"/></radialGradient></defs>` +
          `<ellipse cx="${n.x}" cy="${n.y + r * 1.06}" rx="${r * 0.78}" ry="${r * 0.14}" fill="${KC.navy}" opacity=".16"/>` +
          `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="url(#${gid})"/>` +
          `<ellipse cx="${n.x - r * 0.32}" cy="${n.y - r * 0.42}" rx="${r * 0.42}" ry="${r * 0.24}" fill="#fff" opacity=".28" transform="rotate(-28 ${n.x - r * 0.32} ${n.y - r * 0.42})"/>` +
          (showIc ? nodeIcons(n, n.x, n.y, r * 1.2, icT, "#fff", fill, false)
            : n.glyph ? T(n.x, n.y, n.glyph, { size: n.glyphSize || r * 0.62, weight: 800, color: "#fff", anchor: "middle", base: "central", own: "n:" + n.id }) : "")
        : (colorIc
        ? `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${mixHex(fill, "#ffffff", 0.86)}" stroke="${fill}" stroke-width="${Math.max(5, r * 0.06).toFixed(1)}"/>`
        : `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${KC.soft}" stroke="${fill}" stroke-width="5"/>` + `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" opacity="${act}"/>`) +
        (showIc ? nodeIcons(n, n.x, n.y, r * 1.25, icT, colorIc ? KC.navy : fg, fill, colorIc)
          : n.glyph ? (fa == null ? T : Tsvg)(n.x, n.y, n.glyph, { size: n.glyphSize || r * 0.62, weight: 700, color: fg, anchor: "middle", base: "central", own: "n:" + n.id }) : "");
      out += `<g opacity="${a.o}" transform="${scaleAt(n.x, n.y, a.s * nodeGrow(n, f))}"><g transform="translate(${n.x} 0) scale(${fsx.toFixed(3)} 1) translate(${-n.x} 0)">${inner}</g>` +
        (n.label ? T(n.x, n.y + r + lg, n.label, { size: Math.max(KIT_PARAMS.nodes.labelMin || 0, n.labelSize || 34), weight: KIT_PARAMS.nodes.labelWeight || 700, color: KC.navy, anchor: "middle", own: "n:" + n.id }) : "") +
        (n.sub ? T(n.x, n.y + r + lg + sg, n.sub, { size: 26, weight: 500, color: KC.gray, anchor: "middle", own: "n:" + n.id }) : "") + `</g>`;
    });
    return out;
  },
  // (nodes 노드 grow — 아래 nodeGrow 참고)
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
  // ── 연출 키트 2 (2026-11-19 사용자): 글자 폭증 비행 · 경계 넘어 수평선·태양 · 3D 지구 · 조직도
  // 글자 폭증 비행. 가운데 한 단어(역량)가 100개로 불어나 공간에 흩어지고, 카메라가 휘어지며 그 사이를 날아 지나간다 → 화면이 비면 다음 화두(02 신사업)가 딱.
  // props: text("역량"), count(100), at, burst{at:4,dur:20}, fly{at:20,dur:34}, size(120), curve(1: 카메라 휘는 정도), colors([navy, blue])
  wordSwarm(w, h, p, f) {
    const K = KIT_PARAMS.wordSwarm, n = p.count || K.count, at = p.at || 0, size = p.size || K.size, curve = p.curve == null ? 1 : p.curve;
    const bu = Object.assign({ at: at + 4, dur: 20 }, p.burst || {}), fl = Object.assign({ at: at + 20, dur: 34 }, p.fly || {});
    const cols = p.colors || [KC.navy, KC.blue, "#6f9bfb"];
    const r = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
    const b = eio(lin(f, bu.at, bu.dur)), t = lin(f, fl.at, fl.dur), fp = eio(t);
    const F = 700, Z0 = 700, camZ = fp * 5200, sw = Math.sin(Math.PI * t);
    const camX = curve * 700 * Math.sin(Math.PI * fp * 0.9), camY = -curve * 160 * sw;
    const yaw = curve * 0.42 * Math.sin(Math.PI * fp), roll = curve * 16 * Math.sin(Math.PI * fp * 1.1), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const tx = i === 0 ? 0 : (r(i, 1) - 0.5) * 3400, ty = i === 0 ? 0 : (r(i, 2) - 0.5) * 1900, tz = i === 0 ? Z0 : Z0 + 300 + r(i, 3) * 4600;
      const k = i === 0 ? 1 : b;
      let x = tx * k, y = ty * k, z = Z0 + (tz - Z0) * k;
      x -= camX; y -= camY; z -= camZ;
      const xr = x * cy - z * sy, zr = x * sy + z * cy;   // 카메라가 옆으로 고개를 돌린다(요)
      if (zr < 60) continue;
      const sc = F / zr, op = clamp(1 - zr / 6500) * clamp((zr - 60) / 260) * (i === 0 ? 1 : clamp(b * 1.6));
      if (op <= 0.02 || (i > 0 && b <= 0)) continue;
      pts.push({ x: w / 2 + xr * sc, y: h / 2 + y * sc, s: size * sc, o: op, c: cols[i % cols.length], z: zr });
    }
    pts.sort((a, c) => c.z - a.z);
    const pop = popS(f, at, 12);
    const body = pts.filter((q) => q.s > 4 && q.s < 2400 && q.x > -q.s * 2 && q.x < w + q.s * 2).map((q) =>
      Tsvg(q.x.toFixed(1), (q.y + q.s * 0.35).toFixed(1), xesc(p.text || "역량"), { size: q.s.toFixed(1), weight: 800, color: q.c, anchor: "middle", opacity: (q.o * pop.o).toFixed(3), ls: -2 })).join("");
    rec({ kind: "frame", x: 0, y: 0, w, h, own: "swarm" });
    return `<g transform="rotate(${roll.toFixed(2)} ${w / 2} ${h / 2})">${body}</g>`;
  },
  // 경계 넘어 수평선·태양. 큰 단어(신사업)가 가운데 가로 일직선으로 눌려 '경계선'이 되고, 카메라가 그 선을 넘어 앞으로 나아가면
  // 멀리 지평선에서 노란 태양이 떠오르며 캡션(새로운 고객과 시장)이 나온다.
  // props: word("신사업"), wordY(가운데 높이), wordSize(136), lineLabel("기존 사업의 경계"), tag("02 신사업"), caption, captionSub, at,
  //        collapse{at:0,dur:14}, cross{at:16,dur:40}, sunAt(46), captionAt(58), sun(노랑), color(선·바닥)
  horizon(w, h, p, f) {
    const id = SVG_ID + "hz", at = p.at || 0, blue = p.color || KC.blue, sunC = p.sun || "#ffc21a";
    const co = Object.assign({ at, dur: 14 }, p.collapse || {}), cr = Object.assign({ at: at + 16, dur: 40 }, p.cross || {});
    const sunAt = p.sunAt != null ? p.sunAt : at + 46, capAt = p.captionAt != null ? p.captionAt : at + 58;
    const wy = p.wordY || h / 2, wsz = p.wordSize || 136, yh = h * 0.42;
    const c = eio(lin(f, co.at, co.dur)), ct = lin(f, cr.at, cr.dur), cp = eio(ct);
    const travel = cp + Math.max(0, f - cr.at - cr.dur) * 0.004;   // 넘은 뒤에도 천천히 계속 나아간다
    const z0 = 1, Kp = (wy - yh) * z0, zb = z0 - travel * z0 * 1.02;
    let out = `<defs><linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fff3cf"/></linearGradient>` +
      `<linearGradient id="${id}fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${KC.soft}"/><stop offset="1" stop-color="#d6e2ff"/></linearGradient>` +
      `<radialGradient id="${id}sg"><stop offset="0" stop-color="${sunC}" stop-opacity=".55"/><stop offset="1" stop-color="${sunC}" stop-opacity="0"/></radialGradient>` +
      `<clipPath id="${id}up"><rect x="0" y="0" width="${w}" height="${yh}"/></clipPath><clipPath id="${id}dn"><rect x="0" y="${yh}" width="${w}" height="${h - yh}"/></clipPath></defs>`;
    const fo = eo(f, cr.at, 16);   // 바닥·하늘이 드러나는 정도
    const su = eio(lin(f, sunAt, 34));
    if (fo > 0) {
      out += `<rect width="${w}" height="${yh}" fill="url(#${id}sky)" opacity="${(fo * (0.25 + 0.75 * su)).toFixed(3)}"/>`;
      // 태양: 지평선 뒤에서 떠오른다 (빛무리 + 천천히 도는 햇살)
      if (su > 0) {
        const R = 120, scy = yh + R - su * (R + 70);
        let rays = "";
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2 + f * 0.006, a2 = a + 0.09;
          rays += `<path d="M${w / 2} ${scy}L${(w / 2 + Math.cos(a) * 900).toFixed(1)} ${(scy + Math.sin(a) * 900).toFixed(1)}L${(w / 2 + Math.cos(a2) * 900).toFixed(1)} ${(scy + Math.sin(a2) * 900).toFixed(1)}Z" fill="${sunC}" opacity="${(0.12 * su).toFixed(3)}"/>`;
        }
        out += `<g clip-path="url(#${id}up)">${rays}<circle cx="${w / 2}" cy="${scy}" r="${R * 3.2}" fill="url(#${id}sg)" opacity="${su.toFixed(3)}"/>` +
          `<circle cx="${w / 2}" cy="${scy}" r="${R}" fill="${sunC}"/></g>`;
      }
      out += `<g opacity="${fo.toFixed(3)}"><rect x="0" y="${yh}" width="${w}" height="${h - yh}" fill="url(#${id}fl)"/><g clip-path="url(#${id}dn)">`;
      // 바닥 격자: 가로줄이 다가오고(앞으로 나아감), 세로줄은 소실점으로 모인다
      const gap = 0.16, off = (travel * z0) % gap;
      for (let k = 1; k < 40; k++) {
        const z = k * gap - off; if (z <= 0.02) continue;
        const y = yh + Kp / z; if (y > h + 4) continue;
        out += `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="${blue}" stroke-width="${Math.min(3, 0.6 + 6 / (k + 1)).toFixed(2)}" opacity="${clamp(0.12 + 0.5 / (k * 0.6)).toFixed(3)}"/>`;
      }
      for (let j = -14; j <= 14; j++) out += `<line x1="${w / 2}" y1="${yh}" x2="${w / 2 + j * 300}" y2="${h}" stroke="${blue}" stroke-width="1.6" opacity=".28"/>`;
      out += `</g><line x1="0" y1="${yh}" x2="${w}" y2="${yh}" stroke="${blue}" stroke-width="2" opacity=".45"/></g>`;
    }
    // 경계선: 처음엔 단어 자리의 굵은 파란 일직선 → 카메라가 넘어가며 아래로 빠르게 지나간다
    if (c > 0 && zb > 0.015) {
      const ly = f < cr.at ? wy : yh + Kp / zb;
      if (ly < h + 20) {
        const lw = Math.min(w, (measureText(p.word || "", wsz).w + 40) + (w - measureText(p.word || "", wsz).w) * c), th = 6 + 10 * clamp((ly - wy) / (h - wy));
        out += `<rect x="${(w - lw) / 2}" y="${(ly - th / 2).toFixed(1)}" width="${lw.toFixed(1)}" height="${th.toFixed(1)}" fill="${blue}" opacity="${c.toFixed(3)}"/>`;
        const lo = eo(f, cr.at - 2, 10) * clamp((h - ly) / 160);
        if (p.lineLabel && lo > 0) out += Tsvg(w / 2, (ly - 26).toFixed(1), xesc(p.lineLabel), { size: Math.round(34 + 30 * clamp((ly - wy) / (h - wy))), weight: 700, color: KC.gray, anchor: "middle", opacity: lo.toFixed(3) });
      }
    }
    // 단어가 세로로 눌려 선이 된다
    if (c < 1 && p.word) {
      const s = 1 - 0.97 * c;
      out += `<g transform="translate(0 ${wy}) scale(1 ${s.toFixed(3)}) translate(0 ${-wy})">` + Tsvg(w / 2, wy + wsz * 0.36, xesc(p.word), { size: wsz, weight: 700, color: KC.navy, anchor: "middle", ls: -3 }) + `</g>`;
    }
    const tg = eo(f, sunAt - 6, 12);
    if (p.tag && tg > 0) out += Tsvg(w / 2, 150, xesc(p.tag), { size: 44, weight: 800, color: blue, anchor: "middle", opacity: tg.toFixed(3) });
    const cpS = popS(f, capAt, 14);
    if (p.caption && cpS.o > 0) {
      const cy = yh - 250;
      out += `<g opacity="${cpS.o}" transform="${scaleAt(w / 2, cy, cpS.s)}">` +
        (p.captionSub ? Tsvg(w / 2, cy - 92, xesc(p.captionSub), { size: 42, weight: 600, color: KC.gray, anchor: "middle" }) : "") +
        T(w / 2, cy, p.caption, { size: p.captionSize || 96, weight: 800, color: KC.navy, anchor: "middle", ls: -2 }) + `</g>`;
    }
    rec({ kind: "frame", x: 0, y: 0, w, h, own: "horizon" });
    return out;
  },
  // 3D 지구. 멀리서 작게 → 돌면서 다가와 한반도가 정면에 오고, 대한민국에서 파란 화살표가 세계로 퍼진다.
  // 육지: props.land(설계 때 global_assets/geo/world_land.json을 실어 줌, [[[lon,lat],…],…]) — 없으면 키트 안의 거친 대륙 윤곽.
  // props: at, approach{dur:70, from:0.16, spin:220}, center{lon:127.8,lat:33}, home{lon:127,lat:37.5,label:"대한민국"},
  //        targets[{lon,lat,label}], arrowsAt(80), stagger(6), arrowDur(26), ocean, land(색은 landColor), radius(0.4)
  globe(w, h, p, f) {
    const id = SVG_ID + "gl", at = p.at || 0, K = KIT_PARAMS.globe;
    const ap = Object.assign({ dur: 70, from: 0.16, spin: 220 }, p.approach || {}), cen = Object.assign({ lon: 127.8, lat: 33 }, p.center || {});
    const home = Object.assign({ lon: 127, lat: 37.5, label: "대한민국" }, p.home || {});
    const t = eio(lin(f, at, ap.dur)), R = Math.min(w, h) * (p.radius || K.radius) * (ap.from + (1 - ap.from) * t);
    const lon0 = cen.lon - ap.spin * (1 - t) + 0.02 * Math.max(0, f - at - ap.dur), lat0 = cen.lat * (0.35 + 0.65 * t);
    const cx = w / 2, cy = h / 2 + 10, rad = Math.PI / 180;
    const sl0 = Math.sin(lat0 * rad), cl0 = Math.cos(lat0 * rad);
    const P3 = (lon, lat, alt = 0) => {   // 정사영: x 오른쪽, y 위, z 화면 밖
      const la = lat * rad, dl = (lon - lon0) * rad, r = 1 + alt;
      const x = r * Math.cos(la) * Math.sin(dl), y = r * (cl0 * Math.sin(la) - sl0 * Math.cos(la) * Math.cos(dl)), z = r * (sl0 * Math.sin(la) + cl0 * Math.cos(la) * Math.cos(dl));
      return { x: cx + x * R, y: cy - y * R, z, d: Math.hypot(x, y) };
    };
    const land = p.land || WORLD_COARSE;
    let out = `<defs><radialGradient id="${id}o" cx="0.36" cy="0.32" r="0.8"><stop offset="0" stop-color="${p.ocean || "#5b9cff"}"/><stop offset="0.55" stop-color="#2160d8"/><stop offset="1" stop-color="#0b2f86"/></radialGradient>` +
      `<radialGradient id="${id}a" cx="0.5" cy="0.5" r="0.5"><stop offset="0.86" stop-color="${KC.blue}" stop-opacity="0"/><stop offset="0.93" stop-color="${KC.blue}" stop-opacity=".28"/><stop offset="1" stop-color="${KC.blue}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}s" cx="0.34" cy="0.28" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#001240" stop-opacity=".35"/></radialGradient>` +
      `<clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>`;
    const op = eo(f, at, 12);
    out += `<g opacity="${op.toFixed(3)}"><circle cx="${cx}" cy="${cy}" r="${R * 1.16}" fill="url(#${id}a)"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}o)"/><g clip-path="url(#${id}c)">`;
    // 경위선
    let gr = "";
    for (let la = -60; la <= 75; la += 15) { let d = "", pen = false; for (let lo = -180; lo <= 180; lo += 5) { const q = P3(lo, la); if (q.z > 0) { d += (pen ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); pen = true; } else pen = false; } gr += d; }
    for (let lo = -180; lo < 180; lo += 20) { let d = "", pen = false; for (let la = -80; la <= 80; la += 5) { const q = P3(lo, la); if (q.z > 0) { d += (pen ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); pen = true; } else pen = false; } gr += d; }
    out += `<path d="${gr}" fill="none" stroke="#fff" stroke-width="1" opacity=".16"/>`;
    // 육지: 뒤쪽 점은 테두리로 눌러 붙인다 (거친 정사영 잘라내기)
    let ld = "";
    for (const poly of land) {
      const pts = densify(poly);
      if (!pts.some(([lo, la]) => P3(lo, la).z > 0)) continue;
      ld += pts.map(([lo, la], k) => { const q = P3(lo, la); let x = q.x, y = q.y; if (q.z <= 0) { const s = q.d > 1e-6 ? 1 / q.d : 1; x = cx + (q.x - cx) * s; y = cy + (q.y - cy) * s; } return (k ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }).join("") + "Z";
    }
    out += `<path d="${ld}" fill="${p.landColor || "#dff3d6"}" stroke="#9fd18f" stroke-width="1.2" stroke-linejoin="round"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}s)"/></g></g>`;
    // 대한민국 표시 + 파란 화살표
    const hq = P3(home.lon, home.lat), ho = eo(f, at + ap.dur - 10, 12);
    if (ho > 0 && hq.z > 0) {
      const pu = ((f - at) % 40) / 40;
      out += `<circle cx="${hq.x}" cy="${hq.y}" r="${(10 + 40 * pu).toFixed(1)}" fill="none" stroke="#fff" stroke-width="3" opacity="${((1 - pu) * ho).toFixed(3)}"/>` +
        `<circle cx="${hq.x}" cy="${hq.y}" r="11" fill="${KC.coral}" stroke="#fff" stroke-width="4" opacity="${ho}"/>`;
      if (home.label) out += Tsvg(hq.x + 26, hq.y - 20, xesc(home.label), { size: 36, weight: 800, color: "#fff", opacity: ho, ls: -1 });
    }
    const aAt = p.arrowsAt != null ? p.arrowsAt : at + ap.dur + 8, stg = p.stagger == null ? 6 : p.stagger, aDur = p.arrowDur || 26;
    const V = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
    (p.targets || []).forEach((tg, i) => {
      const g = eio(lin(f, aAt + i * stg, aDur)); if (g <= 0) return;
      const a = V(home.lon, home.lat), b = V(tg.lon, tg.lat), om = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)), so = Math.sin(om) || 1;
      const N = 40, pts = [];
      for (let k = 0; k <= N * g; k++) {
        const u = k / N, s1 = Math.sin((1 - u) * om) / so, s2 = Math.sin(u * om) / so;
        const v = [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2];
        const lat = Math.asin(clamp(v[2], -1, 1)) / rad, lon = Math.atan2(v[1], v[0]) / rad;
        const q = P3(lon, lat, 0.04 + Math.min(0.2, om * 0.1) * Math.sin(Math.PI * u));
        pts.push(q);
      }
      let d = "", pen = false;
      pts.forEach((q) => { const vis = q.z > 0 || q.d > 1; if (vis) { d += (pen ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1); pen = true; } else pen = false; });
      out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".55"/><path d="${d}" fill="none" stroke="${KC.blue}" stroke-width="5" stroke-linecap="round"/>`;
      const e = pts[pts.length - 1], e0 = pts[Math.max(0, pts.length - 3)];
      if (e && e0 && (e.z > 0 || e.d > 1)) {
        const ang = Math.atan2(e.y - e0.y, e.x - e0.x) / rad;
        out += `<g transform="translate(${e.x.toFixed(1)} ${e.y.toFixed(1)}) rotate(${ang.toFixed(1)})"><path d="M8 0L-14 -11L-9 0L-14 11Z" fill="${KC.blue}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g>`;
        const lo = eo(f, aAt + i * stg + aDur - 4, 10);
        if (tg.label && lo > 0 && g >= 1) out += Tsvg(e.x, e.y - 22, xesc(tg.label), { size: 30, weight: 800, color: KC.navy, anchor: "middle", opacity: lo });
      }
    });
    rec({ kind: "frame", x: cx - R, y: cy - R, w: R * 2, h: R * 2, own: "globe" });
    return out;
  },
  // 조직도. 맨 위 회사 상자 아래로 남색 선이 그려지며 부문 → 팀 상자가 차례로 펼쳐지고, highlight 시점에 지정한 상자에 파란 색이 들어온다.
  // props: root("삼성자산운용"), groups[{name, teams:[이름|""…]}] 또는 숫자(부문 수), teams([3,2,3,2,3]), at, drawDur(60),
  //        highlight[[부문,팀(-1이면 부문 상자)],…], highlightAt, stagger(6), color(남색 선), hi(파랑)
  orgChart(w, h, p, f) {
    const at = p.at || 0, nav = p.color || KC.navy, hi = p.hi || KC.blue;
    const groups = Array.isArray(p.groups) ? p.groups : Array.from({ length: p.groups || 5 }, (_, i) => ({ teams: Array.from({ length: (p.teams || [3, 2, 3, 2, 3])[i % 5] }, () => "") }));
    const n = groups.length, rw = 420, rh = 96, gw = Math.min(250, (w - 40 * (n - 1)) / n), gh = 76, tw = gw - 46, th = 52;
    const ry = 0, busY = rh + 60, gy = busY + 50, dd = p.drawDur || 60, stg = p.stagger || 6;
    const gx = (i) => (w - (n * gw + (n - 1) * 40)) / 2 + i * (gw + 40);
    const hiAt = p.highlightAt, his = p.highlight || [];
    const isHi = (g, t) => his.some(([a, b]) => a === g && b === t);
    const hk = (g, t) => (hiAt == null || !isHi(g, t) ? 0 : eio(lin(f, hiAt + his.findIndex(([a, b]) => a === g && b === t) * 5, 14)));
    const line = (x1, y1, x2, y2, s, col = nav, sw = 4) => {
      if (s <= 0) return "";
      return `<line x1="${x1}" y1="${y1}" x2="${(x1 + (x2 - x1) * s).toFixed(1)}" y2="${(y1 + (y2 - y1) * s).toFixed(1)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
    };
    const box = (x, y, bw, bh, label, a, k, big) => {   // a: 등장 pop, k: 파란색 들어오는 정도
      if (a.o <= 0) return "";
      const fill = k > 0 ? mixHex("#ffffff", hi, k) : "#ffffff", tc = k > 0.5 ? "#fff" : nav;
      let s = `<g opacity="${a.o}" transform="${scaleAt(x + bw / 2, y + bh / 2, a.s * (1 + 0.06 * Math.sin(Math.PI * k)))}">` +
        (k > 0 ? `<rect x="${x - 8}" y="${y - 8}" width="${bw + 16}" height="${bh + 16}" rx="18" fill="${hi}" opacity="${(0.22 * k).toFixed(3)}"/>` : "") +
        `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="${fill}" stroke="${k > 0 ? hi : nav}" stroke-width="${big ? 4 : 3}"/>`;
      if (label) s += Tsvg(x + bw / 2, y + bh / 2 + (big ? 14 : 10), xesc(label), { size: big ? 40 : bh > 60 ? 30 : 24, weight: big ? 800 : 700, color: tc, anchor: "middle" });
      else s += `<rect x="${x + bw * 0.2}" y="${y + bh / 2 - 5}" width="${bw * 0.6}" height="10" rx="5" fill="${k > 0.5 ? "#fff" : KC.line}"/>`;
      return s + `</g>`;
    };
    let out = "";
    out += box((w - rw) / 2, ry, rw, rh, p.root || "삼성자산운용", popS(f, at, 12), 0, true);
    const t0 = at + 10;
    out += line(w / 2, rh, w / 2, busY, lin(f, t0, 8));
    out += line(gx(0) + gw / 2, busY, gx(n - 1) + gw / 2, busY, 0) ;
    const bs = eio(lin(f, t0 + 8, 14));   // 가로 버스: 가운데서 양옆으로
    if (bs > 0) out += `<line x1="${w / 2 - (w / 2 - gx(0) - gw / 2) * bs}" y1="${busY}" x2="${w / 2 + (gx(n - 1) + gw / 2 - w / 2) * bs}" y2="${busY}" stroke="${nav}" stroke-width="4" stroke-linecap="round"/>`;
    groups.forEach((g, i) => {
      const x = gx(i), c = x + gw / 2, a0 = t0 + 20 + i * stg, k = hk(i, -1);
      out += line(c, busY, c, gy, lin(f, a0, 6), nav);
      out += box(x, gy, gw, gh, g.name || "", popS(f, a0 + 4, 12), k, false);
      (g.teams || []).forEach((tn, j) => {
        const ty = gy + gh + 34 + j * (th + 26), tx = x + 46, aj = a0 + 12 + j * 5, kj = hk(i, j);
        const sx = x + 22;   // 왼쪽 세로 줄기에서 ㄴ자로
        out += line(sx, j === 0 ? gy + gh : ty - 26 - th / 2 + th / 2, sx, ty + th / 2, lin(f, aj, 6), kj > 0 ? mixHex(nav, hi, kj) : nav, 3);
        out += line(sx, ty + th / 2, tx, ty + th / 2, lin(f, aj + 4, 4), kj > 0 ? mixHex(nav, hi, kj) : nav, 3);
        out += box(tx, ty, tw, th, tn || "", popS(f, aj + 6, 10), kj, false);
      });
    });
    // 파란색이 들어올 때 반짝
    if (hiAt != null) his.forEach(([gi, tj], q) => {
      const s = lin(f, hiAt + q * 5, 22); if (s <= 0 || s >= 1) return;
      const x = gx(gi) + (tj < 0 ? gw / 2 : 46 + tw / 2), y = tj < 0 ? gy + gh / 2 : gy + gh + 34 + tj * (th + 26) + th / 2;
      out += `<circle cx="${x}" cy="${y}" r="${(30 + 90 * s).toFixed(1)}" fill="none" stroke="${hi}" stroke-width="4" opacity="${(1 - s).toFixed(3)}"/>`;
    });
    rec({ kind: "frame", x: 0, y: 0, w, h, own: "org" });
    return out;
  },
  // ── 3D 키트 (CSS 3D — 스튜디오 미리보기 = 렌더. SVG가 아니라 HTML을 돌려준다: HTML_KINDS)
  // 3D 쿼터뷰 막대. 정면(2D)으로 보이다가 turn에서 카메라가 쿼터뷰로 돌고, 막대가 입체가 되며 위로 솟는다.
  // props: bars[{label,value,display,at,highlight,color}], max, pre(0.35: 2D 단계 높이 비율, 1이면 2D에서 다 자람),
  //        turn{at:30,dur:24,rx:-24,ry:-34,zoom:0.86}, riseAt(turn 끝), stagger(8), grow(22), depth(0.8), barWidth, color, highlightColor,
  //        valueSize(44), labelSize(30), annotate{text,at,color}
  bars3d(w, h, p, f) {
    const bars = p.bars || [], n = Math.max(1, bars.length), max = p.max || Math.max(1, ...bars.map((b) => b.value || 0));
    const K = KIT_PARAMS.bars3d, turn = Object.assign({ at: 30, dur: 24, rx: K.rx, ry: K.ry, zoom: K.zoom }, p.turn || {});
    const t = eio(lin(f, turn.at, turn.dur));
    const top = 90, base = h - 80, gap = w / n, bw = Math.min(gap * 0.5, p.barWidth || 160), D = (p.depth || K.depth) * bw * t;
    const pre = p.pre == null ? 0.35 : p.pre, riseAt = p.riseAt != null ? p.riseAt : turn.at + turn.dur, stg = p.stagger == null ? 8 : p.stagger;
    const rx = turn.rx * t, ry = turn.ry * t, zoom = 1 - (1 - turn.zoom) * t;
    const face = (x, y, ww, hh, bg, tr, origin) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${ww}px;height:${hh}px;background:${bg};transform-origin:${origin};transform:${tr};backface-visibility:visible"></div>`;
    const bill = (x, y, z, html, size, color, weight, op = 1) =>   // 카메라를 바라보는 글자(돌아가도 읽힌다)
      `<div style="position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px) rotateY(${-ry}deg) rotateX(${-rx}deg);transform-style:preserve-3d">` +
      `<div style="position:absolute;left:0;top:0;opacity:${op};transform:translate(-50%,-100%);white-space:nowrap;font-family:${FONT};font-size:${size}px;font-weight:${weight};color:${color};letter-spacing:-1px">${html}</div></div>`;
    let out = "";
    const tops = [];
    // 바닥: 3D가 되면서 깔린다
    if (t > 0) out += `<div style="position:absolute;left:-40px;top:${base}px;width:${w + 80}px;height:${bw * 2.2}px;opacity:${t};background:linear-gradient(${KC.soft}, rgba(238,243,255,0));transform-origin:top;transform:rotateX(-90deg)"></div>`;
    out += `<div style="position:absolute;left:0;top:${base}px;width:${w}px;height:3px;background:${KC.line}"></div>`;
    bars.forEach((b, i) => {
      const at = b.at || 0, cx = gap * (i + 0.5), x0 = cx - bw / 2;
      const g3 = pre >= 1 ? 1 : eo(f, riseAt + i * stg, p.grow || 22), frac = pre >= 1 ? eo(f, at, p.grow || 22) : pre * eo(f, at, 16) + (1 - pre) * g3;
      const bh = (base - top) * ((b.value || 0) / max) * frac;
      const col = b.color || (b.highlight ? p.highlightColor || KC.blue : p.color || "#b9c6de");
      if (f >= at && bh > 0.5) {
        out += face(x0, base - bh, bw, bh, col, "translateZ(0)", "top");                                   // 앞면
        if (D > 0.5) {
          out += face(x0 + bw, base - bh, D, bh, shade(col, -0.22), "rotateY(90deg)", "left");            // 옆면
          out += face(x0, base - bh, bw, D, shade(col, 0.28), "rotateX(-90deg)", "top");                 // 윗면
        }
        rec({ kind: "rect", x: x0, y: base - bh, w: bw, h: bh, own: "bar" + i });
      }
      // add{value,label,at,dur(24),size,color}: 막대 위에 증가분 입체가 다른 색으로 솟는다 (+103조 같은 늘어난 몫)
      let ah = 0;
      const ad = b.add;
      if (ad && ad.value && f >= (ad.at || 0)) {
        ah = (base - top) * (ad.value / max) * eo(f, ad.at || 0, ad.dur || 24);
        const ac = ad.color || KC.coral, ay = base - bh - ah;
        if (ah > 0.5) {
          out += face(x0, ay, bw, ah, ac, "translateZ(0)", "top");
          if (D > 0.5) {
            out += face(x0 + bw, ay, D, ah, shade(ac, -0.22), "rotateY(90deg)", "left");
            out += face(x0, ay, bw, D, shade(ac, 0.28), "rotateX(-90deg)", "top");
          }
          rec({ kind: "rect", x: x0, y: ay, w: bw, h: ah, own: "bar" + i + "add" });
        }
        const lo = eo(f, (ad.at || 0) + 8, 10);
        if (ad.label && lo > 0) out += bill(x0 + bw + D + 24 + measureText(ad.label, ad.size || 40).w / 2, ay + ah / 2 + (ad.size || 40) * 0.45, -D / 2, xesc(ad.label), ad.size || 40, ac, 800, lo);
      }
      // valueAt/valueDur: 숫자가 그 시점에 카운트업 (증가분이 다 솟은 뒤 543.5조처럼)
      const vo = b.valueAt != null ? eo(f, b.valueAt, 8) : pre >= 1 ? eo(f, at + 10, 10) : eo(f, riseAt + i * stg + 6, 10);
      if (b.display && vo > 0) {
        const cnt = b.valueAt != null ? eo(f, b.valueAt, b.valueDur || 24) : pre >= 1 ? frac : g3;
        const txt = xesc(displayText(b.display, { text: 1, count: cnt }));
        out += bill(cx, base - bh - ah - 16 - D * 0.3, -D / 2, txt, p.valueSize || 44, b.highlight ? KC.blue : KC.navy, 800, vo);   // 감싸는 div를 두면 3D가 납작해진다
      }
      if (b.label) out += bill(cx, base + 30 + (p.labelSize || 30), 24 * t, xesc(b.label), p.labelSize || 30, KC.gray, 600);
      tops.push([cx, base - bh - ah - 16 - D * 0.3]);
    });
    // annotate{text, at, color}: 마지막(강조) 막대 위에 증감 글자 (팝)
    const an = p.annotate;
    if (an && an.text && tops.length) {
      const a = popS(f, an.at || 0, 12), [ax, ay] = tops[tops.length - 1];
      if (a.o > 0) out += bill(ax, ay - (p.valueSize || 44) * 1.25, -D / 2, xesc(an.text), Math.round((p.valueSize || 44) * 0.9 * a.s), an.color || KC.coral, 800, a.o);
    }
    return `<div style="position:absolute;inset:0;perspective:${K.perspective}px;perspective-origin:50% 40%">` +
      `<div style="position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% ${(top + base) / 2}px;transform:translateY(${40 * t}px) scale(${zoom}) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${D / 2}px)">${out}</div></div>`;
  },
  // 3D 뒤집기 카드. 카드 뒷면(색 + 번호)이 2D로 보이다가 tilt에서 무대가 3D로 기울고, 카드가 차례로 뒤집혀 앞면이 나온 뒤 다시 정면으로(settle).
  // props: cards[{num,title,sub,color,back,at,flipAt}], gap(40), tilt{at:20,dur:18,rx:18,ry:-24,zoom:0.9}, flip{at,dur:22,stagger:12},
  //        settle{at,dur:18} | false(기울어진 채), titleSize(56), subSize(28), front(true: 처음부터 앞면 — 뒤집기 없이 기울기만)
  cards3d(w, h, p, f) {
    const cs = p.cards || [], n = Math.max(1, cs.length), gap = p.gap || 40, cw = (w - gap * (n - 1)) / n, pad = Math.max(24, Math.min(40, Math.round(cw * 0.1)));
    const K = KIT_PARAMS.cards3d, tilt = Object.assign({ at: 20, dur: 18, rx: K.rx, ry: K.ry, zoom: K.zoom }, p.tilt || {});
    const fl = Object.assign({ at: tilt.at + tilt.dur - 6, dur: 22, stagger: 12 }, p.flip || {});
    const flipAt = (c, i) => (c.flipAt != null ? c.flipAt : fl.at + i * fl.stagger);   // 카드별 flipAt: 그 단어가 들리는 순간 뒤집기
    const flipEnd = Math.max(...cs.map(flipAt)) + fl.dur;
    const st = p.settle === false ? null : Object.assign({ at: flipEnd + 24, dur: 18 }, p.settle || {});
    const k = eio(lin(f, tilt.at, tilt.dur)) * (st ? 1 - eio(lin(f, st.at, st.dur)) : 1);
    // mode "fold"(기본): 무대는 정면 그대로(가로선이 평행), 정면 3등분 카드 중 양옆만 안쪽으로 살짝 꺾여 병풍처럼 입체 (2026-11-19 사용자)
    // mode "tilt": 무대 전체가 비스듬히 기운다 (예전 방식 — 가로선이 사선으로 모인다)
    const fold = (p.mode || K.mode) !== "tilt", fa = (tilt.fold != null ? tilt.fold : K.fold) * k, mid = (n - 1) / 2;
    const rx = fold ? 0 : tilt.rx * k, ry = fold ? 0 : tilt.ry * k, zoom = 1 - (1 - (fold ? K.foldZoom : tilt.zoom)) * k;
    // 여러 줄 글자는 가장 긴 줄 기준으로 맞춘다 (한 줄로 재면 너무 작아짐, 2026-11-20)
    const fitW = cw - pad * 2, fit = (t, want) => (t ? Math.min(want, Math.floor(fitW / Math.max(0.01, ...String(t).split("\n").map((ln) => measureText(ln, 1).w)))) : want);
    const tsz = Math.max(32, Math.min(...cs.map((c) => fit(c.title, p.titleSize || 56)))), ssz = Math.max(20, Math.min(...cs.map((c) => fit(c.sub, p.subSize || 28))));
    const faceCss = "position:absolute;inset:0;border-radius:22px;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-sizing:border-box;overflow:hidden";
    let out = "";
    // zoomTo{index,at,dur,scale}: 그 카드가 화면 가운데로 오며 커지고 나머지는 사라진다 (7개 전략 카드 → 그 전략 시작, 2026-11-20 사용자)
    const zt = p.zoomTo ? eio(lin(f, p.zoomTo.at, p.zoomTo.dur || 24)) : 0;
    cs.forEach((c, i) => {
      const at = c.at || 0, a = p.pop === false ? { o: eo(f, at, 10), s: 1 } : popS(f, at, 12); if (a.o <= 0) return;
      const col = c.color || p.accent || KC.blue, x = i * (cw + gap);
      const g = p.front || c.front ? 1 : easeOut(lin(f, flipAt(c, i), fl.dur));
      const rot = 180 * (1 - g), lift = 36 * Math.sin(Math.PI * g) * (p.front || c.front ? 0 : 1);
      const isZ = p.zoomTo && p.zoomTo.index === i, zo = p.zoomTo && !isZ ? 1 - zt : 1;
      const ztr = isZ && zt > 0 ? `translate(${((w / 2 - (x + cw / 2)) * zt).toFixed(1)}px,0) scale(${(1 + ((p.zoomTo.scale || 2.4) - 1) * zt).toFixed(3)}) ` : "";
      rec({ kind: "frame", x, y: 0, w: cw, h, pad, own: "card" + i });
      const back = `<div style="${faceCss};background:${col};transform:rotateY(180deg);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:${FONT}">` +
        `<div style="font-size:${Math.min(110, cw * 0.36)}px;font-weight:800;line-height:1">${xesc(c.backNum != null ? c.backNum : c.num || "")}</div>` +
        (c.back ? `<div style="font-size:30px;font-weight:600;margin-top:18px;opacity:.9">${xesc(c.back)}</div>` : "") + `</div>`;
      const front = `<div style="${faceCss};background:#fff;border:2px solid ${KC.line};box-shadow:0 18px 40px rgba(11,31,75,${0.08 + 0.12 * k});padding:${pad}px;display:flex;flex-direction:column;justify-content:center;text-align:center;font-family:${FONT}">` +
        `<div style="position:absolute;left:0;top:0;right:0;height:10px;background:${col}"></div>` +
        (c.num ? `<div style="font-size:52px;font-weight:800;color:${col};opacity:.85;margin-bottom:14px">${xesc(c.num)}</div>` : "") +
        `<div style="font-size:${tsz}px;font-weight:700;color:${KC.navy};line-height:1.2;word-break:keep-all;white-space:pre-line">${xesc(c.title || "")}</div>` +
        (c.sub ? `<div style="font-size:${ssz}px;font-weight:500;color:${KC.gray};line-height:1.4;margin-top:16px;word-break:keep-all;white-space:pre-line">${hlText(c.sub, c.hl, KC.gray, f)}</div>` : "") + `</div>`;
      out += `<div style="position:absolute;left:${x}px;top:0;width:${cw}px;height:${h}px;transform-style:preserve-3d;opacity:${(a.o * zo).toFixed(3)};z-index:${isZ ? 2 : 1};` +
        `transform-origin:${fold && i < mid ? "100% 50%" : fold && i > mid ? "0% 50%" : "50% 50%"};` +
        `transform:${ztr}translateZ(${lift}px) rotateY(${fold && mid > 0 ? fa * (mid - i) / mid : 0}deg)"><div style="position:absolute;inset:0;transform-style:preserve-3d;transform:rotateY(${rot}deg) scale(${a.s})">${back}${front}</div></div>`;
    });
    return `<div style="position:absolute;inset:0;perspective:${K.perspective}px;perspective-origin:50% 45%">` +
      `<div style="position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%;transform:scale(${zoom}) rotateX(${rx}deg) rotateY(${ry}deg)">${out}</div></div>`;
  },
  // 순위 상승: 1·2·3위 입체 막대 + 물결치며 솟는 붉은 리본 화살표 + 오른쪽 위로 흐르는 배경. "격차 확대"·"1등이 올라간다"
  // props: labels(["3위","2위","1위"]), heights([0.3,0.42,0.55]), rise(1위가 더 올라갈 높이 0.32), at, riseAt(30), arrowAt(10), arrowDur(40),
  //        color(코랄 화살표), barColor, topColor(1위 막대), tag("1위")
  rankRise(w, h, p, f) {
    const id = SVG_ID + "rr", col = p.color || KC.coral, dark = shade(col, -0.3);
    const base = h - 70, bw = Math.min(150, w * 0.12), dx = bw * 0.38, dy = bw * 0.22;
    const labels = p.labels || ["3위", "2위", "1위"], hs = p.heights || [0.3, 0.42, 0.55];
    const at = p.at || 0, rise = p.rise == null ? 0.32 : p.rise, ra = p.riseAt == null ? 30 : p.riseAt;
    let out = `<defs><clipPath id="${id}c"><rect width="${w}" height="${h}"/></clipPath>` +
      `<linearGradient id="${id}f" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${col}" stop-opacity=".22"/></linearGradient></defs>`;
    // 배경: 대각선 줄무늬·점이 오른쪽 위로 흘러간다
    const sp = 90, off = (f * 2.2) % sp;
    let bg = `<rect width="${w}" height="${h}" fill="url(#${id}f)" opacity="${eo(f, at, 20)}"/>`;
    for (let k = -2; k < (w + h) / sp + 2; k++) {
      const x = k * sp + off;
      bg += `<line x1="${x - h}" y1="${h}" x2="${x}" y2="0" stroke="${col}" stroke-width="2" opacity=".10"/>`;
    }
    for (let k = 0; k < 14; k++) {   // 떠오르는 점
      const q = ((f * 0.006 + k * 0.071) % 1), x = (k * 137) % w + q * 220, y = h - q * (h + 60);
      bg += `<circle cx="${x % w}" cy="${y}" r="${3 + (k % 3)}" fill="${col}" opacity="${(0.25 * Math.sin(Math.PI * q)).toFixed(2)}"/>`;
    }
    out += `<g clip-path="url(#${id}c)">${bg}</g>`;
    // 입체 막대 (왼→오: 3위 2위 1위)
    const xs = [w * 0.16, w * 0.36, w * 0.56];
    labels.forEach((lb, i) => {
      const g = eo(f, at + i * 6, 18), top1 = i === 2 ? rise * eo(f, ra, 40) : 0;
      const bh = (base - 40) * (hs[i] + top1) * g; if (bh < 1) return;
      const x = xs[i] - bw / 2, y = base - bh, c = i === 2 ? p.topColor || KC.blue : p.barColor || "#b9c6de";
      out += `<path d="M ${x + bw} ${y} L ${x + bw + dx} ${y - dy} L ${x + bw + dx} ${base - dy} L ${x + bw} ${base} Z" fill="${shade(c, -0.22)}"/>` +
        `<path d="M ${x} ${y} L ${x + dx} ${y - dy} L ${x + bw + dx} ${y - dy} L ${x + bw} ${y} Z" fill="${shade(c, 0.3)}"/>` +
        `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${c}"/>`;
      rec({ kind: "rect", x, y, w: bw, h: bh, own: "rank" + i });
      out += T(xs[i], base + 44, lb, { size: 34, weight: 800, color: i === 2 ? KC.blue : KC.gray, anchor: "middle", own: "rank" + i });
      if (i === 2 && p.tag !== false) {
        const a = popS(f, ra + 20, 12);
        if (a.o) out += `<g opacity="${a.o}" transform="${scaleAt(xs[i] + dx / 2, y - dy - 36, a.s)}"><rect x="${xs[i] + dx / 2 - 62}" y="${y - dy - 66}" width="124" height="56" rx="28" fill="${KC.blue}"/>` +
          Tsvg(xs[i] + dx / 2, y - dy - 38, p.tag || "1위", { size: 32, weight: 800, color: "#fff", anchor: "middle", base: "central" }) + `</g>`;
      }
    });
    // 물결치며 솟는 리본 화살표 (그려진 뒤에도 물결이 흐른다)
    const ad = p.arrowDur || 40, ga = eo(f, (p.arrowAt == null ? 10 : p.arrowAt) + at, ad);
    if (ga > 0) {
      const N = 60, ph = f * 0.12, pts = [];
      const x0 = w * 0.04, y0 = h * 0.86, x1 = w * 0.9, y1 = h * 0.1;
      for (let k = 0; k <= N * ga; k++) {
        const u = k / N, amp = 26 * Math.sin(Math.PI * u);
        const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
        const wv = amp * Math.sin(u * Math.PI * 3 - ph);
        pts.push([x0 + (x1 - x0) * u + (nx / nl) * wv, y0 + (y1 - y0) * (u * u * 0.35 + u * 0.65) + (ny / nl) * wv]);
      }
      if (pts.length > 1) {
        const d = "M " + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" L ");
        out += `<path d="${d}" transform="translate(8 12)" stroke="${dark}" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>` +
          `<path d="${d}" stroke="${col}" stroke-width="28" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<path d="${d}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".35" transform="translate(-4 -6)"/>`;
        const [ex, ey] = pts[pts.length - 1], [px, py] = pts[Math.max(0, pts.length - 4)], ang = (Math.atan2(ey - py, ex - px) * 180) / Math.PI;
        out += `<g transform="translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${ang.toFixed(1)})"><polygon points="-8,-40 52,0 -8,40" fill="${dark}" transform="translate(6 10)" opacity=".55"/><polygon points="-8,-40 52,0 -8,40" fill="${col}"/></g>`;
      }
    }
    return out;
  },
  // 과녁 고리: 가운데 영역에서 한 겹씩 고리가 넓어진다(기울어진 입체 원판). 끝나면 물결이 계속 바깥으로 퍼진다
  // props: center("TF"), rings[{label,at}], at, gap(1겹 두께), tilt(0.42 세로 비율), color, labelSize(40)
  rings(w, h, p, f) {
    const cx = w * 0.5, cy = h * 0.5, rs = p.rings || [], n = Math.max(1, rs.length), tilt = p.tilt || 0.42;
    const R0 = p.r0 || 90, gap = p.gap || Math.min((w * 0.46 - R0) / n, (h * 0.46 / tilt - R0) / n, 220), col = p.color || KC.blue, at = p.at || 0;
    let out = "";
    for (let i = n; i >= 0; i--) {   // 바깥 고리부터 그려 안쪽이 위로
      const a = i === 0 ? eo(f, at, 14) : eo(f, rs[i - 1].at != null ? rs[i - 1].at : at + 20 + (i - 1) * 30, 22); if (a <= 0) continue;
      const R = (R0 + gap * i) * (0.6 + 0.4 * a), c = mixHex(col, "#ffffff", Math.min(0.82, i / (n + 1) * 0.95));
      out += `<ellipse cx="${cx}" cy="${cy + 16}" rx="${R}" ry="${R * tilt}" fill="${shade(c, -0.18)}" opacity="${a}"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * tilt}" fill="${c}" opacity="${a}" stroke="#fff" stroke-width="3"/>`;
    }
    // 바깥으로 퍼지는 물결
    const last = rs.length ? (rs[rs.length - 1].at != null ? rs[rs.length - 1].at : at + 20 + (n - 1) * 30) + 22 : at + 20;
    if (f > last) for (let k = 0; k < 2; k++) {
      const q = (((f - last) / 70) + k / 2) % 1, R = (R0 + gap * n) * (1 + 0.25 * q);
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * tilt}" fill="none" stroke="${col}" stroke-width="4" opacity="${(0.5 * (1 - q)).toFixed(2)}"/>`;
    }
    if (p.center) out += T(cx, cy, p.center, { size: p.centerSize || 54, weight: 800, color: "#fff", anchor: "middle", base: "central", opacity: eo(f, at, 14) });
    rs.forEach((r, i) => {   // 라벨은 그 고리 띠의 앞쪽(아래) 가운데에 — 지시선 없이 과녁처럼 읽힌다
      const a = eo(f, (r.at != null ? r.at : at + 20 + i * 30) + 10, 12); if (!a || !r.label) return;
      const Rm = R0 + gap * (i + 0.62), ly = cy + Rm * tilt + 4, light = i / Math.max(1, n) > 0.45;
      out += T(cx, ly, r.label, { size: Math.min(p.labelSize || 40, Math.round(gap * tilt * 0.72)), weight: 800, color: light ? KC.navy : "#fff", anchor: "middle", base: "central", opacity: a });
    });
    return out;
  },
  // 3분할 빗면 패널: 화면을 비스듬히 셋으로 나누고, 패널마다 아이콘이 움직인다
  // props: panels[{icon,title,sub,color,at}], skew(14), gap(24), titleSize(56), subSize(30)
  panels3(w, h, p, f) {
    const ps = p.panels || [], n = Math.max(1, ps.length), gap = p.gap || 24, sk = Math.tan(((p.skew == null ? 14 : p.skew) * Math.PI) / 180) * h;
    const pw = (w - sk - gap * (n - 1)) / n;
    let out = "";
    ps.forEach((q, i) => {
      // still:true — 튀어 오르지 않고 딱 나온 뒤 멈춤(흔들림·아이콘 움직임 없음). 2026-11-20 사용자: "흔들흔들 울렁거려"
      const still = !!p.still;
      const at = q.at != null ? q.at : i * 12, g = (still ? easeOut : easeOutBack)(clamp(lin(f, at, still ? 14 : 22))), o = clamp(lin(f, at, 10));
      if (o <= 0) return;
      const x = i * (pw + gap), bob = still ? 0 : Math.sin((f - at) * 0.07 + i) * 6 * clamp(lin(f, at + 22, 20));
      const ty = (1 - g) * 120 + bob, c = q.color || [KC.blue, KC.navy, "#4b8bff"][i % 3];
      const poly = `${x + sk},0 ${x + sk + pw},0 ${x + pw},${h} ${x},${h}`;
      out += `<g opacity="${o}" transform="translate(0 ${ty.toFixed(1)})"><polygon points="${poly}" fill="${c}"/>` +
        `<polygon points="${poly}" fill="url(#${SVG_ID}pn)" opacity=".25"/>`;
      const mx = x + sk / 2 + pw / 2;
      out += badgeIcon(q.icon, mx, h * 0.34, Math.min(pw * 0.42, 190), still ? Math.min(f - at, 18) : f - at, c, q.img);
      out += T(mx, h * 0.66, q.title || "", { size: p.titleSize || 56, weight: 800, color: "#fff", anchor: "middle", own: "pn" + i });
      if (q.sub) out += T(mx, h * 0.66 + (p.titleSize || 56) * 0.6 + 44, q.sub, { size: p.subSize || 30, weight: 600, color: "rgba(255,255,255,.85)", anchor: "middle", own: "pn" + i });
      out += `</g>`;
      rec({ kind: "frame", x: x + sk * 0.5, y: 0, w: pw, h, pad: 24, own: "pn" + i });
    });
    return `<defs><linearGradient id="${SVG_ID}pn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` + out;
  },
  // 블록 쌓기(젠가): 아이콘이 나왔다가 블록이 되어 빈자리에 끼워진다 → 다 쌓이면 위로 올라가며 미국 지도가 나타나 파랗게 물든다
  // props: blocks[{label,icon,at}], mapAt, mapLabel("미국 시장"), color
  stackBuild(w, h, p, f) {
    if (p.center) return stackCenter(w, h, p, f);
    const bs = p.blocks || [], col = p.color || KC.blue, n = Math.max(1, bs.length);
    const bw = Math.min(520, w * 0.42), bh = 92, dx = 70, dy = 40, cx = w * 0.32, base = h - 60;
    const mapAt = p.mapAt != null ? p.mapAt : (bs.length ? (bs[bs.length - 1].at || 0) + 60 : 60);
    const lift = 200 * eio(lin(f, mapAt - 10, 40));   // 다 쌓이면 블록 더미가 아래로(카메라가 위로)
    let out = `<g transform="translate(0 ${lift.toFixed(1)})">`;
    bs.forEach((b, i) => {
      const at = b.at || 0, y = base - (i + 1) * (bh + 6);
      // 1) 아이콘 등장 (0~24f) 2) 블록으로 바뀌며 옆에서 미끄러져 끼워짐 (24~44f)
      const ia = popS(f, at, 12), slide = eio(lin(f, at + 22, 22)), x = cx - bw / 2 + (1 - slide) * (w * 0.5);
      const shades = [col, shade(col, -0.15), mixHex(col, "#ffffff", 0.25)];
      const c = shades[i % 3];
      if (slide <= 0 && ia.o) out += `<g opacity="${ia.o}" transform="${scaleAt(w * 0.78, y + bh / 2, ia.s)}"><circle cx="${w * 0.78}" cy="${y + bh / 2}" r="70" fill="${mixHex(c, "#ffffff", 0.86)}" stroke="${c}" stroke-width="6"/>${nodeIcon(b.icon, w * 0.78, y + bh / 2, 88, f - at, KC.navy, c, b.img, !!KIT_PARAMS.nodes.iconColor)}</g>`;
      if (slide > 0) {
        out += `<path d="M ${x + bw} ${y} L ${x + bw + dx} ${y - dy} L ${x + bw + dx} ${y + bh - dy} L ${x + bw} ${y + bh} Z" fill="${shade(c, -0.25)}"/>` +
          `<path d="M ${x} ${y} L ${x + dx} ${y - dy} L ${x + bw + dx} ${y - dy} L ${x + bw} ${y} Z" fill="${shade(c, 0.28)}"/>` +
          `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${c}"/>` +
          badgeIcon(b.icon, x + 56, y + bh / 2, 64, f - at, c, b.img) +
          Tsvg(x + 104, y + bh / 2, b.label || "", { size: 40, weight: 800, color: "#fff", base: "central" });
      } else if (f >= at - 30) {   // 빈자리 표시 (점선 틀)
        out += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${bh}" fill="none" stroke="${KC.line}" stroke-width="3" stroke-dasharray="12 10" opacity="${clamp(lin(f, at - 30, 10))}"/>`;
      }
      if (slide >= 1) rec({ kind: "rect", x: cx - bw / 2, y: y + lift, w: bw, h: bh, own: "blk" + i });
    });
    out += `</g>`;
    // 미국 지도: 흰 지도 → 왼쪽부터 파랗게 물든다
    const ma = eo(f, mapAt, 20);
    if (ma > 0) {
      const mw = w * 0.5, mh = mw * 0.6, mx = w * 0.46, my = Math.max(10, base - n * (bh + 6) - mh + lift - 60);
      const d = US_PATH.map(([lo, la], k) => `${k ? "L" : "M"} ${(mx + ((lo + 125) / 58) * mw).toFixed(1)} ${(my + ((49.5 - la) / 25.5) * mh).toFixed(1)}`).join(" ") + " Z";
      const fill = eio(lin(f, mapAt + 20, 50)), id = SVG_ID + "us";
      out += `<defs><clipPath id="${id}"><rect x="${mx - 10}" y="${my - 10}" width="${(mw + 20) * fill}" height="${mh + 20}"/></clipPath></defs>` +
        `<g opacity="${ma}"><path d="${d}" transform="translate(6 10)" fill="${KC.navy}" opacity=".12"/><path d="${d}" fill="#fff" stroke="${col}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="${d}" fill="${col}" clip-path="url(#${id})"/></g>`;
      if (p.mapLabel) out += T(mx + mw / 2, my + mh + 56, p.mapLabel, { size: 46, weight: 800, color: col, anchor: "middle", opacity: eo(f, mapAt + 40, 14) });
    }
    return out;
  },
  // 통과 화살표: 굵은 파란 화살표가 왼→오로 이동하며 그 위를 지나간다 (업무 카드들을 관통, 2026-11-20 사용자)
  // props: at, dur(60), y(h/2), len(420), thick(54), color
  passArrow(w, h, p, f) {
    const q = lin(f, p.at || 0, p.dur || 60); if (q <= 0 || q >= 1) return "";
    const len = p.len || 420, th = p.thick || 54, y = p.y != null ? p.y : h / 2, col = p.color || KC.blue, hd = th * 1.3;
    const x0 = -len + (w + len * 2) * eio(q), o = clamp(q * 8) * clamp((1 - q) * 8);
    return `<g opacity="${o.toFixed(2)}"><rect x="${x0.toFixed(1)}" y="${y - th / 2}" width="${len - hd}" height="${th}" rx="${th / 2}" fill="${col}"/>` +
      `<polygon points="${(x0 + len - hd - 6).toFixed(1)},${y - th} ${(x0 + len).toFixed(1)},${y} ${(x0 + len - hd - 6).toFixed(1)},${y + th}" fill="${col}"/></g>`;
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
  const ec = ECHO_SELF.has(el.kind) && el.t ? echoAt(el, lf + el.t.in) : null;
  const props = ec ? Object.assign({}, el.props, { _echo: ec }) : el.props || {};
  const body = fn ? fn(w, h, props, lf) : T(w / 2, h / 2, "알 수 없는 diagram kind: " + el.kind, { size: 32, color: KC.coral, anchor: "middle" });
  if (HTML_KINDS.has(el.kind)) return `<div style="position:relative;width:${w}px;height:${h}px;overflow:visible">${body}</div>`;   // CSS 3D 부품
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" style="overflow:visible;display:block">${body}</svg>`;
}
const HTML_KINDS = new Set(["bars3d", "cards3d"]);
// 미국 본토 윤곽 (경도·위도, 단순화) — stackBuild 지도
const US_PATH = [[-124.7,48.4],[-123.3,49],[-95.2,49],[-89.6,48.0],[-84.8,46.6],[-82.4,43.0],[-79.0,43.3],[-76.5,44.2],[-75.0,45.0],[-71.5,45.0],[-69.2,47.4],[-67.0,45.0],[-70.2,43.7],[-70.6,41.6],[-73.9,40.6],[-74.2,39.5],[-75.5,38.4],[-76.0,36.9],[-75.5,35.2],[-77.9,33.9],[-79.9,32.6],[-81.4,30.7],[-80.0,26.7],[-80.4,25.2],[-81.8,25.9],[-82.8,28.0],[-82.7,29.9],[-84.3,30.0],[-86.5,30.4],[-89.6,30.2],[-89.4,29.1],[-91.5,29.5],[-93.8,29.7],[-95.0,29.2],[-97.2,27.6],[-97.4,25.9],[-99.1,26.4],[-100.3,28.3],[-101.4,29.8],[-103.1,29.0],[-104.5,29.6],[-106.5,31.8],[-108.2,31.8],[-111.1,31.3],[-114.8,32.5],[-117.1,32.5],[-118.5,34.0],[-120.6,34.6],[-121.9,36.6],[-122.5,37.8],[-123.8,39.8],[-124.2,41.9],[-124.5,43.0],[-124.0,46.3]];

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
