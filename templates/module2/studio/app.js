// 모듈2 스튜디오 — 섹션 리뷰·직접 편집·코멘트·마스킹 검토·계정 연결
import { mergeSection, stateAt, displayText, richSegments, fmtTime, ENTER_EFFECTS, EXIT_EFFECTS, EMPHASIS, DIAGRAM_KINDS, diagramSVG, brollSVG, brollCamera, resolveColors, applyKitTheme, setMediaResolver, emphasisShadow, emphasisFilter, transformOf, textHTML, HL_EFFECTS } from "./anim.js";

// ------------------------------------------------------------------ 유틸
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "value") el.value = v;
    else if (k in el && k !== "list" && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
async function api(method, url, body, raw) {
  const opt = { method, headers: {} };
  if (raw) { opt.body = raw; }
  else if (body !== undefined) {
    opt.body = typeof body === "string" ? body : JSON.stringify(body);
    opt.headers["Content-Type"] = typeof body === "string" ? "text/plain; charset=utf-8" : "application/json";
  }
  const r = await fetch(url, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
let toastT;
function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms);
}
const put = (el, ...kids) => el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const sec = (f, fps) => (f / fps).toFixed(1) + "s";

const STATUS = { scaffold: "골격(연출 전)", draft: "초안", commented: "코멘트 있음", revision_requested: "수정 요청됨", in_progress: "수정 중", revised: "수정됨·확인 필요", locked: "잠금" };
const CTYPES = { move: "위치", resize: "크기", font: "폰트", timing: "타이밍", effect: "효과", image: "이미지 넣기", replace_video: "영상으로 대체", text: "문구", free: "자유 의견" };
const MODES = { avatar: "인물", slide: "장표", "3d": "3D", video: "영상" };
// 3D 장면 (templates/module2/remotion/three/). 장면 props 안의 at은 "요소 등장(in)부터 센 프레임".
const SCENE_NAMES = { globe: "지구본 거점", bars: "입체 막대", layers: "층 쌓기" };
const SCENE_DEFAULTS = {
  globe: { w: 860, h: 800, props: { markers: [{ lat: 37.5, lon: 127, label: "본사", home: true, at: 0 }, { lat: 14.1, lon: 108.3, label: "거점 1", at: 30 }, { lat: 38, lon: -97, label: "거점 2", at: 60 }], focus: [{ at: 50, lat: 30, lon: -165, zoom: 0.85, dur: 40 }], arcDur: 26 } },
  bars: { w: 1000, h: 420, props: { bars: [{ label: "항목 A", value: 100, display: "100", at: 10 }, { label: "항목 B", value: 130, display: "130", at: 25 }, { label: "항목 C", value: 170, display: "170", at: 40, highlight: true }], trend: true, orbit: 14 } },
  layers: { w: 960, h: 820, props: { layers: [{ label: "기반", sub: "설명", at: 0 }, { label: "사업 1", sub: "설명", at: 15 }, { label: "사업 2", sub: "설명", at: 30 }], explodeAt: 60, gap: 1.05, focus: [] } },
};

// ------------------------------------------------------------------ 상태
const S = {
  view: "sections", project: null, cur: null, sec: null, edits: null, m: null,
  frame: 0, playing: false, edit: false, sel: null, tab: "script",
  fonts: [], families: {}, undo: [], saveT: null, saving: false, dirty: false,
  nodes: {}, scale: 0.5, audio: [], dragging: false, newType: "free", pendingAtt: [],
};

// ------------------------------------------------------------------ 시작
async function boot() {
  document.querySelectorAll("#nav button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  try {
    S.fonts = await api("GET", "/api/fonts");
    const css = S.fonts.map((f) => `@font-face{font-family:"${f.family}";src:url("${f.url}");font-weight:${f.weight};font-display:block}`).join("\n");
    document.head.append(h("style", {}, css));
    for (const f of S.fonts) (S.families[f.family] ||= []).push(f.weight);
    for (const k in S.families) S.families[k].sort((a, b) => a - b);
  } catch (e) { console.warn(e); }
  await refreshProject();
  try { S.theme = (await api("GET", "/api/theme")).theme; } catch (e) { S.theme = null; }
  const [hv, hs] = location.hash.slice(1).split("/");
  if (hs && S.project.sections.some((x) => x.id === hs)) S.cur = hs;
  setView(["direction", "sections", "full", "kit", "redaction", "accounts", "guide"].includes(hv) ? hv : "sections");
  refreshDirBadge();
  setInterval(poll, 4000);
  window.addEventListener("keydown", onKey);
}

async function refreshProject() {
  S.project = await api("GET", "/api/project");
  $("#projTitle").textContent = S.project.project.title || "";
  const r = S.project.redaction;
  const b = $("#redBadge");
  b.textContent = r.tokens ? (r.confirmed ? "확정" : "미확정") : "";
  b.className = "badge " + (r.tokens ? (r.confirmed ? "ok" : "bad") : "");
  const q = S.project.queue.filter((x) => x.status === "pending" || x.status === "in_progress");
  $("#queueInfo").textContent = q.length ? `수정 대기 ${q.length}건: ${q.map((x) => x.section).join(", ")}` : "";
}

async function poll() {
  if (S.dragging || S.saving || S.dirty) return;
  try {
    const before = S.project;
    await refreshProject();
    if (S.view === "full") await pollFull();
    if (S.view === "sections") {
      renderList();
      if (S.cur && S.sec) {
        const now = S.project.sections.find((x) => x.id === S.cur);
        const was = before && before.sections.find((x) => x.id === S.cur);
        if (now && JSON.stringify(now.render) !== JSON.stringify(S.sec.render || {}) && !(now.version !== (was && was.version))) {
          const wasRunning = S.sec.render && S.sec.render.draft && S.sec.render.draft.state === "running";
          S.sec.render = now.render;
          const d = now.render.draft || {};
          if (wasRunning && d.state !== "running") {
            toast(d.state === "done" ? `렌더 완료 (${d.seconds}s). '보기: 렌더본'으로 확인하세요.` : "렌더 실패: " + (d.log || "").slice(-200), 6000);
            buildStage(); drawFrame();
          }
          renderHead(); renderTransport();
        }
        if (now && was && (now.version !== was.version || now.status !== was.status) && now.status !== "revision_requested") {
          await loadSection(S.cur, true);
          toast(`${S.cur} 섹션이 v${now.version}로 갱신됐어요 (${STATUS[now.status] || now.status})`, 4000);
        }
      }
    }
  } catch (e) { /* 서버 재시작 중 */ }
}

function setView(v) {
  S.view = v;
  location.hash = v === "sections" && S.cur ? "sections/" + S.cur : v;
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  stop();
  const app = $("#app");
  app.innerHTML = "";
  if (v === "sections") viewSections(app);
  else if (v === "full") viewFull(app);
  else if (v === "direction") viewDirection(app);
  else if (v === "kit") viewKit(app);
  else if (v === "redaction") viewRedaction(app);
  else if (v === "accounts") viewAccounts(app);
  else viewGuide(app);
}

// ================================================================== 섹션 리뷰
function viewSections(app) {
  if (!S.project.sections.length) {
    app.append(h("div", { class: "card empty" }, "섹션이 없습니다. module2_init.py로 자료를 넣어 섹션 골격을 먼저 만드세요."));
    return;
  }
  app.append(h("div", { class: "secgrid" },
    h("aside", { class: "card seclist", id: "secList" }),
    h("section", { class: "center" },
      h("div", { class: "card sechead", id: "secHead" }),
      h("div", { id: "reqBox" }),
      h("div", { class: "card stagecard" },
        h("div", { class: "stagewrap", id: "stageWrap" }),
        h("div", { class: "transport", id: "transport" })),
      h("div", { class: "card", style: { marginTop: "12px" } },
        h("div", { class: "tabs", id: "tabs" }),
        h("div", { class: "tabbody", id: "tabBody" }))),
    h("aside", { class: "side", id: "side" })));
  renderList();
  const ro = new ResizeObserver(() => fitStage());
  ro.observe($("#stageWrap"));
  loadSection(S.cur || S.project.sections[0].id);
}

function renderList() {
  const box = $("#secList");
  if (!box) return;
  box.innerHTML = "";
  let n = 0;
  for (const s of S.project.sections) {
    n++;
    box.append(h("div", { class: "item" + (s.id === S.cur ? " on" : ""), onclick: () => { if (s.id !== S.cur) loadSection(s.id); } },
      h("div", { class: "t" }, h("span", { class: "n" }, String(n).padStart(2, "0")), s.title),
      h("div", { class: "meta" },
        h("span", { class: "chip " + s.status }, STATUS[s.status] || s.status),
        s.modes.map((m) => h("span", { class: "chip " + m }, MODES[m] || m)),
        h("span", { class: "chip" }, sec(s.duration, s.fps)),
        s.open_comments ? h("span", { class: "chip open" }, `코멘트 ${s.open_comments}`) : null,
        s.sensitive ? h("span", { class: "chip needs_user", title: "민감 토큰 포함 비트 수" }, `민감 ${s.sensitive}`) : null)));
  }
  const tot = S.project.total_frames / (S.project.project.fps || 30);
  box.append(h("div", { class: "total small muted" },
    `전체 ${Math.floor(tot / 60)}분 ${Math.round(tot % 60)}초 · 목표 ${S.project.project.target_minutes || 15}분`));
}

async function loadSection(sid, keepFrame) {
  if (S.dirty) await flushSave();
  stop();
  S.cur = sid;
  history.replaceState(null, "", "#sections/" + sid);
  S.sec = await api("GET", "/api/section/" + sid);
  S.edits = S.sec.edits || { base_version: 1, elements: {} };
  S.edits.elements ||= {};
  S.undo = [];
  if (!keepFrame) { S.frame = 0; S.sel = null; }
  remerge();
  if (!keepFrame) {
    // 첫 화면 = 처음 3초 안에 등장하는 요소가 다 나온 시점 (빈 화면 방지)
    const early = S.m.elements.filter((e) => e.t.in <= 90).map((e) => e.t.in + (e.t.enter === "none" ? 0 : e.t.enterDur));
    S.frame = Math.min(S.m.duration - 1, early.length ? Math.max(...early) : 0);
  }
  if (S.frame >= S.m.duration) S.frame = 0;
  if (S.locked()) S.edit = false;
  renderList();
  renderHead();
  buildStage();
  buildAudio();
  renderTransport();
  renderTabs();
  renderSide();
  drawFrame();
}
S.locked = () => !!(S.sec && S.sec.status && S.sec.status.locked);

function remerge() { S.m = mergeSection(S.sec.layout, S.sec.timeline, S.edits, S.theme); }
const findEl = (id) => S.m.elements.find((e) => e.id === id);

// ------------------------------------------------------------------ 헤더
function renderHead() {
  const box = $("#secHead");
  const sum = S.project.sections.find((x) => x.id === S.cur) || {};
  const st = S.sec.status || {};
  const locked = S.locked();
  const hasWork = (S.sec.comments?.comments || []).some((c) => (c.status || "open") === "open") || Object.keys(S.edits.elements).length > 0;
  box.innerHTML = "";
  put(box,
    h("h2", {}, sum.title || S.cur),
    h("span", { class: "chip " + sum.status }, STATUS[sum.status] || sum.status),
    h("span", { class: "chip" }, "v" + (st.version || 1)),
    st.last_summary ? h("span", { class: "small muted", title: st.last_summary }, "최근 수정: " + st.last_summary.slice(0, 60)) : null,
    h("span", { class: "spacer" }),
    h("span", { class: "small muted", id: "saveState" }, ""),
    S.sec.history.length ? h("select", {
      title: "이전 버전으로 되돌리기", onchange: async (e) => {
        const v = e.target.value; e.target.value = "";
        if (!v || !confirm(`${v}로 되돌릴까요? 현재 상태는 새 스냅샷으로 남습니다.`)) return;
        await api("POST", `/api/section/${S.cur}/restore`, { version: v });
        toast(`${v}로 되돌렸어요`); await refreshProject(); await loadSection(S.cur);
      },
    }, h("option", { value: "" }, "이전 버전…"), S.sec.history.slice().reverse().map((v) => h("option", { value: v }, v))) : null,
    renderButton(),
    h("button", { class: S.edit ? "primary" : "", disabled: locked, title: "단축키 E", onclick: () => toggleEdit() }, S.edit ? "편집 모드 끄기" : "편집 모드"),
    h("button", { class: "primary", disabled: locked || !hasWork, onclick: showRequestBox, title: "열린 코멘트와 편집값을 Claude에게 넘깁니다" }, "수정 요청 보내기"),
    h("button", { onclick: toggleLock }, locked ? "잠금 해제" : "섹션 잠금"));
}

function renderButton() {
  const d = (S.sec.render && S.sec.render.draft) || {};
  const running = d.state === "running";
  const stale = d.url && d.stale;
  return h("button", {
    disabled: running, title: "Remotion으로 이 섹션을 저해상도 초안 영상으로 렌더합니다 (3D 포함). 보통 수 초~1분.",
    onclick: async () => {
      await flushSave();
      try { await api("POST", `/api/section/${S.cur}/render`, { draft: true }); S.sec.render = Object.assign({}, S.sec.render, { draft: Object.assign({}, d, { state: "running" }) }); renderHead(); toast("초안 렌더를 시작했어요. 끝나면 '보기: 렌더본'으로 볼 수 있어요."); }
      catch (e) { toast(e.message); }
    },
  }, running ? "렌더 중…" : d.state === "failed" ? "렌더 실패·다시" : stale ? "초안 렌더 (갱신 필요)" : d.url ? "초안 다시 렌더" : "초안 렌더");
}

function showRequestBox() {
  const box = $("#reqBox");
  box.innerHTML = "";
  const open = (S.sec.comments?.comments || []).filter((c) => (c.status || "open") === "open").length;
  const edits = Object.keys(S.edits.elements).length;
  const note = h("input", { placeholder: "요청 메모 (선택) — 예: 전체적으로 더 역동적으로", style: { flex: 1 } });
  box.append(h("div", { class: "card", style: { marginTop: "12px", padding: "12px" } },
    h("div", { class: "small muted", style: { marginBottom: "6px" } }, `열린 코멘트 ${open}개와 직접 편집 ${edits}개 요소를 이 섹션 수정 요청으로 보냅니다. 현재 버전은 스냅샷으로 보관돼요.`),
    h("div", { class: "row" }, note,
      h("button", { class: "primary", onclick: async () => {
        await flushSave();
        try {
          const r = await api("POST", `/api/section/${S.cur}/request`, { note: note.value });
          box.innerHTML = "";
          toast(`요청 ${r.request} 등록 (스냅샷 ${r.snapshot}). Claude에게 "수정 요청 보냈어"라고 말해 주세요.`, 6000);
          await refreshProject(); renderList(); S.sec.status.status = "revision_requested"; renderHead();
        } catch (e) { toast(e.message); }
      } }, "보내기"),
      h("button", { class: "ghost", onclick: () => (box.innerHTML = "") }, "취소"))));
  note.focus();
}

async function toggleLock() {
  const locked = !S.locked();
  if (locked && S.dirty) await flushSave();
  const r = await api("POST", `/api/section/${S.cur}/lock`, { locked });
  S.sec.status = r.status;
  if (locked) S.edit = false;
  await refreshProject();
  renderList(); renderHead(); buildStage(); renderTabs(); renderSide(); drawFrame();
  toast(locked ? "섹션을 잠갔어요. 에이전트가 더 이상 수정하지 않습니다." : "잠금을 풀었어요.");
}

function toggleEdit(on) {
  if (S.locked()) return toast("잠긴 섹션은 편집할 수 없어요.");
  S.edit = on === undefined ? !S.edit : on;
  stop();
  renderHead();
  $(".stage")?.classList.toggle("editing", S.edit);
  const rv = $("#rv"); if (rv) rv.style.display = S.viewMode === "render" && !S.edit ? "block" : "none";
  renderSide();
  drawFrame();
}

// ------------------------------------------------------------------ 스테이지
function fitStage() {
  const wrap = $("#stageWrap"), st = $(".stage");
  if (!wrap || !st) return;
  S.scale = wrap.clientWidth / S.m.canvas.w;
  st.style.transform = `scale(${S.scale})`;
}

setMediaResolver((src) => resolveSrc(src));   // diagram 안 사진도 스튜디오 파일 경로로

function resolveSrc(src) {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  if (src.startsWith("global_assets/") || src.startsWith("sections/")) return "/files/" + src;
  return `/files/sections/${S.cur}/${src}`;
}

function buildStage() {
  const wrap = $("#stageWrap");
  wrap.innerHTML = "";
  S.nodes = {};
  const stage = h("div", { class: "stage" + (S.edit ? " editing" : ""), style: { width: S.m.canvas.w + "px", height: S.m.canvas.h + "px", background: S.m.canvas.bg } });
  stage.addEventListener("pointerdown", (e) => { if (e.target === stage && S.edit) select(null); });
  for (const el of S.m.elements) {
    const node = h("div", { class: "el", "data-id": el.id });
    let content;
    if (el.type === "text") content = h("div", { class: "txt" });
    else if (el.type === "image") content = el.src ? h("img", { src: resolveSrc(el.src), draggable: false }) : h("div", { class: "ph" }, "이미지");
    else if (el.type === "video" || el.type === "avatar") {
      content = h("div", { style: { width: "100%", height: "100%", position: "relative" } }, h("div", { class: "ph" }, el.text || (el.type === "avatar" ? "아바타" : "영상")));
      if (el.src) {
        const v = h("video", { src: resolveSrc(el.src), muted: true, playsInline: true, preload: "auto", style: { position: "absolute", inset: 0 } });
        v.addEventListener("error", () => v.remove());
        content.append(v);
        node._video = v;
      }
    } else if (el.type === "diagram") {
      content = h("div", { class: "dg", style: { width: "100%", height: "100%", overflow: "visible" } });
    } else if (el.type === "broll") {
      content = h("div", { style: { width: "100%", height: "100%", position: "relative", overflow: "hidden" } }, h("div", { class: "brph", style: { position: "absolute", inset: 0 } }));
      if (el.src) {
        const v = h("video", { src: resolveSrc(el.src), muted: true, playsInline: true, preload: "auto", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } });
        v.addEventListener("error", () => v.remove());
        content.append(v);
        node._video = v;
      }
    } else if (el.type === "3d") {
      const p = el.props || {};
      const names = (p.markers || p.bars || p.layers || []).map((x) => x.label).filter(Boolean).slice(0, 5).join(" · ");
      content = h("div", { class: "ph", style: { flexDirection: "column", gap: "10px", background: "rgba(232,240,255,.6)", borderColor: "#8fb3ff", color: "#2a5bd7" } },
        h("div", { style: { fontWeight: 700 } }, "3D · " + (SCENE_NAMES[el.scene] || el.scene)),
        names ? h("div", { style: { fontSize: "26px" } }, names) : null,
        h("div", { style: { fontSize: "22px", opacity: 0.8 } }, "움직임은 '렌더본' 보기에서 확인"));
    } else if (el.type === "rect") content = null;
    else content = h("div", { class: "ph" }, `${el.type}${el.spec ? ": " + el.spec : ""}`);
    if (content) node.append(content);
    node._content = content;
    node.append(h("div", { class: "tag" }, el.id), ...["nw", "ne", "sw", "se"].map((c) => h("div", { class: "h " + c, "data-h": c })));
    node.addEventListener("pointerdown", (e) => onElDown(e, el.id));
    applyStatic(el, node);
    stage.append(node);
    S.nodes[el.id] = node;
  }
  stage.append(h("div", { class: "guide-x", id: "gx" }), h("div", { class: "guide-y", id: "gy" }));
  wrap.append(stage);
  const r = renderFile();
  if (r) {
    const v = h("video", { id: "rv", src: r.url, muted: true, playsInline: true, preload: "auto",
      style: { position: "absolute", inset: 0, width: "100%", height: "100%", display: S.viewMode === "render" && !S.edit ? "block" : "none", zIndex: 5, background: "#fff" } });
    wrap.append(v);
  }
  fitStage();
}

function renderFile() {
  const r = S.sec && S.sec.render && (S.sec.render.final && S.sec.render.final.url ? S.sec.render.final : S.sec.render.draft);
  return r && r.url ? r : null;
}
function setViewMode(m) {
  S.viewMode = m;
  const v = $("#rv");
  if (v) v.style.display = m === "render" && !S.edit ? "block" : "none";
  renderTransport();
  drawFrame();
}

function applyStatic(el, node) {
  const f = el.font || {};
  Object.assign(node.style, {
    left: el.x + "px", top: el.y + "px", width: el.w + "px", height: el.h + "px", zIndex: String(el.z || 0),
    background: el.fill || "transparent", borderRadius: (el.radius || 0) + "px", padding: (el.pad || 0) + "px",
    fontFamily: f.family ? `"${f.family}", "PretendardUI", sans-serif` : "", fontWeight: f.weight || "", fontSize: f.size ? f.size + "px" : "",
    color: f.color || "", textAlign: f.align || "left", lineHeight: f.lineHeight || "", letterSpacing: f.letterSpacing != null ? f.letterSpacing + "px" : "",
    display: "", alignItems: "", justifyContent: "",
  });
  // 세로 정렬은 flex로. drawFrame이 보이기/숨기기를 할 때 이 값으로 되돌린다(빈 값으로 지우면 세로 정렬이 사라짐)
  node._disp = "";
  if (el.type === "text" && el.valign) {
    node._disp = "flex";
    node.style.display = "flex";
    node.style.alignItems = { top: "flex-start", middle: "center", bottom: "flex-end" }[el.valign] || "flex-start";
    node.style.justifyContent = { left: "flex-start", center: "center", right: "flex-end" }[f.align] || "flex-start";
  }
  node.classList.toggle("sel", S.sel === el.id);
}

function setText(box, el, st, f = 1e9) {
  const raw = el.text || "";
  const hasHl = el.hl && el.hl.length;
  if (!raw.includes("[[") && !hasHl) { box.textContent = displayText(raw, st); box._key = null; return; }
  const html = textHTML(el, st, f);   // [[강조]]·하이라이트 글자 — 렌더와 같은 함수
  if (box._key === html) return;
  box._key = html;
  box.innerHTML = html;
}

// 연출 키트 요소 (anim.js의 같은 함수 → 렌더와 동일). 같은 프레임이면 다시 그리지 않는다.
function drawKit(el, node, lf) {
  const span = el.t.out - el.t.in;
  if (el.type === "diagram") {
    const key = JSON.stringify([lf, el.w, el.h, el.kind, el.props]);
    if (node._kitKey === key || !node._content) return;
    node._kitKey = key;
    node._content.innerHTML = diagramSVG(el, Math.min(lf, 100000));
    return;
  }
  const lfc = Math.min(Math.max(0, lf), span);
  const cam = brollCamera(el, lfc, span);
  if (node._video && node._video.isConnected) {
    node._video.style.transform = `translate(${cam.tx}px, ${cam.ty}px) rotate(${cam.rotate}deg) scale(${cam.scale})`;
    return;
  }
  const ph = node._content && node._content.querySelector(".brph");
  const key = JSON.stringify([lfc, el.w, el.h, el.slot, el.query, el.props]);
  if (ph && node._kitKey !== key) { node._kitKey = key; ph.innerHTML = brollSVG(el, lfc, span); }
}

function drawFrame() {
  if (!S.m) return;
  const f = Math.round(S.frame);
  for (const el of S.m.elements) {
    const node = S.nodes[el.id];
    if (!node) continue;
    const st = stateAt(el, f);
    if (S.edit) {
      node.style.display = node._disp || "";
      node.style.opacity = st.visible ? "1" : "0.28";
      node.classList.toggle("ghost", !st.visible);
      node.style.transform = "";
      node.style.clipPath = "";
      node.style.boxShadow = "";
      node.style.filter = "";
      if (el.type === "text" && node._content) setText(node._content, el, { text: 1, count: 1 });
    } else {
      node.classList.remove("ghost");
      node.style.display = st.visible ? node._disp || "" : "none";
      node.style.opacity = String(st.opacity);
      node.style.transform = transformOf(st);
      node.style.clipPath = st.clipL || st.clipR ? `inset(-20px ${st.clipR}% -20px ${st.clipL}%)` : "";
      node.style.boxShadow = emphasisShadow(st);
      node.style.filter = emphasisFilter(st);
      if (el.type === "text" && node._content) setText(node._content, el, st, f);
    }
    if (el.type === "diagram" || el.type === "broll") drawKit(el, node, S.edit ? 100000 : f - el.t.in);
    if (node._video && !S.playing) {
      const t = Math.max(0, (f - el.t.in) / S.m.fps);
      if (Math.abs(node._video.currentTime - t) > 0.05) node._video.currentTime = t;
    }
  }
  const rv = $("#rv");
  if (rv && S.viewMode === "render" && !S.playing) { const t = f / S.m.fps; if (Math.abs(rv.currentTime - t) > 0.02) rv.currentTime = t; }
  const r = $("#scrub"); if (r) r.value = f;
  const tm = $("#tmLabel"); if (tm) tm.textContent = `${fmtTime(f, S.m.fps)} / ${fmtTime(S.m.duration, S.m.fps)}  ·  f${f}`;
  const ph = $("#tlPlayhead"); if (ph && S.tlppf) ph.style.left = 150 + f * S.tlppf + "px";
}

// ------------------------------------------------------------------ 재생
function renderTransport() {
  const box = $("#transport");
  box.innerHTML = "";
  put(box,
    h("button", { id: "playBtn", onclick: () => (S.playing ? stop() : play()), title: "스페이스" }, "▶ 재생"),
    h("button", { class: "ghost", onclick: () => seek(0), title: "처음으로" }, "⏮"),
    h("input", { type: "range", id: "scrub", min: 0, max: Math.max(0, S.m.duration - 1), step: 1, value: S.frame, oninput: (e) => seek(+e.target.value) }),
    h("span", { class: "time small", id: "tmLabel" }),
    h("label", { class: "small", title: "섹션이 끝나면 다음 섹션을 열어 이어서 재생", style: { display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" } },
      h("input", { type: "checkbox", checked: localStorage.getItem("m2_autoNext") === "1", onchange: (e) => localStorage.setItem("m2_autoNext", e.target.checked ? "1" : "0") }), "다음 섹션 자동"),
    S.audio.length ? h("span", { class: "chip", title: "비트 음성 파일과 함께 재생" }, `음성 ${S.audio.length}`) : h("span", { class: "chip", title: "아직 음성이 없어 무음 재생" }, "무음"),
    renderFile() ? h("select", { title: "미리보기 = 브라우저 계산(편집 즉시 반영) / 렌더본 = Remotion으로 실제 렌더한 영상(3D 포함)", onchange: (e) => setViewMode(e.target.value) },
      h("option", { value: "preview", selected: S.viewMode !== "render" }, "보기: 미리보기"),
      h("option", { value: "render", selected: S.viewMode === "render" }, "보기: 렌더본" + (renderFile().stale ? " (편집 전 버전)" : ""))) : null);
}

function buildAudio() {
  for (const a of S.audio) a.el.pause();
  S.audio = [];
  const beats = (S.sec.timeline && S.sec.timeline.beats) || [];
  const list = (S.sec.timeline && S.sec.timeline.audio && S.sec.timeline.audio.length)
    ? S.sec.timeline.audio.map((a) => ({ src: a.src.startsWith("sections/") ? a.src : `sections/${S.cur}/${a.src}`, at: a.at }))
    : S.sec.audio_files.map((a) => ({ src: a.src, at: (beats.find((b) => b.id === a.beat) || {}).start || 0 }));
  for (const a of list) {
    const el = new Audio("/files/" + a.src);
    el.preload = "auto";
    S.audio.push({ el, at: a.at, started: false });
  }
}

function play() {
  if (S.edit) toggleEdit(false);
  if (S.frame >= S.m.duration - 1) S.frame = 0;
  S.playing = true;
  const f0 = S.frame, t0 = performance.now();
  for (const a of S.audio) a.started = false;
  for (const n of Object.values(S.nodes)) if (n._video) n._video.play().catch(() => {});
  const rv = $("#rv");
  if (rv && S.viewMode === "render") { rv.currentTime = S.frame / S.m.fps; rv.play().catch(() => {}); }
  $("#playBtn").textContent = "❚❚ 정지";
  const loop = () => {
    if (!S.playing) return;
    S.frame = f0 + ((performance.now() - t0) / 1000) * S.m.fps;
    if (S.frame >= S.m.duration - 1) {
      S.frame = S.m.duration - 1; drawFrame(); stop();
      // 다음 섹션 자동: 끝나면 다음 섹션을 열고 처음부터 이어서 재생 (2026-11-20 사용자: "섹션 리뷰에서 하나씩 보면 자동으로 넘어가게")
      if (localStorage.getItem("m2_autoNext") === "1") {
        const ids = S.project.sections.map((x) => x.id), k = ids.indexOf(S.cur);
        if (k >= 0 && k + 1 < ids.length) {
          loadSection(ids[k + 1]).then(() => { S.frame = 0; drawFrame(); setTimeout(() => { if (!S.playing) play(); }, 400); });
        }
      }
      return;
    }
    for (const a of S.audio) {
      const dur = (a.el.duration || 0) * S.m.fps;
      if (!a.started && S.frame >= a.at && (!dur || S.frame < a.at + dur)) {
        a.started = true;
        a.el.currentTime = (S.frame - a.at) / S.m.fps;
        a.el.play().catch(() => {});
      }
    }
    drawFrame();
    S.raf = requestAnimationFrame(loop);
  };
  S.raf = requestAnimationFrame(loop);
}
function stop() {
  S.playing = false;
  cancelAnimationFrame(S.raf);
  for (const a of S.audio) a.el.pause();
  for (const n of Object.values(S.nodes)) if (n._video) n._video.pause();
  const rv = $("#rv"); if (rv) rv.pause();
  const b = $("#playBtn"); if (b) b.textContent = "▶ 재생";
}
function seek(f) {
  const was = S.playing;
  stop();
  S.frame = Math.max(0, Math.min(S.m.duration - 1, Math.round(f)));
  drawFrame();
  if (was) play();
}

// ------------------------------------------------------------------ 편집
function select(id, opts = {}) {
  S.sel = id;
  for (const [k, n] of Object.entries(S.nodes)) n.classList.toggle("sel", k === id);
  document.querySelectorAll(".tl .bar").forEach((b) => b.classList.toggle("sel", b.dataset.id === id));
  document.querySelectorAll("tr[data-el]").forEach((r) => r.classList.toggle("sel", r.dataset.el === id));
  if (!opts.keepSide) renderSide();
}

function pushUndo() {
  S.undo.push(JSON.stringify(S.edits));
  if (S.undo.length > 80) S.undo.shift();
}
function undo() {
  if (!S.undo.length) return toast("되돌릴 편집이 없어요");
  S.edits = JSON.parse(S.undo.pop());
  afterEditsChanged(true);
  toast("되돌렸어요");
}

// patch를 edits에 기록. font는 병합. null 값은 해당 키 삭제.
function writeEdit(id, patch) {
  const e = (S.edits.elements[id] ||= {});
  for (const [k, v] of Object.entries(patch)) {
    if (k === "font") {
      e.font = Object.assign({}, e.font || {}, v);
      for (const fk in e.font) if (e.font[fk] == null) delete e.font[fk];
    } else if (v == null) delete e[k];
    else e[k] = v;
  }
}
function setEdit(id, patch, opts = {}) {
  if (S.locked()) return;
  if (!opts.noUndo) pushUndo();
  writeEdit(id, patch);
  remerge();
  const el = findEl(id);
  if (el && S.nodes[id]) applyStatic(el, S.nodes[id]);
  drawFrame();
  if (opts.timeline !== false) renderTabsIfTimeline();
  if (opts.side) renderSide();
  scheduleSave();
}
function afterEditsChanged(rebuild) {
  remerge();
  if (rebuild) buildStage();
  drawFrame(); renderTabs(); renderSide(); renderHead();
  scheduleSave();
}
function scheduleSave() {
  S.dirty = true;
  const ss = $("#saveState"); if (ss) ss.textContent = "저장 대기…";
  clearTimeout(S.saveT);
  S.saveT = setTimeout(flushSave, 700);
}
async function flushSave() {
  clearTimeout(S.saveT);
  if (!S.dirty || !S.cur) return;
  S.saving = true;
  try {
    await api("PUT", `/api/section/${S.cur}/edits`, S.edits);
    S.dirty = false;
    const ss = $("#saveState"); if (ss) ss.textContent = "저장됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) { toast("저장 실패: " + e.message); }
  S.saving = false;
}

function onElDown(e, id) {
  if (!S.edit) { select(id); return; }
  e.preventDefault(); e.stopPropagation();
  select(id);
  const el = findEl(id);
  const handle = e.target.dataset.h;
  const start = { x: e.clientX, y: e.clientY, r: { x: el.x, y: el.y, w: el.w, h: el.h } };
  const ratio = el.w / Math.max(1, el.h);
  const node = S.nodes[id];
  let moved = false;
  S.dragging = true;
  pushUndo();
  const gx = $("#gx"), gy = $("#gy");
  const move = (ev) => {
    const dx = (ev.clientX - start.x) / S.scale, dy = (ev.clientY - start.y) / S.scale;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    moved = true;
    let { x, y, w, h: hh } = start.r;
    if (!handle) {
      let ddx = dx, ddy = dy;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ddy = 0; else ddx = 0; }
      x = start.r.x + ddx; y = start.r.y + ddy;
      gx.style.display = gy.style.display = "none";
      if (!ev.altKey) {
        const cx = x + w / 2, cy = y + hh / 2, CW = S.m.canvas.w, CH = S.m.canvas.h;
        if (Math.abs(cx - CW / 2) < 12) { x = CW / 2 - w / 2; gx.style.left = CW / 2 + "px"; gx.style.display = "block"; }
        if (Math.abs(cy - CH / 2) < 12) { y = CH / 2 - hh / 2; gy.style.top = CH / 2 + "px"; gy.style.display = "block"; }
        for (const o of S.m.elements) {
          if (o.id === id) continue;
          if (Math.abs(x - o.x) < 8) x = o.x;
          if (Math.abs(y - o.y) < 8) y = o.y;
        }
      }
    } else {
      if (handle.includes("w")) { x = start.r.x + dx; w = start.r.w - dx; }
      if (handle.includes("e")) { w = start.r.w + dx; }
      if (handle.includes("n")) { y = start.r.y + dy; hh = start.r.h - dy; }
      if (handle.includes("s")) { hh = start.r.h + dy; }
      if (ev.shiftKey || el.type === "image" || el.type === "video") {
        hh = w / ratio;
        if (handle.includes("n")) y = start.r.y + start.r.h - hh;
      }
      w = Math.max(20, w); hh = Math.max(20, hh);
    }
    const p = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
    writeEdit(id, handle ? p : { x: p.x, y: p.y });
    Object.assign(node.style, { left: p.x + "px", top: p.y + "px", width: p.w + "px", height: p.h + "px" });
    updateInspectorGeom(p);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    gx.style.display = gy.style.display = "none";
    S.dragging = false;
    if (!moved) { S.undo.pop(); return; }
    remerge(); drawFrame(); renderTabsIfTimeline(); scheduleSave(); renderHead();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function updateInspectorGeom(p) {
  for (const k of ["x", "y", "w", "h"]) { const i = $(`#insp_${k}`); if (i) i.value = p[k]; }
}

function newId() { return "el_u" + Date.now().toString(36).slice(-6); }
function addElement(type, extra = {}) {
  if (S.locked()) return;
  const id = newId();
  const base = { _new: true, type, x: 760, y: 440, w: 400, h: 200, in: Math.round(S.frame), out: S.m.duration, enter: "fade", enterDur: 12, exit: "none", exitDur: 12, z: 5 };
  if (type === "text") Object.assign(base, { w: 640, h: 110, text: "새 텍스트", font: { family: "Pretendard", weight: 600, size: 56, color: "#18202e", align: "center", lineHeight: 1.3, letterSpacing: 0 } });
  if (type === "rect") Object.assign(base, { fill: "#296ef9", radius: 16 });
  Object.assign(base, extra);
  pushUndo();
  S.edits.elements[id] = base;
  S.sel = id;
  if (!S.edit) S.edit = true;
  afterEditsChanged(true);
  toast("요소를 추가했어요. 드래그해서 위치를 잡으세요.");
}
function add3D(scene) {
  const d = SCENE_DEFAULTS[scene];
  addElement("3d", { scene, props: clone(d.props), w: d.w, h: d.h, x: Math.round((1920 - d.w) / 2), y: Math.round((1080 - d.h) / 2) + 60, z: 2 });
}
async function addMedia(kind) {
  const inp = h("input", { type: "file", accept: kind === "image" ? "image/*" : "video/*" });
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    toast("업로드 중…");
    const r = await api("POST", `/api/section/${S.cur}/upload?name=${encodeURIComponent(f.name)}`, undefined, f);
    let w = 800, hh = 450;
    if (kind === "image") {
      const img = new Image(); img.src = URL.createObjectURL(f); await img.decode().catch(() => {});
      if (img.naturalWidth) { w = Math.min(900, img.naturalWidth); hh = Math.round(w * img.naturalHeight / img.naturalWidth); }
    }
    addElement(kind, { src: r.path, w, h: hh, x: Math.round((1920 - w) / 2), y: Math.round((1080 - hh) / 2) });
  };
  inp.click();
}
function deleteSelected() {
  if (!S.sel || S.locked()) return;
  const id = S.sel;
  const e = S.edits.elements[id];
  pushUndo();
  if (e && e._new) delete S.edits.elements[id];
  else S.edits.elements[id] = Object.assign({}, e || {}, { _deleted: true });
  S.sel = null;
  afterEditsChanged(true);
  toast("요소를 지웠어요 (⌘Z로 되돌리기)");
}
function resetSelected() {
  if (!S.sel) return;
  const e = S.edits.elements[S.sel];
  if (!e) return;
  if (e._new) return toast("새로 추가한 요소는 초기화 대신 삭제하세요.");
  pushUndo();
  delete S.edits.elements[S.sel];
  afterEditsChanged(true);
  toast("이 요소의 편집값을 지웠어요");
}

// ------------------------------------------------------------------ 탭
const TABS = { script: "① 대본", storyboard: "② 스토리보드", layout: "③ 장표", timeline: "④ 영상화 타임라인" };
function renderTabs() {
  const tabs = $("#tabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  for (const [k, v] of Object.entries(TABS)) tabs.append(h("button", { class: S.tab === k ? "on" : "", onclick: () => { S.tab = k; renderTabs(); } }, v));
  const body = $("#tabBody");
  body.innerHTML = "";
  if (S.tab === "script") tabScript(body);
  else if (S.tab === "storyboard") body.append(h("div", { class: "md", html: md(S.sec.storyboard || "(스토리보드 없음)") }));
  else if (S.tab === "layout") tabLayout(body);
  else tabTimeline(body);
}
function renderTabsIfTimeline() { if (S.tab === "timeline" || S.tab === "layout") renderTabs(); }

function md(s) {
  const lines = String(s || "").replace(/<!--[\s\S]*?-->/g, "").split("\n").map(esc);
  let out = "", inList = false, inTbl = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
    // 표: | a | b | — 구분 줄(|---|)은 건너뛰고 첫 줄은 머리글
    if (/^\s*\|.*\|\s*$/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (inList) { out += "</ul>"; inList = false; }
      if (!inTbl) { out += `<table class="tbl mdtbl"><thead><tr>${cells.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`; inTbl = true; }
      else out += `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
      continue;
    }
    if (inTbl) { out += "</tbody></table>"; inTbl = false; }
    if (/^\s*[-*] /.test(l)) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + l.replace(/^\s*[-*] /, "") + "</li>"; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    if (/^&gt; /.test(l)) { out += `<blockquote>${l.slice(5)}</blockquote>`; continue; }
    const m = l.match(/^(#{1,3}) (.*)/);
    if (m) out += `<h${m[1].length}>${m[2]}</h${m[1].length}>`;
    else if (l.trim()) out += `<p>${l}</p>`;
  }
  return out + (inList ? "</ul>" : "") + (inTbl ? "</tbody></table>" : "");
}

function tabScript(body) {
  const beats = (S.sec.beats && S.sec.beats.beats) || [];
  const masked = {};
  for (const b of (S.sec.beats_masked && S.sec.beats_masked.beats) || []) masked[b.id] = b;
  const tlb = {};
  for (const b of (S.sec.timeline && S.sec.timeline.beats) || []) tlb[b.id] = b;
  if (!beats.length) return body.append(h("div", { class: "empty" }, "비트가 없습니다."));
  // 음성: 프로젝트 기본 속도·문장 사이 텀 + 비트별 덮어쓰기. 텀은 음성을 다시 만들지 않고 타임라인만 다시 잡는다.
  const V = S.project.voice || {};
  const SPD = { "": "기본", slow: "천천히", medium: "보통", fast: "빠르게" }, GAPS = { "": "기본", short: "짧게", medium: "중간", long: "많이" };
  const sel = (opts, val, on, title) => h("select", { title, onchange: (e) => on(e.target.value) }, Object.entries(opts).map(([k, v]) => h("option", { value: k, selected: (val || "") === k }, v)));
  const setVoice = async (patch) => { await api("POST", "/api/voice/settings", patch); await refreshProject(); toast("음성 기본값을 바꿨어요. 속도는 음성을 다시 만들 때, 텀은 '텀 적용'에서 반영됩니다."); };
  const setBeat = async (beat, patch) => { await api("POST", `/api/section/${S.cur}/voicebeat`, Object.assign({ beat }, patch)); const b = beats.find((x) => x.id === beat); Object.assign(b, patch); for (const k in patch) if (!patch[k]) delete b[k]; };
  const voiced = beats.filter((b) => b.audio_sec).length;
  body.append(h("div", { class: "row voicebar", style: { marginBottom: "10px", flexWrap: "wrap" } },
    h("b", {}, "음성"),
    h("span", { class: "small muted" }, V.voice_set ? `HeyGen · ${voiced}/${beats.length}문장 생성됨` : "보이스 미설정"),
    h("span", { class: "spacer" }),
    h("label", { class: "small" }, "말 속도(기본)"), sel({ slow: "천천히", medium: "보통", fast: "빠르게" }, V.speed || "medium", (v) => setVoice({ speed: v }), "프로젝트 전체 기본 속도"),
    h("label", { class: "small" }, "문장 사이 텀(기본)"), sel({ short: "짧게", medium: "중간", long: "많이" }, V.gap || "medium", (v) => setVoice({ gap: v }), "프로젝트 전체 기본 텀"),
    h("button", {
      class: "primary", disabled: S.locked(), title: "음성은 그대로 두고, 문장 사이 텀을 지금 설정대로 다시 잡습니다(장면 타이밍도 함께 이동).",
      onclick: async () => { await flushSave(); try { const r = await api("POST", `/api/section/${S.cur}/retime`); toast(`텀을 반영했어요 — 섹션 ${(r.duration / S.m.fps).toFixed(1)}초`); await refreshProject(); await loadSection(S.cur); } catch (e) { toast(e.message, 5000); } },
    }, "텀 적용")));
  if (!S.sec.beats_masked) body.append(h("div", { class: "small muted", style: { marginBottom: "8px" } }, "마스킹이 아직 확정되지 않았어요. 상단 '마스킹' 탭에서 확정하면 외부 전송용 문장이 여기에 함께 보입니다."));
  for (const b of beats) {
    const mb = masked[b.id];
    const mode = (mb && mb.mode) || b.mode || "slide";
    let html = esc(b.text);
    for (const sp of (mb && mb.splice) || []) html = html.split(esc(sp.real_eojeol)).join(`<mark>${esc(sp.real_eojeol)}</mark>`);
    const words = S.sec.words[b.id];
    body.append(h("div", { class: "beat" },
      h("div", { class: "id" }, b.id),
      h("div", {},
        h("div", { html }),
        mb ? h("div", { class: "masked" }, "외부 전송용: " + mb.text_masked) : null,
        mb && mb.mode_forced ? h("div", { class: "small", style: { color: "var(--bad)" } }, "⚠ " + mb.mode_forced) : null,
        words ? h("div", { class: "small muted" }, `ASR ${words.words.length}단어 · 실측 ${words.duration_s}s`) : null),
      h("div", { class: "row", style: { alignItems: "flex-start" } },
        h("span", { class: "chip " + mode }, MODES[mode] || mode),
        b.audio_sec ? h("span", { class: "chip locked", title: "생성된 음성 길이" }, "🔊 " + b.audio_sec.toFixed(1) + "s") : h("span", { class: "chip", title: "음성 없음 — 추정 길이" }, (b.est_sec || 0).toFixed ? b.est_sec.toFixed(1) + "s" : ""),
        sel(SPD, b.speed, (v) => setBeat(b.id, { speed: v || null }), "이 문장 말 속도 (다음 음성 생성 때 반영)"),
        sel(GAPS, b.gap_after, (v) => setBeat(b.id, { gap_after: v || null }), "이 문장 뒤 텀 ('텀 적용'으로 반영)"),
        tlb[b.id] ? h("button", { class: "ghost small", onclick: () => seek(tlb[b.id].start) }, "이동") : null,
        h("button", { class: "ghost small", onclick: () => prefillComment("text", `[${b.id}] `) }, "문구 코멘트"))));
  }
}

function tabLayout(body) {
  const locked = S.locked();
  body.append(h("div", { class: "row", style: { marginBottom: "10px", flexWrap: "wrap" } },
    h("button", { disabled: locked, onclick: () => addElement("text") }, "+ 텍스트"),
    h("button", { disabled: locked, onclick: () => addMedia("image") }, "+ 이미지"),
    h("button", { disabled: locked, onclick: () => addMedia("video") }, "+ 영상"),
    h("button", { disabled: locked, onclick: () => addElement("rect") }, "+ 도형"),
    Object.entries(SCENE_NAMES).map(([k, v]) => h("button", { disabled: locked, onclick: () => add3D(k) }, "+ 3D " + v)),
    h("span", { class: "spacer" }),
    h("span", { class: "small muted" }, "보라색 = 직접 편집됨 · 행을 누르면 선택")));
  const fps = S.m.fps;
  const rows = S.m.elements.map((el) => h("tr", { class: "click" + (S.sel === el.id ? " sel" : ""), "data-el": el.id, onclick: () => { if (!S.edit && !locked) toggleEdit(true); select(el.id); } },
    h("td", { class: "mono", style: { color: el._edited || el._new ? "#7a52f0" : "" } }, el.id + (el._new ? " (추가)" : el._edited ? " ✎" : "")),
    h("td", {}, el.type),
    h("td", { class: "mono" }, `${Math.round(el.x)}, ${Math.round(el.y)}`),
    h("td", { class: "mono" }, `${Math.round(el.w)}×${Math.round(el.h)}`),
    h("td", { class: "small" }, el.type === "text" ? `${el.font.family || "-"} ${el.font.weight || ""} · ${el.font.size || ""}px` : ""),
    h("td", { class: "small" }, `${sec(el.t.in, fps)}–${sec(el.t.out, fps)}`),
    h("td", { class: "small" }, `${ENTER_EFFECTS[el.t.enter] || el.t.enter} / ${EXIT_EFFECTS[el.t.exit] || el.t.exit}`)));
  const deleted = Object.entries(S.edits.elements).filter(([, e]) => e._deleted);
  body.append(h("table", { class: "tbl" },
    h("thead", {}, h("tr", {}, ["id", "종류", "위치", "크기", "폰트", "노출", "등장/퇴장"].map((x) => h("th", {}, x)))),
    h("tbody", {}, rows)));
  if (deleted.length) body.append(h("div", { style: { marginTop: "10px" } }, h("span", { class: "small muted" }, "지운 요소: "),
    deleted.map(([id]) => h("button", { class: "ghost small", onclick: () => { pushUndo(); delete S.edits.elements[id]._deleted; if (!Object.keys(S.edits.elements[id]).length) delete S.edits.elements[id]; afterEditsChanged(true); } }, `${id} 복원`))));
}

function tabTimeline(body) {
  const fps = S.m.fps, dur = S.m.duration;
  const W = Math.max(200, body.clientWidth - 150 - 4);
  const ppf = W / dur;
  S.tlppf = ppf;
  const tl = h("div", { class: "tl" });
  const ruler = h("div", { class: "track ruler" });
  const stepS = dur / fps > 40 ? 5 : dur / fps > 16 ? 2 : 1;
  for (let s = 0; s * fps <= dur; s += stepS) ruler.append(h("div", { class: "tick", style: { left: s * fps * ppf + "px" } }, s + "s"));
  ruler.addEventListener("pointerdown", (e) => scrubOn(e, ruler, ppf));
  tl.append(h("div", { class: "lane" }, h("div", { class: "lbl" }, "시간"), ruler));
  const beats = (S.sec.timeline && S.sec.timeline.beats) || [];
  const bt = h("div", { class: "track" });
  for (const b of beats) bt.append(h("div", { class: "beatb", title: b.id, style: { left: b.start * ppf + "px", width: Math.max(2, (b.end - b.start) * ppf - 2) + "px" }, onclick: () => seek(b.start) }, b.id));
  tl.append(h("div", { class: "lane" }, h("div", { class: "lbl" }, "비트"), bt));
  const snaps = [0, dur];
  for (const b of beats) snaps.push(b.start, b.end);
  const wt = h("div", { class: "track" });
  let anyWords = false;
  for (const b of beats) {
    const wj = S.sec.words[b.id];
    if (!wj) continue;
    anyWords = true;
    for (const w of wj.words) {
      const f = Math.round(b.start + w.s * fps);
      snaps.push(f);
      wt.append(h("div", { class: "word", title: `${w.w} @${(f / fps).toFixed(2)}s`, style: { left: f * ppf + "px", maxWidth: Math.max(6, (w.e - w.s) * fps * ppf) + "px" } }, w.w));
    }
  }
  tl.append(h("div", { class: "lane" }, h("div", { class: "lbl", title: "음성 생성 후 ASR 단어 시작점. 막대를 끌면 여기에 붙습니다." }, "단어(ASR)"), anyWords ? wt : h("div", { class: "small muted" }, "음성 생성 후 표시")));
  for (const el of S.m.elements) snaps.push(el.t.in, el.t.out);
  for (const el of S.m.elements) {
    const t = el.t;
    const bar = h("div", { class: "bar" + (el._edited || el._new ? " ed" : "") + (S.sel === el.id ? " sel" : ""), "data-id": el.id,
      style: { left: t.in * ppf + "px", width: Math.max(6, (t.out - t.in) * ppf) + "px" }, title: `${el.id}  ${sec(t.in, fps)}–${sec(t.out, fps)}` },
      h("div", { class: "enter", style: { width: (t.enter !== "none" ? t.enterDur * ppf : 0) + "px" } }),
      h("div", { class: "exit", style: { width: (t.exit !== "none" ? t.exitDur * ppf : 0) + "px" } }),
      el.type === "text" ? (el.text || "").slice(0, 40) : el.type,
      h("div", { class: "grip l", "data-g": "l" }), h("div", { class: "grip r", "data-g": "r" }));
    bar.addEventListener("pointerdown", (e) => barDown(e, el.id, ppf, snaps));
    tl.append(h("div", { class: "lane" }, h("div", { class: "lbl mono", title: el.id }, el.id), h("div", { class: "track" }, bar)));
  }
  tl.append(h("div", { class: "playhead", id: "tlPlayhead", style: { left: 150 + S.frame * ppf + "px" } }), h("div", { class: "snapline", id: "snapline" }));
  body.append(tl, h("div", { class: "small muted", style: { marginTop: "8px" } },
    "막대 가운데를 끌면 등장·퇴장이 함께 이동, 양 끝을 끌면 각각 조정. 비트·단어·다른 요소 경계에 자동으로 붙습니다 (Alt 누르면 해제). 연한 부분은 등장·퇴장 효과 구간."));
}

function scrubOn(e, track, ppf) {
  const r = track.getBoundingClientRect();
  const go = (ev) => seek((ev.clientX - r.left) / ppf);
  go(e);
  const up = () => { window.removeEventListener("pointermove", go); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", go); window.addEventListener("pointerup", up);
}

function barDown(e, id, ppf, snaps) {
  e.preventDefault();
  select(id);
  if (S.locked()) return;
  const el = findEl(id);
  const g = e.target.dataset.g;
  const t0 = { in: el.t.in, out: el.t.out };
  const x0 = e.clientX;
  const others = snaps.filter((f) => f !== t0.in && f !== t0.out);
  const thr = 6 / ppf;
  const line = $("#snapline");
  const bar = e.currentTarget;
  let moved = false;
  S.dragging = true;
  pushUndo();
  const snap = (f, alt) => {
    if (alt) return [f, null];
    let best = null;
    for (const s of others.concat([Math.round(S.frame)])) if (Math.abs(s - f) <= thr && (best == null || Math.abs(s - f) < Math.abs(best - f))) best = s;
    return best == null ? [f, null] : [best, best];
  };
  const move = (ev) => {
    const df = (ev.clientX - x0) / ppf;
    if (!moved && Math.abs(ev.clientX - x0) < 3) return;
    moved = true;
    let ni = t0.in, no = t0.out, hit = null;
    if (g === "l") { [ni, hit] = snap(t0.in + df, ev.altKey); ni = Math.min(ni, no - 3); }
    else if (g === "r") { [no, hit] = snap(t0.out + df, ev.altKey); no = Math.max(no, ni + 3); }
    else {
      let [a, ha] = snap(t0.in + df, ev.altKey);
      const [b, hb] = snap(t0.out + df, ev.altKey);
      if (ha != null) { ni = a; no = a + (t0.out - t0.in); hit = ha; }
      else if (hb != null) { no = b; ni = b - (t0.out - t0.in); hit = hb; }
      else { ni = t0.in + df; no = t0.out + df; }
      if (t0.out >= S.m.duration) no = S.m.duration; // 끝까지 유지되는 요소는 퇴장 고정, 등장만 이동
    }
    ni = Math.max(0, Math.round(ni)); no = Math.min(S.m.duration, Math.round(no));
    writeEdit(id, { in: ni, out: no });
    remerge();
    bar.style.left = ni * ppf + "px"; bar.style.width = Math.max(6, (no - ni) * ppf) + "px";
    line.style.display = hit != null ? "block" : "none";
    if (hit != null) line.style.left = 150 + hit * ppf + "px";
    S.frame = g === "r" ? Math.max(0, no - 1) : ni;
    drawFrame();
  };
  const up = () => {
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    line.style.display = "none"; S.dragging = false;
    if (!moved) { S.undo.pop(); return; }
    renderTabs(); renderSide(); scheduleSave(); renderHead();
  };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}

// ------------------------------------------------------------------ 오른쪽: 인스펙터 + 코멘트
function renderSide() {
  const side = $("#side");
  if (!side) return;
  const keep = side.querySelector("#cBody")?.value || "";
  side.innerHTML = "";
  if (S.edit && S.sel && findEl(S.sel)) side.append(inspector(findEl(S.sel)));
  else if (S.edit) side.append(h("div", { class: "card small muted" }, "스테이지에서 요소를 누르면 위치·크기·폰트·타이밍을 바로 바꿀 수 있어요. 드래그 = 이동, 모서리 = 크기, Shift = 축 고정·비율 유지, Alt = 자석 끄기."));
  side.append(commentsPanel(keep));
}

function num(label, val, on, attrs = {}) {
  return h("div", {}, h("label", {}, label), h("input", Object.assign({ type: "number", value: val ?? "", onchange: (e) => on(e.target.value === "" ? null : +e.target.value) }, attrs)));
}

function inspector(el) {
  const id = el.id, f = el.font || {}, t = el.t, fps = S.m.fps;
  const set = (patch, side) => setEdit(id, patch, { side });
  const fams = Object.keys(S.families);
  const famSel = h("select", { onchange: (e) => { const ws = S.families[e.target.value] || [400]; const w = ws.includes(f.weight) ? f.weight : ws.reduce((a, b) => Math.abs(b - (f.weight || 400)) < Math.abs(a - (f.weight || 400)) ? b : a); set({ font: { family: e.target.value, weight: w } }, true); } },
    (fams.includes(f.family) ? fams : [f.family || "", ...fams]).map((x) => h("option", { value: x, selected: x === f.family }, x + (x && !S.families[x] ? " (설치 안 됨)" : ""))));
  const weights = S.families[f.family] || [f.weight || 400];
  const box = h("div", { class: "card insp" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, id), h("span", { class: "chip" }, el.type), h("span", { class: "spacer" }),
      h("button", { class: "ghost small", onclick: resetSelected, title: "이 요소의 직접 편집값 삭제" }, "초기화"),
      h("button", { class: "ghost small danger", onclick: deleteSelected }, "삭제")),
    el.type === "text" ? h("div", {}, h("label", {}, "문구 (화면 표시)"), h("textarea", { rows: 2, value: el.text || "", oninput: (e) => { setEdit(id, { text: e.target.value }, { noUndo: true, timeline: false }); } , onfocus: () => pushUndo() })) : null,
    h("div", { class: "g4" },
      num("X", Math.round(el.x), (v) => set({ x: v }), { id: "insp_x" }), num("Y", Math.round(el.y), (v) => set({ y: v }), { id: "insp_y" }),
      num("폭", Math.round(el.w), (v) => set({ w: v }), { id: "insp_w" }), num("높이", Math.round(el.h), (v) => set({ h: v }), { id: "insp_h" })),
    h("div", { class: "row", style: { marginTop: "6px", gap: "4px", flexWrap: "wrap" } },
      h("button", { class: "ghost small", onclick: () => set({ x: Math.round((S.m.canvas.w - el.w) / 2) }, true) }, "가로 가운데"),
      h("button", { class: "ghost small", onclick: () => set({ y: Math.round((S.m.canvas.h - el.h) / 2) }, true) }, "세로 가운데")),
    el.type === "text" ? h("div", { class: "sec" },
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, "폰트"), famSel),
        h("div", {}, h("label", {}, "굵기"), h("select", { onchange: (e) => set({ font: { weight: +e.target.value } }) }, weights.map((w) => h("option", { value: w, selected: w === f.weight }, w))))),
      h("div", { class: "g4" },
        num("크기", f.size, (v) => set({ font: { size: v } })),
        num("행간", f.lineHeight, (v) => set({ font: { lineHeight: v } }), { step: 0.05 }),
        num("자간", f.letterSpacing, (v) => set({ font: { letterSpacing: v } }), { step: 0.5 }),
        h("div", {}, h("label", {}, "색"), h("input", { type: "color", value: toHex(f.color || "#000000"), onchange: (e) => set({ font: { color: e.target.value } }) }))),
      h("div", { class: "small muted", style: { marginTop: "4px" } }, "일부만 강조: 문구에서 [[강조할 부분]]으로 감싸기 → ",
        h("input", { type: "color", value: toHex(f.accentColor || "#296ef9"), style: { width: "36px", height: "22px", verticalAlign: "middle" }, onchange: (e) => set({ font: { accentColor: e.target.value } }) })),
      hlPanel(el, set),
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, "정렬"), h("select", { onchange: (e) => set({ font: { align: e.target.value } }) }, ["left", "center", "right"].map((a) => h("option", { value: a, selected: a === (f.align || "left") }, { left: "왼쪽", center: "가운데", right: "오른쪽" }[a])))),
        h("div", {}, h("label", {}, "세로 정렬"), h("select", { onchange: (e) => set({ valign: e.target.value }) }, ["top", "middle", "bottom"].map((a) => h("option", { value: a, selected: a === (el.valign || "top") }, { top: "위", middle: "가운데", bottom: "아래" }[a])))))) : null,
    el.type === "3d" ? h("div", { class: "sec" },
      h("label", {}, "3D 장면"),
      h("select", { onchange: (e) => { const sc = e.target.value; set({ scene: sc, props: clone(SCENE_DEFAULTS[sc].props) }, true); } },
        Object.entries(SCENE_NAMES).map(([k, v]) => h("option", { value: k, selected: k === el.scene }, v))),
      h("label", {}, "장면 설정 (JSON) — 안의 at은 이 요소가 등장한 뒤 몇 프레임째인지"),
      h("textarea", { rows: 12, class: "mono", style: { fontSize: "11px" }, value: JSON.stringify(el.props || {}, null, 1),
        onchange: (e) => { try { set({ props: JSON.parse(e.target.value) }); toast("장면 설정을 저장했어요. 초안 렌더로 확인하세요."); } catch (err) { toast("JSON 형식 오류: " + err.message, 5000); } } }),
      h("div", { class: "small muted" }, "지구본: markers(lat·lon·label·at·home), focus(at·lat·lon·zoom). 막대: bars(label·value·display·at·highlight), trend. 층: layers(label·sub·at), explodeAt, focus(at·index).")) : null,
    el.type === "diagram" ? h("div", { class: "sec" },
      h("label", {}, "연출 키트 — " + (DIAGRAM_KINDS[el.kind] || el.kind)),
      h("label", {}, "설정 (JSON) — 안의 at·dur는 이 요소가 등장한 뒤 몇 프레임째인지"),
      h("textarea", { rows: 14, class: "mono", style: { fontSize: "11px" }, value: JSON.stringify(el.props || {}, null, 1),
        onchange: (e) => { try { set({ props: JSON.parse(e.target.value) }); toast("저장했어요. 재생으로 바로 확인됩니다."); } catch (err) { toast("JSON 형식 오류: " + err.message, 5000); } } }),
      h("div", { class: "small muted" }, "종류별 설정은 플러그인 templates/module2/remotion/DIRECTION_KIT.md")) : null,
    el.type === "broll" ? h("div", { class: "sec" },
      h("label", {}, "B-ROLL 장면 묘사 (자리표시에 표시)"),
      h("textarea", { rows: 3, value: el.slot || "", onchange: (e) => set({ slot: e.target.value }) }),
      h("label", {}, "검색어 (영문)"),
      h("input", { value: el.query || "", onchange: (e) => set({ query: e.target.value }) }),
      h("label", {}, "영상 파일 (프로젝트 기준 경로, 비우면 자리표시)"),
      h("input", { value: el.src || "", placeholder: "global_assets/clips/building.mp4", onchange: (e) => set({ src: e.target.value || null }, true) }),
      h("label", {}, "카메라 (JSON: zoomFrom·zoomTo·panX·panY·rotate)"),
      h("input", { class: "mono", value: JSON.stringify((el.props && el.props.camera) || { zoomFrom: 1, zoomTo: 1.06 }),
        onchange: (e) => { try { set({ props: Object.assign({}, el.props || {}, { camera: JSON.parse(e.target.value) }) }); } catch (err) { toast("JSON 형식 오류: " + err.message, 5000); } } })) : null,
    h("div", { class: "sec" },
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, "배경"), h("div", { class: "row" },
          h("input", { type: "checkbox", checked: !!el.fill, onchange: (e) => set({ fill: e.target.checked ? "#f3f6fb" : null }, true) }),
          el.fill ? h("input", { type: "color", value: toHex(el.fill), onchange: (e) => set({ fill: e.target.value }) }) : h("span", { class: "small muted" }, "없음"))),
        num("모서리", el.radius || 0, (v) => set({ radius: v })))),
    h("div", { class: "sec" },
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, `등장 f${t.in} (${sec(t.in, fps)})`), h("div", { class: "row" }, h("input", { type: "number", value: t.in, onchange: (e) => set({ in: +e.target.value }, true) }), h("button", { class: "ghost small", title: "현재 재생 위치로", onclick: () => set({ in: Math.round(S.frame) }, true) }, "지금"))),
        h("div", {}, h("label", {}, `퇴장 f${t.out} (${sec(t.out, fps)})`), h("div", { class: "row" }, h("input", { type: "number", value: t.out, onchange: (e) => set({ out: +e.target.value }, true) }), h("button", { class: "ghost small", title: "현재 재생 위치로", onclick: () => set({ out: Math.round(S.frame) + 1 }, true) }, "지금")))),
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, "등장 효과"), h("select", { onchange: (e) => set({ enter: e.target.value }, true) }, Object.entries(ENTER_EFFECTS).map(([k, v]) => h("option", { value: k, selected: k === t.enter }, v)))),
        num("등장 길이(f)", t.enterDur, (v) => set({ enterDur: v }, true))),
      h("div", { class: "g2" },
        h("div", {}, h("label", {}, "퇴장 효과"), h("select", { onchange: (e) => set({ exit: e.target.value }, true) }, Object.entries(EXIT_EFFECTS).map(([k, v]) => h("option", { value: k, selected: k === t.exit }, v)))),
        num("퇴장 길이(f)", t.exitDur, (v) => set({ exitDur: v }, true))),
      h("label", {}, "강조"),
      h("div", { class: "row", style: { flexWrap: "wrap", gap: "4px" } },
        (t.emphasis || []).map((em, i) => h("span", { class: "chip" }, `${EMPHASIS[em.type] || em.type} @${sec(em.at, fps)}`, h("a", { href: "#", onclick: (e) => { e.preventDefault(); const list = (t.emphasis || []).slice(); list.splice(i, 1); set({ emphasis: list }, true); } }, " ✕"))),
        Object.entries(EMPHASIS).map(([k, v]) => h("button", { class: "ghost small", onclick: () => set({ emphasis: (t.emphasis || []).concat([{ at: Math.round(S.frame), type: k, dur: 20 }]) }, true) }, `+ ${v} 지금`)))),
    h("div", { class: "small muted", style: { marginTop: "8px" } }, "바꾼 값은 자동 저장되고, 영상 렌더에 숫자 그대로 들어갑니다."));
  return box;
}
// 하이라이트 글자: 문구 안에서 강조할 글자 · 색 · 효과를 고른다 (애니메이션: 기본 남색→파랑으로 바뀌며 한 번 반짝)
function hlPanel(el, set) {
  const list = el.hl || [], fps = S.m ? S.m.fps : 30;
  const colors = Object.assign({ blue: "#296ef9", navy: "#0b1f4b", coral: "#ff5050" }, (S.theme && S.theme.colors) || {});
  const names = ["blue", "navy", "coral", "gray"].filter((k) => colors[k]);
  const txt = h("input", { placeholder: "강조할 글자 (문구 그대로)", style: { flex: "1" } });
  const pick = h("button", { class: "ghost small", title: "미리보기·문구 칸에서 드래그로 고른 글자를 가져옵니다",
    onclick: () => { const sel = String(window.getSelection ? window.getSelection() : "").trim(); if (sel) txt.value = sel; else toast("먼저 화면이나 문구 칸에서 글자를 드래그해 고르세요"); } }, "선택한 글자");
  const col = h("select", {}, names.map((k) => h("option", { value: "$" + k, selected: k === "blue" }, k)), h("option", { value: "custom" }, "직접…"));
  const colPick = h("input", { type: "color", value: "#296ef9", style: { width: "36px" } });
  const eff = h("select", {}, Object.entries(HL_EFFECTS).map(([k, v]) => h("option", { value: k }, v)));
  const add = (at) => {
    const t = txt.value.trim();
    if (!t) return toast("강조할 글자를 적거나 고르세요");
    if (!(el.text || "").replace(/\[\[|\]\]/g, "").includes(t)) return toast("문구 안에 그 글자가 없어요: " + t, 4000);
    const item = { text: t, color: col.value === "custom" ? colPick.value : col.value, effect: eff.value };
    if (at != null) item.at = at;
    set({ hl: list.concat([item]) }, true);
  };
  return h("div", { class: "hlbox" },
    h("label", {}, "하이라이트 글자 — 고른 글자가 색이 바뀌며 반짝"),
    h("div", { class: "row", style: { flexWrap: "wrap", gap: "4px" } },
      list.length ? list.map((x, i) => h("span", { class: "chip" },
        h("b", { style: { color: x.color && x.color[0] === "#" ? x.color : colors[(x.color || "$blue").slice(1)] } }, x.text),
        ` · ${HL_EFFECTS[x.effect || "shine"] || x.effect}${x.at != null ? " @" + sec(x.at, fps) : " (처음부터)"}`,
        h("a", { href: "#", onclick: (e) => { e.preventDefault(); const l2 = list.slice(); l2.splice(i, 1); set({ hl: l2.length ? l2 : null }, true); } }, " ✕")))
        : h("span", { class: "small muted" }, "없음")),
    h("div", { class: "row", style: { gap: "4px", marginTop: "4px" } }, txt, pick),
    h("div", { class: "row", style: { gap: "4px", marginTop: "4px" } }, h("span", { class: "small" }, "색"), col, colPick, h("span", { class: "small" }, "효과"), eff),
    h("div", { class: "row", style: { gap: "4px", marginTop: "4px" } },
      h("button", { class: "small", onclick: () => add(Math.round(S.frame)) }, "+ 지금 시점에"),
      h("button", { class: "ghost small", onclick: () => add(null) }, "+ 처음부터 강조")));
}
function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map((x) => x + x).join("");
  return "#000000";
}

function commentsPanel(keepBody) {
  const list = (S.sec.comments && S.sec.comments.comments) || [];
  const open = list.filter((c) => (c.status || "open") === "open");
  const target = h("select", { id: "cTarget" }, h("option", { value: "" }, "섹션 전체"), S.m.elements.map((e) => h("option", { value: e.id, selected: e.id === S.sel }, e.id)));
  const types = h("div", { class: "typegrid" }, Object.entries(CTYPES).map(([k, v]) => h("button", { class: S.newType === k ? "on" : "", onclick: () => { S.newType = k; types.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.textContent === v)); } }, v)));
  const bodyIn = h("textarea", { id: "cBody", rows: 3, placeholder: "예: 이 숫자는 '두 배'라고 말할 때 카운트업으로 나오게", value: keepBody });
  const atChk = h("input", { type: "checkbox", checked: true, id: "cAt" });
  const attBox = h("div", { class: "row small", style: { flexWrap: "wrap" } }, S.pendingAtt.map((a) => h("span", { class: "chip" }, a.name)));
  const box = h("div", { class: "card" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, "코멘트"), h("span", { class: "chip open" }, `열림 ${open.length}`), h("span", { class: "chip" }, `전체 ${list.length}`)),
    h("div", { class: "newc", style: { marginTop: "10px" } },
      h("div", { class: "row" }, h("span", { class: "small muted" }, "대상"), target),
      types, bodyIn,
      h("div", { class: "row small" }, atChk, h("label", { for: "cAt" }, `현재 시점 ${fmtTime(Math.round(S.frame), S.m.fps)} 포함`), h("span", { class: "spacer" }),
        h("button", { class: "ghost small", onclick: attach, title: "이미지·영상 첨부" }, "📎 첨부")),
      attBox,
      h("button", { class: "primary", onclick: () => addComment(target.value, bodyIn.value, atChk.checked) }, "코멘트 추가")),
    list.slice().sort((a, b) => ((a.status || "open") === "open" ? 0 : 1) - ((b.status || "open") === "open" ? 0 : 1) || (b.created || "").localeCompare(a.created || "")).map(commentCard));
  return box;
}
function commentCard(c) {
  const st = c.status || "open";
  return h("div", { class: "comment", onclick: () => { if (c.frame != null) seek(c.frame); if (c.target && findEl(c.target)) select(c.target, { keepSide: true }); } },
    h("div", { class: "h1" },
      h("span", { class: "chip " + st }, { open: "열림", resolved: "반영됨", needs_user: "확인 필요" }[st] || st),
      h("span", { class: "chip" }, CTYPES[c.type] || c.type),
      h("span", { class: "small mono" }, c.target || "섹션 전체"),
      c.frame != null ? h("span", { class: "small muted" }, "@" + fmtTime(c.frame, S.m.fps)) : null,
      h("span", { class: "spacer" }),
      st === "open" ? h("button", { class: "ghost small danger", onclick: (e) => { e.stopPropagation(); delComment(c.id); } }, "삭제")
        : h("button", { class: "ghost small", onclick: (e) => { e.stopPropagation(); reopen(c.id); } }, "다시 열기")),
    h("div", { class: "body" }, c.body),
    (c.attachments || []).length ? h("div", { class: "att" }, c.attachments.map((a) => /\.(png|jpe?g|gif|webp)$/i.test(a.path) ? h("img", { src: resolveSrc(a.path), title: a.name }) : h("a", { href: resolveSrc(a.path), target: "_blank" }, a.name))) : null,
    c.resolution ? h("div", { class: "res" }, "↳ " + c.resolution) : null);
}
function prefillComment(type, text) {
  S.newType = type;
  renderSide();
  const b = $("#cBody"); if (b) { b.value = text; b.focus(); }
}
function attach() {
  const inp = h("input", { type: "file", multiple: true, accept: "image/*,video/*" });
  inp.onchange = async () => {
    for (const f of inp.files) {
      const r = await api("POST", `/api/section/${S.cur}/upload?name=${encodeURIComponent(f.name)}`, undefined, f);
      S.pendingAtt.push({ name: f.name, path: r.path });
    }
    renderSide();
    toast(`첨부 ${inp.files.length}개`);
  };
  inp.click();
}
async function saveComments() { await api("PUT", `/api/section/${S.cur}/comments`, S.sec.comments); }
async function addComment(target, body, withAt) {
  if (!body.trim() && !S.pendingAtt.length) return toast("내용을 적어 주세요");
  S.sec.comments ||= { comments: [] };
  S.sec.comments.comments.push({
    id: "c" + Date.now().toString(36), target: target || null, type: S.newType, body: body.trim(),
    frame: withAt ? Math.round(S.frame) : null, attachments: S.pendingAtt.slice(), status: "open", created: new Date().toISOString(),
  });
  S.pendingAtt = [];
  await saveComments();
  const b = $("#cBody"); if (b) b.value = "";
  renderSide(); await refreshProject(); renderList(); renderHead();
  toast("코멘트를 저장했어요");
}
async function delComment(id) {
  S.sec.comments.comments = S.sec.comments.comments.filter((c) => c.id !== id);
  await saveComments(); renderSide(); await refreshProject(); renderList(); renderHead();
}
async function reopen(id) {
  const c = S.sec.comments.comments.find((x) => x.id === id);
  c.status = "open";
  await saveComments(); renderSide(); await refreshProject(); renderList(); renderHead();
}

// ------------------------------------------------------------------ 키보드
function onKey(e) {
  if (S.view !== "sections" || !S.m) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return;
  if (e.key === " ") { e.preventDefault(); S.playing ? stop() : play(); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1);
    if (S.edit && S.sel && e.altKey) { const el = findEl(S.sel); setEdit(S.sel, { x: el.x + d }); }
    else seek(S.frame + d);
  } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && S.edit && S.sel) {
    e.preventDefault();
    const el = findEl(S.sel);
    setEdit(S.sel, { y: el.y + (e.key === "ArrowDown" ? 1 : -1) * (e.shiftKey ? 10 : 1) });
  } else if (e.key === "e" || e.key === "E") toggleEdit();
  else if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undo(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && S.edit && S.sel) { e.preventDefault(); deleteSelected(); }
  else if (e.key === "Escape") select(null);
}

// ================================================================== 마스킹 검토
async function viewRedaction(app) {
  const data = await api("GET", "/api/redaction");
  const m = data.map;
  const changes = {}, del = new Set();
  const wrap = h("div", { class: "wrap" });
  app.append(wrap);
  const draw = () => {
    wrap.innerHTML = "";
    const active = m.tokens.filter((t) => !t.allow);
    wrap.append(h("div", { class: "card", style: { padding: "14px 16px" } },
      h("div", { class: "row", style: { flexWrap: "wrap" } },
        h("h2", {}, "민감정보 마스킹"),
        h("span", { class: "chip " + (m.confirmed ? "locked" : "needs_user") }, m.confirmed ? `확정됨 ${m.confirmed_at || ""}` : "미확정"),
        h("span", { class: "chip" }, `토큰 ${m.tokens.length} · 마스킹 ${active.length}`),
        h("span", { class: "spacer" }),
        h("button", { onclick: async () => { await api("POST", "/api/redaction/rescan"); toast("다시 스캔했어요"); setView("redaction"); } }, "다시 스캔"),
        h("button", { onclick: save }, "저장"),
        h("button", { class: "primary", onclick: confirmMap }, "확정하고 마스킹본 만들기")),
      h("div", { class: "small muted", style: { marginTop: "6px" } },
        "실값과 매핑표는 이 컴퓨터에만 있습니다. ElevenLabs·HeyGen·웹검색에는 오른쪽 마스킹본만 나갑니다. 노출해도 되는 항목은 '노출 허용'을 켜세요. 민감 단어가 들어간 문장은 인물에서 빠지고 장표+합성 음성으로 처리됩니다.")));
    const tbl = h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ["범주", "실값", "대체어", "노출 허용", "발화", "횟수", "출처", ""].map((x) => h("th", {}, x)))),
      h("tbody", {}, m.tokens.filter((t) => !del.has(t.id)).map((t) => h("tr", {},
        h("td", {}, h("select", { onchange: (e) => { t.cat = e.target.value; (changes[t.id] ||= {}).cat = t.cat; } }, Object.entries(data.cats).map(([k, v]) => h("option", { value: k, selected: k === t.cat }, v)))),
        h("td", { style: { fontWeight: 600, color: t.allow ? "var(--ink3)" : "var(--bad)" } }, t.real),
        h("td", {}, h("input", { value: t.mask, style: { width: "120px" }, onchange: (e) => { t.mask = e.target.value; (changes[t.id] ||= {}).mask = t.mask; } })),
        h("td", {}, h("input", { type: "checkbox", checked: !!t.allow, onchange: (e) => { t.allow = e.target.checked; (changes[t.id] ||= {}).allow = t.allow; draw(); } })),
        h("td", {}, h("input", { type: "checkbox", checked: t.spoken !== false, title: "나레이션에서 실제로 읽히는가 (읽히면 실단어 합성 대상)", onchange: (e) => { t.spoken = e.target.checked; (changes[t.id] ||= {}).spoken = t.spoken; } })),
        h("td", {}, t.count || 0),
        h("td", { class: "small muted" }, { regex: "패턴", dict: "사전", heuristic: "추정", project: "프로젝트", manual: "수동" }[t.source] || t.source),
        h("td", {}, h("button", { class: "ghost small danger", title: "오탐이면 삭제", onclick: () => { del.add(t.id); draw(); } }, "삭제"))))));
    const real = h("input", { placeholder: "놓친 실값 (예: 한빛투자증권)", style: { flex: 1 } });
    const cat = h("select", {}, Object.entries(data.cats).map(([k, v]) => h("option", { value: k }, v)));
    const mask = h("input", { placeholder: "대체어(선택)", style: { width: "120px" } });
    let hl = esc(data.script);
    for (const t of active.slice().sort((a, b) => b.real.length - a.real.length)) hl = hl.split(esc(t.real)).join(`\u0001${esc(t.real)}\u0002`);
    hl = hl.replace(/\u0001/g, '<span class="hit">').replace(/\u0002/g, "</span>");
    let mk = esc(data.masked);
    for (const msk of [...new Set(active.map((t) => t.mask))].sort((a, b) => b.length - a.length)) mk = mk.split(esc(msk)).join(`\u0001${esc(msk)}\u0002`);
    mk = mk.replace(/\u0001/g, '<span class="msk">').replace(/\u0002/g, "</span>");
    wrap.append(h("div", { class: "redgrid" },
      h("div", { class: "card", style: { padding: "12px", overflow: "auto" } },
        h("h3", {}, "추출된 토큰"), tbl,
        h("div", { class: "row", style: { marginTop: "10px" } }, real, cat, mask,
          h("button", { onclick: async () => { if (!real.value.trim()) return; await save(true); await api("POST", "/api/redaction/add", { real: real.value, cat: cat.value, mask: mask.value }); toast("추가했어요"); setView("redaction"); } }, "추가"))),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
        h("div", { class: "card", style: { padding: "12px" } }, h("h3", {}, "원문 (빨강 = 마스킹 대상)"), h("div", { class: "scriptbox", html: hl })),
        h("div", { class: "card", style: { padding: "12px" } }, h("h3", {}, "외부 전송용 마스킹본"), h("div", { class: "scriptbox", html: mk })))));
  };
  async function save(silent) {
    const tokens = Object.entries(changes).map(([id, c]) => Object.assign({ id }, c));
    await api("PUT", "/api/redaction", { tokens, delete: [...del] });
    if (silent !== true) { toast("저장했어요"); setView("redaction"); }
  }
  async function confirmMap() {
    await save(true);
    if (!confirm("현재 매핑으로 확정할까요?\n섹션마다 마스킹본(beats_masked.json)과 실단어 합성 계획(splice_plan.json)이 만들어집니다.")) return;
    const r = await api("POST", "/api/redaction/confirm");
    toast(`확정했어요. 마스킹본 ${r.written.length}개, 실단어 합성 대상 비트 ${r.splice_beats}개`, 5000);
    await refreshProject();
    setView("redaction");
  }
  draw();
}

// ================================================================== 계정 연결
const READ_TEXT = `안녕하십니까. 지금부터 올해의 경영 방향과 주요 과제를 말씀드리겠습니다.
지난 한 해 우리는 빠르게 변하는 시장 속에서도 고객의 신뢰를 지키며 꾸준히 성장해 왔습니다.
하지만 앞으로의 환경은 지금까지와는 전혀 다를 것입니다. 기술은 더 빨라지고, 고객의 기대는 더 높아지고 있습니다.
그래서 우리는 세 가지에 집중하려 합니다. 첫째, 고객 중심의 상품과 서비스. 둘째, 데이터와 인공지능을 활용한 업무 혁신. 셋째, 함께 성장하는 조직 문화입니다.
숫자보다 중요한 것은 방향이고, 방향보다 중요한 것은 실행입니다.
여러분 한 분 한 분의 실행이 모여 우리 회사의 내일을 만듭니다.
함께 해 주십시오. 감사합니다.`;

async function viewAccounts(app) {
  const acc = await api("GET", "/api/accounts");
  const wrap = h("div", { class: "wrap" });
  app.append(wrap);
  wrap.append(h("div", { class: "card", style: { padding: "14px 16px" } },
    h("h2", {}, "계정 연결"),
    h("div", { class: "small muted", style: { marginTop: "4px" } }, "키는 이 컴퓨터의 ~/.config/video-agents/secrets.env 에만 저장되고 화면에 다시 표시되지 않습니다. 영상·음성 생성처럼 비용이 드는 작업은 Claude가 매번 금액을 알리고 승인을 받은 뒤에만 실행합니다.")));
  const checksBox = (res) => h("div", { style: { marginTop: "8px" } }, (res.checks || []).map((c) => h("div", { class: "check " + (c.ok ? "ok" : "bad") }, h("span", { class: "ic" }, c.ok ? "✓" : "✕"), h("div", {}, h("b", {}, c.name), h("div", { class: "small" }, c.msg)))));

  // HeyGen
  const hgKey = h("input", { type: "password", placeholder: acc.heygen.key_set ? "저장됨 — 바꿀 때만 입력" : "HeyGen API 키", style: { width: "100%" } });
  const hgAv = h("input", { value: acc.heygen.avatar_id || "", placeholder: "avatar_id (Look ID)", style: { width: "100%" } });
  const hgVo = h("input", { value: acc.heygen.voice_id || "", placeholder: "voice_id (음성 보이스 ID)", style: { width: "100%" } });
  const hgRes = h("div");
  const hg = h("div", { class: "card" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, "HeyGen — 인물(아바타) · 음성"), h("span", { class: "spacer" }), h("span", { class: "chip " + (acc.heygen.key_set ? "locked" : "needs_user") }, acc.heygen.key_set ? "키 있음" : "키 없음")),
    h("ol", { class: "steps" },
      h("li", {}, h("a", { href: "https://app.heygen.com/", target: "_blank" }, "HeyGen에 로그인"), " 합니다. (보안상 이 화면 안에서 로그인 창을 열 수는 없어 새 탭으로 엽니다.)"),
      h("li", {}, "발표자 아바타가 없으면 ", h("b", {}, "Avatars → Create Avatar"), "로 만듭니다. 정면 상반신, 밝고 고른 조명, 단색 배경, 2분 이상 자연스럽게 말하는 영상이 좋습니다."),
      h("li", {}, "아바타 상세에서 ", h("b", {}, "Look ID(avatar_id)"), "를 복사합니다."),
      h("li", {}, h("a", { href: "https://app.heygen.com/settings?nav=API", target: "_blank" }, "Settings → API"), "에서 API 키를 복사합니다."),
      h("li", {}, "음성도 HeyGen으로 만들면 ", h("b", {}, "Voices"), "에서 본인 보이스의 ", h("b", {}, "voice_id"), "를 복사합니다."),
      h("li", {}, "아래에 붙여넣고 저장 → 연결 테스트로 아바타·Avatar V 지원·잔여 크레딧·보이스 종류를 확인합니다.")),
    h("label", { class: "small muted" }, "API 키"), hgKey,
    h("label", { class: "small muted", style: { display: "block", marginTop: "6px" } }, "avatar_id"), hgAv,
    h("label", { class: "small muted", style: { display: "block", marginTop: "6px" } }, "voice_id (음성 — 저장하면 이 프로젝트 음성은 HeyGen으로 만듭니다)"), hgVo,
    h("div", { class: "row", style: { marginTop: "10px" } },
      h("button", { onclick: async () => { await api("POST", "/api/accounts/heygen", { api_key: hgKey.value, avatar_id: hgAv.value, voice_id: hgVo.value }); hgKey.value = ""; toast("저장했어요"); } }, "저장"),
      h("button", { class: "primary", onclick: async () => { hgRes.innerHTML = "테스트 중…"; const r = await api("POST", "/api/accounts/heygen/test"); hgRes.innerHTML = ""; hgRes.append(checksBox(r)); if (r.avatar && r.avatar.preview) hgRes.append(h("img", { src: r.avatar.preview, style: { maxWidth: "220px", borderRadius: "8px", marginTop: "8px" } })); } }, "연결 테스트")),
    hgRes,
    h("div", { class: "small muted", style: { marginTop: "10px" } }, "비용 감각: Avatar V 약 $0.05/초. 15분 영상에서 인물이 처음·끝 합쳐 2분이면 약 $6. 크레딧이 모자라면 클로징 클립을 못 만드는 일이 있었으니 생성 전 잔여 크레딧을 꼭 확인합니다."));

  // ElevenLabs
  const elKey = h("input", { type: "password", placeholder: acc.elevenlabs.key_set ? "저장됨 — 바꿀 때만 입력" : "ElevenLabs API 키", style: { width: "100%" } });
  const elVoice = h("input", { value: acc.elevenlabs.voice_id || "", placeholder: "voice_id (클론 보이스)", style: { width: "100%" } });
  const elRes = h("div");
  const el = h("div", { class: "card" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, "ElevenLabs — 음성 복제·음악"), h("span", { class: "spacer" }), h("span", { class: "chip " + (acc.elevenlabs.key_set ? "locked" : "needs_user") }, acc.elevenlabs.key_set ? "키 있음" : "키 없음")),
    h("ol", { class: "steps" },
      h("li", {}, h("a", { href: "https://elevenlabs.io/app", target: "_blank" }, "ElevenLabs에 로그인"), "합니다."),
      h("li", {}, h("a", { href: "https://elevenlabs.io/app/settings/api-keys", target: "_blank" }, "API Keys"), "에서 새 키를 만들고 권한을 켭니다: ", h("b", {}, "Text to Speech, Voices(읽기·쓰기), Music, User(읽기), Image & Video(AI 영상 B-roll)"), ". TTS만 켠 키로는 보이스 목록을 못 읽습니다."),
      h("li", {}, "키를 저장하고 연결 테스트로 권한과 남은 글자 수를 확인합니다."),
      h("li", {}, "클론 보이스가 없으면 아래 녹음기로 1~3분 샘플을 녹음해 ", h("b", {}, "Instant Voice Clone"), "을 만듭니다. 더 높은 품질은 사이트의 Professional Voice Clone(30분 이상 녹음)을 쓰세요."),
      h("li", {}, "이미 클론이 있으면 테스트 결과에서 골라 voice_id로 지정합니다.")),
    h("label", { class: "small muted" }, "API 키"), elKey,
    h("label", { class: "small muted", style: { display: "block", marginTop: "6px" } }, "voice_id"), elVoice,
    h("div", { class: "row", style: { marginTop: "10px" } },
      h("button", { onclick: async () => { await api("POST", "/api/accounts/elevenlabs", { api_key: elKey.value, voice_id: elVoice.value }); elKey.value = ""; toast("저장했어요"); } }, "저장"),
      h("button", { class: "primary", onclick: async () => {
        elRes.innerHTML = "테스트 중…";
        const r = await api("POST", "/api/accounts/elevenlabs/test");
        elRes.innerHTML = ""; elRes.append(checksBox(r));
        const vs = (r.checks || []).flatMap((c) => c.voices || []);
        if (vs.length) elRes.append(h("div", { style: { marginTop: "6px" } }, h("span", { class: "small muted" }, "내 클론: "),
          vs.map((v) => h("button", { class: "ghost small", onclick: async () => { elVoice.value = v.id; await api("POST", "/api/accounts/elevenlabs", { voice_id: v.id }); toast(`${v.name}을(를) 보이스로 지정했어요`); } }, v.name))));
      } }, "연결 테스트")),
    elRes,
    recorder());
  // Envato (이미지·영상·아이콘 소재) — 키는 사용자가 직접 넣는다
  const evKey = h("input", { type: "password", placeholder: acc.envato && acc.envato.key_set ? "저장됨 — 바꿀 때만 입력" : "Envato 개인 토큰 (Personal Token)", style: { width: "100%" } });
  const evRes = h("div");
  const ev = h("div", { class: "card" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, "Envato — 이미지·영상·아이콘 소재"), h("span", { class: "spacer" }), h("span", { class: "chip " + (acc.envato && acc.envato.key_set ? "locked" : "needs_user") }, acc.envato && acc.envato.key_set ? "키 있음" : "키 없음")),
    h("ol", { class: "steps" },
      h("li", {}, h("a", { href: "https://build.envato.com/create-token/", target: "_blank" }, "build.envato.com 토큰 만들기"), "에서 로그인 후 권한을 고릅니다: ", h("b", {}, "View and search Envato sites, Download your purchased items, View your account username"), "."),
      h("li", {}, "만든 토큰을 아래에 붙여넣고 저장 → 연결 테스트."),
      h("li", {}, "에이전트가 ", h("code", {}, "envato_assets.py search"), "로 소재를 찾고, 구매한 항목은 ", h("code", {}, "download"), "로 global_assets/에 받습니다. (Envato Elements 구독 소재는 API로 받을 수 없어 사이트에서 직접 받아 global_assets/에 넣어 주세요.)")),
    h("label", { class: "small muted" }, "개인 토큰"), evKey,
    h("div", { class: "row", style: { marginTop: "10px" } },
      h("button", { onclick: async () => { await api("POST", "/api/accounts/envato", { api_key: evKey.value }); evKey.value = ""; toast("저장했어요"); } }, "저장"),
      h("button", { class: "primary", onclick: async () => { evRes.innerHTML = "테스트 중…"; const r = await api("POST", "/api/accounts/envato/test"); evRes.innerHTML = ""; evRes.append(checksBox(r)); } }, "연결 테스트")),
    evRes);
  wrap.append(h("div", { class: "acgrid" }, hg, el, ev));
}

function recorder() {
  const box = h("div", { class: "recorder" });
  const st = { rec: null, chunks: [], t0: 0, timer: null, blob: null, stream: null, ac: null };
  const timeL = h("span", { class: "mono" }, "00:00");
  const meter = h("div", { class: "meter" }, h("i"));
  const recBtn = h("button", { class: "primary" }, "● 녹음 시작");
  const preview = h("div");
  const samples = h("div");
  const nameIn = h("input", { placeholder: "보이스 이름 (예: 홍길동-발표)", style: { flex: 1 } });
  const loadSamples = async () => {
    const list = await api("GET", "/api/voice-samples");
    samples.innerHTML = "";
    const total = list.reduce((a, b) => a + b.sec, 0);
    samples.append(h("div", { class: "small muted", style: { margin: "8px 0 4px" } }, `저장된 샘플 ${list.length}개 · 총 ${Math.round(total)}초 (권장 60~180초)`));
    for (const s of list) samples.append(h("div", { class: "row small", style: { margin: "3px 0" } },
      h("input", { type: "checkbox", checked: true, "data-name": s.name, class: "smp" }), h("span", { class: "mono" }, s.name), h("span", { class: "muted" }, s.sec + "s"),
      h("audio", { controls: true, src: "/files/" + s.src, style: { height: "28px", flex: 1 } }),
      h("button", { class: "ghost small danger", onclick: async () => { await api("POST", "/api/voice-sample/delete", { name: s.name }); loadSamples(); } }, "삭제")));
    if (list.length) samples.append(h("div", { class: "row", style: { marginTop: "8px" } }, nameIn,
      h("button", { class: "primary", onclick: async () => {
        const names = [...samples.querySelectorAll(".smp")].filter((c) => c.checked).map((c) => c.dataset.name);
        const sec_ = list.filter((s) => names.includes(s.name)).reduce((a, b) => a + b.sec, 0);
        if (!names.length) return toast("샘플을 선택하세요");
        if (!confirm(`선택한 샘플 ${names.length}개(총 ${Math.round(sec_)}초)를 ElevenLabs에 업로드해 Instant Voice Clone을 만듭니다.\n본인 목소리이고 복제에 동의한 경우에만 진행하세요. 계속할까요?`)) return;
        toast("클론 생성 중…", 8000);
        const r = await api("POST", "/api/elevenlabs/clone", { name: nameIn.value || "module2-voice", samples: names });
        if (r.ok) toast(`클론 완료. voice_id가 프로젝트에 저장됐어요.`, 5000); else toast("실패: " + r.error, 7000);
      } }, "보이스 클론 만들기")));
  };
  const stopRec = () => {
    if (!st.rec) return;
    st.rec.stop();
    clearInterval(st.timer);
    st.stream.getTracks().forEach((t) => t.stop());
    st.ac && st.ac.close();
    recBtn.textContent = "● 녹음 시작";
  };
  recBtn.onclick = async () => {
    if (st.rec && st.rec.state === "recording") return stopRec();
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { return toast("마이크 권한이 필요해요: " + e.message, 5000); }
    st.chunks = [];
    st.rec = new MediaRecorder(st.stream);
    st.rec.ondataavailable = (e) => st.chunks.push(e.data);
    st.rec.onstop = () => {
      st.blob = new Blob(st.chunks, { type: st.rec.mimeType });
      preview.innerHTML = "";
      preview.append(h("div", { class: "row", style: { marginTop: "8px" } },
        h("audio", { controls: true, src: URL.createObjectURL(st.blob), style: { flex: 1 } }),
        h("button", { class: "primary", onclick: async () => {
          const ext = (st.rec.mimeType.split("/")[1] || "webm").split(";")[0];
          const r = await api("POST", `/api/voice-sample?ext=${ext}`, undefined, st.blob);
          if (r.ok) { toast(`저장 ${r.name} (${r.sec}s)`); preview.innerHTML = ""; loadSamples(); } else toast("변환 실패: " + r.error, 6000);
        } }, "저장"),
        h("button", { class: "ghost", onclick: () => (preview.innerHTML = "") }, "버리기")));
    };
    st.rec.start();
    st.t0 = Date.now();
    recBtn.textContent = "■ 녹음 정지";
    st.ac = new AudioContext();
    const an = st.ac.createAnalyser(); an.fftSize = 512;
    st.ac.createMediaStreamSource(st.stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    st.timer = setInterval(() => {
      const s = Math.floor((Date.now() - st.t0) / 1000);
      timeL.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      an.getFloatTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
      const bar = meter.firstChild;
      bar.style.width = Math.min(100, peak * 140) + "%";
      bar.style.background = peak > 0.9 ? "var(--bad)" : peak > 0.6 ? "var(--warn)" : "var(--ok)";
    }, 100);
  };
  box.append(
    h("h3", {}, "보이스 클론 녹음"),
    h("ul", { class: "small", style: { margin: "0 0 8px", paddingLeft: "18px" } },
      h("li", {}, "조용한 방에서, 입과 마이크 사이 한 뼘(약 20cm)을 유지하세요."),
      h("li", {}, "실제 발표하듯 일정한 톤과 속도로 읽으세요. 막을 쓰는 소리·숨소리·배경음은 품질을 떨어뜨립니다."),
      h("li", {}, "레벨 막대가 초록~노랑 사이면 적당합니다. 빨강이면 마이크에서 조금 떨어지세요."),
      h("li", {}, "샘플에는 회사 실데이터를 넣지 마세요. 아래 문장을 읽으면 됩니다.")),
    h("div", { class: "readtext" }, READ_TEXT),
    h("div", { class: "row", style: { marginTop: "8px" } }, recBtn, timeL, meter),
    preview, samples);
  loadSamples();
  return box;
}

// ================================================================== 디자인 키트 (design/theme.json)
// 공통 양식의 단일 출처: 색 · 글자 양식(제목·머리말·화두 문장·칩…) · 애니메이션 양식 · 연출 부품 카탈로그.
// 여기서 바꾸면 그 양식을 참조하는 모든 섹션 미리보기에 바로 반영된다(영상은 '합본 다시 만들기').
const KIT_DEMOS = {
  rankRise: { w: 1200, h: 540, len: 140, props: { riseAt: 34, arrowAt: 8 } },
  rings: { w: 1400, h: 600, len: 200, props: { center: "TF", rings: [{ label: "수요 확인", at: 20 }, { label: "결과 보며", at: 60 }, { label: "단계적 확대", at: 100 }] } },
  panels3: { w: 1500, h: 560, len: 120, props: { panels: [{ icon: "money", title: "수익성", at: 0 }, { icon: "building", title: "기금", at: 14 }, { icon: "team", title: "연금", at: 28 }] } },
  wordSwarm: { w: 1600, h: 900, len: 80, props: { text: "역량", burst: { at: 14, dur: 18 }, fly: { at: 30, dur: 40 } } },
  horizon: { w: 1600, h: 900, len: 140, props: { word: "신사업", wordY: 420, lineLabel: "기존 사업의 경계", caption: "새로운 고객과 시장", captionSub: "경계를 넘어" } },
  globe: { w: 1400, h: 860, len: 170, props: { center: { lon: 117, lat: 27 }, targets: [{ lon: -74, lat: 40.7 }, { lon: -0.1, lat: 51.5 }, { lon: 103.8, lat: 1.35 }, { lon: 151.2, lat: -33.9 }] } },
  orgChart: { w: 1600, h: 560, len: 150, props: { root: "삼성자산운용", groups: 5, highlight: [[1, 0], [2, 2], [4, 1]], highlightAt: 100 } },
  stackBuild: { w: 1400, h: 800, len: 230, props: { blocks: [{ label: "협업", icon: "handshake", at: 0 }, { label: "역량", icon: "team", at: 36 }, { label: "손익", icon: "money", at: 72 }], mapLabel: "미국 시장" } },
  bars3d: { w: 1100, h: 640, len: 150, props: { bars: [{ label: "2025", value: 440 }, { label: "2026", value: 440, display: "543조", highlight: true, valueAt: 100, add: { value: 103, label: "+103조", at: 64 } }], pre: 1, turn: { at: 24, ry: -45 } } },
  cards3d: { w: 1500, h: 460, len: 150, props: { cards: [{ num: "01", title: "성장", sub: "ETF·연금" }, { num: "02", title: "신사업", sub: "초부유층" }, { num: "03", title: "글로벌", sub: "해외 거점" }], tilt: { at: 16 } } },
  zoomReveal: { w: 1920, h: 1080, props: { slot: "건물 전경", caption: "사진 위 한 줄" } },
  split: { w: 1600, h: 700, props: { left: { label: "국내", slot: "왼쪽" }, right: { label: "해외", slot: "오른쪽" }, vs: "VS" } },
  gallery: { w: 1500, h: 760, props: { images: [1, 2, 3, 4, 5, 6].map((i) => ({ label: "사진 " + i })), cols: 3 } },
  compare: { w: 1600, h: 900, props: { before: { label: "전" }, after: { label: "후" } } },
  stack: { w: 1400, h: 900, props: { images: [{}, {}, { label: "맨 위 사진" }] } },
  chapter: { w: 1920, h: 1080, props: { num: "01", title: "챕터 제목", sub: "Chapter", onBlue: true } },
  keyword: { w: 1600, h: 400, props: { text: "Beyond", size: 220 } },
  ghost: { w: 1600, h: 500, props: { text: "10년", size: 320, maxOpacity: 0.25 } },
  stat: { w: 1200, h: 520, props: { value: "4,178", unit: "억 원", label: "세전이익", delta: "+2배", size: 220 } },
  bars: { w: 900, h: 600, props: { bars: [{ label: "전년", value: 440, display: "" }, { label: "올해", value: 440, display: "543조", highlight: true, add: { value: 103, label: "+103조", at: 0 } }], max: 600, barWidth: 180, valueSize: 56 } },
  line: { w: 1000, h: 500, props: { series: [{ points: [3, 3.6, 3.3, 4.2, 3.9, 4.7] }], labels: ["", "", "", "", "", ""], markers: [{ i: 5, text: "정점" }] } },
  nodes: { w: 1200, h: 500, len: 160, props: { nodes: [{ id: "a", x: 220, y: 200, r: 110, glyph: "대체", label: "대체", icon: "money", flipAt: 20 }, { id: "b", x: 600, y: 200, r: 110, glyph: "글로벌", glyphSize: 52, label: "글로벌", icon: "globe", flipAt: 40 }, { id: "c", x: 980, y: 200, r: 110, glyph: "AI", label: "AI", icon: "robot", flipAt: 60, fill: "$coral" }], links: [{ from: "a", to: "b", arrow: true }, { from: "b", to: "c", arrow: true }] } },
  // 노드 아이콘 데모는 nodes 썸네일에서: 클릭하면 글자 원이 뒤집혀 아이콘이 나온다
  table: { w: 1300, h: 420, props: { cols: ["구분", "목표", "현재"], rows: [["ETF", "40%", "39.4%"], ["연금", "14.5%", "13.1%"]], highlights: [{ row: 0, at: 0 }], accentCol: 1, rowH: 110 } },
  cards: { w: 1500, h: 400, props: { cards: [{ num: "01", title: "성장" }, { num: "02", title: "신사업" }, { num: "03", title: "글로벌" }], titleSize: 64, focus: [{ index: 1, at: 0 }] } },
  arrow: { w: 900, h: 450, props: { label: "격차 확대", color: "$coral", width: 14 } },
  banner: { w: 1920, h: 200, props: { text: "하지만, 모두가 같은 성과를 낸 것은 아니다", fill: "$coral", rx: 0, size: 68 } },
};

async function viewKit(app) {
  const r = await api("GET", "/api/theme");
  S.theme = r.theme;
  S.kitUsage = r.usage;
  app.append(h("div", { id: "kitRoot" }));
  renderKit();
}

let kitSaveT;
function kitChanged(rerender = true) {
  clearTimeout(kitSaveT);
  const st = $("#kitSave"); if (st) st.textContent = "저장 중…";
  kitSaveT = setTimeout(async () => {
    try { const r = await api("PUT", "/api/theme", S.theme); S.theme.version = r.version; const st2 = $("#kitSave"); if (st2) st2.textContent = "저장됨 · v" + r.version; }
    catch (e) { toast("저장 실패: " + e.message, 5000); }
  }, 500);
  if (rerender) renderKit();
}

const COLOR_OPTS = () => Object.keys(S.theme.colors || {});
const colorOf = (v) => (typeof v === "string" && v[0] === "$" ? (S.theme.colors || {})[v.slice(1)] || v : v);

function usageChips(list) {
  if (!list || !list.length) return h("span", { class: "small muted" }, "안 쓰임");
  const n = list[list.length - 1], sids = list.slice(0, -1);
  return h("span", { class: "small" }, `${n}개 · `, sids.map((sid) => h("a", { href: "#", class: "kitlink", onclick: (e) => { e.preventDefault(); S.cur = sid; S.frame = 0; setView("sections"); } }, sid + " ")));
}

function renderKit() {
  const root = $("#kitRoot");
  if (!root) return;
  const T = S.theme, U = S.kitUsage || {};
  applyKitTheme(T);   // 부품 썸네일도 키트 값(색·간격)으로
  root.innerHTML = "";
  const head = h("div", { class: "card kithead" },
    h("h2", { style: { margin: 0 } }, "디자인 키트"),
    h("span", { class: "small muted" }, "모든 장표의 공통 양식(제목 크기·위치, 박스 색, 칩, 애니메이션, 연출 부품)이 여기를 거칩니다. 바꾸면 그 양식을 쓰는 모든 섹션 미리보기에 바로 반영되고, 영상은 '전체 보기 → 합본 다시 만들기'로 갱신합니다."),
    h("span", { class: "spacer" }), h("span", { class: "small", id: "kitSave" }, "v" + (T.version || 1)));
  root.append(head);

  // 1) 색
  const colors = h("div", { class: "card kitsec" }, h("h3", {}, "색"),
    h("div", { class: "kitcolors" }, Object.entries(T.colors || {}).map(([k, v]) => h("label", { class: "kitcolor" },
      h("input", { type: "color", value: v, oninput: (e) => { T.colors[k] = e.target.value; kitChanged(false); }, onchange: () => renderKit() }),
      h("div", {}, h("b", {}, k), h("div", { class: "small muted" }, (T.colorLabels || {})[k] || ""), h("div", { class: "mono" }, v))))));
  root.append(colors);

  // 2) 글자 양식
  const rows = Object.entries(T.styles || {}).map(([k, st]) => {
    const f = st.font || {};
    const set = (patch, isFont = true) => { if (isFont) st.font = Object.assign({}, st.font, patch); else Object.assign(st, patch); kitChanged(); };
    const prev = h("div", { class: "kitprev", style: {
      fontFamily: `"${f.family || "Pretendard"}", PretendardUI, sans-serif`, fontWeight: f.weight, fontSize: Math.min(64, (f.size || 40) * 0.5) + "px",
      color: colorOf(f.color), background: colorOf(st.fill) || ((f.color || "").includes("white") ? "#203260" : "transparent"),
      borderRadius: (st.radius || 0) * 0.5 + "px", letterSpacing: (f.letterSpacing || 0) * 0.5 + "px", textAlign: f.align || "left" } }, st.label || k);
    return h("tr", {},
      h("td", {}, h("b", {}, k), h("div", { class: "small muted" }, st.label || ""), st.idea ? h("div", { class: "small kitidea" }, "💡 " + st.idea) : null),
      h("td", { style: { width: "34%" } }, prev),
      h("td", {}, h("input", { type: "number", value: f.size, style: { width: "64px" }, onchange: (e) => set({ size: +e.target.value }) }), h("div", { class: "small muted" }, "크기")),
      h("td", {}, h("select", { onchange: (e) => set({ weight: +e.target.value }) }, [500, 600, 700].map((w) => h("option", { value: w, selected: w === f.weight }, w))), h("div", { class: "small muted" }, "굵기")),
      h("td", {}, h("select", { onchange: (e) => set({ color: "$" + e.target.value }) }, COLOR_OPTS().map((c) => h("option", { value: c, selected: f.color === "$" + c }, c))), h("div", { class: "small muted" }, "글자색")),
      h("td", {}, st.fill !== undefined ? h("select", { onchange: (e) => set({ fill: "$" + e.target.value }, false) }, COLOR_OPTS().map((c) => h("option", { value: c, selected: st.fill === "$" + c }, c))) : h("span", { class: "small muted" }, "-"), h("div", { class: "small muted" }, "박스색")),
      h("td", {}, st.y !== undefined ? h("div", { class: "row" },
        h("input", { type: "number", value: st.x, title: "x", style: { width: "58px" }, onchange: (e) => set({ x: +e.target.value }, false) }),
        h("input", { type: "number", value: st.y, title: "y", style: { width: "58px" }, onchange: (e) => set({ y: +e.target.value }, false) })) : h("span", { class: "small muted" }, "장면마다"), h("div", { class: "small muted" }, "위치 x·y")),
      h("td", {}, usageChips((U.styles || {})[k])));
  });
  root.append(h("div", { class: "card kitsec" }, h("h3", {}, "글자 양식"),
    h("table", { class: "tbl kittbl" }, h("thead", {}, h("tr", {}, ["양식", "미리보기", "", "", "", "", "", "쓰인 곳"].map((x) => h("th", {}, x)))), h("tbody", {}, rows))));

  // 3) 애니메이션 양식
  const mrows = Object.entries(T.motion || {}).map(([k, mo]) => {
    const set = (patch) => { Object.assign(mo, patch); kitChanged(); };
    const box = h("div", { class: "kitmbox" }, "Aa");
    const play = () => {
      const el = { t: { in: 0, out: 9999, enter: mo.enter, enterDur: mo.enterDur || 12, exit: "none", exitDur: 10, emphasis: [] } };
      let f = 0; const step = () => { const st = stateAt(el, f); box.style.opacity = st.opacity; box.style.transform = transformOf(st, 0.5); box.style.clipPath = st.clipR ? `inset(0 ${st.clipR}% 0 0)` : ""; if (f++ < (mo.enterDur || 12) + 15) requestAnimationFrame(step); };
      step();
    };
    return h("tr", {},
      h("td", {}, h("b", {}, k), h("div", { class: "small muted" }, mo.label || "")),
      h("td", {}, h("select", { onchange: (e) => set({ enter: e.target.value }) }, Object.entries(ENTER_EFFECTS).map(([v, n]) => h("option", { value: v, selected: v === mo.enter }, n)))),
      h("td", {}, h("input", { type: "number", value: mo.enterDur, style: { width: "58px" }, onchange: (e) => set({ enterDur: +e.target.value }) }), h("span", { class: "small muted" }, " f")),
      h("td", {}, h("select", { onchange: (e) => set({ exit: e.target.value }) }, Object.entries(EXIT_EFFECTS).map(([v, n]) => h("option", { value: v, selected: v === mo.exit }, n)))),
      h("td", {}, h("input", { type: "number", value: mo.exitDur, style: { width: "58px" }, onchange: (e) => set({ exitDur: +e.target.value }) }), h("span", { class: "small muted" }, " f")),
      h("td", {}, h("div", { class: "row" }, h("button", { class: "ghost small", onclick: play }, "▶"), box)));
  });
  root.append(h("div", { class: "card kitsec" }, h("h3", {}, "애니메이션 양식"),
    h("div", { class: "small muted", style: { marginBottom: "6px" } }, "30f = 1초. 등장 모션은 1.5초(45f) 안에 끝나게. 장면이 바뀔 때 이전 화두는 '퇴장'으로 사라집니다."),
    h("table", { class: "tbl kittbl" }, h("thead", {}, h("tr", {}, ["양식", "등장", "길이", "퇴장", "길이", "미리보기"].map((x) => h("th", {}, x)))), h("tbody", {}, mrows))));

  // 3b) 섹션 전환 (@remotion/transitions — 합본 때 경계마다 적용)
  root.append(kitFont(T));
  root.append(kitTransitions(T));
  root.append(kitBeatAccent(T));
  root.append(kitMilestones(T));
  root.append(kitTextHighlight(T));

  // 4) 연출 부품
  const comps = Object.entries(T.components || {}).map(([k, c]) => {
    const demo = KIT_DEMOS[k];
    let thumb;
    if (demo) {
      const del = Object.assign({ id: "demo_" + k, kind: k, t: { in: 0 } }, resolveColors({ w: demo.w, h: demo.h, props: demo.props }, T.colors));
      const box = h("div", { style: { width: demo.w + "px", height: demo.h + "px", transform: `scale(${Math.min(320 / demo.w, 180 / demo.h)})`, transformOrigin: "0 0" }, html: diagramSVG(del, 100000) });
      // 썸네일 클릭 → 처음부터 움직임 재생 (3D 전환·뒤집기 등 무엇을 가리키는지 바로 보이게)
      const play = () => { let f = 0; const len = demo.len || 90; const step = () => { box.innerHTML = diagramSVG(del, f); if (f++ < len) requestAnimationFrame(step); }; step(); };
      thumb = h("div", { class: "kitthumb", title: "클릭하면 움직임 재생", style: { cursor: "pointer" }, onclick: play }, box, h("span", { class: "kitplay" }, "▶"));
    } else if (k === "broll") thumb = h("div", { class: "kitthumb", html: brollSVG({ w: 1920, h: 1080, slot: "장면 묘사", query: "query" }, 0, 100).replace("<svg ", '<svg style="width:320px;height:180px" ') });
    else thumb = h("div", { class: "kitthumb ph" }, "3D");
    const params = c.params ? h("div", { class: "kitparams" }, Object.entries(c.params).map(([pk, pv]) => h("label", { class: "small" },
      ((c.paramLabels || {})[pk] || pk) + " ",
      typeof pv === "string"   // 색 같은 글자 값(#8a94a6)은 글자 칸
        ? h("input", { type: "text", value: pv, style: { width: "92px" }, onchange: (e) => { c.params[pk] = e.target.value.trim(); kitChanged(); } })
        : h("input", { type: "number", value: pv, style: { width: "64px" }, onchange: (e) => { c.params[pk] = +e.target.value; kitChanged(); } })))) : null;
    return h("div", { class: "kitcomp" }, thumb, h("b", {}, c.label || k), h("div", { class: "mono small muted" }, k), h("div", { class: "small kitidea" }, "💡 " + (c.idea || "")), params, usageChips((U.kinds || {})[k]));
  });
  root.append(h("div", { class: "card kitsec" }, h("h3", {}, "연출 부품"),
    h("div", { class: "small muted", style: { marginBottom: "6px" } }, "부품 사용법·props: 플러그인 templates/module2/remotion/DIRECTION_KIT.md. 부품 색도 위 '색'을 따릅니다."),
    h("div", { class: "kitcomps" }, comps)));

  // 5) 양식을 안 쓰는 글자
  const raw = Object.entries(U.unstyled_text || {});
  root.append(h("div", { class: "card kitsec" }, h("h3", {}, "양식을 쓰지 않는 글자 요소"),
    raw.length ? h("div", { class: "small" }, "아래 섹션의 글자 요소는 값을 직접 갖고 있어 키트를 바꿔도 따라오지 않습니다(한 번만 쓰는 특수 글자). 공통으로 만들 것은 에이전트에게 양식으로 옮겨 달라고 하세요: ",
      raw.map(([sid, n]) => h("a", { href: "#", class: "kitlink", onclick: (e) => { e.preventDefault(); S.cur = sid; S.frame = 0; setView("sections"); } }, `${sid}(${n}) `)))
      : h("div", { class: "small muted" }, "없음 — 모든 글자가 키트 양식을 씁니다.")));
}

const TR_TYPES = { fade: "페이드", slide: "밀어내기", wipe: "닦아내기", flip: "뒤집기", clockWipe: "시계방향 닦아내기", iris: "원으로 열리기", none: "전환 없음" };
const TR_DIRS = { "from-right": "오른쪽에서", "from-left": "왼쪽에서", "from-bottom": "아래에서", "from-top": "위에서" };

// 전환 미리보기: A(앞 섹션) → B(다음 섹션)를 진행률 p(0~1)로 그린다 (렌더의 @remotion/transitions와 같은 모양을 근사)
function trPaint(a, b, t, p) {
  const dir = t.direction || "from-right";
  const v = { "from-right": [1, 0], "from-left": [-1, 0], "from-bottom": [0, 1], "from-top": [0, -1] }[dir] || [1, 0];
  a.style.cssText = b.style.cssText = "";
  a.style.opacity = b.style.opacity = 1;
  if (t.type === "none") { b.style.opacity = p < 0.5 ? 0 : 1; return; }
  if (t.type === "fade") { b.style.opacity = p; return; }
  if (t.type === "slide") { a.style.transform = `translate(${-v[0] * p * 100}%,${-v[1] * p * 100}%)`; b.style.transform = `translate(${v[0] * (1 - p) * 100}%,${v[1] * (1 - p) * 100}%)`; return; }
  if (t.type === "wipe") {
    const q = (1 - p) * 100;
    b.style.clipPath = { "from-right": `inset(0 0 0 ${q}%)`, "from-left": `inset(0 ${q}% 0 0)`, "from-bottom": `inset(${q}% 0 0 0)`, "from-top": `inset(0 0 ${q}% 0)` }[dir];
    return;
  }
  if (t.type === "flip") {
    const ax = v[1] ? "X" : "Y", s = v[0] || v[1];
    if (p < 0.5) { a.style.transform = `perspective(600px) rotate${ax}(${s * p * 180}deg)`; b.style.opacity = 0; }
    else { a.style.opacity = 0; b.style.transform = `perspective(600px) rotate${ax}(${s * (p - 1) * 180}deg)`; }
    return;
  }
  if (t.type === "clockWipe") { b.style.webkitMaskImage = b.style.maskImage = `conic-gradient(#000 ${p * 360}deg, transparent ${p * 360}deg)`; return; }
  if (t.type === "iris") { b.style.clipPath = `circle(${p * 75}% at 50% 50%)`; }
}

function trPreview(t) {
  const a = h("div", { class: "trA" }, "앞 섹션"), b = h("div", { class: "trB" }, "다음 섹션");
  const box = h("div", { class: "trbox" }, a, b);
  trPaint(a, b, t, 0);
  const play = () => {
    const n = Math.max(1, t.frames || 15); let f = -15;
    const step = () => { const p = Math.min(1, Math.max(0, f / n)); trPaint(a, b, t, p); if (f++ < n + 20) setTimeout(step, 1000 / 30); };
    step();
  };
  return h("div", { class: "row" }, h("button", { class: "ghost small", onclick: play }, "▶"), box);
}

function kitTransitions(T) {
  const TC = T.transitions = T.transitions || { enabled: true, default: { type: "fade", frames: 15 }, chapter: { type: "wipe", direction: "from-right", frames: 18 }, sections: {} };
  TC.sections = TC.sections || {};
  const row = (label, sub, t, onDel) => {
    const set = (patch) => { Object.assign(t, patch); kitChanged(); };
    const dirOn = ["slide", "wipe", "flip"].includes(t.type);
    return h("tr", {},
      h("td", {}, h("b", {}, label), h("div", { class: "small muted" }, sub)),
      h("td", {}, h("select", { onchange: (e) => set({ type: e.target.value }) }, Object.entries(TR_TYPES).map(([v, n]) => h("option", { value: v, selected: v === t.type }, n)))),
      h("td", {}, dirOn ? h("select", { onchange: (e) => set({ direction: e.target.value }) }, Object.entries(TR_DIRS).map(([v, n]) => h("option", { value: v, selected: v === (t.direction || "from-right") }, n))) : h("span", { class: "small muted" }, "-")),
      h("td", {}, h("input", { type: "number", min: 0, max: 24, value: t.frames, style: { width: "58px" }, onchange: (e) => set({ frames: Math.max(0, Math.min(24, +e.target.value)) }) }), h("span", { class: "small muted" }, " f")),
      h("td", {}, h("select", { onchange: (e) => set({ timing: e.target.value }) }, [["linear", "일정"], ["spring", "부드럽게"]].map(([v, n]) => h("option", { value: v, selected: v === (t.timing || "linear") }, n)))),
      h("td", {}, trPreview(t)),
      h("td", {}, onDel ? h("button", { class: "ghost small", onclick: onDel }, "삭제") : null));
  };
  const rows = [
    row("기본", "모든 섹션 경계", TC.default = TC.default || { type: "fade", frames: 15 }),
    row("챕터 시작", "챕터 간지로 시작하는 섹션으로 들어갈 때", TC.chapter = TC.chapter || { type: "wipe", direction: "from-right", frames: 18 }),
    ...Object.entries(TC.sections).map(([sid, t]) => row(sid + "로 들어갈 때", "이 섹션만 따로", t, () => { delete TC.sections[sid]; kitChanged(); })),
  ];
  const secs = ((S.project && S.project.sections) || []).map((s) => s.id).filter((sid) => !TC.sections[sid]);
  const add = h("select", { onchange: (e) => { if (!e.target.value) return; TC.sections[e.target.value] = Object.assign({}, TC.default); kitChanged(); } },
    h("option", { value: "" }, "+ 섹션별로 따로 정하기"), secs.map((sid) => h("option", { value: sid }, sid)));
  return h("div", { class: "card kitsec" }, h("h3", {}, "섹션 전환"),
    h("div", { class: "row" },
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: TC.enabled !== false, onchange: (e) => { TC.enabled = e.target.checked; kitChanged(); } }), " 섹션 사이에 전환 넣기"),
      h("span", { class: "small muted" }, "합본 때 경계마다 적용(@remotion/transitions). 섹션 다시 렌더는 필요 없고 '전체 보기 → 합본 다시 만들기'만 하면 됩니다. 길이는 최대 24f(0.8초) — 앞 섹션 끝 무음 안에서만 겹칩니다.")),
    h("table", { class: "tbl kittbl" }, h("thead", {}, h("tr", {}, ["경계", "전환", "방향", "길이", "속도", "미리보기", ""].map((x) => h("th", {}, x)))), h("tbody", {}, rows)),
    add);
}

function kitBeatAccent(T) {
  const B = T.beatAccent = Object.assign({ enabled: true, types: ["pulse", "lift", "bounce"], delay: 8, dur: 22, every: 120, window: 24 }, T.beatAccent || {});
  const num = (k, label, unit) => h("label", { class: "small" }, label + " ", h("input", { type: "number", value: B[k], style: { width: "64px" }, onchange: (e) => { B[k] = +e.target.value; kitChanged(); } }), unit ? " " + unit : "");
  const box = h("div", { class: "kitmbox" }, "Aa");
  const play = () => {
    const el = { w: 200, h: 100, t: { in: 0, out: 9999, enter: "none", enterDur: 1, exit: "none", exitDur: 1, emphasis: B.types.map((t, i) => ({ type: t, at: 10 + i * (B.dur + 14), dur: B.dur })) } };
    let f = 0; const step = () => { const st = stateAt(el, f); box.style.transform = transformOf(st, 0.5); if (f++ < 10 + B.types.length * (B.dur + 14)) requestAnimationFrame(step); };
    step();
  };
  return h("div", { class: "card kitsec" }, h("h3", {}, "비트마다 움직임 (자동 강조)"),
    h("div", { class: "small muted", style: { marginBottom: "6px" } }, "문장이 시작될 때·긴 문장은 일정 간격마다 화면에 변화가 없으면, 지금 화면의 주인공 요소(가장 큰 도표·글자)에 작은 강조를 자동으로 겁니다. 요소에 noAccent:true면 제외."),
    h("div", { class: "row" },
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: B.enabled !== false, onchange: (e) => { B.enabled = e.target.checked; kitChanged(); } }), " 켜기"),
      h("label", { class: "small" }, "강조 순서 ", h("input", { value: B.types.join(","), style: { width: "220px" }, title: Object.entries(EMPHASIS).map(([k, v]) => k + "=" + v).join(" "),
        onchange: (e) => { B.types = e.target.value.split(",").map((x) => x.trim()).filter((x) => EMPHASIS[x]); kitChanged(); } })),
      num("delay", "문장 시작 뒤", "f"), num("dur", "길이", "f"), num("every", "긴 문장 간격", "f"),
      h("button", { class: "ghost small", onclick: play }, "▶"), box),
    h("div", { class: "small muted" }, "강조 종류: " + Object.entries(EMPHASIS).map(([k, v]) => `${k}(${v})`).join(" · ")));
}

// 기본 글꼴: 고르면 모든 글자 양식 + 키트 그림 + 마일스톤 글꼴이 함께 바뀐다
function kitFont(T) {
  const F = T.font = Object.assign({ family: "Pretendard" }, T.font || {});
  const fams = Object.keys(S.families || {});
  const sample = h("div", { style: { fontFamily: `"${F.family}", Pretendard, sans-serif`, fontSize: "40px", fontWeight: 800, color: (T.colors || {}).navy, padding: "8px 0" } }, "2027 경영전략 · Beyond Connection 543.5조");
  const weights = (S.families || {})[F.family] || [];
  return h("div", { class: "card kitsec" }, h("h3", {}, "기본 글꼴 (영상 전체)"),
    h("div", { class: "small muted" }, "글꼴 파일(.otf·.ttf)을 프로젝트 global_assets/fonts/ 에 넣거나 Windows에 설치하면 목록에 나옵니다. 바꾸면 모든 섹션을 다시 렌더해야 합니다."),
    h("div", { class: "row" },
      h("select", { onchange: (e) => {
        F.family = e.target.value;
        for (const st of Object.values(T.styles || {})) if (st.font) st.font.family = F.family;   // 글자 양식 전체
        kitChanged(); renderKit();
      } }, (fams.includes(F.family) ? fams : [F.family, ...fams]).map((x) => h("option", { value: x, selected: x === F.family }, x + (S.families[x] ? "" : " (설치 안 됨)")))),
      h("span", { class: "small muted" }, weights.length ? "굵기: " + weights.join(" · ") : "")),
    sample);
}
// 하이라이트 글자 기본값 (장표 안 강조 단어 — 인스펙터에서 고른 글자에 적용)
function kitTextHighlight(T) {
  const H = T.textHighlight = Object.assign({ color: "$blue", effect: "color", dur: 18 }, T.textHighlight || {});
  const names = Object.keys(T.colors || {}).filter((k) => !["bg", "white", "soft", "line"].includes(k));
  const demo = h("div", { style: { fontSize: "34px", fontWeight: 700, color: (T.colors || {}).navy || "#0b1f4b", padding: "10px 0", cursor: "pointer" }, title: "클릭하면 재생" });
  const el = () => ({ text: "올해, 우리는 어떤 환경에서", font: { color: (T.colors || {}).navy || "#0b1f4b" }, hl: [{ text: "어떤 환경", at: 6, color: (T.colors || {})[H.color.slice(1)] || H.color, effect: H.effect, dur: H.dur }] });
  const play = () => { let f = 0; const step = () => { demo.innerHTML = textHTML(el(), { text: 1, count: 1 }, f); if (f++ < 70) requestAnimationFrame(step); }; step(); };
  demo.onclick = play; demo.innerHTML = textHTML(el(), { text: 1, count: 1 }, 999);
  return h("div", { class: "card kitsec" }, h("h3", {}, "하이라이트 글자 (장표 안 강조 단어)"),
    h("div", { class: "small muted" }, "요소 인스펙터 → '하이라이트 글자'에서 글자를 고르면 이 기본값으로 바뀌며 반짝입니다. 아래 문장을 클릭하면 재생."),
    h("div", { class: "row" },
      h("label", { class: "small" }, "색 ", h("select", { onchange: (e) => { H.color = e.target.value; kitChanged(false); play(); } }, names.map((k) => h("option", { value: "$" + k, selected: "$" + k === H.color }, k)))),
      h("label", { class: "small" }, "효과 ", h("select", { onchange: (e) => { H.effect = e.target.value; kitChanged(false); play(); } }, Object.entries(HL_EFFECTS).map(([k, v]) => h("option", { value: k, selected: k === H.effect }, v)))),
      h("label", { class: "small" }, "길이(f) ", h("input", { type: "number", value: H.dur, style: { width: "56px" }, onchange: (e) => { H.dur = +e.target.value; kitChanged(false); play(); } }))),
    demo);
}
function kitMilestones(T) {
  const M = T.milestones = Object.assign({ enabled: true, height: 64, hideOpening: true, hideEnding: false }, T.milestones || {});
  const chs = (S.project && S.project.project && S.project.project.milestones) || [];
  return h("div", { class: "card kitsec" }, h("h3", {}, "마일스톤 바 (영상 위 큰 챕터)"),
    h("div", { class: "row" },
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: M.enabled !== false, onchange: (e) => { M.enabled = e.target.checked; kitChanged(); } }), " 영상 맨 위에 표시"),
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: !!M.hideOpening, onchange: (e) => { M.hideOpening = e.target.checked; kitChanged(); } }), " 오프닝에서는 숨김"),
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: !!M.hideEnding, onchange: (e) => { M.hideEnding = e.target.checked; kitChanged(); } }), " 마무리에서는 숨김"),
      ["fill", "on", "off", "track"].map((k) => h("label", { class: "small" }, ({ fill: "진행색", on: "지금 챕터", off: "다른 챕터", track: "바탕선" })[k] + " ",
        h("select", { onchange: (e) => { M[k] = "$" + e.target.value; kitChanged(); } }, COLOR_OPTS().map((c) => h("option", { value: c, selected: M[k] === "$" + c }, c)))))),
    h("div", { class: "small muted", style: { marginTop: "6px" } }, chs.length
      ? "챕터: " + chs.map((c) => `${c.title}(${(c.sections || []).join("·")}${c.steps ? `, 단계 ${c.steps.length}` : ""})`).join("  →  ") + " — 묶음은 project.json milestones에서 정합니다(에이전트에게 요청)."
      : "project.json에 milestones(큰 챕터 묶음)가 없어 표시되지 않습니다."),
    h("div", { class: "small muted" }, "합본 때 겹칩니다(섹션 재렌더 불필요). 섹션 제목은 이 띠 아래(y 90 이상)에 둡니다 — 배치 검사가 확인합니다."));
}

// ================================================================== 연출안 (director) + 연출 검수
// 장표를 만들기 전에 영상 전체 연출안(00-direction/direction.md)을 사용자가 보고 승인한다.
// 아래 검수 결과는 direction_check.py와 같은 규칙 — 오류가 있으면 최종 렌더가 막힌다.
async function refreshDirBadge() {
  try {
    const d = await api("GET", "/api/direction");
    const b = $("#dirBadge");
    if (!b) return;
    b.textContent = !d.exists || d.template ? "없음" : d.approved_current ? "승인" : "미승인";
    b.className = "badge " + (d.approved_current ? "ok" : "bad");
    return d;
  } catch (e) { return null; }
}

async function viewDirection(app) {
  const d = await refreshDirBadge();
  if (!d) { app.append(h("div", { class: "card empty" }, "연출안을 불러오지 못했습니다.")); return; }
  const c = d.check, byLevel = (lv) => c.issues.filter((x) => x.level === lv);
  app.append(h("div", { class: "dirgrid" },
    h("section", { class: "card guidebox" },
      h("div", { class: "row" },
        h("h2", { style: { margin: 0 } }, "연출안"),
        h("span", { class: "chip " + (d.approved_current ? "locked" : "needs_user") }, d.approved_current ? `승인됨 · ${d.approved.approved_at.replace("T", " ")}` : d.approved.approved_at ? "승인 뒤 바뀜 — 다시 승인 필요" : "미승인"),
        h("span", { class: "spacer" }),
        h("button", {
          class: "primary", disabled: !d.exists || d.template || d.approved_current,
          title: "이 연출안대로 섹션을 설계하도록 승인합니다. 연출안이 바뀌면 다시 승인해야 합니다.",
          onclick: async () => {
            if (!confirm("이 연출안을 승인할까요? 에이전트가 이대로 섹션별 장표를 설계합니다.")) return;
            try { await api("POST", "/api/direction/approve"); toast("연출안을 승인했어요."); setView("direction"); } catch (e) { toast(e.message, 5000); }
          },
        }, d.approved_current ? "승인됨" : "연출안 승인")),
      !d.exists ? h("div", { class: "empty" }, "아직 연출안이 없습니다. 에이전트(director)가 00-direction/direction.md를 먼저 써야 합니다.")
        : d.template ? h("div", { class: "empty" }, "연출안이 템플릿 그대로입니다. 에이전트가 채운 뒤 다시 보세요.")
          : h("div", { class: "md", html: md(d.text) })),
    h("aside", { class: "card", style: { padding: "14px" } },
      h("h3", { style: { marginTop: 0 } }, "연출 검수"),
      h("div", { class: "row small" },
        h("span", { class: "chip " + (c.ok ? "locked" : "needs_user") }, c.ok ? "통과" : `오류 ${c.errors}`),
        h("span", { class: "chip open" }, `경고 ${c.warnings}`)),
      h("div", { class: "small muted", style: { margin: "6px 0 10px" } }, "오류가 있으면 최종 렌더가 막힙니다 (초안 렌더는 가능)."),
      h("div", { class: "small", style: { marginBottom: "8px" } }, "장치 사용: ", Object.entries(c.devices).map(([k, v]) => h("span", { class: "chip", style: { margin: "2px" } }, `${k} ${v}`))),
      ["error", "warn"].map((lv) => byLevel(lv).map((x) => h("div", { class: "dirissue " + lv, onclick: x.section ? () => { S.cur = x.section; S.frame = 0; setView("sections"); } : null, title: x.section ? "이 섹션 열기" : "" },
        h("b", {}, (lv === "error" ? "오류 " : "경고 ") + (x.section || "전체")), " ", x.msg))))));
}

// ================================================================== 전체 보기 (합본 이어보기)
// final/master.mp4(없으면 master_draft.mp4)를 재생하고, 섹션 챕터로 이동한다.
// 챕터 시작 = 앞 섹션 timeline.duration 합 (assemble.py와 같은 기준).
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function viewFull(app) {
  app.append(h("div", { class: "fullgrid" },
    h("section", {},
      h("div", { class: "card fullhead", id: "fullHead" }),
      h("div", { class: "card stagecard" },
        h("div", { id: "fullPlayer", class: "fullplayer" }),
        h("div", { class: "row small", id: "fullNow", style: { marginTop: "8px" } }))),
    h("aside", { class: "card seclist", id: "fullList" })));
  S.full = await api("GET", "/api/full");
  buildFullPlayer();
  renderFullHead();
  renderFullList();
}

function fullVideo() { return $("#fullVid"); }

function buildFullPlayer() {
  const box = $("#fullPlayer");
  if (!box) return;
  const f = S.full.file;
  const keep = fullVideo() ? fullVideo().currentTime : 0;
  box.innerHTML = "";
  if (!f) {
    box.append(h("div", { class: "empty" }, "아직 합본 영상이 없습니다. 위의 '합본 만들기'를 누르면 섹션 렌더 후 이어 붙입니다."));
    return;
  }
  const v = h("video", { id: "fullVid", src: f.url, controls: true, preload: "auto", style: { width: "100%", display: "block", background: "#000", borderRadius: "8px" } });
  v.addEventListener("loadedmetadata", () => { if (keep) v.currentTime = Math.min(keep, v.duration - 0.1); });
  v.addEventListener("timeupdate", markFullNow);
  box.append(v);
}

function fullCurrent() {
  const v = fullVideo();
  if (!v || !S.full) return null;
  const fr = v.currentTime * S.full.fps;
  return S.full.sections.find((s) => fr >= s.start && fr < s.start + s.duration) || S.full.sections[S.full.sections.length - 1];
}

function markFullNow() {
  const cur = fullCurrent();
  const v = fullVideo();
  document.querySelectorAll("#fullList .item").forEach((el) => el.classList.toggle("on", !!cur && el.dataset.sid === cur.id));
  const now = $("#fullNow");
  if (!now || !cur || !v) return;
  const n = S.full.sections.indexOf(cur) + 1;
  now.innerHTML = "";
  put(now,
    h("b", {}, `${String(n).padStart(2, "0")} ${cur.title}`),
    h("span", { class: "muted" }, `${mmss(v.currentTime)} / ${mmss(S.full.total_frames / S.full.fps)}`),
    h("span", { class: "spacer" }),
    h("button", { onclick: () => { S.cur = cur.id; S.frame = 0; setView("sections"); } }, "이 섹션 리뷰하기"));
}

function renderFullHead() {
  const box = $("#fullHead");
  if (!box) return;
  const f = S.full.file, j = S.full.job || {};
  const changed = S.full.sections.filter((s) => s.changed);
  const running = j.state === "running";
  box.innerHTML = "";
  put(box,
    h("h2", {}, "전체 보기"),
    f ? h("span", { class: "chip" }, f.draft ? "초안 합본" : "합본") : null,
    f ? h("span", { class: "small muted" }, `${f.name} · ${f.made.replace("T", " ")} · ${mmss(S.full.total_frames / S.full.fps)}`) : null,
    h("span", { class: "spacer" }),
    running ? h("span", { class: "small" }, j.step || "진행 중") : null,
    j.state === "failed" ? h("span", { class: "chip needs_user", title: j.log }, "합본 실패 — 마우스를 올려 원인 보기") : null,
    h("button", {
      class: changed.length || !f ? "primary" : "", disabled: running,
      title: "렌더가 없거나 편집 뒤 다시 렌더해야 하는 섹션만 최종 렌더한 뒤 전체를 이어 붙입니다.",
      onclick: async () => {
        try { await api("POST", "/api/full/build"); S.full.job = { state: "running", step: "준비 중" }; renderFullHead(); toast("합본을 다시 만들기 시작했어요. 바뀐 섹션만 렌더합니다."); }
        catch (e) { toast(e.message); }
      },
    }, running ? "만드는 중…" : f ? "합본 다시 만들기" : "합본 만들기"));
  const ck = S.full.check || {};
  if (ck.errors) {
    box.append(h("div", { class: "small fullwarn" }, `연출 검수 오류 ${ck.errors}건 — 이 합본은 연출 기준을 통과하지 못한 상태입니다. `,
      h("a", { href: "#direction", onclick: (e) => { e.preventDefault(); setView("direction"); } }, "연출안 탭에서 보기")));
  }
  if (changed.length && f) {
    box.append(h("div", { class: "small fullwarn" },
      `합본에 아직 반영되지 않은 섹션 ${changed.length}개: `,
      changed.map((s) => `${s.id}(${s.changed})`).join(", ")));
  }
}

function renderFullList() {
  const box = $("#fullList");
  if (!box) return;
  box.innerHTML = "";
  S.full.sections.forEach((s, i) => {
    box.append(h("div", {
      class: "item", "data-sid": s.id, title: "이 지점부터 재생",
      onclick: () => { const v = fullVideo(); if (!v) return; v.currentTime = s.start / S.full.fps + 0.01; v.play().catch(() => {}); },
    },
      h("div", { class: "t" }, h("span", { class: "n" }, String(i + 1).padStart(2, "0")), s.title),
      h("div", { class: "meta" },
        h("span", { class: "chip" }, mmss(s.start / S.full.fps)),
        h("span", { class: "chip" }, sec(s.duration, S.full.fps)),
        s.changed ? h("span", { class: "chip open" }, s.changed) : null)));
  });
  markFullNow();
}

async function pollFull() {
  if (!$("#fullHead")) return;
  const before = S.full;
  S.full = await api("GET", "/api/full");
  const wasRunning = before && before.job && before.job.state === "running";
  if (wasRunning && S.full.job.state !== "running") {
    toast(S.full.job.state === "done" ? "합본을 새로 만들었어요." : "합본 실패: " + (S.full.job.log || "").slice(-200), 6000);
  }
  if (JSON.stringify(before && before.file) !== JSON.stringify(S.full.file)) buildFullPlayer();
  renderFullHead();
  renderFullList();
}

// ================================================================== 안내
function viewGuide(app) {
  app.append(h("div", { class: "card guidebox" },
    h("h2", {}, "모듈2 스튜디오 사용법"),
    h("ol", {},
      h("li", {}, h("b", {}, "마스킹 확정"), " — 상단 '마스킹'에서 회사명·금액·지역 같은 민감정보 목록을 확인하고 확정합니다. 확정 전에는 어떤 음성·아바타도 만들지 않습니다."),
      h("li", {}, h("b", {}, "섹션 리뷰"), " — 섹션을 하나씩 열어 ① 대본 ② 스토리보드 ③ 장표 ④ 영상화 타임라인을 봅니다. 재생 버튼으로 실제 영상처럼 움직임을 확인합니다."),
      h("li", {}, h("b", {}, "직접 고치기"), " — '편집 모드'를 켜고 요소를 끌어 위치, 모서리로 크기, 오른쪽 패널에서 폰트·색·등장/퇴장 효과를 바꿉니다. 타임라인 탭에서 막대를 끌어 나오는 타이밍을 조절합니다. 바꾼 숫자는 그대로 영상에 들어갑니다."),
      h("li", {}, h("b", {}, "말로 고치기"), " — 직접 고치기 어려운 건 코멘트로 남깁니다. 위치·크기·폰트·타이밍·효과·이미지 넣기·영상으로 대체·문구·자유 의견 중 유형을 고르고, 필요하면 이미지나 영상을 첨부합니다."),
      h("li", {}, h("b", {}, "수정 요청 보내기"), " — 섹션 상단 버튼을 누른 뒤 Claude에게 \"수정 요청 보냈어\"라고 말하면, 요청이 있는 섹션마다 서브에이전트가 하나씩 붙어 고칩니다. 끝나면 섹션이 '수정됨·확인 필요'로 바뀝니다."),
      h("li", {}, h("b", {}, "전체 보기"), " — 상단 '전체 보기'에서 합본 영상을 처음부터 끝까지 이어서 봅니다. 오른쪽 목록을 누르면 그 섹션으로 건너뛰고, '이 섹션 리뷰하기'로 바로 고치러 갈 수 있습니다. 섹션을 고친 뒤 '합본 다시 만들기'를 누르면 바뀐 섹션만 다시 렌더해 이어 붙입니다."),
      h("li", {}, h("b", {}, "확인과 잠금"), " — 수정본을 다시 보고, 마음에 들면 '섹션 잠금'을 누릅니다. 잠긴 섹션은 에이전트가 건드리지 않습니다. 이전 버전으로 되돌릴 수도 있습니다."),
      h("li", {}, h("b", {}, "계정 연결"), " — HeyGen과 ElevenLabs 키를 넣고 연결 테스트를 합니다. 클론 보이스가 없으면 녹음기로 샘플을 녹음합니다.")),
    h("h3", { style: { marginTop: "16px" } }, "단축키"),
    h("div", { class: "small" },
      h("span", { class: "kbd" }, "Space"), " 재생/정지 · ", h("span", { class: "kbd" }, "← →"), " 1프레임 (Shift 10프레임) · ", h("span", { class: "kbd" }, "E"), " 편집 모드 · ",
      h("span", { class: "kbd" }, "⌘Z"), " 되돌리기 · ", h("span", { class: "kbd" }, "↑ ↓"), " / ", h("span", { class: "kbd" }, "Alt ← →"), " 선택 요소 미세 이동 · ", h("span", { class: "kbd" }, "Delete"), " 선택 요소 삭제 · ", h("span", { class: "kbd" }, "Esc"), " 선택 해제"),
    h("h3", { style: { marginTop: "16px" } }, "주의"),
    h("ul", { class: "small" },
      h("li", {}, "이 스튜디오는 이 컴퓨터(127.0.0.1)에서만 열립니다. 실데이터가 있으니 화면 공유·외부 게시에 주의하세요."),
      h("li", {}, "미리보기는 영상 렌더와 같은 애니메이션 규칙(anim.js)을 씁니다. 다만 3D·차트·실제 아바타 영상은 렌더 단계에서 완성됩니다."))));
}

boot();
