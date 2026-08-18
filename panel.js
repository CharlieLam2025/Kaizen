// VideoBricks panel — reader first, then bricks / ask / notes.

const TUTORIAL = [
  {
    title: "把字幕当成一本书",
    body: "默认是双语阅读。点左边时间跳到那一秒，也可以在上面输入 12:30 跳转。播放时会跟着滚，手一滑会暂停跟随。",
    view: "read",
    spot: ".reader-tools, #transcriptBox",
  },
  {
    title: "划线、笔记、查词",
    body: "在句子上选几个词，底部会出现工具条：划线、写笔记、查词典、存进生词本。存过的词之后会标绿。",
    view: "read",
    spot: "#transcriptBox",
  },
  {
    title: "一块一块拆，还能做成图",
    body: "上面会写清这块在干什么：讲概念、讲案例、讲故事、给做法、在问答。类型变了会另起一行。点开一块可以拆解、做成图。",
    view: "bricks",
    spot: "#brickList",
  },
  {
    title: "问视频",
    body: "问整支，或先划一句话再点「问这句」。回答里的时间戳能点，直接跳到出处。",
    view: "ask",
    spot: ".view[data-view='ask']",
  },
  {
    title: "笔记、金句和快捷键",
    body: "划过的线、金句、笔记、生词都在这里。看视频时三个键就够：Alt+1 收下这句，Alt+2 循环这块，Alt+3 记下自己的话。顶栏「导出」能打成 PDF，或下载 Markdown / Obsidian。",
    view: "notes",
    spot: ".view[data-view='notes']",
  },
  {
    title: "复习：让它长进脑子",
    body: "给划线、金句点「做成卡」，生词本能一键全变成卡。到期的卡会出现在「复习」页，按记忆情况安排下次出现。看完还可以在拆砖页点「闭卷复盘」，凭记忆默写，AI 对照字幕告诉你漏了什么。",
    view: "review",
    spot: ".view[data-view='review']",
  },
];

const CAT_ORDER = ["concept", "case", "story", "action", "qa"];

const CAT_LABEL = {
  concept: "讲概念",
  case: "讲案例",
  story: "讲故事",
  action: "给做法",
  qa: "在问答",
};

const CAT_COLOR = {
  concept: "#5b8def",
  case: "#3aa06a",
  story: "#9b6bd6",
  action: "#d4922a",
  qa: "#d45b6a",
};

const PROGRESS_LABEL = {
  fresh: "未开始",
  learning: "进行中",
  done: "已学会",
};

const state = {
  tabId: null,
  videoId: null,
  title: "",
  language: "",
  segments: [],
  gist: "",
  blocks: [],
  selectedBlock: -1,
  dives: {},
  scripts: {},
  translations: {},
  transcriptMode: "bilingual",
  chat: [],
  askContext: null,
  study: null,
  lastSeconds: 0,
  loopIndex: -1,
  progress: {},
  conceptMap: null,
  argMap: null,
  visuals: {},
  scriptStudio: -1,
};

let loadingVideoId = null;
let isTranslating = false;
let isAnalyzing = false;
let isStudying = false;
let settingsCache = { apiKey: "", supadataKey: "", baseUrl: "", model: "" };
let highlights = [];
let notes = [];
let vocab = [];
let selPayload = null;
let pendingNote = null;
let notesFilter = "highlights";
let brickFilter = "all";
let brickKind = "all";
let mapKind = "mind";
let studyTab = "recap";
let tutIndex = 0;
let tutorialPending = false;
let followPlayback = true;
let followLockUntil = 0;
let lastFollowedRow = null;
let lastUserScrollAt = 0;

const $ = (id) => document.getElementById(id);

function esc(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sendToBg(message) {
  return chrome.runtime.sendMessage(message);
}

function sendToTab(message) {
  return new Promise((resolve) => {
    if (!state.tabId) return resolve(null);
    chrome.tabs.sendMessage(state.tabId, message, (response) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(response);
    });
  });
}

function seek(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  sendToTab({ type: "VB_SEEK", seconds: s });
  scrollToSeconds(s);
}

function scrollToSeconds(seconds) {
  const rows = [...document.querySelectorAll("#transcriptBox .t-row")];
  let target = null;
  for (const row of rows) {
    if (Number(row.dataset.start) <= seconds) target = row;
    else break;
  }
  if (!target) return;
  followLockUntil = Date.now() + 900;
  lastFollowedRow = target;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 1100);
}

function parseJumpInput(raw) {
  const text = String(raw || "").trim().replace("：", ":");
  if (!text) return null;
  const clockMatch = text.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
  const sec = Number(text);
  return Number.isFinite(sec) && sec >= 0 ? sec : null;
}

let focusMode = false;
let reviewOnly = false;
let typeSize = 16;

function applyTypeSize() {
  document.documentElement.style.setProperty("--read-size", `${typeSize}px`);
}

function setFocusMode(on) {
  focusMode = Boolean(on);
  document.body.classList.toggle("reading-focus", focusMode);
  if ($("focusDock")) $("focusDock").hidden = !focusMode;
  $("focusBtn")?.classList.toggle("active", focusMode);
}

function syncLangButtons() {
  const mode = state.transcriptMode;
  $("modeOriginal")?.classList.toggle("active", mode === "original");
  $("modeBilingual")?.classList.toggle("active", mode === "bilingual");
  $("modeZh")?.classList.toggle("active", mode === "zh");
  document.querySelectorAll("#focusLang [data-tm]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tm === mode);
  });
}

function updateFollowBtn() {
  const btn = $("followBtn");
  if (!btn) return;
  btn.classList.toggle("active", followPlayback);
  btn.textContent = followPlayback ? "跟随" : "已停";
}

function videoIdFromHref(href) {
  try {
    const url = new URL(href);
    if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
    return null;
  } catch (_e) {
    return null;
  }
}

async function findWatchTab() {
  const queries = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
    { url: ["*://www.youtube.com/watch*", "*://m.youtube.com/watch*", "*://www.youtube.com/shorts/*"] },
  ];
  for (const query of queries) {
    try {
      const tabs = await chrome.tabs.query(query);
      const hit = (tabs || []).find((tab) => videoIdFromHref(tab.url));
      if (hit) return hit;
    } catch (_e) {
      /* next */
    }
  }
  return null;
}

async function ensureContentScript(tabId) {
  const ping = await sendToTab({ type: "VB_VIDEO_INFO" });
  if (ping) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return true;
  } catch (_e) {
    return false;
  }
}

function linkifyTimes(text) {
  return esc(text).replace(/\[(\d{1,3}):([0-5]\d)\]/g, (_m, min, sec) => {
    const s = Number(min) * 60 + Number(sec);
    return `<span class="time-link" data-s="${s}">[${min}:${sec}]</span>`;
  });
}

function parseClock(label) {
  const m = String(label || "").match(/(\d{1,3}):([0-5]\d)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ---------- storage ----------

async function loadSettings() {
  const stored = await chrome.storage.local.get("vb_settings");
  settingsCache = {
    apiKey: "",
    supadataKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    diveModel: "deepseek-v4-pro",
    readSize: 16,
    ...(stored.vb_settings || {}),
  };
  if (settingsCache.model === "deepseek-chat") settingsCache.model = "deepseek-v4-flash";
  if (!settingsCache.diveModel) settingsCache.diveModel = "deepseek-v4-pro";
  typeSize = Math.min(22, Math.max(14, Number(settingsCache.readSize) || 16));
  applyTypeSize();
  return settingsCache;
}

async function saveSettings(next) {
  settingsCache = { ...settingsCache, ...next };
  await chrome.storage.local.set({ vb_settings: settingsCache });
  paintModelSwitch();
}

function paintModelSwitch() {
  const cur = settingsCache.model || "deepseek-v4-flash";
  document.querySelectorAll("#modelSwitch [data-m]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.m === cur);
  });
}

function paintSetupModelPick() {
  const daily = $("setupModel")?.value || "deepseek-v4-flash";
  document.querySelectorAll("#setupModelPick [data-pick]").forEach((btn) => {
    const on = btn.dataset.pick === "pro" ? daily === "deepseek-v4-pro" : daily !== "deepseek-v4-pro";
    btn.classList.toggle("on", on);
  });
}

function applySetupModels() {
  const daily = $("setupModel").value || "deepseek-v4-flash";
  $("setupDiveModel").value = $("setupDiveFollow")?.checked ? daily : "deepseek-v4-pro";
  paintSetupModelPick();
}

function keysReady() {
  return Boolean(settingsCache.apiKey && settingsCache.supadataKey);
}

let quotes = [];
let cards = [];
let shelf = [];
let atlas = { concepts: [], propositions: [], focusQuestion: "" };

const HL_COLOR = {
  def: { label: "定义", cls: "hl-def" },
  ex: { label: "例子", cls: "hl-ex" },
  contra: { label: "反驳", cls: "hl-contra" },
  act: { label: "行动", cls: "hl-act" },
};

let shelfFilter = "new";

async function loadLists() {
  const stored = await chrome.storage.local.get([
    "vb_highlights",
    "vb_notes",
    "vb_vocab",
    "vb_quotes",
    "vb_cards",
    "vb_shelf",
    "vb_atlas",
  ]);
  highlights = stored.vb_highlights || [];
  notes = stored.vb_notes || [];
  vocab = stored.vb_vocab || [];
  quotes = stored.vb_quotes || [];
  cards = stored.vb_cards || [];
  shelf = stored.vb_shelf || [];
  atlas = stored.vb_atlas || { concepts: [], propositions: [], focusQuestion: "" };
}

async function saveList(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function normLabel(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[的了着是与和]/g, "")
    .slice(0, 12);
}

function openVideoAt(videoId, seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const url = `https://www.youtube.com/watch?v=${videoId}${s ? `&t=${s}s` : ""}`;
  if (state.tabId) chrome.tabs.update(state.tabId, { url });
  else chrome.tabs.create({ url });
}

async function upsertShelf(partial) {
  const id = partial?.videoId;
  if (!id) return;
  const i = shelf.findIndex((x) => x.videoId === id);
  if (i >= 0) {
    const prev = shelf[i];
    shelf[i] = {
      ...prev,
      ...partial,
      bucket: partial.bucket || prev.bucket || "new",
      updatedAt: Date.now(),
    };
  } else {
    shelf.unshift({
      bucket: "new",
      addedAt: Date.now(),
      updatedAt: Date.now(),
      title: "",
      lastSeconds: 0,
      ...partial,
    });
  }
  if (shelf.length > 200) shelf.length = 200;
  await saveList("vb_shelf", shelf);
  renderShelf();
}

function renderShelf() {
  const root = $("shelfBox");
  if (!root) return;
  const rows = shelf.filter((x) => (x.bucket || "new") === shelfFilter);
  if (!rows.length) {
    const empty = {
      new: "打开过的视频会出现在这里。",
      later: "以后再看的会进这一栏。",
      shortlist: "精选短名单还是空的。",
      done: "还没有标成看完的视频。",
    };
    root.innerHTML = `<div class="chat-empty">${empty[shelfFilter] || "空"}</div>`;
    return;
  }
  root.innerHTML = rows
    .map((item) => {
      const here = item.videoId === state.videoId;
      return `<article class="shelf-item${here ? " on" : ""}">
        <div class="shelf-title">${esc(item.title || item.videoId)}</div>
        <div class="note-meta">${item.lastSeconds ? `看到 ${clock(item.lastSeconds)}` : "还没开始"}</div>
        <div class="row-actions">
          <button class="text-btn" data-open="${item.videoId}" data-s="${item.lastSeconds || 0}" type="button">${here ? "继续这篇" : "打开"}</button>
          ${shelfFilter !== "later" ? `<button class="text-btn" data-bucket="later" data-id="${item.videoId}" type="button">以后</button>` : ""}
          ${shelfFilter !== "shortlist" ? `<button class="text-btn" data-bucket="shortlist" data-id="${item.videoId}" type="button">精选</button>` : ""}
          ${shelfFilter !== "done" ? `<button class="text-btn" data-bucket="done" data-id="${item.videoId}" type="button">看完</button>` : ""}
          ${shelfFilter !== "new" ? `<button class="text-btn" data-bucket="new" data-id="${item.videoId}" type="button">放回新进</button>` : ""}
        </div>
      </article>`;
    })
    .join("");
  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.open === state.videoId) {
        seek(Number(btn.dataset.s) || 0);
        switchView("read");
        return;
      }
      openVideoAt(btn.dataset.open, btn.dataset.s);
    });
  });
  root.querySelectorAll("[data-bucket]").forEach((btn) => {
    btn.addEventListener("click", () => upsertShelf({ videoId: btn.dataset.id, bucket: btn.dataset.bucket }));
  });
}

async function mergeAtlasLocal(map) {
  if (!isNovakMap(map) || !state.videoId) return;
  if (!atlas.concepts) atlas.concepts = [];
  if (!atlas.propositions) atlas.propositions = [];
  const byNorm = new Map(atlas.concepts.map((c) => [normLabel(c.label), c]));
  const idMap = new Map();
  for (const c of map.concepts || []) {
    const key = normLabel(c.label);
    if (!key) continue;
    let node = byNorm.get(key);
    if (!node) {
      node = {
        id: `a-${key}`.slice(0, 20),
        label: c.label,
        level: Number(c.level) || 0,
        sources: [],
      };
      atlas.concepts.push(node);
      byNorm.set(key, node);
    }
    idMap.set(c.id, node.id);
    if (!node.sources.some((s) => s.videoId === state.videoId)) {
      const block = state.blocks[c.block];
      node.sources.push({
        videoId: state.videoId,
        title: state.title,
        block: Number.isFinite(Number(c.block)) ? Number(c.block) : -1,
        seconds: block?.start || 0,
      });
    }
  }
  for (const p of map.propositions || []) {
    const from = idMap.get(p.from);
    const to = idMap.get(p.to);
    if (!from || !to || from === to) continue;
    if (atlas.propositions.some((x) => x.from === from && x.to === to && x.link === p.link)) continue;
    atlas.propositions.push({ from, to, link: p.link, cross: Boolean(p.cross) });
  }
  for (const p of atlas.propositions) {
    const a = atlas.concepts.find((c) => c.id === p.from);
    const b = atlas.concepts.find((c) => c.id === p.to);
    const aSet = new Set((a?.sources || []).map((s) => s.videoId));
    const bVids = (b?.sources || []).map((s) => s.videoId);
    if (aSet.size && bVids.some((v) => !aSet.has(v))) p.cross = true;
  }
  if (atlas.concepts.length > 80) atlas.concepts = atlas.concepts.slice(-80);
  if (atlas.propositions.length > 120) atlas.propositions = atlas.propositions.slice(-120);
  await chrome.storage.local.set({ vb_atlas: atlas });
}

function atlasAsNovak() {
  return {
    focusQuestion: atlas.focusQuestion || "这些视频共同在讲什么？",
    concepts: (atlas.concepts || []).map((c) => ({
      id: c.id,
      label: c.label,
      level: c.level || 0,
      block: -1,
      sources: c.sources || [],
    })),
    propositions: atlas.propositions || [],
  };
}

async function weaveAtlas() {
  const help = $("mapHelp");
  if (help) help.textContent = "正在把本视频织进总图…";
  const result = await sendToBg({
    action: "vbAtlas",
    current: state.conceptMap,
    atlas,
    title: state.title,
  });
  if (!result?.ok) {
    if (help) help.textContent = result?.error || "织图失败";
    return;
  }
  atlas.focusQuestion = result.focusQuestion;
  const byNorm = new Map((atlas.concepts || []).map((c) => [normLabel(c.label), c]));
  const nextConcepts = [];
  for (const c of result.concepts || []) {
    const old = byNorm.get(normLabel(c.label));
    nextConcepts.push({
      id: old?.id || c.id,
      label: c.label,
      level: c.level,
      sources: old?.sources || [],
    });
  }
  atlas.concepts = nextConcepts;
  atlas.propositions = result.propositions || [];
  if (isNovakMap(state.conceptMap)) await mergeAtlasLocal(state.conceptMap);
  await chrome.storage.local.set({ vb_atlas: atlas });
  renderMaps();
}

async function stashLearningBricks() {
  const vid = state.videoId;
  const title = state.title;
  const blocks = state.blocks || [];
  if (!vid || !blocks.length) return;
  for (let i = 0; i < blocks.length; i++) {
    if (blockProgress(i) !== "learning") continue;
    const sourceId = `brick-${vid}-${i}`;
    if (hasCardFor(sourceId)) continue;
    await addCard({
      type: "brick",
      sourceId,
      videoId: vid,
      videoTitle: title,
      seconds: blocks[i].start || 0,
      front: `「${blocks[i].title}」讲了什么？`,
      back: blocks[i].summary || "打开视频对一下",
      hint: `${clock(blocks[i].start)}–${clock(blocks[i].end)}`,
      interval: 1,
      due: Date.now() + DAY,
    });
  }
}

async function scheduleBrick(i) {
  const block = state.blocks[i];
  if (!block || !state.videoId) return;
  const sourceId = `brick-${state.videoId}-${i}`;
  const existing = cards.find((c) => c.sourceId === sourceId);
  if (existing) {
    existing.due = Date.now() + DAY;
    existing.front = `「${block.title}」讲了什么？`;
    existing.back = block.summary || existing.back;
    await saveList("vb_cards", cards);
    renderReviewBadge();
    return;
  }
  await addCard({
    type: "brick",
    sourceId,
    videoId: state.videoId,
    videoTitle: state.title,
    seconds: block.start || 0,
    front: `「${block.title}」讲了什么？`,
    back: block.summary || "打开视频对一下",
    hint: `${clock(block.start)}–${clock(block.end)}`,
    interval: 1,
    due: Date.now() + DAY,
  });
}

async function dropBrickCard(i) {
  const sourceId = `brick-${state.videoId}-${i}`;
  const next = cards.filter((c) => c.sourceId !== sourceId);
  if (next.length === cards.length) return;
  cards = next;
  await saveList("vb_cards", cards);
  renderReviewBadge();
}

async function loadResumeHint() {
  if (!state.segments.length || state.lastSeconds < 20) return;
  if (state.resumeHint?.where) {
    renderResume();
    return;
  }
  const videoId = state.videoId;
  const result = await sendToBg({
    action: "vbResume",
    seconds: state.lastSeconds,
    segments: state.segments,
    blocks: state.blocks,
    title: state.title,
  });
  if (state.videoId !== videoId || !result?.ok) return;
  state.resumeHint = { where: result.where, stuck: result.stuck, next: result.next };
  saveCache();
  renderResume();
}

async function saveCache() {
  if (!state.videoId) return;
  const key = `vb_cache_${state.videoId}`;
  const payload = {
    title: state.title,
    gist: state.gist,
    blocks: state.blocks,
    dives: state.dives,
    scripts: state.scripts,
    translations: state.translations,
    chat: state.chat.slice(-30),
    study: state.study,
    lastSeconds: state.lastSeconds,
    progress: state.progress,
    conceptMap: state.conceptMap,
    argMap: state.argMap,
    visuals: state.visuals,
    resumeHint: state.resumeHint || null,
    savedAt: Date.now(),
  };
  try {
    const idxStore = await chrome.storage.local.get("vb_cache_index");
    let index = [state.videoId, ...(idxStore.vb_cache_index || []).filter((id) => id !== state.videoId)];
    const evicted = index.slice(20);
    index = index.slice(0, 20);
    await chrome.storage.local.set({ [key]: payload, vb_cache_index: index });
    if (evicted.length) await chrome.storage.local.remove(evicted.map((id) => `vb_cache_${id}`));
    const slot = shelf.find((x) => x.videoId === state.videoId);
    if (slot && slot.lastSeconds !== state.lastSeconds) {
      slot.lastSeconds = state.lastSeconds;
      slot.updatedAt = Date.now();
      await saveList("vb_shelf", shelf);
    }
  } catch (_e) {
    /* ignore */
  }
}

async function loadCache(videoId) {
  try {
    const stored = await chrome.storage.local.get(`vb_cache_${videoId}`);
    return stored[`vb_cache_${videoId}`] || null;
  } catch (_e) {
    return null;
  }
}

// ---------- shell ----------

function showSetup(show) {
  $("setupGate").hidden = !show;
  if (show) {
    $("stateBox").hidden = true;
    $("mainBox").hidden = true;
    $("setupKey").value = settingsCache.apiKey || "";
    $("setupSupadata").value = settingsCache.supadataKey || "";
    $("setupBase").value = settingsCache.baseUrl || "https://api.deepseek.com/v1";
    $("setupModel").value = settingsCache.model || "deepseek-v4-flash";
    if ($("setupDiveModel")) $("setupDiveModel").value = settingsCache.diveModel || "deepseek-v4-pro";
    if ($("setupDiveFollow")) {
      $("setupDiveFollow").checked = settingsCache.diveModel === settingsCache.model;
    }
    paintSetupModelPick();
    paintModelSwitch();
  }
}

function showStateBox(emoji, title, sub, retry) {
  reviewOnly = false;
  setFocusMode(false);
  $("stateBox").hidden = false;
  $("mainBox").hidden = true;
  $("stateEmoji").textContent = emoji;
  $("stateTitle").textContent = title;
  $("stateSub").textContent = sub || "";
  $("stateRetry").hidden = !retry;
  const due = dueCards().length;
  if ($("stateReview")) $("stateReview").hidden = Boolean(retry) || !due;
}

function showMain() {
  reviewOnly = false;
  $("stateBox").hidden = true;
  $("mainBox").hidden = false;
  if (tutorialPending) {
    tutorialPending = false;
    openTutorial(true);
  }
}

function showReviewOnly() {
  reviewOnly = true;
  setFocusMode(false);
  $("stateBox").hidden = true;
  $("mainBox").hidden = false;
  $("videoTitle").textContent = "今日复习";
  if ($("progressMeter")) $("progressMeter").innerHTML = "";
  switchView("review");
  renderReview();
}

function switchView(name) {
  if (name !== "read") setFocusMode(false);
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === name);
  });
}

function fillSettingsDrawer() {
  $("settingsDrawer").innerHTML = `
    <p class="setup-lead">两个 Key 都要有。改完点保存。</p>
    <label class="field"><span>DeepSeek API Key</span><input type="password" id="setKey" /></label>
    <label class="field"><span>Supadata API Key</span><input type="password" id="setSupadata" /></label>
    <p class="setup-lead">日常和拆解可以分开选。顶栏的 Flash / Pro 切的是日常。</p>
    <label class="field"><span>日常 · 翻译、提问、分块、做成图</span>
      <input type="hidden" id="setModel" />
      <div class="seg-toggle model-switch" id="setModelSwitch">
        <button type="button" class="seg-btn" data-m="deepseek-v4-flash">Flash</button>
        <button type="button" class="seg-btn" data-m="deepseek-v4-pro">Pro</button>
      </div>
    </label>
    <label class="field"><span>拆解和长笔记</span>
      <input type="hidden" id="setDiveModel" />
      <div class="seg-toggle model-switch" id="setDiveSwitch">
        <button type="button" class="seg-btn" data-m="deepseek-v4-flash">Flash</button>
        <button type="button" class="seg-btn" data-m="deepseek-v4-pro">Pro</button>
      </div>
    </label>
    <label class="field"><span>接口地址</span><input type="text" id="setBase" /></label>
    <div class="drawer-actions" style="margin-top:8px">
      <button id="settingsSave" class="btn btn-primary" type="button">保存</button>
      <span id="settingsSaved" hidden style="color:#3aa06a;margin-left:8px">已保存</span>
    </div>
    <p class="setup-lead" style="margin-top:12px">看视频时只用三个键（不要在输入框里按）。问句、已学会、复制都在侧栏里点。</p>
    <table class="keys-table">
      <tr><th>按键</th><th>作用</th></tr>
      <tr><td><kbd>Alt</kbd>+<kbd>1</kbd></td><td>收下正在说的这句</td></tr>
      <tr><td><kbd>Alt</kbd>+<kbd>2</kbd></td><td>循环正在听的知识块</td></tr>
      <tr><td><kbd>Alt</kbd>+<kbd>3</kbd></td><td>在这一刻写下自己的话</td></tr>
      <tr><td><kbd>Alt</kbd>+<kbd>/</kbd></td><td>在视频上显示这三个键</td></tr>
    </table>
    <p class="setup-lead" style="margin-top:12px">顶栏「导出」会打开排版页：打印成 PDF，或下载 Markdown。你的笔记和金句在最前。</p>
    <p class="setup-foot" style="margin-top:10px">
      <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">申请 DeepSeek</a>
      ·
      <a href="https://dash.supadata.ai/auth/sign-up" target="_blank" rel="noreferrer">申请 Supadata</a>
    </p>
  `;
  $("setKey").value = settingsCache.apiKey || "";
  $("setSupadata").value = settingsCache.supadataKey || "";
  $("setBase").value = settingsCache.baseUrl || "";
  $("setModel").value = settingsCache.model || "deepseek-v4-flash";
  $("setDiveModel").value = settingsCache.diveModel || "deepseek-v4-pro";
  const paint = (root, value) => {
    root?.querySelectorAll("[data-m]").forEach((btn) => btn.classList.toggle("active", btn.dataset.m === value));
  };
  paint($("setModelSwitch"), $("setModel").value);
  paint($("setDiveSwitch"), $("setDiveModel").value);
  $("setModelSwitch")?.querySelectorAll("[data-m]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("setModel").value = btn.dataset.m;
      paint($("setModelSwitch"), btn.dataset.m);
    });
  });
  $("setDiveSwitch")?.querySelectorAll("[data-m]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("setDiveModel").value = btn.dataset.m;
      paint($("setDiveSwitch"), btn.dataset.m);
    });
  });
  $("settingsSave").addEventListener("click", async () => {
    await saveSettings({
      apiKey: $("setKey").value.trim(),
      supadataKey: $("setSupadata").value.trim(),
      baseUrl: $("setBase").value.trim() || "https://api.deepseek.com/v1",
      model: $("setModel").value || "deepseek-v4-flash",
      diveModel: $("setDiveModel").value || "deepseek-v4-pro",
    });
    $("settingsSaved").hidden = false;
    setTimeout(() => ($("settingsSaved").hidden = true), 1200);
    if (!keysReady()) showSetup(true);
  });
}

// ---------- tutorial ----------

function clearTutSpot() {
  document.querySelectorAll(".tut-spot").forEach((el) => el.classList.remove("tut-spot"));
}

function renderTutorial() {
  const step = TUTORIAL[tutIndex];
  if (!step) return;
  $("tutKicker").textContent = `${tutIndex + 1} / ${TUTORIAL.length}`;
  $("tutTitle").textContent = step.title;
  $("tutBody").textContent = step.body;
  $("tutNext").textContent = tutIndex === TUTORIAL.length - 1 ? "开始用" : "下一步";
  $("tutPrev").hidden = tutIndex === 0;
  $("tutDots").innerHTML = TUTORIAL.map((_, i) => `<i class="${i === tutIndex ? "on" : ""}"></i>`).join("");
  clearTutSpot();
  if (step.view && !$("mainBox").hidden) switchView(step.view);
  if (step.spot && !$("mainBox").hidden) {
    document.querySelectorAll(step.spot).forEach((el) => el.classList.add("tut-spot"));
  }
}

async function maybeStartTutorial() {
  if (!$("setupGate").hidden) return;
  const flags = await chrome.storage.local.get("vb_tutorial_done");
  if (flags.vb_tutorial_done) return;
  if (state.videoId && !$("mainBox").hidden) openTutorial(true);
  else tutorialPending = true;
}

function openTutorial(fromStart = true) {
  if (fromStart) tutIndex = 0;
  $("tutorial").hidden = false;
  renderTutorial();
}

async function closeTutorial() {
  clearTutSpot();
  tutorialPending = false;
  $("tutorial").hidden = true;
  await chrome.storage.local.set({ vb_tutorial_done: true });
}

function friendlyTranscriptError(raw) {
  const e = String(raw || "");
  if (/还没有配置|NO_KEY|Key 无效|401/.test(e)) return "字幕钥匙无效或还没填，去设置里看一下。";
  if (/没有原生字幕|字幕是空/.test(e)) return "这支视频没有可用字幕。";
  if (/超时/.test(e)) return "打开字幕超时了，点重试。";
  return "点重试，或换一支有字幕的视频。";
}

async function loadVideo(videoId, tabTitle = "") {
  loadingVideoId = videoId;
  showStateBox("拆", "正在打开字幕…", "铺好之后就可以划线、拆知识。");

  const result = await sendToBg({ action: "vbSupadata", videoId });
  if (loadingVideoId !== videoId) return;
  if (!result?.ok) {
    showStateBox("拆", "暂时读不到字幕", friendlyTranscriptError(result?.error), true);
    return;
  }

  await stashLearningBricks();
  brickKind = "all";
  Object.assign(state, {
    videoId,
    title: result.title || tabTitle || "",
    language: result.language || "",
    segments: result.segments,
    gist: "",
    blocks: [],
    selectedBlock: -1,
    dives: {},
    scripts: {},
    translations: {},
    transcriptMode: "bilingual",
    chat: [],
    askContext: null,
    study: null,
    lastSeconds: 0,
    loopIndex: -1,
    progress: {},
    conceptMap: null,
    argMap: null,
    visuals: {},
    scriptStudio: -1,
    resumeHint: null,
  });
  sendToTab({ type: "VB_LOOP_CLEAR" });

  const cached = await loadCache(videoId);
  if (cached) {
    state.title = state.title || cached.title || "";
    state.gist = cached.gist || "";
    state.blocks = cached.blocks || [];
    state.dives = cached.dives || {};
    state.scripts = cached.scripts || {};
    state.translations = cached.translations || {};
    state.chat = cached.chat || [];
    state.study = cached.study || null;
    state.lastSeconds = cached.lastSeconds || 0;
    state.progress = cached.progress || {};
    state.conceptMap = isNovakMap(cached.conceptMap) ? cached.conceptMap : null;
    state.argMap = cached.argMap || null;
    state.visuals = cached.visuals || {};
    state.resumeHint = cached.resumeHint || null;
  }

  showMain();
  $("videoTitle").textContent = state.title;
  await upsertShelf({
    videoId: state.videoId,
    title: state.title,
    lastSeconds: state.lastSeconds,
  });
  renderAll();
  renderResume();
  if (state.lastSeconds >= 20) loadResumeHint();
  if (state.transcriptMode !== "original") translateAll();
  if (!state.blocks.length) analyzeBlocks();
  if (!state.study) loadStudyPack();
  else {
    if (!state.conceptMap) loadConceptMap();
    if (!state.argMap) loadArgMap();
  }
}

function renderResume() {
  const banner = $("resumeBanner");
  if (!state.lastSeconds || state.lastSeconds < 20) {
    banner.hidden = true;
    return;
  }
  const idx = state.blocks.findIndex((b) => state.lastSeconds >= b.start && state.lastSeconds < b.end);
  const block = idx >= 0 ? state.blocks[idx] : null;
  const hint = state.resumeHint || {};
  banner.hidden = false;
  banner.innerHTML = `
    <div>上次看到 ${clock(state.lastSeconds)}${block ? `，讲到「${esc(block.title)}」` : ""}。
      <button class="text-btn" type="button" id="resumeGo">从这里继续</button>
    </div>
    ${hint.where ? `<div class="resume-line">${esc(hint.where)}</div>` : ""}
    ${hint.stuck ? `<div class="resume-line">卡住的可能是：${esc(hint.stuck)}</div>` : ""}
    ${hint.next ? `<div class="resume-line">接下来：${esc(hint.next)}</div>` : ""}
  `;
  $("resumeGo").addEventListener("click", () => seek(state.lastSeconds));
}

async function analyzeBlocks() {
  if (isAnalyzing || !state.segments.length) return;
  isAnalyzing = true;
  const videoId = state.videoId;
  setBrickStatus("正在拆成知识块…");
  try {
    const result = await sendToBg({
      action: "vbSegment",
      segments: state.segments,
      title: state.title,
      durationSeconds: state.segments.at(-1)?.end || 0,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "拆块失败");
    state.gist = result.gist;
    state.blocks = result.blocks;
    renderBrickBar();
    renderBrickList();
    renderResume();
    if (state.lastSeconds >= 20) loadResumeHint();
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) setBrickStatus(error.message);
  } finally {
    isAnalyzing = false;
    if (state.videoId === videoId && state.blocks.length) setBrickStatus("");
  }
}

function setBrickStatus(text) {
  const el = $("brickStatus");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text || "";
}

async function loadStudyPack() {
  if (isStudying || !state.segments.length) return;
  isStudying = true;
  const videoId = state.videoId;
  $("studyBox").innerHTML = `<div class="study-label">学习包</div><p style="color:var(--muted)">正在提炼关键词和问题…</p>`;
  try {
    const result = await sendToBg({
      action: "vbStudy",
      segments: state.segments,
      title: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "学习包失败");
    state.study = { recap: result.recap, keywords: result.keywords, questions: result.questions };
    renderStudy();
    saveCache();
    if (!state.conceptMap) loadConceptMap();
  } catch (error) {
    if (state.videoId === videoId) {
      $("studyBox").innerHTML = `<div class="dive-error">${esc(error.message)}</div>`;
    }
  } finally {
    isStudying = false;
  }
}

// ---------- render ----------

function renderAll() {
  renderBrickBar();
  renderBrickList();
  renderStudy();
  renderTranscript();
  renderChat();
  renderAskContext();
  renderNotes();
  renderMaps();
  renderReview();
  renderShelf();
}

function blockProgress(i) {
  return state.progress[i] || "fresh";
}

function setProgress(i, status, persist = true) {
  if (!state.blocks[i] || state.progress[i] === status) return;
  if (status === "learning" && state.progress[i] === "done") return;
  state.progress[i] = status;
  if (status === "done") dropBrickCard(i);
  renderBrickBar();
  renderBrickList();
  renderMaps();
  if (persist) saveCache();
}

function renderProgressMeter() {
  const root = $("progressMeter");
  if (!root) return;
  const total = state.blocks.length;
  if (!total) {
    root.innerHTML = "";
    return;
  }
  const counts = { fresh: 0, learning: 0, done: 0 };
  state.blocks.forEach((_, i) => {
    counts[blockProgress(i)] += 1;
  });
  root.innerHTML = `
    <div class="progress-track" title="绿=已学会，橙=进行中">
      <i class="done" style="width:${(counts.done / total) * 100}%"></i>
      <i class="learning" style="width:${(counts.learning / total) * 100}%"></i>
    </div>
    <span>已学会 ${counts.done} · 进行中 ${counts.learning} · 未开始 ${counts.fresh}</span>
  `;
}

function selectBlock(i, view = "bricks") {
  state.selectedBlock = i;
  if (state.scriptStudio !== i) state.scriptStudio = -1;
  state.askContext = { type: "block", idx: i };
  if (blockProgress(i) === "fresh") setProgress(i, "learning");
  renderBrickBar();
  renderBrickList();
  renderAskContext();
  renderMaps();
  if (view) switchView(view);
}

function renderBrickIndex() {
  const root = $("brickIndex");
  if (!root) return;
  if (!state.blocks.length) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const counts = {};
  state.blocks.forEach((b) => {
    counts[b.category] = (counts[b.category] || 0) + 1;
  });
  const kinds = CAT_ORDER.filter((k) => counts[k]);
  root.hidden = false;
  root.innerHTML = `<button type="button" class="brick-index-item${brickKind === "all" ? " on" : ""}" data-kind="all">全部 ${state.blocks.length}</button>${kinds
    .map(
      (k) =>
        `<button type="button" class="brick-index-item${brickKind === k ? " on" : ""}" data-kind="${k}" data-cat="${k}">${CAT_LABEL[k]} ${counts[k]}</button>`,
    )
    .join("")}`;
  root.querySelectorAll("[data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      brickKind = btn.dataset.kind;
      renderBrickIndex();
      renderBrickList();
    });
  });
}

function renderBrickBar() {
  const bar = $("brickBar");
  if (!bar) return;
  bar.innerHTML = "";
  renderProgressMeter();
  renderBrickIndex();
  if (!state.blocks.length) return;
  state.blocks.forEach((block, i) => {
    const st = blockProgress(i);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip st-${st}${i === state.selectedBlock ? " selected" : ""}${i === state.loopIndex ? " looping" : ""}`;
    btn.dataset.cat = block.category;
    btn.title = `${CAT_LABEL[block.category]} · ${PROGRESS_LABEL[st]} · ${clock(block.start)}-${clock(block.end)}`;
    btn.innerHTML = `
      <span class="chip-kind">${CAT_LABEL[block.category] || ""}</span>
      <span class="chip-title">${esc(block.title)}</span>
      ${st === "done" ? `<span class="chip-mark">✓</span>` : st === "learning" ? `<span class="chip-mark live">●</span>` : ""}
    `;
    btn.addEventListener("click", () => selectBlock(i, "bricks"));
    bar.appendChild(btn);
  });
}

function renderStudy() {
  const root = $("studyBox");
  if (!root) return;
  const study = state.study;
  if (!state.gist && !study) {
    root.innerHTML = "";
    return;
  }
  const tabs = [
    study?.recap?.length ? ["recap", "复述"] : null,
    study?.keywords?.length ? ["kw", "词"] : null,
    study?.questions?.length ? ["q", "问题"] : null,
  ].filter(Boolean);
  if (tabs.length && !tabs.some((t) => t[0] === studyTab)) studyTab = tabs[0][0];
  let body = "";
  if (studyTab === "recap") {
    body = `<ol class="study-recap">${(study?.recap || []).map((line) => `<li>${esc(line)}</li>`).join("")}</ol>`;
  } else if (studyTab === "kw") {
    body = (study?.keywords || [])
      .map((k) => `<button class="kw" type="button" data-word="${esc(k.word)}"><b>${esc(k.word)}</b><i>${esc(k.gloss)}</i></button>`)
      .join("");
  } else if (studyTab === "q") {
    const qs = study?.questions || [];
    const allCarded = qs.every((_, i) => hasCardFor(`sq-${state.videoId}-${i}`));
    body =
      qs
        .map((q) => {
          const s = parseClock(q.at);
          return `<div class="q-item">${s != null ? `<span class="time-link" data-s="${s}">${esc(q.at)}</span>` : ""}<span>${esc(q.q)}</span></div>`;
        })
        .join("") +
      (qs.length
        ? `<div class="q-actions">${
            allCarded
              ? `<span class="q-carded">已进复习卡</span>`
              : `<button class="text-btn" id="questionsToCards" type="button">把这些问题存成复习卡</button>`
          }</div>`
        : "");
  }
  root.innerHTML = `
    ${state.gist ? `<p class="study-gist">${esc(state.gist)}</p>` : ""}
    ${
      tabs.length
        ? `<div class="study-tabs">${tabs
            .map(([id, label]) => `<button type="button" class="seg-btn${studyTab === id ? " active" : ""}" data-study="${id}">${label}</button>`)
            .join("")}<button type="button" class="seg-btn recall-btn" id="recallOpen">闭卷复盘</button></div>`
        : ""
    }
    <div class="study-body">${body}</div>
  `;
  root.querySelectorAll("[data-study]").forEach((btn) => {
    btn.addEventListener("click", () => {
      studyTab = btn.dataset.study;
      renderStudy();
    });
  });
  root.querySelectorAll(".kw").forEach((btn) => {
    btn.addEventListener("click", () => openWordCard(btn.dataset.word, {}));
  });
  $("recallOpen")?.addEventListener("click", openRecallModal);
  $("questionsToCards")?.addEventListener("click", saveQuestionsAsCards);
}

function isNovakMap(map) {
  return Boolean(map?.focusQuestion || map?.propositions?.length || map?.concepts?.length);
}

async function loadConceptMap() {
  if (!state.blocks.length) return;
  const videoId = state.videoId;
  try {
    const result = await sendToBg({
      action: "vbConceptMap",
      blocks: state.blocks,
      keywords: state.study?.keywords || [],
      title: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "概念图失败");
    state.conceptMap = {
      focusQuestion: result.focusQuestion,
      concepts: result.concepts,
      propositions: result.propositions,
    };
    await mergeAtlasLocal(state.conceptMap);
    saveCache();
    renderMaps();
  } catch (_error) {
    if (state.videoId === videoId && !state.conceptMap) {
      state.conceptMap = fallbackConceptMap();
      mergeAtlasLocal(state.conceptMap);
      renderMaps();
    }
  }
}

async function loadArgMap() {
  if (!state.blocks.length || state.argMap) return;
  const videoId = state.videoId;
  try {
    const result = await sendToBg({
      action: "vbArgMap",
      blocks: state.blocks,
      title: state.title,
      gist: state.gist,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "论证图失败");
    state.argMap = { claim: result.claim, supports: result.supports, rebuts: result.rebuts };
    saveCache();
    renderMaps();
  } catch (_error) {
    if (state.videoId === videoId && !state.argMap) {
      state.argMap = {
        claim: state.gist || state.title || "主张",
        supports: state.blocks.slice(0, 4).map((b, i) => ({ id: `s${i}`, text: b.summary || b.title, block: i })),
        rebuts: [],
      };
      renderMaps();
    }
  }
}

function fallbackConceptMap() {
  const concepts = [
    { id: "root", label: wrapLabel(state.gist || "本视频", 8), level: 0, block: -1 },
    ...state.blocks.slice(0, 8).map((b, i) => ({
      id: `n${i}`,
      label: wrapLabel(b.title, 8),
      level: 1,
      block: i,
    })),
  ];
  return {
    focusQuestion: "这支视频在讲什么？",
    concepts,
    propositions: state.blocks.slice(0, 8).map((_, i) => ({
      from: "root",
      link: "包含",
      to: `n${i}`,
      cross: false,
    })),
  };
}

function renderMaps() {
  const box = $("mapBox");
  if (!box) return;
  box.classList.remove("universe");
  if (mapKind === "atlas") {
    $("mapHelp").textContent = "跨视频总图：同一概念出现在多支视频里会叠在一起。虚线多半是跨视频连接。点框可跳到对应视频。";
    box.innerHTML = renderAtlasMap();
  } else if (mapKind === "concept") {
    $("mapHelp").textContent = "Novak 概念图：上边一般、下边具体。线上的字是连接词，合起来是一句命题。虚线是交叉连接。";
    box.innerHTML = renderConceptMapSvg();
  } else if (mapKind === "arg") {
    $("mapHelp").textContent = "论证图：中间是主张，左边支撑，右边限制。点卡片跳到对应知识块。";
    if (!state.argMap) loadArgMap();
    box.innerHTML = renderArgMapSvg();
  } else if (mapKind === "time") {
    $("mapHelp").textContent = "按视频时间把知识块排下来。点节点跳到那一段。";
    box.innerHTML = renderTimeMapSvg();
  } else {
    $("mapHelp").textContent = "从中心散开。点知识块展开/收起，再点子节点跳到视频。";
    box.innerHTML = renderMindMapSvg();
  }
  box.querySelectorAll("[data-block]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (el.dataset.dragging === "1") return;
      event.stopPropagation();
      const i = Number(el.dataset.block);
      if (!Number.isFinite(i) || !state.blocks[i]) return;
      if (el.dataset.expand === "1") {
        state.selectedBlock = state.selectedBlock === i ? -1 : i;
        renderMaps();
        return;
      }
      selectBlock(i);
      seek(state.blocks[i].start);
    });
  });
  box.querySelectorAll("[data-word]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      openWordCard(el.dataset.word);
    });
  });
  box.querySelectorAll("[data-atlas]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const node = (atlas.concepts || []).find((c) => c.id === el.dataset.atlas);
      const here = (node?.sources || []).find((s) => s.videoId === state.videoId);
      const src = here || node?.sources?.[0];
      if (!src) return;
      if (src.videoId === state.videoId) {
        if (src.seconds) seek(src.seconds);
        return;
      }
      openVideoAt(src.videoId, src.seconds);
    });
  });
  $("atlasWeave")?.addEventListener("click", weaveAtlas);
}

function wrapLabel(text, max = 8) {
  const s = String(text || "");
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function renderMindMapSvg() {
  if (!state.blocks.length) {
    return `<div class="chat-empty">知识块出来后，这里会生成可点击的思维导图。</div>`;
  }
  const width = 340;
  const rootLabel = wrapLabel(state.gist || state.title || "本视频", 12);
  const open = state.selectedBlock;
  let y = 56;
  const nodes = [];
  state.blocks.forEach((block, i) => {
    const st = blockProgress(i);
    const x = i % 2 === 0 ? 28 : 178;
    nodes.push({ i, x, y, block, st });
    y += open === i ? 28 + 18 * Math.max(1, (state.dives[i]?.parts || []).length + 1) : 36;
  });
  const height = Math.max(220, y + 16);
  const rootX = 170;
  const rootY = 22;
  const lines = nodes
    .map((n) => {
      const mx = (rootX + n.x + 60) / 2;
      return `<path d="M${rootX},${rootY + 14} Q${mx},40 ${n.x + 60},${n.y + 12}" fill="none" stroke="#e6dece" stroke-width="1.4"/>`;
    })
    .join("");
  const blockNodes = nodes
    .map((n) => {
      const fill = n.st === "done" ? "#eef6ee" : n.st === "learning" ? "#fff4e4" : "#fffdf8";
      const stroke = n.i === open ? "#c45c26" : "#e6dece";
      const kids =
        open === n.i
          ? (state.dives[n.i]?.parts || [])
              .slice(0, 4)
              .map(
                (p, k) =>
                  `<g class="map-node" data-block="${n.i}">
                    <rect x="${n.x + 10}" y="${n.y + 26 + k * 18}" width="120" height="16" rx="8" fill="#f4efe4" stroke="#e6dece"/>
                    <text x="${n.x + 70}" y="${n.y + 37 + k * 18}" text-anchor="middle" font-size="10" fill="#6f675c">${esc(wrapLabel(p.name, 8))}</text>
                  </g>`,
              )
              .join("")
          : "";
      return `<g class="map-node" data-block="${n.i}" data-expand="1">
        <rect x="${n.x}" y="${n.y}" width="134" height="24" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
        <text x="${n.x + 67}" y="${n.y + 16}" text-anchor="middle" font-size="11" font-weight="700" fill="#2c2418">${esc(wrapLabel(n.block.title, 8))}</text>
      </g>${kids}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${lines}
    <g class="map-node">
      <circle cx="${rootX}" cy="${rootY}" r="16" fill="#c45c26"/>
      <text x="${rootX}" y="${rootY + 4}" text-anchor="middle" font-size="10" fill="#fffaf4" font-weight="700">根</text>
    </g>
    <text x="${rootX}" y="48" text-anchor="middle" font-size="11" fill="#6f675c">${esc(rootLabel)}</text>
    ${blockNodes}
  </svg>`;
}

function layoutNovak(map) {
  const W = 340;
  const boxW = 86;
  const boxH = 30;
  const concepts = map.concepts || [];
  const byLevel = new Map();
  for (const c of concepts) {
    const lv = Math.max(0, Math.min(3, Number(c.level) || 0));
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(c);
  }
  const pos = new Map();
  let y = 52;
  for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
    const rows = [];
    const all = byLevel.get(lv);
    for (let i = 0; i < all.length; i += 3) rows.push(all.slice(i, i + 3));
    for (const row of rows) {
      const gap = (W - 16 - row.length * boxW) / (row.length + 1);
      row.forEach((c, i) => {
        pos.set(c.id, {
          x: 8 + gap + i * (boxW + gap) + boxW / 2,
          y: y + boxH / 2,
          c,
        });
      });
      y += 70;
    }
  }
  return { pos, height: Math.max(220, y + 8), boxW, boxH, width: W };
}

function renderAtlasMap() {
  const shared = (atlas.concepts || []).filter((c) => (c.sources || []).length > 1);
  const map = atlasAsNovak();
  const weave = `<div class="atlas-bar">
    <button class="btn" id="atlasWeave" type="button">把本视频织进总图</button>
    <span>${(atlas.concepts || []).length} 个概念 · ${shared.length} 个跨视频</span>
  </div>`;
  if (!(atlas.concepts || []).length) {
    return `${weave}<div class="chat-empty">看过两支以上、并生成过概念图之后，相同的概念会叠到这里。</div>`;
  }
  const svg = renderConceptMapSvgFrom(map, true);
  const bridges = shared
    .map((c) => {
      const names = (c.sources || []).map((s) => esc((s.title || s.videoId).slice(0, 18))).join(" · ");
      return `<li><button class="text-btn" data-atlas="${c.id}" type="button">${esc(c.label)}</button><span class="note-meta">${names}</span></li>`;
    })
    .join("");
  return `${weave}${svg}${bridges ? `<ol class="cmap-props atlas-list">${bridges}</ol>` : ""}`;
}

function renderConceptMapSvg() {
  return renderConceptMapSvgFrom(state.conceptMap, false);
}

function renderConceptMapSvgFrom(map, atlasMode) {
  if (!isNovakMap(map)) {
    return `<div class="chat-empty">概念图生成中。出来后是从上到下的层级：概念在框里，线上是连接词。</div>`;
  }
  const { pos, height, boxW, boxH, width } = layoutNovak(map);
  const names = new Map((map.concepts || []).map((c) => [c.id, c.label]));
  const props = map.propositions || [];
  const marker = atlasMode ? "vb-amap" : "vb-cmap";
  const links = props
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      const x1 = a.x;
      const y1 = a.y + boxH / 2;
      const x2 = b.x;
      const y2 = b.y - boxH / 2;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dash = e.cross ? `stroke-dasharray="4 3"` : "";
      return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="${e.cross ? "#8d867c" : "#c4472d"}" stroke-width="1.2" ${dash} marker-end="url(#${marker})"/>
        <rect x="${mx - 18}" y="${my - 8}" width="36" height="14" rx="3" fill="#fffdf8"/>
        <text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="9" fill="#5f5a53">${esc(e.link)}</text>`;
    })
    .join("");
  const boxes = [...pos.values()]
    .map((p) => {
      const block = Number(p.c.block);
      const blockAttr = !atlasMode && Number.isFinite(block) && block >= 0 ? `data-block="${block}"` : "";
      const atlasAttr = atlasMode ? `data-atlas="${p.c.id}"` : "";
      const multi = atlasMode && (p.c.sources || []).length > 1;
      const lines = fitLines(p.c.label, 6, 2);
      return `<g class="map-node" ${blockAttr} ${atlasAttr}>
        <rect x="${p.x - boxW / 2}" y="${p.y - boxH / 2}" width="${boxW}" height="${boxH}" rx="4" fill="${multi ? "#fff3b0" : "#fffdf8"}" stroke="#1c1812" stroke-width="1.2"/>
        ${lines.map((line, i) => `<text x="${p.x}" y="${p.y - 4 + i * 12}" text-anchor="middle" font-size="11" fill="#1c1812">${esc(line)}</text>`).join("")}
      </g>`;
    })
    .join("");
  const list = atlasMode
    ? ""
    : props
        .map((e) => `<li>${esc(names.get(e.from) || e.from)} <i>${esc(e.link)}</i> ${esc(names.get(e.to) || e.to)}${e.cross ? " <em>交叉</em>" : ""}</li>`)
        .join("");
  return `<div class="cmap">
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="${marker}" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto">
          <path d="M0,0 L10,3.5 L0,7 Z" fill="#c4472d"/>
        </marker>
      </defs>
      <rect width="${width}" height="${height}" fill="#fffdf8"/>
      <text x="${width / 2}" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="#1c1812">${esc(map.focusQuestion || "")}</text>
      ${links}${boxes}
    </svg>
    ${list ? `<ol class="cmap-props">${list}</ol>` : ""}
  </div>`;
}

function renderArgMapSvg() {
  const map = state.argMap;
  if (!map?.claim) {
    return `<div class="chat-empty">论证图生成中。</div>`;
  }
  const W = 340;
  const supports = map.supports || [];
  const rebuts = map.rebuts || [];
  const rows = Math.max(supports.length, rebuts.length, 1);
  const H = 70 + rows * 52;
  const claim = `<rect x="70" y="16" width="200" height="36" rx="6" fill="#c45c26"/>
    <text x="170" y="38" text-anchor="middle" font-size="12" fill="#fffaf4" font-weight="700">${esc(wrapLabel(map.claim, 14))}</text>`;
  const left = supports
    .map((s, i) => {
      const y = 68 + i * 52;
      const attr = s.block >= 0 ? `data-block="${s.block}"` : "";
      return `<g class="map-node" ${attr}>
        <path d="M170,52 L90,${y + 16}" fill="none" stroke="#3aa06a" stroke-width="1.2"/>
        <rect x="12" y="${y}" width="140" height="40" rx="6" fill="#eef6ee" stroke="#3aa06a"/>
        <text x="82" y="${y + 24}" text-anchor="middle" font-size="11" fill="#2c2418">${esc(wrapLabel(s.text, 10))}</text>
      </g>`;
    })
    .join("");
  const right = rebuts
    .map((s, i) => {
      const y = 68 + i * 52;
      const attr = s.block >= 0 ? `data-block="${s.block}"` : "";
      return `<g class="map-node" ${attr}>
        <path d="M170,52 L250,${y + 16}" fill="none" stroke="#d45b6a" stroke-width="1.2"/>
        <rect x="188" y="${y}" width="140" height="40" rx="6" fill="#f8eeee" stroke="#d45b6a"/>
        <text x="258" y="${y + 24}" text-anchor="middle" font-size="11" fill="#2c2418">${esc(wrapLabel(s.text, 10))}</text>
      </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#fffdf8"/>
    ${left}${right}${claim}
  </svg>`;
}

function renderTimeMapSvg() {
  if (!state.blocks.length) {
    return `<div class="chat-empty">知识块出来后，这里按时间排成一条线。</div>`;
  }
  const W = 340;
  const H = 36 + state.blocks.length * 52;
  const items = state.blocks
    .map((b, i) => {
      const y = 16 + i * 52;
      const st = blockProgress(i);
      const fill = st === "done" ? "#eef6ee" : st === "learning" ? "#fff4e4" : "#fffdf8";
      const kind = CAT_LABEL[b.category] || "";
      const color = CAT_COLOR[b.category] || "#c45c26";
      return `${i ? `<line x1="20" y1="${y - 10}" x2="20" y2="${y + 4}" stroke="#e6dece"/>` : ""}
        <g class="map-node" data-block="${i}">
          <circle cx="20" cy="${y + 20}" r="5" fill="${color}"/>
          <text x="34" y="${y + 14}" font-size="10" fill="#9a9286">${clock(b.start)}</text>
          <text x="34" y="${y + 28}" font-size="10" font-weight="700" fill="${color}">${esc(kind)}</text>
          <rect x="88" y="${y}" width="236" height="40" rx="8" fill="${fill}" stroke="#e6dece"/>
          <text x="206" y="${y + 24}" text-anchor="middle" font-size="12" fill="#2c2418">${esc(wrapLabel(b.title, 12))}</text>
        </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#fffdf8"/>
    ${items}
  </svg>`;
}

function renderBrickList() {
  const root = $("brickList");
  root.innerHTML = "";
  if (!state.blocks.length) {
    root.innerHTML = `<div class="chat-empty">知识块出来后，可以逐块拆解，或按你的理解写成口播。</div>`;
    return;
  }
  const shown = state.blocks
    .map((block, i) => ({ block, i }))
    .filter(({ block, i }) => {
      if (brickKind !== "all" && block.category !== brickKind) return false;
      if (brickFilter !== "all" && blockProgress(i) !== brickFilter) return false;
      return true;
    });
  if (!shown.length) {
    root.innerHTML = `<div class="chat-empty">这一栏还是空的。</div>`;
    return;
  }
  let prevCat = null;
  shown.forEach(({ block, i }) => {
    const st = blockProgress(i);
    const open = i === state.selectedBlock;
    const viz = state.visuals[i];
    if (brickKind === "all" && block.category !== prevCat) {
      const scene = document.createElement("div");
      scene.className = "brick-scene";
      scene.dataset.cat = block.category;
      scene.innerHTML = `<span>${CAT_LABEL[block.category] || ""}</span>`;
      root.appendChild(scene);
      prevCat = block.category;
    }
    const card = document.createElement("div");
    card.className = `brick-card st-${st}${open ? " selected" : ""}`;
    card.dataset.cat = block.category;
    card.innerHTML = `
      <div class="brick-head">
        <div>
          <div class="brick-kicker">
            <span class="brick-kind">${CAT_LABEL[block.category] || ""}</span>
            <span class="brick-st">${PROGRESS_LABEL[st]}</span>
          </div>
          <div class="brick-title">${esc(block.title)}</div>
        </div>
        <span class="brick-time" data-s="${block.start}">${clock(block.start)}–${clock(block.end)}</span>
      </div>
      <p class="brick-summary">${esc(block.summary)}</p>
      <div class="brick-tools">
        <button class="btn${state.loopIndex === i ? " loop-on" : ""}" data-loop="${i}" type="button">${state.loopIndex === i ? "停循环" : "循环"}</button>
        <button class="btn" data-dive="${i}" type="button">${state.dives[i] ? "重拆" : "拆解"}</button>
        <button class="btn" data-script="${i}" type="button">${state.scriptStudio === i ? "收起口播" : "口播"}</button>
        <button class="btn" data-ask="${i}" type="button">提问</button>
        <button class="btn" data-learn="${i}" type="button">${st === "done" ? "未学会" : "已学会"}</button>
        <button class="btn" data-later="${i}" type="button">下次再看</button>
      </div>
      <div class="viz-bar">
        <span>做成图</span>
        <button class="viz-btn${viz?.kind === "info" ? " on" : ""}" data-viz="info" type="button">信息图</button>
        <button class="viz-btn${viz?.kind === "mind" ? " on" : ""}" data-viz="mind" type="button">导图</button>
        <button class="viz-btn${viz?.kind === "flow" ? " on" : ""}" data-viz="flow" type="button">流程</button>
      </div>
      <div class="dive-slot" ${open ? "" : "hidden"}></div>
    `;
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, .brick-time, .viz-frame, a, textarea, input, .script-studio")) return;
      if (state.selectedBlock === i) {
        state.selectedBlock = -1;
        if (state.scriptStudio === i) state.scriptStudio = -1;
        renderBrickBar();
        renderBrickList();
        return;
      }
      selectBlock(i, "bricks");
    });
    card.querySelector(".brick-time").addEventListener("click", (event) => {
      event.stopPropagation();
      seek(block.start);
    });
    card.querySelector(`[data-loop="${i}"]`).addEventListener("click", () => toggleLoop(i));
    card.querySelector(`[data-dive="${i}"]`).addEventListener("click", () => deepDive(i));
    card.querySelector(`[data-script="${i}"]`).addEventListener("click", () => toggleScriptStudio(i));
    card.querySelector(`[data-ask="${i}"]`).addEventListener("click", () => {
      selectBlock(i, "ask");
      $("askInput").focus();
    });
    card.querySelector(`[data-learn="${i}"]`).addEventListener("click", () => {
      setProgress(i, st === "done" ? "fresh" : "done");
    });
    card.querySelector(`[data-later="${i}"]`).addEventListener("click", async (event) => {
      event.stopPropagation();
      if (st === "fresh") setProgress(i, "learning");
      await scheduleBrick(i);
      event.currentTarget.textContent = "已排入";
    });
    card.querySelectorAll("[data-viz]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        makeVisual(i, btn.dataset.viz);
      });
    });
    const slot = card.querySelector(".dive-slot");
    if (open) {
      if (viz) slot.insertAdjacentHTML("beforeend", renderVisualHtml(i, viz));
      if (state.dives[i]) slot.insertAdjacentHTML("beforeend", renderDiveHtml(state.dives[i]));
      if (state.scriptStudio === i) {
        slot.insertAdjacentHTML("beforeend", renderScriptStudio(i));
        bindScriptStudio(slot, i);
      }
      slot.querySelector("[data-dlviz]")?.addEventListener("click", () => downloadVisual(i));
    }
    root.appendChild(card);
  });
}

function renderDiveHtml(dive) {
  const list = (label, items) => {
    if (!items?.length) return "";
    return `<div class="dive-col"><div class="dive-label">${label}</div><ul>${items
      .map((item) => `<li>${linkifyTimes(item)}</li>`)
      .join("")}</ul></div>`;
  };
  if (dive.essence || dive.parts?.length) {
    const parts = (dive.parts || [])
      .map(
        (p) =>
          `<div class="part-card"><b>${esc(p.name)}</b><p>${esc(p.role)}</p>${p.ifMissing ? `<em>缺了：${esc(p.ifMissing)}</em>` : ""}</div>`,
      )
      .join("");
    return `<div class="dive">
      ${dive.essence ? `<p class="dive-hero">${esc(dive.essence)}</p>` : ""}
      ${parts ? `<div class="part-grid">${parts}</div>` : ""}
      ${dive.map ? `<p class="dive-map">${esc(dive.map)}</p>` : ""}
      <div class="dive-cols">
        ${list("怎么记", dive.encode)}
        ${list("何时用", dive.retrieve)}
        ${list("挂钩", dive.connect)}
      </div>
      ${dive.gap ? `<p class="dive-note"><b>缺口</b>${esc(dive.gap)}</p>` : ""}
      ${dive.owned ? `<p class="dive-note own"><b>算内化</b>${esc(dive.owned)}</p>` : ""}
    </div>`;
  }
  const concepts = (dive.concepts || [])
    .map((c) => `<div class="part-card"><b>${esc(c.term)}</b><p>${esc(c.def)}</p></div>`)
    .join("");
  return `<div class="dive">
    ${dive.summary ? `<p class="dive-hero">${esc(dive.summary)}</p>` : ""}
    ${concepts ? `<div class="part-grid">${concepts}</div>` : ""}
    <div class="dive-cols">
      ${list("前置", dive.prereq)}
      ${list("原理", dive.mechanism)}
      ${list("例子", dive.examples)}
      ${list("坑", dive.pitfalls)}
      ${list("自测", dive.selfTest)}
    </div>
  </div>`;
}

function toggleLoop(i) {
  if (state.loopIndex === i) {
    state.loopIndex = -1;
    sendToTab({ type: "VB_LOOP_CLEAR" });
  } else {
    const block = state.blocks[i];
    state.loopIndex = i;
    state.selectedBlock = i;
    sendToTab({ type: "VB_LOOP", start: block.start, end: block.end });
    scrollToSeconds(block.start);
    setProgress(i, "learning");
  }
  renderBrickBar();
  renderBrickList();
}

function applyLoopToPage() {
  if (state.loopIndex < 0 || !state.blocks[state.loopIndex]) return;
  const block = state.blocks[state.loopIndex];
  sendToTab({ type: "VB_LOOP", start: block.start, end: block.end, seek: false });
}

const SCRIPT_LENS = [
  { label: "15秒", chars: 70 },
  { label: "30秒", chars: 140 },
  { label: "45秒", chars: 200 },
  { label: "60秒", chars: 270 },
  { label: "90秒", chars: 400 },
];

const SCRIPT_PURPOSE_UI = [
  { id: "retell", label: "复述给自己" },
  { id: "teach", label: "讲给一个人" },
  { id: "short", label: "发短视频" },
];

const SCRIPT_TONE_UI = [
  { id: "talk", label: "对一个人说" },
  { id: "calm", label: "冷静讲清" },
  { id: "sharp", label: "带一点锋芒" },
];

const SCRIPT_OPEN_UI = [
  { id: "take", label: "从我的理解" },
  { id: "hook", label: "反常识" },
  { id: "scene", label: "场景" },
  { id: "none", label: "不要钩子" },
];

const SCRIPT_CLOSE_UI = [
  { id: "one", label: "收一句" },
  { id: "cta", label: "下一步" },
  { id: "none", label: "说完就停" },
];

function defaultScriptPrefs() {
  const saved = settingsCache.scriptPrefs || {};
  return {
    chars: Math.min(600, Math.max(60, Number(saved.chars) || 200)),
    purpose: SCRIPT_PURPOSE_UI.some((x) => x.id === saved.purpose) ? saved.purpose : "teach",
    tone: SCRIPT_TONE_UI.some((x) => x.id === saved.tone) ? saved.tone : "talk",
    open: SCRIPT_OPEN_UI.some((x) => x.id === saved.open) ? saved.open : "take",
    close: SCRIPT_CLOSE_UI.some((x) => x.id === saved.close) ? saved.close : "one",
  };
}

function scriptRecord(i) {
  const cur = state.scripts[i] || {};
  return {
    take: cur.take || "",
    prefs: { ...defaultScriptPrefs(), ...(cur.prefs || {}) },
    hook: cur.hook || "",
    script: cur.script || "",
    cta: cur.cta || "",
    error: cur.error || "",
    busy: Boolean(cur.busy),
  };
}

function countSpoken(text) {
  return String(text || "").replace(/\s/g, "").length;
}

function spokenSeconds(chars) {
  return Math.max(8, Math.round(Number(chars || 0) / 4.5));
}

function scriptChips(items, key, value) {
  return items
    .map(
      (item) =>
        `<button class="ghost-chip${item.id === value ? " active" : ""}" type="button" data-pref="${key}" data-val="${item.id}">${item.label}</button>`,
    )
    .join("");
}

function renderScriptStudio(i) {
  const rec = scriptRecord(i);
  const prefs = rec.prefs;
  const hasDraft = Boolean(rec.script);
  const full = [rec.hook, rec.script, rec.cta].filter(Boolean).join("\n\n");
  const n = countSpoken(full);
  const lenChips = SCRIPT_LENS.map(
    (item) =>
      `<button class="ghost-chip${item.chars === prefs.chars ? " active" : ""}" type="button" data-pref="chars" data-val="${item.chars}">${item.label}</button>`,
  ).join("");
  return `<div class="script-studio">
    <div class="dive-label">口播</div>
    <label class="field">
      <span>你怎么理解这块</span>
      <textarea data-script-take rows="4" placeholder="这块你听懂了什么、哪里不服、你想强调什么。空着也能写；有你的话，稿子会像你在说。">${esc(rec.take)}</textarea>
    </label>
    <div class="script-pref">
      <span>篇幅</span>
      <div class="script-chips">${lenChips}</div>
      <label class="script-chars">约 <input data-script-chars type="number" min="60" max="600" value="${prefs.chars}" /> 字</label>
    </div>
    <div class="script-pref">
      <span>用途</span>
      <div class="script-chips">${scriptChips(SCRIPT_PURPOSE_UI, "purpose", prefs.purpose)}</div>
    </div>
    <div class="script-pref">
      <span>语气</span>
      <div class="script-chips">${scriptChips(SCRIPT_TONE_UI, "tone", prefs.tone)}</div>
    </div>
    <div class="script-pref">
      <span>开场</span>
      <div class="script-chips">${scriptChips(SCRIPT_OPEN_UI, "open", prefs.open)}</div>
    </div>
    <div class="script-pref">
      <span>结尾</span>
      <div class="script-chips">${scriptChips(SCRIPT_CLOSE_UI, "close", prefs.close)}</div>
    </div>
    <div class="script-actions">
      <button class="btn btn-primary" data-run-script type="button"${rec.busy ? " disabled" : ""}>${rec.busy ? "正在写…" : hasDraft ? "再写一版" : "写成口播"}</button>
      ${hasDraft ? `<button class="btn" data-copy-script type="button">复制</button>` : ""}
    </div>
    ${rec.error ? `<p class="script-error">${esc(rec.error)}</p>` : ""}
    ${
      hasDraft
        ? `<div class="script-card">
      ${rec.hook ? `<p class="script-hook">${esc(rec.hook)}</p>` : ""}
      <p class="script-body">${esc(rec.script)}</p>
      ${rec.cta ? `<p class="script-cta">${esc(rec.cta)}</p>` : ""}
      <p class="script-meta">${n} 字 · 大约 ${spokenSeconds(n)} 秒</p>
    </div>`
        : ""
    }
  </div>`;
}

function rememberScriptDraft(i, root) {
  const rec = scriptRecord(i);
  const take = root.querySelector("[data-script-take]")?.value ?? rec.take;
  const typed = Number(root.querySelector("[data-script-chars]")?.value);
  const chars = Number.isFinite(typed) ? Math.min(600, Math.max(60, typed)) : rec.prefs.chars;
  state.scripts[i] = { ...rec, take, prefs: { ...rec.prefs, chars }, error: "", busy: rec.busy };
}

function bindScriptStudio(slot, i) {
  const root = slot.querySelector(".script-studio");
  if (!root) return;
  const rec = scriptRecord(i);
  root.querySelector("[data-script-take]")?.addEventListener("input", (event) => {
    state.scripts[i] = { ...scriptRecord(i), take: event.target.value, error: "" };
  });
  root.querySelector("[data-script-chars]")?.addEventListener("change", async (event) => {
    rememberScriptDraft(i, root);
    const n = Math.min(600, Math.max(60, Number(event.target.value) || 200));
    state.scripts[i] = { ...scriptRecord(i), prefs: { ...scriptRecord(i).prefs, chars: n } };
    await saveSettings({ scriptPrefs: state.scripts[i].prefs });
    renderBrickList();
  });
  root.querySelectorAll("[data-pref]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      rememberScriptDraft(i, root);
      const key = btn.dataset.pref;
      const raw = btn.dataset.val;
      const val = key === "chars" ? Number(raw) : raw;
      const prefs = { ...scriptRecord(i).prefs, [key]: val };
      state.scripts[i] = { ...scriptRecord(i), prefs };
      await saveSettings({ scriptPrefs: prefs });
      renderBrickList();
    });
  });
  root.querySelector("[data-run-script]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    generateScript(i);
  });
  root.querySelector("[data-copy-script]")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const text = [rec.hook, rec.script, rec.cta].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      event.currentTarget.textContent = "已复制";
    } catch (_e) {
      event.currentTarget.textContent = "复制失败";
    }
  });
}

function toggleScriptStudio(i) {
  if (state.scriptStudio === i) {
    state.scriptStudio = -1;
  } else {
    state.scriptStudio = i;
    state.selectedBlock = i;
    if (!state.scripts[i]) state.scripts[i] = scriptRecord(i);
  }
  renderBrickBar();
  renderBrickList();
}

async function generateScript(i) {
  if (scriptRecord(i).busy) return;
  const slot = document.querySelector(`.brick-card [data-script="${i}"]`)?.closest(".brick-card")?.querySelector(".script-studio");
  if (slot) rememberScriptDraft(i, slot);
  const rec = scriptRecord(i);
  const block = state.blocks[i];
  const videoId = state.videoId;
  if (!block) return;
  const excerpt = state.segments
    .filter((s) => s.start >= block.start - 2 && s.start < block.end + 2)
    .map((s) => s.text)
    .join("\n");
  const dive = state.dives[i];
  state.scriptStudio = i;
  state.selectedBlock = i;
  state.scripts[i] = { ...rec, busy: true, error: "" };
  renderBrickList();
  try {
    const result = await sendToBg({
      action: "vbScript",
      block,
      excerpt,
      title: state.title,
      take: rec.take,
      prefs: rec.prefs,
      dive: dive
        ? {
            essence: dive.essence || dive.summary || "",
            parts: (dive.parts || []).map((p) => p.name).filter(Boolean),
          }
        : null,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "口播失败");
    state.scripts[i] = {
      ...scriptRecord(i),
      hook: result.hook,
      script: result.script,
      cta: result.cta,
      busy: false,
      error: "",
    };
    saveCache();
  } catch (error) {
    if (state.videoId !== videoId) return;
    state.scripts[i] = { ...scriptRecord(i), busy: false, error: error.message };
  }
  renderBrickList();
}

function fitLines(text, maxChars, maxLines) {
  const s = String(text || "").trim();
  const lines = [];
  for (let i = 0; i < s.length && lines.length < maxLines; i += maxChars) {
    lines.push(s.slice(i, i + maxChars));
  }
  if (s.length > maxChars * maxLines && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  }
  return lines;
}

function fallbackVisual(kind, block, dive) {
  const parts = dive?.parts?.length
    ? dive.parts
    : [{ name: block.title, role: block.summary || "" }];
  if (kind === "mind") {
    return {
      title: block.title,
      center: wrapLabel(block.title, 8),
      nodes: parts.slice(0, 7).map((p, i) => ({ id: `n${i}`, label: p.name, detail: p.role })),
    };
  }
  if (kind === "flow") {
    const steps = (dive?.encode?.length ? dive.encode : parts.map((p) => p.role || p.name)).slice(0, 6);
    return {
      title: block.title,
      steps: steps.map((s, i) => ({ n: i + 1, h: typeof s === "string" ? wrapLabel(s, 8) : s.name, b: typeof s === "string" ? s : s.role })),
    };
  }
  return {
    title: block.title,
    kicker: CAT_LABEL[block.category] || "知识块",
    lede: dive?.essence || block.summary || "",
    pills: parts.map((p) => p.name).slice(0, 4),
    rows: parts.slice(0, 5).map((p) => ({ h: p.name, b: p.role })),
    callout: dive?.owned || "",
  };
}

function renderInfoSvg(spec) {
  const W = 340;
  const title = fitLines(spec.title, 11, 2);
  const lede = fitLines(spec.lede, 18, 3);
  const pills = (spec.pills || []).slice(0, 4);
  const rows = (spec.rows || []).slice(0, 5);
  const headerH = 56 + title.length * 22;
  const ledeH = lede.length ? lede.length * 17 + 12 : 8;
  const pillH = pills.length ? 34 : 0;
  const H = headerH + ledeH + pillH + rows.length * 58 + (spec.callout ? 54 : 18);
  const titleSvg = title
    .map((line, i) => `<text x="20" y="${42 + i * 22}" font-size="20" font-weight="700" fill="#fffdf8">${esc(line)}</text>`)
    .join("");
  const ledeSvg = lede
    .map((line, i) => `<text x="20" y="${headerH + 16 + i * 17}" font-size="12.5" fill="#6f675c">${esc(line)}</text>`)
    .join("");
  const pillSvg = pills
    .map((p, i) => {
      const x = 20 + (i % 4) * 78;
      const y = headerH + ledeH + 4;
      return `<rect x="${x}" y="${y}" width="72" height="22" rx="11" fill="#f4efe4"/>
        <text x="${x + 36}" y="${y + 15}" text-anchor="middle" font-size="10" fill="#2c2418">${esc(wrapLabel(p, 5))}</text>`;
    })
    .join("");
  const rowSvg = rows
    .map((row, i) => {
      const y = headerH + ledeH + pillH + 8 + i * 58;
      const body = fitLines(row.b, 20, 2);
      return `<rect x="16" y="${y}" width="308" height="52" rx="10" fill="#fff" stroke="#e6dece"/>
        <circle cx="36" cy="${y + 26}" r="10" fill="#c45c26"/>
        <text x="36" y="${y + 30}" text-anchor="middle" font-size="10" fill="#fffaf4" font-weight="700">${i + 1}</text>
        <text x="54" y="${y + 20}" font-size="13" font-weight="700" fill="#2c2418">${esc(wrapLabel(row.h, 12))}</text>
        ${body.map((line, k) => `<text x="54" y="${y + 36 + k * 13}" font-size="11" fill="#6f675c">${esc(line)}</text>`).join("")}`;
    })
    .join("");
  const call = spec.callout
    ? `<rect x="0" y="${H - 48}" width="${W}" height="48" fill="#c45c26"/>
       <text x="20" y="${H - 22}" font-size="12" fill="#fffaf4">${esc(wrapLabel(spec.callout, 24))}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
    <rect width="${W}" height="${H}" fill="#fffdf8"/>
    <rect width="${W}" height="${headerH}" fill="#c45c26"/>
    <text x="20" y="22" font-size="10" letter-spacing="2" fill="#f3ead8">${esc((spec.kicker || "INFOGRAPHIC").toUpperCase())}</text>
    ${titleSvg}${ledeSvg}${pillSvg}${rowSvg}${call}
  </svg>`;
}

function renderMindSvg(spec) {
  const W = 340;
  const H = 300;
  const cx = 170;
  const cy = 150;
  const nodes = (spec.nodes || []).slice(0, 8);
  const R = 96;
  const lines = nodes
    .map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.86;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e6dece" stroke-width="1.4"/>
        <rect x="${x - 42}" y="${y - 14}" width="84" height="28" rx="14" fill="#fffdf8" stroke="#c45c26"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="#2c2418">${esc(wrapLabel(n.label, 6))}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
    <rect width="${W}" height="${H}" fill="#f4efe4"/>
    ${lines}
    <circle cx="${cx}" cy="${cy}" r="34" fill="#c45c26"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#fffaf4" font-weight="700">${esc(wrapLabel(spec.center || spec.title, 6))}</text>
  </svg>`;
}

function renderFlowSvg(spec) {
  const steps = (spec.steps || []).slice(0, 6);
  const W = 340;
  const H = 44 + steps.length * 68;
  const items = steps
    .map((step, i) => {
      const y = 28 + i * 68;
      const body = fitLines(step.b || step.h, 20, 2);
      return `${i ? `<line x1="36" y1="${y - 10}" x2="36" y2="${y + 6}" stroke="#c45c26" stroke-width="2"/>` : ""}
        <circle cx="36" cy="${y + 22}" r="12" fill="#c45c26"/>
        <text x="36" y="${y + 26}" text-anchor="middle" font-size="11" fill="#fffaf4" font-weight="700">${step.n || i + 1}</text>
        <rect x="56" y="${y}" width="268" height="54" rx="10" fill="#fffdf8" stroke="#e6dece"/>
        <text x="70" y="${y + 20}" font-size="13" font-weight="700" fill="#2c2418">${esc(wrapLabel(step.h, 12))}</text>
        ${body.map((line, k) => `<text x="70" y="${y + 36 + k * 13}" font-size="11" fill="#6f675c">${esc(line)}</text>`).join("")}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
    <rect width="${W}" height="${H}" fill="#f4efe4"/>
    <text x="16" y="20" font-size="12" fill="#9a9286">${esc(spec.title || "")}</text>
    ${items}
  </svg>`;
}

function renderVisualSvg(viz) {
  if (!viz?.spec) return "";
  if (viz.kind === "mind") return renderMindSvg(viz.spec);
  if (viz.kind === "flow") return renderFlowSvg(viz.spec);
  return renderInfoSvg(viz.spec);
}

function renderVisualHtml(i, viz) {
  const label = { info: "信息图", mind: "思维导图", flow: "流程" }[viz.kind] || "图";
  return `<div class="viz-wrap">
    <div class="viz-head">
      <span>${label}${viz.loading ? " · 生成中" : ""}</span>
      <button class="text-btn" data-dlviz type="button">下载 SVG</button>
    </div>
    <div class="viz-frame">${renderVisualSvg(viz)}</div>
  </div>`;
}

function downloadVisual(i) {
  const viz = state.visuals[i];
  const svg = renderVisualSvg(viz);
  if (!svg) return;
  const name = `拆砖-${(state.blocks[i]?.title || "图").slice(0, 20)}.svg`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function makeVisual(i, kind) {
  const block = state.blocks[i];
  if (!block) return;
  state.selectedBlock = i;
  const dive = state.dives[i];
  state.visuals[i] = { kind, spec: fallbackVisual(kind, block, dive), loading: true };
  renderBrickList();
  const excerpt = state.segments
    .filter((s) => s.start >= block.start - 2 && s.start < block.end + 2)
    .map((s) => s.text)
    .join("\n")
    .slice(0, 3000);
  try {
    const result = await sendToBg({
      action: "vbVisual",
      kind,
      block,
      dive,
      title: state.title,
      excerpt,
    });
    if (state.videoId && result?.ok && result.spec) {
      state.visuals[i] = { kind, spec: result.spec };
      saveCache();
    } else if (state.visuals[i]) {
      state.visuals[i].loading = false;
    }
  } catch (_e) {
    if (state.visuals[i]) state.visuals[i].loading = false;
  }
  renderBrickList();
}

async function deepDive(i) {
  const videoId = state.videoId;
  state.selectedBlock = i;
  try {
    const result = await sendToBg({
      action: "vbDeepDive",
      block: state.blocks[i],
      segments: state.segments,
      videoTitle: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "拆解失败");
    const { ok, error, code, ...dive } = result;
    state.dives[i] = dive;
    setProgress(i, "learning");
    saveCache();
    renderBrickList();
    renderMaps();
  } catch (error) {
    alert(error.message);
  }
}


// ---------- reader ----------

function vocabTerms() {
  return [...new Set(vocab.map((v) => String(v.word || "").trim().toLowerCase()).filter((w) => /^[a-z][a-z' -]{0,39}$/.test(w)))].sort(
    (a, b) => b.length - a.length,
  );
}

function decorateText(text) {
  let html = esc(text);
  const terms = vocabTerms();
  if (terms.length) {
    const pattern = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
    html = html
      .split(/(<[^>]+>)/)
      .map((chunk) =>
        chunk.startsWith("<")
          ? chunk
          : chunk.replace(pattern, (m) => `<span class="vocab-hit" data-vocab="${m.toLowerCase()}">${m}</span>`),
      )
      .join("");
  }
  const marks = highlights.filter((h) => h.videoId === state.videoId && text.includes(h.text));
  for (const mark of marks) {
    const safe = mark.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(safe, "i"),
      (m) => `<mark data-hid="${mark.id}" class="${HL_COLOR[mark.color]?.cls || "hl-def"}">${m}</mark>`,
    );
  }
  return html;
}

function renderTranscript() {
  const box = $("transcriptBox");
  box.innerHTML = "";
  const mode = state.transcriptMode;
  syncLangButtons();

  state.segments.forEach((segment, i) => {
    const zh = state.translations[i];
    const row = document.createElement("div");
    row.className = "t-row";
    row.dataset.idx = i;
    row.dataset.start = segment.start;
    const en = mode === "zh" ? "" : `<div class="t-en">${decorateText(segment.text)}</div>`;
    const zhHtml =
      mode === "original"
        ? ""
        : `<div class="t-zh ${zh ? "" : "pending"}">${zh ? decorateText(zh) : "翻译中…"}</div>`;
    row.innerHTML = `<button class="t-time" type="button" data-s="${segment.start}" title="跳到 ${clock(segment.start)}">${clock(segment.start)}</button><div>${en}${zhHtml}</div>`;
    row.addEventListener("click", (event) => {
      if (event.target.closest(".vocab-hit")) return;
      if (String(window.getSelection() || "").trim()) return;
      seek(segment.start);
    });
    box.appendChild(row);
  });
}

async function translateAll() {
  if (isTranslating) return;
  isTranslating = true;
  const videoId = state.videoId;
  try {
    while (state.videoId === videoId && state.transcriptMode !== "original") {
      const pending = [];
      for (let i = 0; i < state.segments.length && pending.length < 40; i++) {
        if (!state.translations[i]) pending.push(i);
      }
      if (!pending.length) break;
      const result = await sendToBg({
        action: "vbTranslate",
        lines: pending.map((i) => state.segments[i].text),
      });
      if (state.videoId !== videoId) break;
      if (!result?.ok) {
        pending.forEach((i) => {
          if (!state.translations[i]) state.translations[i] = result?.error || "翻译失败";
        });
        renderTranscript();
        break;
      }
      pending.forEach((i, k) => {
        state.translations[i] = result.translations[k] || "";
      });
      renderTranscript();
      saveCache();
    }
  } finally {
    isTranslating = false;
  }
}

function setTranscriptMode(mode) {
  state.transcriptMode = mode;
  renderTranscript();
  if (mode !== "original") translateAll();
}

function runReaderSearch() {
  const q = $("readerSearch").value.trim().toLowerCase();
  const box = $("searchHits");
  if (q.length < 2) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const hits = [];
  state.segments.forEach((seg) => {
    if (seg.text.toLowerCase().includes(q)) hits.push(seg);
  });
  if (!hits.length) {
    box.hidden = false;
    box.textContent = "这篇里没有匹配。";
    return;
  }
  box.hidden = false;
  box.innerHTML = hits
    .slice(0, 20)
    .map(
      (seg) =>
        `<button class="search-hit" type="button" data-s="${seg.start}"><b>${clock(seg.start)}</b> ${esc(seg.text).slice(0, 90)}</button>`,
    )
    .join("");
  box.querySelectorAll(".search-hit").forEach((btn) => {
    btn.addEventListener("click", () => {
      seek(Number(btn.dataset.s));
      const row = document.querySelector(`.t-row[data-start="${btn.dataset.s}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.classList.add("flash");
      setTimeout(() => row?.classList.remove("flash"), 1200);
    });
  });
}

// ---------- selection: highlight / note / vocab ----------

function captureSelection() {
  const selection = window.getSelection();
  const text = String(selection || "").trim();
  if (!text) return null;
  const node = selection.anchorNode;
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const row = el?.closest?.(".t-row");
  if (!row || !$("transcriptBox").contains(row)) return null;
  const idx = Number(row.dataset.idx);
  const seg = state.segments[idx];
  return {
    text: text.slice(0, 240),
    sentence: seg?.text || text,
    seconds: Number(row.dataset.start) || 0,
    idx,
  };
}

function placeSelBar() {
  const selection = window.getSelection();
  const payload = captureSelection();
  const bar = $("selBar");
  if (!payload || !selection.rangeCount) {
    bar.hidden = true;
    selPayload = null;
    return;
  }
  selPayload = payload;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  bar.hidden = false;
  bar.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 360))}px`;
  bar.style.top = `${Math.max(8, rect.top - 42)}px`;
}

async function addHighlight(color = "def") {
  if (!selPayload || !state.videoId) return;
  const tone = HL_COLOR[color] ? color : "def";
  highlights.unshift({
    id: uid("h"),
    videoId: state.videoId,
    videoTitle: state.title,
    text: selPayload.text,
    sentence: selPayload.sentence,
    seconds: selPayload.seconds,
    color: tone,
    createdAt: Date.now(),
  });
  if (highlights.length > 800) highlights.length = 800;
  await saveList("vb_highlights", highlights);
  renderTranscript();
  renderNotes();
}

function openNoteModal() {
  if (!selPayload) return;
  pendingNote = { ...selPayload };
  $("noteQuote").textContent = pendingNote.text;
  $("noteInput").value = "";
  $("noteModal").hidden = false;
  $("noteInput").focus();
}

async function saveNote() {
  const text = $("noteInput").value.trim();
  if (!text || !pendingNote) return;
  notes.unshift({
    id: uid("n"),
    videoId: state.videoId,
    videoTitle: state.title,
    text,
    quote: pendingNote.text,
    seconds: pendingNote.seconds,
    createdAt: Date.now(),
  });
  await saveList("vb_notes", notes);
  $("noteModal").hidden = true;
  pendingNote = null;
  renderNotes();
}

async function addVocab(word, sentence, seconds) {
  const trimmed = String(word || "").trim();
  if (!trimmed) return false;
  const exists = vocab.some((v) => v.word.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    vocab.unshift({
      id: uid("v"),
      word: trimmed.slice(0, 80),
      sentence: String(sentence || "").slice(0, 400),
      seconds: Number(seconds) || 0,
      videoId: state.videoId,
      videoTitle: state.title,
      createdAt: Date.now(),
    });
    if (vocab.length > 500) vocab.length = 500;
    await saveList("vb_vocab", vocab);
  }
  renderTranscript();
  renderNotes();
  return true;
}

function pronounce(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch (_e) {
    /* ignore */
  }
}

function renderDef(def) {
  const senses = (def.senses || [])
    .map((s) => `<li>${s.pos ? `<span class="word-pos">${esc(s.pos)}</span>` : ""}<span>${esc(s.en)}</span><span class="word-sense-zh">${esc(s.zh)}</span></li>`)
    .join("");
  const examples = (def.examples || [])
    .map((e) => `<li><button class="word-say" type="button">🔊</button><div><span>${esc(e.en)}</span><span class="word-example-zh">${esc(e.zh)}</span></div></li>`)
    .join("");
  return `
    ${def.phonetic ? `<div class="word-phonetic">${esc(def.phonetic)}</div>` : ""}
    ${senses ? `<div class="word-label">释义</div><ul class="word-senses">${senses}</ul>` : ""}
    ${!senses && def.meaning ? `<div>${esc(def.meaning)}</div>` : ""}
    ${def.usage ? `<div class="word-label">用法</div><div>${esc(def.usage)}</div>` : ""}
    ${examples ? `<div class="word-label">例句</div><ul class="word-examples">${examples}</ul>` : ""}
    ${def.inContext ? `<div class="word-label">在本句中</div><div>${esc(def.inContext)}</div>` : ""}
  `;
}

function showWordCard(word, entry = {}) {
  document.getElementById("wordCard")?.remove();
  const card = document.createElement("div");
  card.id = "wordCard";
  card.className = "word-card";
  card.innerHTML = `
    <div class="word-card-top">
      <span class="word-card-word">${esc(word)} <button class="word-say" id="sayHead" type="button">🔊</button></span>
      <div class="row-actions">
        <button class="btn" id="wordSave" type="button">存入生词本</button>
        <button class="text-btn" id="wordClose" type="button">关闭</button>
      </div>
    </div>
    ${entry.sentence ? `<p class="vocab-sentence">${esc(entry.sentence)}</p>` : ""}
    <div id="wordBody">正在查词典…</div>
  `;
  document.body.appendChild(card);
  $("sayHead").addEventListener("click", () => pronounce(word));
  $("wordClose").addEventListener("click", () => card.remove());
  $("wordSave").addEventListener("click", async () => {
    await addVocab(word, entry.sentence, entry.seconds);
    $("wordSave").textContent = "已存";
  });
  card.addEventListener("click", (event) => {
    const btn = event.target.closest?.(".word-say");
    if (!btn || btn.id === "sayHead") return;
    const en = btn.nextElementSibling?.querySelector("span")?.textContent;
    if (en) pronounce(en);
  });

  const cached = vocab.find((v) => v.word.toLowerCase() === word.toLowerCase() && v.definition);
  if (cached?.definition) {
    $("wordBody").innerHTML = renderDef(cached.definition);
    return;
  }
  sendToBg({
    action: "vbDefine",
    word,
    sentence: entry.sentence || "",
    videoTitle: entry.videoTitle || state.title,
  }).then(async (result) => {
    if (!document.getElementById("wordCard")) return;
    if (!result?.ok) {
      $("wordBody").innerHTML = `<div class="dive-error">${esc(result?.error || "查词失败")}</div>`;
      return;
    }
    $("wordBody").innerHTML = renderDef(result.definition);
    const target = vocab.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (target) {
      target.definition = result.definition;
      await saveList("vb_vocab", vocab);
    }
  });
}

function openWordCard(word, extra) {
  const existing = vocab.find((v) => v.word.toLowerCase() === String(word).toLowerCase());
  showWordCard(existing?.word || word, existing || extra || {});
}

function segmentAt(seconds) {
  let hit = null;
  for (const seg of state.segments) {
    if (seg.start <= seconds) hit = seg;
    else break;
  }
  return hit;
}

function blockIndexAt(seconds) {
  return state.blocks.findIndex((b) => seconds >= b.start && seconds < b.end);
}

function forThisVideo(list) {
  return (list || []).filter((item) => !state.videoId || item.videoId === state.videoId);
}

function buildExportPayload() {
  return {
    exportedAt: Date.now(),
    videoId: state.videoId,
    title: state.title || "未命名视频",
    url: state.videoId ? `https://www.youtube.com/watch?v=${state.videoId}` : "",
    gist: state.gist,
    blocks: state.blocks,
    progress: state.progress,
    dives: state.dives,
    scripts: state.scripts,
    study: state.study,
    conceptMap: state.conceptMap,
    notes: forThisVideo(notes),
    quotes: forThisVideo(quotes),
    highlights: forThisVideo(highlights),
    vocab: forThisVideo(vocab),
    chat: (state.chat || []).slice(-24),
  };
}

async function openExport() {
  const payload = buildExportPayload();
  const hasBody =
    payload.notes.length ||
    payload.quotes.length ||
    payload.highlights.length ||
    payload.blocks.length ||
    payload.chat.length;
  if (!hasBody) {
    alert("先打开一支视频，或至少留下一条笔记、金句或划线。");
    return;
  }
  await chrome.storage.local.set({ vb_export: payload });
  chrome.tabs.create({ url: chrome.runtime.getURL("export.html") });
}

async function saveQuote(seconds, text) {
  const line = text || segmentAt(seconds)?.text || "";
  if (!line) return false;
  quotes.unshift({
    id: uid("q"),
    videoId: state.videoId,
    videoTitle: state.title,
    text: line.slice(0, 400),
    seconds: Number(seconds) || 0,
    createdAt: Date.now(),
  });
  if (quotes.length > 400) quotes.length = 400;
  await saveList("vb_quotes", quotes);
  renderNotes();
  return true;
}

let lastInboxId = 0;

async function applyHotkey(payload) {
  if (!payload?.action) return;
  if (payload.id && payload.id === lastInboxId) return;
  lastInboxId = payload.id || Date.now();
  if (payload.id) chrome.storage.local.set({ vb_inbox_seen: payload.id });
  const seconds = Number(payload.seconds);
  const t = Number.isFinite(seconds) ? seconds : state.lastSeconds;
  const line = payload.caption || segmentAt(t)?.text || "";
  const idx = blockIndexAt(t);
  if (payload.action === "quote") {
    await saveQuote(t, line);
    switchView("notes");
    notesFilter = "quotes";
    document.querySelectorAll("[data-notes]").forEach((b) => b.classList.toggle("active", b.dataset.notes === "quotes"));
    renderNotes();
    return;
  }
  if (payload.action === "note") {
    const quote = line || `在 ${clock(t)}`;
    if (String(payload.text || "").trim()) {
      notes.unshift({
        id: uid("n"),
        videoId: state.videoId,
        videoTitle: state.title,
        text: String(payload.text).trim(),
        quote,
        seconds: t,
        createdAt: Date.now(),
      });
      await saveList("vb_notes", notes);
      switchView("notes");
      notesFilter = "memos";
      document.querySelectorAll("[data-notes]").forEach((b) => b.classList.toggle("active", b.dataset.notes === "memos"));
      renderNotes();
      return;
    }
    pendingNote = { text: quote, sentence: quote, seconds: t, idx: 0 };
    $("noteQuote").textContent = quote;
    $("noteInput").value = "";
    $("noteModal").hidden = false;
    $("noteInput").focus();
    return;
  }
  if (payload.action === "loop" && idx >= 0) {
    toggleLoop(idx);
    return;
  }
  if (payload.action === "learned" && idx >= 0) {
    setProgress(idx, blockProgress(idx) === "done" ? "fresh" : "done");
    return;
  }
  if (payload.action === "ask") {
    state.askContext = { type: "quote", text: line || payload.text || "" };
    renderAskContext();
    switchView("ask");
    $("askInput").focus();
  }
}

function renderNotes() {
  const root = $("notesBox");
  const cardBtn = (item) =>
    hasCardFor(item.id)
      ? `<button class="text-btn" type="button" disabled>已做卡</button>`
      : `<button class="text-btn" data-card="${item.id}" type="button">做成卡</button>`;
  if (notesFilter === "highlights") {
    const rows = highlights.filter((h) => h.videoId === state.videoId);
    root.innerHTML = rows.length
      ? rows
          .map(
            (h) => `<div class="note-item"><div class="note-meta">${clock(h.seconds)} · ${HL_COLOR[h.color]?.label || "定义"}</div><q class="${HL_COLOR[h.color]?.cls || "hl-def"}">${esc(h.text)}</q>
          <div class="row-actions"><button class="text-btn" data-jump="${h.seconds}" type="button">跳转</button>
          ${cardBtn(h)}
          <button class="text-btn" data-delh="${h.id}" type="button">删除</button></div></div>`,
          )
          .join("")
      : `<div class="chat-empty">在阅读里选中文字，点「划线」。`;
  } else if (notesFilter === "quotes") {
    const rows = quotes.filter((q) => q.videoId === state.videoId);
    root.innerHTML = rows.length
      ? rows
          .map(
            (q) => `<div class="note-item"><div class="note-meta">${clock(q.seconds)} · 金句</div><q>${esc(q.text)}</q>
          <div class="row-actions"><button class="text-btn" data-jump="${q.seconds}" type="button">跳转</button>
          ${cardBtn(q)}
          <button class="text-btn" data-delq="${q.id}" type="button">删除</button></div></div>`,
          )
          .join("")
      : `<div class="chat-empty">看视频时按 Alt+1，收下正在说的那一句。`;
  } else if (notesFilter === "memos") {
    const rows = notes.filter((n) => n.videoId === state.videoId);
    root.innerHTML = rows.length
      ? rows
          .map(
            (n) => `<div class="note-item"><div class="note-meta">${clock(n.seconds)}</div><q>${esc(n.quote)}</q><p>${esc(n.text)}</p>
          <div class="row-actions"><button class="text-btn" data-jump="${n.seconds}" type="button">跳转</button>
          <button class="text-btn" data-deln="${n.id}" type="button">删除</button></div></div>`,
          )
          .join("")
      : `<div class="chat-empty">选中一句点「笔记」，或看视频时按 Alt+3。`;
  } else {
    const pendingVocab = uncardedVocab().length;
    const batchBtn = pendingVocab
      ? `<div class="vocab-batch"><button class="btn" id="vocabAllCards" type="button">把 ${pendingVocab} 个生词做成复习卡</button></div>`
      : "";
    root.innerHTML = vocab.length
      ? batchBtn +
        vocab
          .map(
            (v) => `<div class="vocab-item"><div class="vocab-word">${esc(v.word)}</div>
          <div class="vocab-sentence">${esc(v.sentence)}</div>
          <div class="vocab-source">${esc(v.videoTitle || "")}</div>
          <div class="row-actions">
            <button class="text-btn" data-def="${esc(v.word)}" type="button">查词</button>
            <button class="text-btn" data-jump="${v.seconds}" type="button">跳转</button>
            <button class="text-btn" data-delv="${v.id}" type="button">删除</button>
          </div></div>`,
          )
          .join("")
      : `<div class="chat-empty">选中单词，点「存词」或「查词」。`;
    $("vocabAllCards")?.addEventListener("click", makeVocabCards);
  }
  root.querySelectorAll("[data-jump]").forEach((btn) => btn.addEventListener("click", () => seek(Number(btn.dataset.jump))));
  root.querySelectorAll("[data-def]").forEach((btn) => btn.addEventListener("click", () => openWordCard(btn.dataset.def)));
  root.querySelectorAll("[data-card]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const item =
        highlights.find((h) => h.id === btn.dataset.card) || quotes.find((q) => q.id === btn.dataset.card);
      if (item) await makeClozeCard(item, btn);
    }),
  );
  root.querySelectorAll("[data-delh]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      highlights = highlights.filter((h) => h.id !== btn.dataset.delh);
      await saveList("vb_highlights", highlights);
      renderTranscript();
      renderNotes();
    }),
  );
  root.querySelectorAll("[data-delq]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      quotes = quotes.filter((q) => q.id !== btn.dataset.delq);
      await saveList("vb_quotes", quotes);
      renderNotes();
    }),
  );
  root.querySelectorAll("[data-deln]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      notes = notes.filter((n) => n.id !== btn.dataset.deln);
      await saveList("vb_notes", notes);
      renderNotes();
    }),
  );
  root.querySelectorAll("[data-delv]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      vocab = vocab.filter((v) => v.id !== btn.dataset.delv);
      await saveList("vb_vocab", vocab);
      renderTranscript();
      renderNotes();
    }),
  );
}

// ---------- review cards ----------

const DAY = 24 * 60 * 60 * 1000;
const CARD_TYPE_LABEL = { cloze: "挖空", qa: "问题", vocab: "生词", brick: "增量" };
let reviewRevealed = false;

function hasCardFor(sourceId) {
  return cards.some((c) => c.sourceId === sourceId);
}

async function addCard(card) {
  cards.unshift({
    id: uid("c"),
    interval: 0,
    reps: 0,
    due: Date.now(),
    createdAt: Date.now(),
    ...card,
  });
  if (cards.length > 1000) cards.length = 1000;
  await saveList("vb_cards", cards);
  renderReviewBadge();
}

function dueCards() {
  const now = Date.now();
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
}

async function gradeCard(card, grade) {
  const now = Date.now();
  if (grade === "again") {
    card.interval = 0;
    card.reps = 0;
    card.due = now + 10 * 60 * 1000;
  } else if (grade === "good") {
    card.interval = card.interval ? Math.min(365, Math.round(card.interval * 2.5 * 10) / 10) : 1;
    card.reps += 1;
    card.due = now + card.interval * DAY;
  } else {
    card.interval = card.interval ? Math.min(365, card.interval * 4) : 3;
    card.reps += 1;
    card.due = now + card.interval * DAY;
  }
  await saveList("vb_cards", cards);
  reviewRevealed = false;
  renderReview();
}

function renderReviewBadge() {
  const badge = $("reviewBadge");
  if (!badge) return;
  const n = dueCards().length;
  const text = n > 99 ? "99+" : String(n);
  badge.hidden = n === 0;
  if (badge.textContent !== text) badge.textContent = text;
}

function uncardedVocab() {
  return vocab.filter((v) => !hasCardFor(v.id));
}

function vocabCardFrom(v) {
  const word = String(v.word || "").trim();
  const sentence = String(v.sentence || "");
  const zh = v.definition?.senses?.[0]?.zh || v.definition?.meaning || "";
  const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (sentence && pattern.test(sentence)) {
    return { front: sentence.replace(pattern, "____"), back: word, hint: zh };
  }
  return { front: `${word} 是什么意思？`, back: zh || sentence || "回原句确认一下", hint: "" };
}

async function makeVocabCards() {
  const pending = uncardedVocab();
  for (const v of pending) {
    await addCard({
      type: "vocab",
      sourceId: v.id,
      videoId: v.videoId,
      videoTitle: v.videoTitle || "",
      seconds: v.seconds || 0,
      ...vocabCardFrom(v),
    });
  }
  renderReview();
  renderNotes();
}

async function makeClozeCard(item, btn) {
  if (hasCardFor(item.id)) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "做卡中…";
  }
  const result = await sendToBg({
    action: "vbCloze",
    text: item.text,
    sentence: item.sentence || item.text,
    videoTitle: item.videoTitle || state.title,
  });
  if (!result?.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "重试做卡";
      btn.title = result?.error || "";
    }
    return;
  }
  await addCard({
    type: "cloze",
    sourceId: item.id,
    videoId: item.videoId,
    videoTitle: item.videoTitle || state.title,
    seconds: item.seconds || 0,
    front: result.front,
    back: result.back,
    hint: result.hint || "",
  });
  if (btn) btn.textContent = "已做卡";
  renderReview();
}

async function saveQuestionsAsCards() {
  const qs = state.study?.questions || [];
  for (let i = 0; i < qs.length; i++) {
    const sourceId = `sq-${state.videoId}-${i}`;
    if (hasCardFor(sourceId)) continue;
    const s = parseClock(qs[i].at);
    await addCard({
      type: "qa",
      sourceId,
      videoId: state.videoId,
      videoTitle: state.title,
      seconds: s || 0,
      front: qs[i].q,
      back: qs[i].at ? `自己先答，再跳回 ${qs[i].at} 对一遍` : "自己先答，再回视频里对一遍",
      hint: "",
    });
  }
  renderStudy();
  renderReview();
}

function cardFrontHtml(card) {
  return esc(card.front).replace(/____/g, `<span class="cloze-gap">____</span>`);
}

function renderReview() {
  const root = $("reviewBox");
  if (!root) return;
  renderReviewBadge();
  const due = dueCards();
  const total = cards.length;

  if (!total) {
    root.innerHTML = `<div class="chat-empty">还没有复习卡。<br><br>
      在「笔记」里给划线、金句点「做成卡」，生词本可以一键全部做成卡，学习包的问题也能存进来。
      到期的卡会出现在这里，按记忆情况安排下次出现的时间。</div>`;
    return;
  }

  if (!due.length) {
    const next = cards.slice().sort((a, b) => a.due - b.due)[0];
    const wait = next ? Math.max(0.1, Math.round(((next.due - Date.now()) / DAY) * 10) / 10) : 0;
    const pendingVocab = uncardedVocab().length;
    root.innerHTML = `<div class="review-done">
      <div class="review-done-mark">✓</div>
      <p>今天的卡复习完了。共 ${total} 张，最近的一张约 ${wait} 天后到期。</p>
      ${pendingVocab ? `<button id="vocabToCards" class="btn" type="button">把生词本 ${pendingVocab} 个词做成卡</button>` : ""}
    </div>`;
    $("vocabToCards")?.addEventListener("click", makeVocabCards);
    return;
  }

  const card = due[0];
  const sameVideo = card.videoId && card.videoId === state.videoId;
  root.innerHTML = `
    <div class="review-head">到期 ${due.length} 张 · 共 ${total} 张</div>
    <div class="review-card">
      <div class="review-meta">${CARD_TYPE_LABEL[card.type] || "卡"} · ${esc(card.videoTitle || "")}</div>
      <div class="review-front">${cardFrontHtml(card)}</div>
      ${
        reviewRevealed
          ? `<div class="review-back">
              <div class="review-answer">${esc(card.back)}</div>
              ${card.hint ? `<div class="review-hint">${esc(card.hint)}</div>` : ""}
              <div class="row-actions">
                ${card.seconds != null && card.videoId ? `<button class="text-btn" id="reviewJump" type="button">${sameVideo ? `跳到出处 ${clock(card.seconds)}` : "打开出处"}</button>` : ""}
                <button class="text-btn" id="reviewDelete" type="button">删除这张</button>
              </div>
            </div>
            <div class="review-grades">
              <button class="btn grade-again" id="gradeAgain" type="button">忘了<i>10 分钟后再来</i></button>
              <button class="btn grade-good" id="gradeGood" type="button">想起来了<i>${card.interval ? Math.min(365, Math.round(card.interval * 2.5 * 10) / 10) : 1} 天后</i></button>
              <button class="btn grade-easy" id="gradeEasy" type="button">太简单<i>${card.interval ? Math.min(365, card.interval * 4) : 3} 天后</i></button>
            </div>`
          : `${card.type === "brick" && card.videoId ? `<button class="btn" id="reviewJump" type="button">先去看这块</button>` : ""}<button class="btn btn-primary review-reveal" id="reviewReveal" type="button">显示答案</button>`
      }
    </div>
  `;
  $("reviewReveal")?.addEventListener("click", () => {
    reviewRevealed = true;
    renderReview();
  });
  $("gradeAgain")?.addEventListener("click", () => gradeCard(card, "again"));
  $("gradeGood")?.addEventListener("click", () => gradeCard(card, "good"));
  $("gradeEasy")?.addEventListener("click", () => gradeCard(card, "easy"));
  $("reviewJump")?.addEventListener("click", () => {
    if (card.videoId === state.videoId) seek(card.seconds);
    else openVideoAt(card.videoId, card.seconds);
  });
  $("reviewDelete")?.addEventListener("click", async () => {
    cards = cards.filter((c) => c.id !== card.id);
    await saveList("vb_cards", cards);
    reviewRevealed = false;
    renderReview();
  });
}

// ---------- recall (闭卷复盘) ----------

let isRecalling = false;

function openRecallModal() {
  $("recallInput").value = "";
  $("recallResult").hidden = true;
  $("recallResult").innerHTML = "";
  $("recallInput").hidden = false;
  $("recallSubmit").hidden = false;
  $("recallModal").hidden = false;
  $("recallInput").focus();
}

async function submitRecall() {
  const text = $("recallInput").value.trim();
  if (!text || isRecalling) return;
  isRecalling = true;
  const btn = $("recallSubmit");
  btn.disabled = true;
  btn.textContent = "批改中…";
  try {
    const result = await sendToBg({
      action: "vbRecall",
      recall: text,
      segments: state.segments,
      title: state.title,
    });
    if (!result?.ok) throw new Error(result?.error || "批改失败");
    const got = (result.got || []).map((x) => `<li class="ok">${esc(x)}</li>`).join("");
    const missed = (result.missed || [])
      .map((m) => {
        const s = parseClock(m.at);
        return `<li class="miss">${esc(m.point)}${s != null ? ` <span class="time-link" data-s="${s}">[${esc(m.at)}]</span>` : ""}</li>`;
      })
      .join("");
    const wrong = (result.wrong || [])
      .map((w) => `<li class="fix"><s>${esc(w.said)}</s> → ${esc(w.fix)}</li>`)
      .join("");
    $("recallResult").innerHTML = `
      ${result.verdict ? `<p class="recall-verdict">${esc(result.verdict)}</p>` : ""}
      ${got ? `<div class="recall-sec"><b>记住了</b><ul>${got}</ul></div>` : ""}
      ${missed ? `<div class="recall-sec"><b>漏掉了</b><ul>${missed}</ul></div>` : ""}
      ${wrong ? `<div class="recall-sec"><b>记岔了</b><ul>${wrong}</ul></div>` : ""}
    `;
    $("recallResult").hidden = false;
    $("recallInput").hidden = true;
    btn.hidden = true;
  } catch (error) {
    $("recallResult").innerHTML = `<div class="dive-error">${esc(error.message)}</div>`;
    $("recallResult").hidden = false;
  } finally {
    isRecalling = false;
    btn.disabled = false;
    btn.textContent = "对照字幕批改";
  }
}

// ---------- ask ----------

function buildContextText() {
  const full = state.segments.map((s) => `[${clock(s.start)}] ${s.text}`).join("\n");
  const ctx = state.askContext;
  if (ctx?.type === "quote") {
    return `观众划线：「${ctx.text}」\n\n${full}`.slice(0, 13000);
  }
  if (ctx?.type === "block" && state.blocks[ctx.idx]) {
    const block = state.blocks[ctx.idx];
    const excerpt = state.segments
      .filter((s) => s.start >= block.start - 2 && s.start < block.end + 2)
      .map((s) => `[${clock(s.start)}] ${s.text}`)
      .join("\n");
    return `聚焦「${block.title}」\n${excerpt}`.slice(0, 13000);
  }
  return full.slice(0, 13000);
}

function renderAskContext() {
  const root = $("askContext");
  const ctx = state.askContext;
  if (!ctx) {
    root.textContent = "范围：整支视频";
    return;
  }
  const label = ctx.type === "quote" ? ctx.text.slice(0, 50) : state.blocks[ctx.idx]?.title || "";
  root.innerHTML = `范围：<span class="ctx-chip">${esc(label)} <button class="ctx-clear" type="button">✕</button></span>`;
  root.querySelector(".ctx-clear").addEventListener("click", () => {
    state.askContext = null;
    renderAskContext();
  });
}

function renderChat() {
  const box = $("chatBox");
  box.querySelectorAll(".msg").forEach((el) => el.remove());
  $("chatEmpty").style.display = state.chat.length ? "none" : "block";
  state.chat.forEach((msg) => {
    const el = document.createElement("div");
    el.className = `msg ${msg.role === "user" ? "user" : "ai"}`;
    const quote = msg.quote ? `<span class="msg-quote">${esc(msg.quote)}</span>` : "";
    el.innerHTML = `<div class="msg-bubble">${quote}${msg.role === "user" ? esc(msg.content) : linkifyTimes(msg.content)}</div>`;
    box.appendChild(el);
  });
}

async function askVideo(question) {
  if (!question.trim()) return;
  const videoId = state.videoId;
  const history = state.chat.map((m) => ({ role: m.role, content: m.content }));
  const quote = state.askContext?.type === "quote" ? state.askContext.text : "";
  state.chat.push({ role: "user", content: question.trim(), quote });
  renderChat();
  $("askSend").disabled = true;
  try {
    const result = await sendToBg({
      action: "vbAsk",
      question: question.trim(),
      contextText: buildContextText(),
      history,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "回答失败");
    state.chat.push({ role: "assistant", content: result.answer });
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) state.chat.push({ role: "assistant", content: `⚠ ${error.message}` });
  } finally {
    $("askSend").disabled = false;
    renderChat();
  }
}

// ---------- poll ----------

async function pollTick() {
  if (!keysReady()) return;
  const tab = await findWatchTab();
  if (!tab) {
    if (!state.videoId && loadingVideoId === null && $("setupGate").hidden) {
      if (reviewOnly) return;
      showStateBox("拆", "打开一个 YouTube 视频", "阅读器会自动铺开双语字幕。");
    }
    return;
  }
  state.tabId = tab.id;
  await ensureContentScript(tab.id);
  applyLoopToPage();
  const info = (await sendToTab({ type: "VB_VIDEO_INFO" })) || {};
  const videoId = info.videoId || videoIdFromHref(tab.url);
  if (!videoId) return;
  if (videoId !== state.videoId && videoId !== loadingVideoId) {
    loadVideo(videoId, tab.title || info.title || "");
    return;
  }
  if (Number.isFinite(info.currentTime)) {
    state.lastSeconds = info.currentTime;
    const rows = document.querySelectorAll("#transcriptBox .t-row");
    let active = null;
    for (const row of rows) {
      if (Number(row.dataset.start) <= info.currentTime) active = row;
      else break;
    }
    rows.forEach((row) => row.classList.toggle("playing", row === active));
    const at = state.blocks.findIndex(
      (b) => info.currentTime >= b.start && info.currentTime < b.end,
    );
    if (at >= 0 && blockProgress(at) === "fresh") setProgress(at, "learning");
    const canFollow =
      followPlayback &&
      active &&
      active !== lastFollowedRow &&
      Date.now() > followLockUntil &&
      Date.now() - lastUserScrollAt > 1200;
    if (canFollow) {
      followLockUntil = Date.now() + 400;
      lastFollowedRow = active;
      active.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

// ---------- boot ----------

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadLists();
  fillSettingsDrawer();
  paintModelSwitch();
  paintSetupModelPick();

  $("modelSwitch")?.querySelectorAll("[data-m]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveSettings({ model: btn.dataset.m });
      if ($("setModel")) $("setModel").value = btn.dataset.m;
      $("setModelSwitch")?.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("active", b.dataset.m === btn.dataset.m));
    });
  });
  $("setupModelPick")?.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("setupModel").value = btn.dataset.pick === "pro" ? "deepseek-v4-pro" : "deepseek-v4-flash";
      applySetupModels();
    });
  });
  $("setupDiveFollow")?.addEventListener("change", applySetupModels);

  const inbox = await chrome.storage.local.get(["vb_inbox", "vb_inbox_seen"]);
  if (inbox.vb_inbox?.id && inbox.vb_inbox.id !== inbox.vb_inbox_seen) {
    await applyHotkey(inbox.vb_inbox);
    await chrome.storage.local.set({ vb_inbox_seen: inbox.vb_inbox.id });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.vb_inbox?.newValue) {
      applyHotkey(changes.vb_inbox.newValue);
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === "vbHotkey") applyHotkey(message);
  });
  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.repeat) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
    const map = { Digit1: "quote", Digit2: "loop", Digit3: "note" };
    const action = map[event.code];
    if (!action) return;
    event.preventDefault();
    applyHotkey({ action, seconds: state.lastSeconds, caption: "", id: Date.now() });
  });

  if (!keysReady()) {
    showSetup(true);
  } else {
    showSetup(false);
    maybeStartTutorial();
  }

  $("setupSave").addEventListener("click", async () => {
    await saveSettings({
      apiKey: $("setupKey").value.trim(),
      supadataKey: $("setupSupadata").value.trim(),
      baseUrl: $("setupBase").value.trim() || "https://api.deepseek.com/v1",
      model: $("setupModel").value || "deepseek-v4-flash",
      diveModel: $("setupDiveModel")?.value || "deepseek-v4-pro",
    });
    if (!keysReady()) {
      $("setupLead").textContent = "两个 Key 都要填。缺哪个就去上面的官网申请。";
      return;
    }
    showSetup(false);
    maybeStartTutorial();
    pollTick();
  });

  $("tutSkip").addEventListener("click", closeTutorial);
  $("tutPrev").addEventListener("click", () => {
    if (tutIndex > 0) {
      tutIndex -= 1;
      renderTutorial();
    }
  });
  $("tutNext").addEventListener("click", () => {
    if (tutIndex >= TUTORIAL.length - 1) closeTutorial();
    else {
      tutIndex += 1;
      renderTutorial();
    }
  });
  $("tutReplay").addEventListener("click", () => {
    $("moreMenu").hidden = true;
    openTutorial(true);
  });
  $("exportTopBtn")?.addEventListener("click", openExport);
  $("exportBtn")?.addEventListener("click", openExport);

  $("moreBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = $("moreMenu");
    menu.hidden = !menu.hidden;
    $("moreBtn").setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#moreMenu") || event.target.closest?.("#moreBtn")) return;
    if ($("moreMenu")) $("moreMenu").hidden = true;
  });

  $("settingsBtn").addEventListener("click", () => {
    $("moreMenu").hidden = true;
    const drawer = $("settingsDrawer");
    drawer.hidden = !drawer.hidden;
    if (!drawer.hidden) fillSettingsDrawer();
  });

  $("stateReview")?.addEventListener("click", showReviewOnly);
  $("focusBtn")?.addEventListener("click", () => setFocusMode(!focusMode));
  $("focusExit")?.addEventListener("click", () => setFocusMode(false));
  $("focusLang")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tm]");
    if (btn) setTranscriptMode(btn.dataset.tm);
  });
  $("typeSmaller")?.addEventListener("click", async () => {
    typeSize = Math.max(14, typeSize - 1);
    applyTypeSize();
    await saveSettings({ readSize: typeSize });
  });
  $("typeBigger")?.addEventListener("click", async () => {
    typeSize = Math.min(22, typeSize + 1);
    applyTypeSize();
    await saveSettings({ readSize: typeSize });
  });

  $("stateRetry").addEventListener("click", () => {
    const id = state.videoId || loadingVideoId;
    loadingVideoId = null;
    if (id) loadVideo(id);
  });

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
      if (tab.dataset.view === "maps") {
        if (!state.conceptMap || !isNovakMap(state.conceptMap)) loadConceptMap();
        if (!state.argMap) loadArgMap();
        renderMaps();
      }
      if (tab.dataset.view === "review") {
        reviewRevealed = false;
        renderReview();
      }
      if (tab.dataset.view === "shelf") renderShelf();
      if (tab.dataset.view === "maps" && mapKind === "atlas") renderMaps();
    });
  });
  document.querySelectorAll("[data-progress]").forEach((btn) => {
    btn.addEventListener("click", () => {
      brickFilter = btn.dataset.progress;
      document.querySelectorAll("[data-progress]").forEach((b) => b.classList.toggle("active", b === btn));
      renderBrickList();
    });
  });
  document.querySelectorAll("[data-map]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mapKind = btn.dataset.map;
      document.querySelectorAll("[data-map]").forEach((b) => b.classList.toggle("active", b === btn));
      renderMaps();
    });
  });
  document.querySelectorAll("[data-shelf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      shelfFilter = btn.dataset.shelf;
      document.querySelectorAll("[data-shelf]").forEach((b) => b.classList.toggle("active", b === btn));
      renderShelf();
    });
  });
  $("followBtn")?.addEventListener("click", () => {
    followPlayback = !followPlayback;
    if (followPlayback) {
      lastUserScrollAt = 0;
      lastFollowedRow = null;
    }
    updateFollowBtn();
  });
  $("jumpForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const seconds = parseJumpInput($("jumpInput").value);
    if (seconds == null) return;
    seek(seconds);
  });
  document.addEventListener(
    "scroll",
    () => {
      if (Date.now() < followLockUntil) return;
      lastUserScrollAt = Date.now();
      if (followPlayback) {
        followPlayback = false;
        updateFollowBtn();
      }
    },
    true,
  );
  updateFollowBtn();

  $("modeOriginal").addEventListener("click", () => setTranscriptMode("original"));
  $("modeBilingual").addEventListener("click", () => setTranscriptMode("bilingual"));
  $("modeZh").addEventListener("click", () => setTranscriptMode("zh"));
  $("readerSearch").addEventListener("input", () => {
    clearTimeout($("readerSearch")._t);
    $("readerSearch")._t = setTimeout(runReaderSearch, 200);
  });

  document.querySelectorAll("[data-notes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      notesFilter = btn.dataset.notes;
      document.querySelectorAll("[data-notes]").forEach((b) => b.classList.toggle("active", b === btn));
      renderNotes();
    });
  });

  document.addEventListener("mouseup", () => setTimeout(placeSelBar, 0));
  document.addEventListener("scroll", () => ($("selBar").hidden = true), true);
  $("selBar").addEventListener("mousedown", (e) => e.preventDefault());
  $("selBar").addEventListener("click", async (event) => {
    const act = event.target.dataset.act;
    if (!act || !selPayload) return;
    if (act === "mark") await addHighlight(event.target.dataset.color || "def");
    if (act === "note") openNoteModal();
    if (act === "define") openWordCard(selPayload.text, selPayload);
    if (act === "vocab") await addVocab(selPayload.text, selPayload.sentence, selPayload.seconds);
    if (act === "ask") {
      state.askContext = { type: "quote", text: selPayload.text };
      renderAskContext();
      switchView("ask");
      $("askInput").focus();
    }
    $("selBar").hidden = true;
    window.getSelection()?.removeAllRanges();
  });

  $("noteCancel").addEventListener("click", () => {
    $("noteModal").hidden = true;
  });
  $("noteSave").addEventListener("click", saveNote);

  $("recallCancel").addEventListener("click", () => {
    $("recallModal").hidden = true;
  });
  $("recallSubmit").addEventListener("click", submitRecall);
  renderReviewBadge();
  setInterval(renderReviewBadge, 60 * 1000);

  $("askForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("askInput").value;
    $("askInput").value = "";
    askVideo(q);
  });
  $("askInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("askForm").requestSubmit();
    }
  });

  document.body.addEventListener("click", (event) => {
    const link = event.target.closest?.(".time-link");
    if (link) seek(Number(link.dataset.s));
    const hit = event.target.closest?.(".vocab-hit");
    if (hit) {
      event.preventDefault();
      event.stopPropagation();
      openWordCard(hit.dataset.vocab);
    }
  });

  addEventListener("beforeunload", () => saveCache());
  pollTick();
  setInterval(pollTick, 1500);
  setInterval(() => {
    if (state.videoId) saveCache();
  }, 15000);
});
