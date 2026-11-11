// 모듈2 스튜디오 — 섹션 리뷰·직접 편집·코멘트·마스킹 검토·계정 연결
import { mergeSection, stateAt, displayText, richSegments, fmtTime, ENTER_EFFECTS, EXIT_EFFECTS, EMPHASIS } from "./anim.js";

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

const STATUS = { draft: "초안", commented: "코멘트 있음", revision_requested: "수정 요청됨", in_progress: "수정 중", revised: "수정됨·확인 필요", locked: "잠금" };
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
  const [hv, hs] = location.hash.slice(1).split("/");
  if (hs && S.project.sections.some((x) => x.id === hs)) S.cur = hs;
  setView(["sections", "redaction", "accounts", "guide"].includes(hv) ? hv : "sections");
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

function remerge() { S.m = mergeSection(S.sec.layout, S.sec.timeline, S.edits); }
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
  if (el.type === "text" && el.valign) {
    node.style.display = "flex";
    node.style.alignItems = { top: "flex-start", middle: "center", bottom: "flex-end" }[el.valign] || "flex-start";
    node.style.justifyContent = { left: "flex-start", center: "center", right: "flex-end" }[f.align] || "flex-start";
  }
  node.classList.toggle("sel", S.sel === el.id);
}

function setText(box, el, st) {
  const raw = el.text || "";
  if (!raw.includes("[[")) { box.textContent = displayText(raw, st); return; }
  const key = JSON.stringify([raw, st.text, st.count]);
  if (box._key === key) return;
  box._key = key;
  box.innerHTML = "";
  const accent = (el.font && el.font.accentColor) || "#296ef9";
  for (const s of richSegments(raw, st)) box.append(s.accent ? h("span", { style: { color: accent } }, s.text) : s.text);
}

function drawFrame() {
  if (!S.m) return;
  const f = Math.round(S.frame);
  for (const el of S.m.elements) {
    const node = S.nodes[el.id];
    if (!node) continue;
    const st = stateAt(el, f);
    if (S.edit) {
      node.style.display = "";
      node.style.opacity = st.visible ? "1" : "0.28";
      node.classList.toggle("ghost", !st.visible);
      node.style.transform = "";
      node.style.clipPath = "";
      node.style.boxShadow = "";
      if (el.type === "text" && node._content) setText(node._content, el, { text: 1, count: 1 });
    } else {
      node.classList.remove("ghost");
      node.style.display = st.visible ? "" : "none";
      node.style.opacity = String(st.opacity);
      node.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.scale})`;
      node.style.clipPath = st.clipL || st.clipR ? `inset(-20px ${st.clipR}% -20px ${st.clipL}%)` : "";
      node.style.boxShadow = st.highlight ? `0 0 0 ${14 * st.highlight}px rgba(255,214,0,${0.4 * st.highlight})` : "";
      if (el.type === "text" && node._content) setText(node._content, el, st);
    }
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
    if (S.frame >= S.m.duration - 1) { S.frame = S.m.duration - 1; drawFrame(); return stop(); }
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
  const lines = esc(s).split("\n");
  let out = "", inList = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
    if (/^\s*[-*] /.test(l)) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + l.replace(/^\s*[-*] /, "") + "</li>"; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    const m = l.match(/^(#{1,3}) (.*)/);
    if (m) out += `<h${m[1].length}>${m[2]}</h${m[1].length}>`;
    else if (l.trim()) out += `<p>${l}</p>`;
  }
  return out + (inList ? "</ul>" : "");
}

function tabScript(body) {
  const beats = (S.sec.beats && S.sec.beats.beats) || [];
  const masked = {};
  for (const b of (S.sec.beats_masked && S.sec.beats_masked.beats) || []) masked[b.id] = b;
  const tlb = {};
  for (const b of (S.sec.timeline && S.sec.timeline.beats) || []) tlb[b.id] = b;
  if (!beats.length) return body.append(h("div", { class: "empty" }, "비트가 없습니다."));
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
        h("span", { class: "chip" }, (b.est_sec || 0).toFixed ? b.est_sec.toFixed(1) + "s" : ""),
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
  const hgRes = h("div");
  const hg = h("div", { class: "card" },
    h("div", { class: "row" }, h("h3", { style: { margin: 0 } }, "HeyGen — 인물(아바타)"), h("span", { class: "spacer" }), h("span", { class: "chip " + (acc.heygen.key_set ? "locked" : "needs_user") }, acc.heygen.key_set ? "키 있음" : "키 없음")),
    h("ol", { class: "steps" },
      h("li", {}, h("a", { href: "https://app.heygen.com/", target: "_blank" }, "HeyGen에 로그인"), " 합니다. (보안상 이 화면 안에서 로그인 창을 열 수는 없어 새 탭으로 엽니다.)"),
      h("li", {}, "발표자 아바타가 없으면 ", h("b", {}, "Avatars → Create Avatar"), "로 만듭니다. 정면 상반신, 밝고 고른 조명, 단색 배경, 2분 이상 자연스럽게 말하는 영상이 좋습니다."),
      h("li", {}, "아바타 상세에서 ", h("b", {}, "Look ID(avatar_id)"), "를 복사합니다."),
      h("li", {}, h("a", { href: "https://app.heygen.com/settings?nav=API", target: "_blank" }, "Settings → API"), "에서 API 키를 복사합니다."),
      h("li", {}, "아래에 붙여넣고 저장 → 연결 테스트로 아바타·Avatar V 지원·잔여 크레딧을 확인합니다.")),
    h("label", { class: "small muted" }, "API 키"), hgKey,
    h("label", { class: "small muted", style: { display: "block", marginTop: "6px" } }, "avatar_id"), hgAv,
    h("div", { class: "row", style: { marginTop: "10px" } },
      h("button", { onclick: async () => { await api("POST", "/api/accounts/heygen", { api_key: hgKey.value, avatar_id: hgAv.value }); hgKey.value = ""; toast("저장했어요"); } }, "저장"),
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
      h("li", {}, h("a", { href: "https://elevenlabs.io/app/settings/api-keys", target: "_blank" }, "API Keys"), "에서 새 키를 만들고 권한을 켭니다: ", h("b", {}, "Text to Speech, Voices(읽기·쓰기), Music, User(읽기)"), ". TTS만 켠 키로는 보이스 목록을 못 읽습니다."),
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
  wrap.append(h("div", { class: "acgrid" }, hg, el));
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
