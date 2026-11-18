// 모듈2 배치 검사 — 장면마다 화면에 같이 보이는 글자·선·도형의 위치를 계산해 겹침·붙음·화면 밖을 찾는다.
//   node layout_audit.mjs <project> [--json] [--section s21]
// 그리는 규칙은 스튜디오·렌더와 같은 templates/module2/studio/anim.js (mergeSection + diagram 위치 기록).
// 결과 종류: overlap(겹침, 오류) · crossing(선이 글자를 가로지름, 오류) · edge(카드·칩 안 글자가 테두리에 붙거나 넘침, 오류) · crowded(24px 미만으로 붙음, 경고) · offscreen(화면 밖, 경고)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, "..", "..");
const A = await import(pathToFileURL(path.join(PLUGIN, "templates", "module2", "studio", "anim.js")).href);

const args = process.argv.slice(2);
const P = path.resolve(args[0] || ".");
const asJson = args.includes("--json");
const only = args.includes("--section") ? args[args.indexOf("--section") + 1] : null;
const rj = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

const GAP_MIN = 24;           // 서로 다른 내용 사이 최소 숨 쉴 간격(px) — 2026-11-18 사용자: '간격이 안 맞아 겹치고 붙어 있다'
const GAP_SHAPE = 14;         // 글자와 남의 도형(원·막대) 사이 최소 간격
const PAD_MIN = 20;           // 카드·칩 같은 테두리 안 글자는 가장자리에서 최소 이만큼 (2026-11-18 사용자: '대체 Co-GP' 카드 끝에 붙음)
const FRAME = { w: 1920, h: 1080, margin: 24 };

const cfg = rj(path.join(P, "project.json"), {});
const theme = rj(path.join(P, "design", "theme.json")) || rj(path.join(PLUGIN, "templates", "module2", "theme.json"));
// 마일스톤 바(합본 때 영상 맨 위에 겹침)가 켜져 있으면 그 높이 + 16px 안으로 글자가 들어오면 안 된다
const MS = theme && theme.milestones && theme.milestones.enabled !== false && (cfg.milestones || []).length ? (theme.milestones.height || 64) + 16 : 0;
const msHidden = new Set(MS && theme.milestones.hideOpening !== false && cfg.milestones[0] ? cfg.milestones[0].sections || [] : []);

function textBox(el) {
  const f = el.font || {}, size = f.size || 48, lh = f.lineHeight || 1.25;
  const raw = String(el.text || "").replace(/\[\[|\]\]/g, "");
  if (!raw.trim()) return null;
  if (el.fill) {                                                     // 칩·박스: 박스 자체가 차지하는 자리 + 안쪽 글자 폭(edge 검사용)
    const m = A.measureText(raw, size, lh);
    return { x: el.x, y: el.y, w: el.w, h: el.h, inner: m.w, boxed: true };
  }
  const m = A.measureText(raw, size, lh);
  const w = Math.min(m.w, el.w || m.w), th = m.lines * size * lh;
  const pad = typeof el.pad === "number" ? el.pad : 0;
  const x = f.align === "center" ? el.x + (el.w - w) / 2 : f.align === "right" ? el.x + el.w - w - pad : el.x + pad;
  const y = el.valign === "middle" ? el.y + (el.h - th) / 2 : el.valign === "bottom" ? el.y + el.h - th : el.y + pad;
  // 글자 실제 잉크 높이 ≈ 줄높이의 안쪽
  const inset = (size * lh - size) / 2;
  return { x, y: y + inset, w, h: th - inset * 2 };
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
function gap(a, b) {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return { dx, dy };
}
function segHitsBox(l, b, pad = 4) {
  const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad;
  // Liang–Barsky
  let t0 = 0, t1 = 1; const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  for (const [p, q] of [[-dx, l.x1 - x0], [dx, x1 - l.x1], [-dy, l.y1 - y0], [dy, y1 - l.y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

function framesOf(m) {
  const fr = new Set();
  for (const el of m.elements) {
    const t = el.t; fr.add(t.in + (t.enterDur || 12) + 14);
    if (el.type === "diagram" || el.type === "3d") {
      const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (["at", "activeAt", "subAt"].includes(k) && typeof x === "number") fr.add(t.in + x + 30); else walk(x); } };
      walk(el.props || {});
    }
  }
  return [...fr].filter((f) => f >= 0 && f < m.duration).sort((a, b) => a - b);
}

function audit(sid) {
  const d = path.join(P, "sections", sid);
  const m = A.mergeSection(rj(path.join(d, "layout.json"), { elements: [] }), rj(path.join(d, "timeline.json"), {}), rj(path.join(d, "edits.json"), {}), theme);
  const found = new Map();
  for (const f of framesOf(m)) {
    const texts = [], lines = [], shapes = [], frames = [];
    for (const el of m.elements) {
      const st = A.stateAt(el, f);
      if (!st.visible || st.opacity < 0.6) continue;
      if (el.type === "text") { const b = textBox(el); if (b) texts.push(Object.assign(b, { id: el.id, label: String(el.text).slice(0, 24), own: el.id })); }
      else if (el.type === "diagram") {
        if (["chapter", "ghost"].includes(el.kind)) continue;
        for (const p of A.collectDiagram(el, f - el.t.in)) {
          const own = el.id + "/" + (p.own || p.kind + Math.round(p.x || p.x1));
          if (p.kind === "text") texts.push({ x: p.x, y: p.y, w: p.w, h: p.h, id: el.id, label: p.text, own });
          else if (p.kind === "frame") frames.push({ x: p.x, y: p.y, w: p.w, h: p.h, id: el.id, own });
          else if (p.kind === "line") lines.push(Object.assign({}, p, { id: el.id, own }));
          else shapes.push({ x: p.x, y: p.y, w: p.w, h: p.h, id: el.id, kind: p.kind, own });
        }
      } else if (el.type === "3d") shapes.push({ x: el.x + el.w * 0.1, y: el.y + el.h * 0.1, w: el.w * 0.8, h: el.h * 0.8, id: el.id, kind: "3d", own: el.id });
    }
    const add = (kind, a, b, px) => {
      const key = [kind, a.label, b ? b.label || b.kind : ""].join("|");
      if (!found.has(key)) found.set(key, { section: sid, t: +(f / m.fps).toFixed(1), kind, a: `${a.id}「${a.label}」`, b: b ? `${b.id}「${b.label || b.kind}」` : "", px: Math.round(px) });
    };
    // 테두리 안 글자: 칩은 글자 폭 + 양옆 여백이 칩 폭 안에, 카드(frame)는 같은 카드의 글자가 가장자리에서 PAD_MIN 이상
    for (const a of texts) {
      if (a.boxed && a.inner + PAD_MIN * 2 > a.w) add("edge", a, null, (a.w - a.inner) / 2);
      for (const fr of frames) {
        if (fr.own !== a.own) continue;
        const m = Math.min(a.x - fr.x, fr.x + fr.w - (a.x + a.w), a.y - fr.y, fr.y + fr.h - (a.y + a.h));
        if (m < PAD_MIN) add("edge", a, { id: fr.id, kind: "카드 테두리" }, m);
      }
    }
    for (let i = 0; i < texts.length; i++) {
      const a = texts[i];
      if (a.x < FRAME.margin || a.y < FRAME.margin / 2 || a.x + a.w > FRAME.w - FRAME.margin || a.y + a.h > FRAME.h - FRAME.margin / 2) add("offscreen", a, null, 0);
      else if (MS && !msHidden.has(sid) && a.y < MS) add("milestone", a, null, MS - a.y);
      for (let j = i + 1; j < texts.length; j++) {
        const b = texts[j];
        if (a.own === b.own && a.own.endsWith("/word")) continue;   // 한 단어의 글자들(대형 키워드 스태거)
        const ov = inter(a, b);
        if (ov > 0) add("overlap", a, b, Math.sqrt(ov));
        else { const g = gap(a, b); const near = (g.dx === 0 && g.dy < GAP_MIN) || (g.dy === 0 && g.dx < GAP_MIN); if (near) add("crowded", a, b, Math.max(g.dx, g.dy)); }
      }
      for (const l of lines) if (l.own !== a.own && segHitsBox(l, a)) add("crossing", a, { id: l.id, kind: "선/화살표" }, 0);
      for (const s of shapes) {
        if (s.own === a.own) continue;
        const kn = { id: s.id, kind: s.kind === "circle" ? "원" : s.kind === "rect" ? "막대" : s.kind };
        if (inter(a, s) > 40) add("overlap", a, kn, Math.sqrt(inter(a, s)));
        else { const g = gap(a, s); if ((g.dx === 0 && g.dy < GAP_SHAPE) || (g.dy === 0 && g.dx < GAP_SHAPE)) add("crowded", a, kn, Math.max(g.dx, g.dy)); }
      }
    }
  }
  return [...found.values()];
}

const sids = (cfg.sections || []).map((s) => s.id).filter((s) => !only || s === only);
const all = sids.flatMap(audit);
if (asJson) console.log(JSON.stringify(all));
else {
  const KN = { overlap: "겹침", crossing: "선이 글자를 가로지름", edge: "테두리에 붙음", milestone: "마일스톤 바와 겹침", crowded: "너무 붙음", offscreen: "화면 밖" };
  for (const x of all) console.log(`${x.section} ${String(x.t).padStart(5)}s  ${KN[x.kind]}  ${x.a}${x.b ? " ↔ " + x.b : ""}${x.px ? ` (${x.px}px)` : ""}`);
  console.log(`\n합계 ${all.length}건 — 겹침 ${all.filter((x) => x.kind === "overlap").length} · 가로지름 ${all.filter((x) => x.kind === "crossing").length} · 테두리 ${all.filter((x) => x.kind === "edge").length} · 붙음 ${all.filter((x) => x.kind === "crowded").length} · 화면 밖 ${all.filter((x) => x.kind === "offscreen").length}`);
}
