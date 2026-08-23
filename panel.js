// VideoBricks panel — reader first, then bricks / ask / notes.

const TUTORIAL = [
  {
    kicker: "理念",
    title: "这两个字",
    body: "Kaizen 的意思是改善。改是看见自己的不足，就动手改。善是改完之后，往更好的方向去。",
    more: "念作 kai-zen。这个词本来是工厂和公司里的说法：不指望一次巨大的颠覆，而是每个人每天在手边的事上改一点，攒下来就是质的变化。",
  },
  {
    kicker: "理念",
    title: "精进，不求顿悟",
    body: "我们看了太多内容，更多是在囤积，很少真正变成自己的。Kaizen 把一部片子拆短，好让你真的吃进去。",
  },
  {
    kicker: "用法",
    title: "把字幕当成一本书",
    body: "默认双语。点左边时间跳秒。在字幕上划过几个字，先选横线、波浪或框，再点定义、例子。按 B 会先夹在这一秒，事后可补标题和感想。点词是查词。做成卡之后，去顶栏「复习」。",
    view: "read",
    spot: ".reader-tools, #transcriptBox",
  },
  {
    kicker: "用法",
    title: "先过生词，再看视频",
    body: "顶栏「设词汇水平」选四级、六级、雅思或托福。打开视频后，会先给一份可能生词库。跳到某一句后，底下会出现「回生词」，不用再往回拉。",
    view: "read",
    spot: "#vocabLevelBtn, #vocabPreview",
  },
  {
    kicker: "用法",
    title: "划一段，跟读",
    body: "影子跟读不用去视频页拧倍速。在字幕里划一段，点「跟读」：这段会循环，速度自动降下来，听完空一拍你再开口。上面也能随时改 0.5× 到 2×。",
    view: "read",
    spot: "#shadowBtn, #rateSelect",
  },
  {
    kicker: "用法",
    title: "拆解看结构，费曼看你会不会",
    body: "拆解是 AI 帮你看这块是什么。费曼是按几个问题自己讲。打开费曼会先收起拆解。可以用 Typeless、豆包输入法或微信输入法对着说。卡住的地方就是没懂。AI 只指出缺口，不会替你写一版。",
  },
  {
    kicker: "用法",
    title: "做成的卡在「复习」",
    body: "生词本就是牌组。存进去的词会按间隔再见到，像 Anki。点「生词」先背到期的，牌组里能管理、跳回视频。金句和划线做成的卡仍在「复习」。",
    view: "vocab",
    spot: ".view-tab[data-view='vocab']",
  },
];

const CAT_ORDER = ["concept", "case", "story", "action", "qa"];

const CAT_LABEL = liveLabels({
  concept: "讲概念",
  case: "讲案例",
  story: "讲故事",
  action: "给做法",
  qa: "在问答",
});

const DIVE_FRAME = liveLabels({
  concept: "SEE-I · 属加种差",
  case: "类比编码 · CER",
  story: "冰山",
  action: "任务分析 · 库伯",
  qa: "Toulmin",
});

const SOLO_LABEL = liveLabels({
  pre: "还没成形",
  uni: "单点",
  multi: "多点",
  rel: "关联",
  ext: "抽象拓展",
});

const CAT_COLOR = {
  concept: "#5b8def",
  case: "#3aa06a",
  story: "#9b6bd6",
  action: "#d4922a",
  qa: "#d45b6a",
};

const PROGRESS_LABEL = liveLabels({
  fresh: "未开始",
  learning: "进行中",
  done: "已学会",
});

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
  lineLoop: -1,
  loopSpan: null,
  shadowing: false,
  shadowGap: true,
  shadowGapSec: 1.6,
  progress: {},
  conceptMap: null,
  argMap: null,
  visuals: {},
  scriptStudio: -1,
  quoteExtracted: false,
  levelScan: null,
  vocabPreviewDone: false,
  translateFailed: {},
  translateTries: {},
};

let loadingVideoId = null;
let videoJob = 0;
let pendingSeek = null;
let followPausedByUser = false;
let transcriptFailId = "";
let transcriptFailAt = 0;
let isTranslating = false;
let isAnalyzing = false;
let isStudying = false;
let isExtractingQuotes = false;
let extractingQuotesFor = "";
let isScanningVocab = false;
let settingsCache = { apiKey: "", supadataKey: "", baseUrl: "", model: "" };
let highlights = [];
let notes = [];
let vocab = [];
let marks = [];
let selPayload = null;
let pendingNote = null;
let pendingMark = null;
let notesFilter = "page";
let vocabScope = "all";
let vocabQuery = "";
let vocabPageMode = "review";
let vocabReviewRevealed = false;
let vocabCheck = null;
let vocabCheckPref = { scope: "due", kinds: "mix" };
let brickFilter = "all";
let brickKind = "all";
let mapKind = "concept";
let mapMoreOpen = false;
let atlasWoveFor = "";
let atlasQuietError = "";
let conceptMapFallback = false;
let argMapFallback = false;
let studyTab = "recap";
let tutIndex = 0;
let tutorialPending = false;
let followPlayback = true;
let followLockUntil = 0;
let lastFollowedRow = null;
let lastFollowedStart = -1;
let lastPlayheadAt = 0;
let programmaticScroll = false;
let lastUserScrollAt = 0;
let heavyWorkTimer = 0;
let transcriptRows = [];
let playingRowEl = null;
let decorateCache = null;
let echoMarksCache = null;
let echoMarksKey = "";
let goldIndexCache = null;
let goldIndexKey = "";
let transcriptGen = 0;
let transcriptPaintKey = "";
let transcriptReady = false;
let mentionReCache = new Map();
let pollBusy = false;
let followBusy = false;
let contentReadyAt = 0;
let contentReadyTab = 0;
let lastInjectAt = 0;
let injectingContent = false;
let watchTabCache = { at: 0, tab: null };
let saveCacheTimer = 0;
let saveProgressTimer = 0;
let quoteRailOpen = false;
let brickMoreOpen = -1;
let vocabCardIndex = 0;
let vocabJumpAt = {};
let vocabHitCache = new Map();
let playbackRate = 1;
let watchRate = 1;
let shadowRate = 0.75;
let shadowHinted = false;
let selectingUntil = 0;
const PLAY_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
let jumpTrail = null;

const $ = (id) => document.getElementById(id);

function eventEl(event) {
  const node = event && event.target;
  if (!node) return null;
  return node.nodeType === 1 ? node : node.parentElement;
}

function closeClickBlockers() {
  const bar = $("selBar");
  if (bar) bar.hidden = true;
  setMarkFacePopOpen(false);
  ["noteModal", "markModal", "recallModal", "vocabTestModal"].forEach((id) => {
    const el = $(id);
    if (el) el.hidden = true;
  });
  if ($("cardStudio") && !$("cardStudio").hidden) closeCardStudio();
  if ($("moreMenu")) $("moreMenu").hidden = true;
  if ($("themePop")) $("themePop").hidden = true;
}

function activateView(name) {
  if (!name) return;
  switchView(name);
  if (name === "review") reviewRevealed = false;
  if (name === "vocab") {
    if (!vocabPageMode) vocabPageMode = dueVocabCards().length ? "review" : "deck";
    if (resolveVocabLevel().id !== "off" && !state.levelScan?.scanned && state.segments.length) {
      scanVideoVocab();
    }
  }
  paintView(name);
  if (name === "bricks") {
    if (!state.blocks.length) setBrickStatus(t("点「拆」才拆页，不会一打开就花额度。"));
  }
  if (name === "read" && followPlayback) {
    lastFollowedStart = -1;
    const row = rowAtSeconds(state.lastSeconds);
    if (row) centerRowInView(row, { smooth: false });
  }
}

async function onTranscriptClick(event) {
  const el = eventEl(event);
  if (!el) return;
  const echo = el.closest("[data-echo]");
  if (echo) {
    event.stopPropagation();
    openEcho(echo.dataset.echo);
    return;
  }
  const row = el.closest(".t-row");
  if (el.closest(".t-time") && row) {
    seek(Number(row.dataset.start));
    return;
  }
  if (selectedText()) return;
  const hit = el.closest(".vocab-hit, .w-hit");
  if (hit) {
    event.stopPropagation();
    openWordFromEl(hit, row);
    return;
  }
  const mark = el.closest("mark[data-hid]");
  if (mark) {
    event.stopPropagation();
    await removeHighlight(mark.dataset.hid);
    return;
  }
  if (el.closest(".t-en")) {
    const word = wordFromClick(event);
    if (word) {
      event.stopPropagation();
      openWordFromEl({ dataset: { word } }, row);
      return;
    }
  }
  const retry = el.closest("[data-retryzh]");
  if (retry) {
    event.stopPropagation();
    retryTranslationAt(Number(retry.dataset.retryzh));
    return;
  }
  if (el.closest(".t-time") && row) seek(Number(row.dataset.start));
}

let coreClicksBound = false;

function setVocabPage(mode) {
  vocabPageMode = mode === "check" || mode === "review" || mode === "deck" ? mode : "deck";
  vocabReviewRevealed = false;
  renderVocabPage();
}

function bindCoreClicks() {
  if (coreClicksBound) return;
  coreClicksBound = true;
  document.addEventListener(
    "mousedown",
    (event) => {
      const el = eventEl(event);
      if (!el) return;
      if (el.closest(".view-tab, .topbar, .reader-tools, [data-vpage]")) {
        const bar = $("selBar");
        if (bar) bar.hidden = true;
        setMarkFacePopOpen(false);
      }
    },
    true,
  );
  document.addEventListener("click", (event) => {
    const el = eventEl(event);
    if (!el) return;
    const vpage = el.closest("[data-vpage]");
    if (vpage) {
      event.preventDefault();
      setVocabPage(vpage.dataset.vpage);
      return;
    }
    const tab = el.closest(".view-tab");
    if (!tab || el.closest("#selBar")) return;
    if ($("mainBox")?.hidden) return;
    activateView(tab.dataset.view);
  });
  $("transcriptBox")?.addEventListener("click", onTranscriptClick);
}

function esc(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function escAttr(text) {
  return esc(text).replace(/"/g, "&quot;");
}

function cleanZh(text) {
  return String(text ?? "")
    .replace(/^\s*\d{1,4}(?:\.|\．|、|\)|：|:)\s+/, "")
    .trim();
}

function translationKind(zh, en) {
  const cleaned = cleanZh(zh);
  if (!cleaned) return "empty";
  if (looksLikeFailedZh(cleaned)) return "error";
  if (typeof sameAsSource === "function" && sameAsSource(cleaned, en)) return "echo";
  return "ok";
}

function isRealTranslation(zh, en) {
  return translationKind(zh, en) === "ok";
}

function isTranslateFatal(result) {
  const text = `${result?.code || ""} ${result?.error || ""}`;
  return result?.code === "NO_KEY" || /NO_KEY|401|402|钥匙|额度|欠费|429|网络|Failed to fetch|AI 请求失败/i.test(text);
}

function translationAt(i) {
  const cleaned = cleanZh(state.translations[i]);
  if (!isRealTranslation(cleaned, state.segments[i]?.text)) return "";
  return cleaned;
}

function clock(seconds) {
  return typeof formatClock === "function" ? formatClock(seconds) : `${Math.floor(Math.max(0, Number(seconds) || 0) / 60)}:${String(Math.max(0, Math.floor(Number(seconds) || 0)) % 60).padStart(2, "0")}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sendToBg(message) {
  return chrome.runtime.sendMessage(message);
}

function sendToTab(message, tabId = state.tabId) {
  return new Promise((resolve) => {
    if (!tabId) return resolve(null);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 800);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) return resolve(null);
      resolve(response);
    });
  });
}

async function sendToTabSure(message, tabId = state.tabId) {
  let res = await sendToTab(message, tabId);
  if (res) return res;
  contentReadyAt = 0;
  lastInjectAt = 0;
  if (tabId) await ensureContentScript(tabId, { skipPing: true });
  res = await sendToTab(message, tabId);
  if (!res) {
    const now = Date.now();
    if (now - (sendToTabSure._hintAt || 0) > 4000) {
      sendToTabSure._hintAt = now;
      flashHint("视频页没接上。点一下视频再试。");
    }
  }
  return res;
}

function seek(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  sendToTabSure({ type: "VB_SEEK", seconds: s });
  scrollToSeconds(s);
}

function inferJumpKind() {
  if ($("vocabPreview")?.dataset.open === "1") return "vocab-preview";
  if (currentView() === "vocab") return "vocab-list";
  if (currentView() === "notes" && notesFilter === "vocab") return "vocab-list";
  if (document.getElementById("wordCard")) return "word-card";
  return currentView() || "read";
}

function jumpOriginLabel(kind, word) {
  if (kind === "vocab-preview" || kind === "vocab-list") return "生词";
  if (kind === "word-card") return word ? `「${word}」` : "词卡";
  if (kind === "notes") {
    return notesFilter === "quotes"
      ? "金句"
      : notesFilter === "highlights"
        ? "划线"
        : notesFilter === "page"
          ? "正文"
          : notesFilter === "pins"
            ? "书签"
            : "笔记";
  }
  if (kind === "maps") return "图谱";
  if (kind === "bricks") return "拆页";
  if (kind === "review") return "复习";
  if (kind === "shelf") return "库";
  return "刚才";
}

function rememberJumpOrigin(origin = {}) {
  if (jumpTrail) {
    if (origin.word) jumpTrail.word = origin.word;
    if (origin.kind) jumpTrail.kind = origin.kind;
    if (origin.label) jumpTrail.label = origin.label;
    if (origin.entry) jumpTrail.wordEntry = origin.entry;
    return;
  }
  const kind = origin.kind || inferJumpKind();
  jumpTrail = {
    view: currentView(),
    seconds: state.lastSeconds,
    scrollY: window.scrollY,
    notesFilter,
    kind,
    word: origin.word || "",
    label: origin.label || jumpOriginLabel(kind, origin.word),
    previewOpen: $("vocabPreview")?.dataset.open === "1",
    vocabCardIndex,
    wordEntry: origin.entry || null,
  };
  followPlayback = false;
  updateFollowBtn();
}

function peekSeek(seconds, origin = {}) {
  rememberJumpOrigin(origin);
  document.getElementById("wordCard")?.remove();
  if (jumpTrail?.kind === "vocab-preview") {
    const el = $("vocabPreview");
    if (el) {
      el.dataset.open = "0";
      syncReadBanners();
    }
  }
  if (currentView() !== "read") {
    switchView("read");
    paintView("read");
  }
  seek(seconds);
  renderJumpBack();
}

function clearJumpTrail() {
  jumpTrail = null;
  renderJumpBack();
}

function returnFromJump() {
  const trail = jumpTrail;
  if (!trail) return;
  jumpTrail = null;
  renderJumpBack();
  followPlayback = false;
  updateFollowBtn();
  const goScroll = (el) => {
    programmaticScroll = true;
    followLockUntil = Date.now() + 900;
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
    else window.scrollTo({ top: trail.scrollY || 0, behavior: "smooth" });
    setTimeout(() => {
      programmaticScroll = false;
    }, 500);
  };
  if (trail.kind === "vocab-preview" || trail.previewOpen) {
    switchView("read");
    vocabCardIndex = trail.vocabCardIndex ?? vocabCardIndex;
    renderVocabPreview();
    requestAnimationFrame(() => goScroll($("vocabPreview")));
    return;
  }
  if (trail.kind === "word-card") {
    if (trail.view && trail.view !== currentView()) {
      switchView(trail.view);
      paintView(trail.view);
    }
    requestAnimationFrame(() => goScroll());
    if (trail.word) openWordCard(trail.word, trail.wordEntry || {});
    return;
  }
  if (trail.view && trail.view !== currentView()) {
    switchView(trail.view);
    if (trail.view === "notes") {
      if (trail.notesFilter) {
        notesFilter = trail.notesFilter;
        document.querySelectorAll("[data-notes]").forEach((b) => {
          b.classList.toggle("active", b.dataset.notes === trail.notesFilter);
        });
      }
      renderNotes();
    } else {
      paintView(trail.view);
    }
  }
  requestAnimationFrame(() => {
    if ((trail.kind === "vocab-list" || trail.notesFilter === "vocab") && trail.word) {
      const hit = [...document.querySelectorAll(".vocab-word")].find(
        (el) => el.textContent.trim().toLowerCase() === String(trail.word).toLowerCase(),
      );
      if (hit) {
        goScroll(hit);
        return;
      }
    }
    goScroll();
  });
}

function jumpVocabCardNext() {
  const words = state.levelScan?.words || [];
  const trail = jumpTrail;
  jumpTrail = null;
  renderJumpBack();
  if (words.length) {
    const at = trail?.vocabCardIndex ?? vocabCardIndex;
    vocabCardIndex = Math.min(words.length - 1, at + 1);
    if (state.vocabPreviewDone) state.vocabPreviewDone = false;
  }
  switchView("read");
  renderVocabPreview();
  requestAnimationFrame(() => $("vocabPreview")?.scrollIntoView({ block: "start", behavior: "smooth" }));
}

function renderJumpBack() {
  const bar = $("jumpBackBar");
  if (!bar) return;
  if (!jumpTrail) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  const word = jumpTrail.word;
  const hits = word ? vocabHits(word) : [];
  const at = word ? vocabJumpAt[String(word).toLowerCase()] : null;
  const idx = Number.isFinite(at) ? hits.findIndex((h) => Math.abs(h.seconds - at) < 0.8) : -1;
  const preview = jumpTrail.kind === "vocab-preview";
  bar.hidden = false;
  bar.innerHTML = `
    <button type="button" class="jump-back-go" id="jumpBackBtn">回${esc(jumpTrail.label)}</button>
    <span class="jump-back-meta">${word ? `${esc(word)}${hits.length ? ` · ${idx >= 0 ? idx + 1 : "?"} / ${hits.length}` : ""}` : "跳过来看这一句"}</span>
    ${word && hits.length > 1 ? `<button type="button" id="jumpPrevHit">上一处</button><button type="button" class="jump-back-go" id="jumpNextHit">下一处</button>` : ""}
    ${preview && (state.levelScan?.words || []).length > 1 ? `<button type="button" id="jumpNextWord">下一个词</button>` : ""}
    <button type="button" class="jump-back-x" id="jumpBackDismiss" title="关掉">×</button>
  `;
  $("jumpBackBtn")?.addEventListener("click", returnFromJump);
  $("jumpPrevHit")?.addEventListener("click", () => jumpVocabPrev(word));
  $("jumpNextHit")?.addEventListener("click", () => jumpVocabNext(word));
  $("jumpNextWord")?.addEventListener("click", jumpVocabCardNext);
  $("jumpBackDismiss")?.addEventListener("click", clearJumpTrail);
}

function segmentIndexAt(seconds) {
  const segs = state.segments;
  if (!segs.length) return 0;
  let lo = 0;
  let hi = segs.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= seconds) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function rowAtSeconds(seconds) {
  return transcriptRows[segmentIndexAt(seconds)] || null;
}

function isReadView() {
  return Boolean(document.querySelector('.view[data-view="read"].active'));
}

function readingMidY() {
  const chrome = document.querySelector(".reader-tools") || document.querySelector(".views") || document.querySelector(".topbar");
  const top = chrome ? chrome.getBoundingClientRect().bottom : 0;
  return (top + window.innerHeight) / 2;
}

function scrollHolder(el) {
  let node = el?.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 8) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function isRowNearCenter(row, slop = 36) {
  if (!row) return false;
  const rect = row.getBoundingClientRect();
  const mid = readingMidY();
  return Math.abs(rect.top + rect.height / 2 - mid) <= slop;
}

function lockFollowScroll(ms = 800) {
  programmaticScroll = true;
  followLockUntil = Date.now() + ms;
  clearTimeout(lockFollowScroll._t);
  lockFollowScroll._t = setTimeout(() => {
    programmaticScroll = false;
  }, ms);
}

function centerRowInView(row, { smooth = true } = {}) {
  if (!row || !isReadView()) return false;
  const holder = scrollHolder(row);
  const holderIsPage = holder === document.documentElement || holder === document.body || holder === document.scrollingElement;
  const mid = holderIsPage ? readingMidY() : holder.getBoundingClientRect().top + holder.clientHeight * 0.42;
  const rect = row.getBoundingClientRect();
  const delta = rect.top + rect.height / 2 - mid;
  if (Math.abs(delta) < 72) return false;
  const far = Math.abs(delta) > 220;
  const useSmooth = smooth && far;
  lockFollowScroll(useSmooth ? 700 : 800);
  lastFollowedRow = row;
  lastFollowedStart = Number(row.dataset.start);
  if (holderIsPage) {
    window.scrollBy({ top: delta, behavior: useSmooth ? "smooth" : "auto" });
  } else {
    holder.scrollTop += delta;
  }
  return true;
}

function paintPlayingRow(seconds) {
  const next = rowAtSeconds(seconds);
  if (next === playingRowEl) return next;
  playingRowEl?.classList.remove("playing");
  next?.classList.add("playing");
  playingRowEl = next;
  return next;
}

function paintLoopRows() {
  const from = state.loopSpan ? state.loopSpan.from : state.lineLoop;
  const to = state.loopSpan ? state.loopSpan.to : state.lineLoop;
  for (const row of transcriptRows) {
    const i = Number(row.dataset.idx);
    row.classList.toggle("looping", from >= 0 && i >= from && i <= to);
  }
}

function paintGoldRows() {
  goldIndexCache = null;
  goldIndexKey = "";
  const golds = goldIndexSet();
  transcriptRows.forEach((row, i) => {
    const idx = Number(row?.dataset?.idx);
    row?.classList.toggle("gold", golds.has(Number.isFinite(idx) ? idx : i));
  });
}

function refreshTranscriptWhenIdle() {
  if (currentView() !== "read" || !state.segments.length) return;
  const id = state.videoId;
  refreshTranscriptWhenIdle.gen = (refreshTranscriptWhenIdle.gen || 0) + 1;
  const gen = refreshTranscriptWhenIdle.gen;
  let i = 0;
  const run = () => {
    if (gen !== refreshTranscriptWhenIdle.gen) return;
    if (state.videoId !== id || currentView() !== "read") return;
    if (transcriptRows.length !== state.segments.length) {
      renderTranscript({ force: true });
      return;
    }
    if (i === 0) decorateCache = null;
    const started = Date.now();
    while (i < transcriptRows.length && Date.now() - started < 8) {
      paintOneTranscriptRow(i);
      i += 1;
    }
    if (i < transcriptRows.length) {
      if (globalThis.requestIdleCallback) requestIdleCallback(run, { timeout: 400 });
      else setTimeout(run, 16);
    }
  };
  if (globalThis.requestIdleCallback) requestIdleCallback(run, { timeout: 1200 });
  else setTimeout(run, 360);
}

function resetTranscriptCaches() {
  transcriptGen += 1;
  transcriptPaintKey = "";
  transcriptReady = false;
  transcriptRows = [];
  playingRowEl = null;
  decorateCache = null;
  echoMarksCache = null;
  echoMarksKey = "";
  goldIndexCache = null;
  goldIndexKey = "";
  vocabHitCache.clear();
  vocabJumpAt = {};
  jumpTrail = null;
  renderJumpBack();
}

function saveCacheSoon(ms = 1000) {
  clearTimeout(saveCacheTimer);
  clearTimeout(saveProgressTimer);
  saveProgressTimer = 0;
  saveCacheTimer = setTimeout(() => {
    saveCacheTimer = 0;
    saveCache();
  }, ms);
}

function saveProgressSoon(ms = 4000) {
  if (saveCacheTimer) return;
  clearTimeout(saveProgressTimer);
  saveProgressTimer = setTimeout(() => {
    saveProgressTimer = 0;
    saveProgress();
  }, ms);
}

async function saveProgress() {
  if (!state.videoId) return;
  const key = `vb_cache_${state.videoId}`;
  try {
    const stored = await chrome.storage.local.get(key);
    const pack = stored[key];
    if (pack && typeof pack === "object") {
      await chrome.storage.local.set({
        [key]: { ...pack, lastSeconds: state.lastSeconds },
      });
    }
    const slot = shelf.find((x) => x.videoId === state.videoId);
    if (slot) {
      slot.lastSeconds = state.lastSeconds;
      slot.updatedAt = Date.now();
      await saveList("vb_shelf", shelf);
    }
  } catch (_e) {
    /* ignore */
  }
}

function scrollToSeconds(seconds) {
  const target = rowAtSeconds(seconds);
  if (!target) return;
  centerRowInView(target, { smooth: true });
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 1100);
}

function pauseFollowFromUser(event) {
  if (programmaticScroll || Date.now() < followLockUntil) return;
  const box = $("transcriptBox");
  const el = event?.target;
  if (!box || !el || (el !== box && !box.contains(el))) return;
  if (event && event.type === "wheel" && Math.abs(event.deltaY || event.deltaX || 0) < 2) return;
  lastUserScrollAt = Date.now();
  if (!followPlayback) return;
  followPausedByUser = true;
  updateFollowBtn();
}

async function followTick() {
  if (followBusy || document.hidden) return;
  if (Date.now() - lastPlayheadAt < 450) return;
  if (!state.videoId || !state.segments.length || !state.tabId) return;
  followBusy = true;
  try {
    await followTickWork();
  } finally {
    followBusy = false;
  }
}

function applyPlayhead(info) {
  if (info?.ad) return;
  if (!Number.isFinite(info?.currentTime)) return;
  if (state.tabId && info.tabId && Number(info.tabId) !== Number(state.tabId)) return;
  if (state.videoId && info.videoId !== state.videoId) return;
  const selecting = Boolean($("selBar") && !$("selBar").hidden);
  lastPlayheadAt = Date.now();
  state.lastSeconds = info.currentTime;
  saveProgressSoon(4000);
  paintMarkWalker(info.currentTime);
  const active = paintPlayingRow(info.currentTime);
  if (selecting || !followPlayback || !active || !isReadView()) return;
  if (followPausedByUser) {
    if (isRowNearCenter(active, 80)) followPausedByUser = false;
    else return;
  }
  const start = Number(active.dataset.start);
  if (start === lastFollowedStart && isRowNearCenter(active, 80)) return;
  if (Date.now() < followLockUntil) {
    if (start === lastFollowedStart) return;
    centerRowInView(active, { smooth: false });
    return;
  }
  centerRowInView(active, { smooth: false });
}

async function followTickWork() {
  if (!state.videoId || !state.segments.length || !state.tabId) return;
  const info = await sendToTab({ type: "VB_VIDEO_INFO" });
  applyPlayhead(info);
}

function parseJumpInput(raw) {
  return typeof parseClockInput === "function" ? parseClockInput(raw) : null;
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
  btn.classList.toggle("active", followPlayback && !followPausedByUser);
  btn.textContent = followPlayback && !followPausedByUser ? "跟随" : "已停";
}

function watchSnapToTab(snap) {
  if (!snap?.tabId && !snap?.id) return null;
  return {
    id: snap.tabId || snap.id,
    url: snap.url || "",
    title: snap.title || "",
    active: Boolean(snap.active),
    videoId: snap.videoId || "",
  };
}

async function readRememberedWatch() {
  try {
    const stored = await chrome.storage.local.get("vb_watch");
    const snap = stored.vb_watch;
    if (!snap) return null;
    if (snap.at && Date.now() - snap.at > 30 * 60 * 1000) return null;
    return snap;
  } catch (_e) {
    return null;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function listWatchTabs() {
  const remembered = await readRememberedWatch();
  const extra = [];
  if (remembered?.tabId || remembered?.id) {
    extra.push({
      id: remembered.tabId || remembered.id,
      url: remembered.url || "",
      title: remembered.title || "",
      active: Boolean(remembered.active),
      lastAccessed: remembered.at || 0,
      videoId: remembered.videoId || videoIdFromHref(remembered.url || ""),
    });
  }
  const fromBg = await withTimeout(sendToBg({ action: "vbFindWatch" }), 500);
  let queried = fromBg?.ok && Array.isArray(fromBg.tabs) ? fromBg.tabs : null;
  if (!queried) {
    const tabs = await withTimeout(chrome.tabs.query({}), 500);
    queried = Array.isArray(tabs)
      ? tabs.filter((tab) => isWatchHost(tabHref(tab))).map(summarizeWatchTab)
      : [];
  }
  const seen = new Set(queried.map((tab) => tab.id));
  for (const tab of extra) {
    if (tab.id && !seen.has(tab.id)) queried.push(tab);
  }
  return queried.sort(sortWatchTabs);
}

function tabVideoId(tab) {
  return tab?.videoId || videoIdFromHref(tabHref(tab) || tab?.url || "");
}

async function findWatchTab() {
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active && isWatchHost(tabHref(active))) {
      const tab = {
        id: active.id,
        url: tabHref(active),
        title: active.title || "",
        active: true,
        videoId: tabVideoId(active) || videoIdFromHref(tabHref(active)),
      };
      watchTabCache = { at: Date.now(), tab };
      return tab;
    }
  } catch (_e) {}
  if (watchTabCache.tab && Date.now() - watchTabCache.at < 800 && tabVideoId(watchTabCache.tab)) {
    return watchTabCache.tab;
  }
  const listed = await listWatchTabs();
  let picked = listed.find((tab) => tab.active && isWatchHost(tabHref(tab))) || null;
  if (!picked) {
    const pinned = state.tabId ? listed.find((tab) => Number(tab.id) === Number(state.tabId)) : null;
    if (pinned && !listed.some((tab) => tab.active && isWatchHost(tabHref(tab)))) picked = pinned;
  }
  if (!picked) {
    watchTabCache = { at: Date.now(), tab: null };
    return null;
  }
  const tab = {
    id: picked.id,
    url: picked.url,
    title: picked.title,
    active: picked.active,
    videoId: tabVideoId(picked),
  };
  watchTabCache = { at: Date.now(), tab };
  return tab;
}

let pendingWatchInfo = null;

function markWatchStage(stage, extra = {}) {
  chrome.storage.local
    .set({ vb_watch_diag: { stage, at: Date.now(), version: "0.7.9", ...extra } })
    .catch(() => {});
}

function takeIncomingWatch(info) {
  const videoId = info?.videoId || videoIdFromHref(info?.url || "");
  const next = { ...info, videoId };
  if (!keysReady()) {
    pendingWatchInfo = next;
    markWatchStage("queued", { videoId });
    return;
  }
  pendingWatchInfo = null;
  const decision = watchAdoptDecision(next, {
    videoId: state.videoId,
    tabId: state.tabId,
    segments: state.segments.length,
    loadingVideoId,
  });
  if (decision === "clear") {
    if (next.tabId) state.tabId = next.tabId;
    clearOpenedVideo(t("这页没有可读视频"));
    return;
  }
  if (!videoId) return;
  if (decision === "keep") {
    if (
      next.tabId &&
      (!state.tabId ||
        Number(next.tabId) === Number(state.tabId) ||
        next.source === "user" ||
        next.activeWatch)
    ) {
      state.tabId = next.tabId;
    }
    if (state.segments.length && !loadingVideoId && $("mainBox")?.hidden && $("setupGate")?.hidden) {
      showMain();
    }
    return;
  }
  if (decision !== "open") return;
  if (next.source !== "user" && !next.force) {
    if (
      videoId === transcriptFailId &&
      Date.now() - transcriptFailAt < 20000 &&
      !next.activeWatch &&
      !(next.tabId && state.tabId && Number(next.tabId) !== Number(state.tabId))
    ) {
      return;
    }
  }
  if (next.tabId) state.tabId = next.tabId;
  markWatchStage("loading", { videoId, tabId: state.tabId, source: next.source || "" });
  loadVideo(videoId, next.title || "", { force: Boolean(next.force || next.source === "user") });
}

function clearOpenedVideo(reason) {
  videoJob += 1;
  loadingVideoId = null;
  isTranslating = false;
  isAnalyzing = false;
  isStudying = false;
  Object.assign(state, {
    videoId: null,
    title: "",
    language: "",
    segments: [],
    gist: "",
    blocks: [],
    translations: {},
    study: null,
    lastSeconds: 0,
    translateFailed: {},
    translateTries: {},
  });
  transcriptFailId = "";
  transcriptFailAt = 0;
  autoOpenKey = "";
  markWatchStage("cleared", { reason: String(reason || "").slice(0, 120) });
  showStateBox("K", t("这页没有可读视频"), reason || t("换到一支能播的 YouTube 或 B 站，或把链接贴在下面。"), false, true);
}

function queueIncomingWatch(info, source) {
  if (!info) return;
  takeIncomingWatch({
    videoId: info.videoId,
    title: info.title || "",
    tabId: info.tabId || info.id,
    url: info.url || "",
    ad: Boolean(info.ad),
    force: Boolean(info.force),
    source: source || info.source || "storage",
  });
}

// This bridge is deliberately installed before the large DOM boot below.
// Opening through the in-player K button must still bind the video even if a
// later, unrelated UI initializer fails.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.vb_click?.newValue) {
    queueIncomingWatch(changes.vb_click.newValue, "user");
    return;
  }
  if (changes.vb_watch?.newValue) queueIncomingWatch(changes.vb_watch.newValue, "storage");
});
chrome.storage.local
  .get(["vb_click", "vb_watch"])
  .then((stored) => {
    const click = stored.vb_click;
    if (click && Date.now() - Number(click.at || 0) < 15000) {
      queueIncomingWatch(click, "user");
      return;
    }
    const candidates = [click, stored.vb_watch].filter(Boolean);
    candidates.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
    queueIncomingWatch(candidates[0], "storage");
  })
  .catch(() => {});

async function adoptActiveWatchNow() {
  if (!keysReady() || loadingVideoId) return false;
  if (state.videoId && state.segments.length) return false;
  const queries = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
    { active: true },
  ];
  for (const query of queries) {
    try {
      const tabs = await chrome.tabs.query(query);
      for (const tab of tabs || []) {
        const id = videoIdFromHref(tabHref(tab));
        if (!id) continue;
        takeIncomingWatch({ videoId: id, title: tab.title || "", tabId: tab.id, url: tabHref(tab), source: "adopt" });
        return true;
      }
    } catch (_e) {}
  }
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active && isWatchHost(tabHref(active)) && !videoIdFromHref(tabHref(active))) {
      if (state.videoId && state.segments.length) return false;
      takeIncomingWatch({
        title: active.title || "",
        tabId: active.id,
        url: tabHref(active),
        watchPage: true,
        activeWatch: true,
        source: "adopt",
      });
      return true;
    }
  } catch (_e) {}
  return false;
}

async function probePageVideoId(tabId) {
  if (!tabId) return null;
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const data = document.getElementById("movie_player")?.getVideoData?.();
          if (data?.video_id) return data.video_id;
        } catch (_e) {}
        try {
          const id = window.ytInitialPlayerResponse?.videoDetails?.videoId;
          if (id) return id;
        } catch (_e) {}
        try {
          const st = window.__INITIAL_STATE__ || {};
          const bvid = st.bvid || st.videoData?.bvid || st.videoInfo?.bvid || st.epInfo?.bvid;
          if (bvid) {
            const p = Number(st.p || 1);
            return p > 1 ? `${bvid}:p${p}` : bvid;
          }
          const aid = st.aid || st.videoData?.aid || st.epInfo?.aid;
          if (aid) return `av${aid}`;
        } catch (_e) {}
        return null;
      },
    });
    return injected?.[0]?.result || null;
  } catch (_e) {
    return null;
  }
}

function hostLabel(href) {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    if (host.includes("bilibili")) return "B 站";
    if (host.includes("youtu")) return "YouTube";
    return host;
  } catch (_e) {
    return "";
  }
}

let autoOpenKey = "";

function maybeAutoOpenWatch(tabs) {
  if (!keysReady() || state.videoId || loadingVideoId || reviewOnly) return;
  if (transcriptFailId && Date.now() - transcriptFailAt < 12000) return;
  const hit = (tabs || []).find((tab) => tab.active && tabVideoId(tab));
  if (!hit) return;
  const id = tabVideoId(hit);
  if (!id || autoOpenKey === id) return;
  autoOpenKey = id;
  takeIncomingWatch({
    videoId: id,
    title: hit.title || "",
    tabId: hit.id,
    url: hit.url || "",
    activeWatch: true,
    source: "adopt",
  });
}

function captionsOnlyMode() {
  return settingsCache.captionsOnly !== false;
}

const LIVE_CC_FONTS = ["sans", "serif", "round", "mono"];

function liveCcSizeOf(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 16;
  return Math.min(28, Math.max(13, Math.round(n)));
}

function liveCcFontOf(raw) {
  return LIVE_CC_FONTS.includes(raw) ? raw : "sans";
}

function paintLiveStyleSettings() {
  const size = liveCcSizeOf(settingsCache.liveCcSize);
  const font = liveCcFontOf(settingsCache.liveCcFont);
  if ($("setLiveSizeLabel")) $("setLiveSizeLabel").textContent = String(size);
  $("setLiveFont")?.querySelectorAll("[data-font]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.font === font);
  });
}

function preferredTranscriptMode() {
  const mode = settingsCache.transcriptMode || state.transcriptMode || "bilingual";
  if (mode === "original" || mode === "zh" || mode === "bilingual") return mode;
  return "bilingual";
}

async function paintStateTabs() {
  const box = $("stateOpen");
  const list = $("stateTabList");
  const kicker = $("stateOpenKicker");
  if (!box || !list) return;
  box.hidden = false;
  const tabs = await listWatchTabs();
  const best = tabs.find((tab) => tabVideoId(tab)) || tabs[0];
  const paste = $("statePaste");
  if (paste && best?.url && !paste.matches(":focus")) paste.value = best.url;
  maybeAutoOpenWatch(tabs);
  const key = tabs.map((tab) => `${tab.id}:${tabVideoId(tab) || ""}:${tab.title}`).join("|");
  if (kicker) {
    kicker.textContent = best && tabVideoId(best)
      ? t("已认出这支，正在打开字幕。")
      : tabs.length
        ? t("这边看见这些页，点一个就开始。")
        : t("还没看到视频页。点一下 YouTube 或 B 站窗口，或把链接贴在下面。");
  }
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.innerHTML = tabs
    .slice(0, 6)
    .map((tab) => {
      const id = tabVideoId(tab);
      const title = String(tab.title || id || tab.url || "视频")
        .replace(/ - YouTube$/, "")
        .replace(/_哔哩哔哩.*$/, "")
        .slice(0, 48);
      return `<button type="button" class="state-tab" data-tab-id="${tab.id}" data-video-id="${esc(id || "")}">
        <b>${esc(title || "未命名")}</b>
        <span>${esc(hostLabel(tab.url))}${id ? "" : ` · ${t("还没认出这支")}`}</span>
      </button>`;
    })
    .join("");
}

async function adoptWatchTab(tabId, videoId, title) {
  watchTabCache = { at: 0, tab: null };
  state.tabId = Number(tabId) || null;
  if (state.tabId) {
    try {
      await chrome.tabs.update(state.tabId, { active: true });
    } catch (_e) {}
  }
  if (videoId) {
    takeIncomingWatch({ videoId, title: title || "", tabId: state.tabId, force: true, source: "user" });
    return;
  }
  if (!state.tabId) return;
  await ensureContentScript(state.tabId);
  const info = (await sendToTab({ type: "VB_VIDEO_INFO" })) || {};
  const probed = info.videoId || (await probePageVideoId(state.tabId));
  if (probed) {
    takeIncomingWatch({
      videoId: probed,
      title: title || info.title || "",
      tabId: state.tabId,
      force: true,
      source: "user",
    });
  } else flashHint(t("这页还没认出视频。点一下播放，或把链接贴在下面。"));
}

async function openPastedWatch() {
  const raw = String($("statePaste")?.value || "").trim();
  if (!raw) {
    flashHint(t("先贴一条 YouTube 或 B 站链接。"));
    return;
  }
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const id = videoIdFromHref(href);
  if (!id) {
    flashHint(t("这不是一支能认的 YouTube 或 B 站链接。"));
    return;
  }
  const tabs = await listWatchTabs();
  const hit = tabs.find((tab) => tab.videoId === id);
  if (hit) {
    adoptWatchTab(hit.id, id, hit.title || "");
    return;
  }
  try {
    const created = await chrome.tabs.create({ url: href, active: true });
    takeIncomingWatch({
      videoId: id,
      title: created?.title || "",
      tabId: created?.id || null,
      url: href,
      force: true,
      source: "user",
    });
  } catch (_e) {
    flashHint(t("打不开这支。检查一下链接。"));
  }
}

async function ensureContentScript(tabId, { skipPing } = {}) {
  if (injectingContent) return false;
  if (!skipPing) {
    const ping = await sendToTab({ type: "VB_VIDEO_INFO" });
    if (ping) {
      contentReadyAt = Date.now();
      contentReadyTab = tabId;
      return true;
    }
  }
  if (Date.now() - lastInjectAt < 2000) return false;
  injectingContent = true;
  lastInjectAt = Date.now();
  try {
    let hasCore = false;
    try {
      const [shot] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => Boolean(globalThis.__KAIZEN_CS__?.i18n && globalThis.__KAIZEN_CS__?.site),
      });
      hasCore = Boolean(shot?.result);
    } catch (_e) {}
    await chrome.scripting.executeScript({
      target: { tabId },
      files: hasCore ? ["content.js"] : ["i18n.js", "i18n-dict.js", "site.js", "content.js"],
    });
    contentReadyAt = Date.now();
    contentReadyTab = tabId;
    return true;
  } catch (_e) {
    return false;
  } finally {
    injectingContent = false;
  }
}

function linkifyTimes(text) {
  return esc(text).replace(/\[(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\]/g, (_m, a, b, c) => {
    const s = c != null ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
    return `<span class="time-link" data-s="${s}">${_m}</span>`;
  });
}

function parseClock(label) {
  const m = String(label || "").match(/(\d{1,3}):([0-5]\d)(?::([0-5]\d))?/);
  if (!m) return null;
  if (m[3] != null) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[1]) * 60 + Number(m[2]);
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
  playbackRate = nearestPlayRate(settingsCache.playRate);
  watchRate = playbackRate;
  shadowRate = nearestPlayRate(settingsCache.shadowRate || 0.75);
  state.shadowGap = settingsCache.shadowGap !== false;
  setUiLang(settingsCache.uiLang || "zh-CN");
  if (settingsCache.captionsOnly == null) settingsCache.captionsOnly = true;
  applyTheme(settingsCache.uiTheme || "paper");
  applyTypeSize();
  applyPlayRate(playbackRate, false);
  let persist = false;
  if (!settingsCache.clientId) {
    settingsCache.clientId = uid("kz");
    persist = true;
  }
  if (!["original", "bilingual", "zh"].includes(settingsCache.transcriptMode)) {
    settingsCache.transcriptMode = "bilingual";
    persist = true;
  }
  if (persist) await chrome.storage.local.set({ vb_settings: settingsCache });
  state.transcriptMode = preferredTranscriptMode();
  return settingsCache;
}

async function saveSettings(next) {
  let stored = {};
  try {
    stored = (await chrome.storage.local.get("vb_settings")).vb_settings || {};
  } catch (_e) {}
  settingsCache = { ...stored, ...settingsCache, ...next };
  await chrome.storage.local.set({ vb_settings: settingsCache });
  if (next.uiTheme) applyTheme(next.uiTheme);
  paintModelSwitch();
}

function applyTheme(theme) {
  const id = ["paper", "night", "ink", "folio", "moss"].includes(theme) ? theme : "paper";
  document.documentElement.dataset.theme = id;
  document.body?.setAttribute("data-theme", id);
  const btn = $("themeBtn");
  if (btn) btn.dataset.swatch = id;
}

function themeCardsHtml(attr, cur) {
  return UI_THEMES.map(
    (row) =>
      `<button type="button" class="theme-card${cur === row.id ? " on" : ""}" ${attr}="${row.id}">
        <span class="theme-preview" data-swatch="${row.id}">
          <span class="theme-preview-bar"></span>
          <span class="theme-preview-page">
            <span class="theme-preview-kicker"></span>
            <span class="theme-preview-title"></span>
            <span class="theme-preview-line"></span>
            <span class="theme-preview-line dim"></span>
            <span class="theme-preview-chip"></span>
          </span>
        </span>
        <span class="theme-card-name">${t(row.label)}</span>
      </button>`,
  ).join("");
}

function paintThemeChrome() {
  const cur = settingsCache.uiTheme || "paper";
  applyTheme(cur);
  const pop = $("themePop");
  if (!pop) return;
  pop.innerHTML = `<p class="setup-lead">${t("侧栏和卡片都跟着这套外观。点一张就能看见。")}</p>
    <div class="theme-grid">${themeCardsHtml("data-theme", cur)}</div>`;
  pop.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveSettings({ uiTheme: btn.dataset.theme, cardTpl: themeCardTpl(btn.dataset.theme) });
      paintThemeChrome();
      if (typeof paintCardStudio === "function" && !$("cardStudio")?.hidden) paintCardStudio();
    });
  });
}

function themeCardTpl(theme) {
  return { paper: "poster", night: "night", ink: "ink", folio: "folio", moss: "moss" }[theme] || settingsCache.cardTpl || "poster";
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
  return Boolean(settingsCache.apiKey);
}

function resolveVocabLevel() {
  const raw = globalThis.WordLevel?.resolve(settingsCache) || { id: "off", key: "off", label: "未设置", known: 0, prompt: "" };
  return { ...raw, label: t(raw.label) };
}

let wordFreqList = [];
let wordPacksHave = {};

function wordPackIds() {
  return globalThis.WordLevel?.PACK_IDS || ["cet4", "cet6", "kaoyan", "ielts", "toefl", "sat", "gre"];
}

function wordPackReady(id) {
  if (id === "off") return false;
  return wordFreqList.length > 1000;
}

async function loadWordPacks() {
  try {
    const stored = await chrome.storage.local.get(["vb_wordfreq", "vb_wordpacks"]);
    if (Array.isArray(stored.vb_wordfreq) && stored.vb_wordfreq.length > 1000) {
      wordFreqList = stored.vb_wordfreq.map((w) => String(w || "").toLowerCase()).filter(Boolean);
    }
    wordPacksHave = stored.vb_wordpacks && typeof stored.vb_wordpacks === "object" ? stored.vb_wordpacks : {};
  } catch (_e) {
    wordPacksHave = {};
  }
}

async function ensureWordFreq() {
  if (wordFreqList.length > 1000) return wordFreqList;
  await loadWordPacks();
  if (wordFreqList.length > 1000) return wordFreqList;
  const res = await fetch(chrome.runtime.getURL("packs/english-freq.txt"));
  if (!res.ok) throw new Error(t("词汇包还没准备好。"));
  const text = await res.text();
  const seen = new Set();
  const words = [];
  for (const raw of String(text || "").split(/\s+/)) {
    const w = raw.toLowerCase();
    if (!/^[a-z][a-z'-]{1,39}$/.test(w) || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }
  if (words.length < 1000) throw new Error(t("词汇包还没准备好。"));
  wordFreqList = words;
  await chrome.storage.local.set({ vb_wordfreq: words });
  return words;
}

async function installWordPack(id, { all = false } = {}) {
  const freq = await ensureWordFreq();
  const next = { ...wordPacksHave };
  const at = Date.now();
  for (const packId of wordPackIds()) {
    const known = Number(globalThis.WordLevel?.BANDS?.[packId]?.known) || freq.length;
    next[packId] = { n: Math.min(known, freq.length), at };
  }
  wordPacksHave = next;
  await chrome.storage.local.set({ vb_wordfreq: freq, vb_wordpacks: next });
  return next;
}

function packKnownSet(level) {
  const n = Number(level?.known) || 0;
  return globalThis.WordLevel?.knownFromFreq(wordFreqList, n) || new Set();
}

function wordPackBoxHtml() {
  const ids = wordPackIds();
  const ready = wordFreqList.length > 1000;
  return `
    <p class="wordpack-kicker">${t("词汇包")}</p>
    <p class="setup-lead">${t("下载到本机后，按这个水平筛生词不再调用 AI。按常用度切一刀，不是官方考纲。")}</p>
    <div class="wordpack-list">
      ${ids
        .map((packId) => {
          const meta = globalThis.WordLevel?.BANDS?.[packId] || { label: packId, known: 0 };
          const have = Boolean(wordPacksHave[packId] || ready);
          const n = wordPacksHave[packId]?.n || meta.known;
          return `<div class="wordpack-row">
            <div>
              <b>${t(meta.label)}</b>
              <span>${have ? t("已下载 · {n} 词", { n }) : t("约 {n} 词", { n: meta.known })}</span>
            </div>
            <button type="button" class="btn${have ? "" : " btn-primary"}" data-pack="${packId}" ${have ? "disabled" : ""}>${have ? t("已在本机") : t("下载")}</button>
          </div>`;
        })
        .join("")}
    </div>
    <div class="row-actions">
      <button type="button" class="text-btn" data-pack-all>${ready ? t("词表已在本机") : t("一次装齐")}</button>
    </div>
  `;
}

function bindWordPackBox(root) {
  if (!root) return;
  root.innerHTML = wordPackBoxHtml();
  const run = async (id, all) => {
    try {
      await installWordPack(id, { all });
      paintWordPackBoxes();
      flashHint(all ? t("词表已装到本机。筛生词不再花 token。") : t("已下载「{name}」词包", { name: t(globalThis.WordLevel?.BANDS?.[id]?.label || id) }));
      checkAchievementsSoon("pack");
      const level = resolveVocabLevel();
      if (level.id !== "off" && state.segments.length) scanVideoVocab({ force: true });
    } catch (error) {
      flashHint(friendlyAiError(error.message, t("词汇包还没准备好。")));
    }
  };
  root.querySelectorAll("[data-pack]").forEach((btn) => {
    btn.addEventListener("click", () => run(btn.dataset.pack, false));
  });
  root.querySelector("[data-pack-all]")?.addEventListener("click", () => {
    if (wordFreqList.length > 1000) return;
    run("ielts", true);
  });
}

function paintWordPackBoxes() {
  ["popWordPacks", "setWordPacks"].forEach((id) => {
    const el = $(id);
    if (el) bindWordPackBox(el);
  });
}

function paintVocabBand(prefix, band) {
  const box = $(`${prefix}VocabBand`);
  const wrap = $(`${prefix}VocabScoreWrap`);
  const input = $(`${prefix}VocabScore`);
  const label = $(`${prefix}VocabScoreLabel`);
  if (box && !box.querySelector("[data-band]")) box.innerHTML = vocabBandButtons();
  box?.querySelectorAll("[data-band]").forEach((btn) => btn.classList.toggle("active", btn.dataset.band === band));
  const meta = globalThis.WordLevel?.scoreMeta?.(band);
  if (wrap) wrap.hidden = !meta;
  if (label && meta) label.textContent = t(meta.label);
  if (input && meta) input.placeholder = t(meta.ph);
}

function bindVocabBandUI(prefix, onPick) {
  const box = $(`${prefix}VocabBand`);
  const input = $(`${prefix}VocabScore`);
  const band = settingsCache.vocabBand || "off";
  if (input && document.activeElement !== input) input.value = settingsCache.vocabScore || "";
  paintVocabBand(prefix, band);
  if (box && box.dataset.bound !== "1") {
    box.dataset.bound = "1";
    box.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-band]");
      if (!btn) return;
      paintVocabBand(prefix, btn.dataset.band);
      onPick?.();
    });
  }
  if (input && input.dataset.bound !== "1") {
    input.dataset.bound = "1";
    input.addEventListener("change", () => onPick?.());
  }
}

async function applyVocabPick(prefix) {
  await saveSettings(readVocabSettings(prefix));
  state.levelScan = null;
  state.vocabPreviewDone = false;
  vocabCardIndex = 0;
  paintVocabChrome();
  if (resolveVocabLevel().id !== "off" && state.segments.length) {
    scanVideoVocab({ force: true });
  }
  if (currentView() === "vocab") renderVocabPage();
}

function vocabBandButtons() {
  const rows = [
    ["cet4", "四级"],
    ["cet6", "六级"],
    ["kaoyan", "考研"],
    ["tem4", "专四"],
    ["tem8", "专八"],
    ["ielts", "雅思"],
    ["toefl", "托福"],
    ["sat", "SAT"],
    ["gre", "GRE"],
    ["custom", "自填词量"],
    ["off", "先不设"],
  ];
  return rows.map(([id, label]) => `<button type="button" class="seg-btn" data-band="${id}">${t(label)}</button>`).join("");
}

function keysTableHtml() {
  return `<p class="setup-lead" style="margin-top:12px">${t("看视频时用播放条和右下那一排钮。键盘可选用，输入框里不会触发。")}</p>
    <table class="keys-table">
      <tr><th>${t("钮 / 键")}</th><th>${t("作用")}</th></tr>
      <tr><td>K</td><td>${t("打开侧栏")}</td></tr>
      <tr><td>R</td><td>Record · ${t("记下正在说的这句")}</td></tr>
      <tr><td>A</td><td>Again · ${t("再听这句或划过的几句。再按一次，或按 Esc 停")}</td></tr>
      <tr><td>N</td><td>Note · ${t("在这一刻写下自己的话")}</td></tr>
      <tr><td>B</td><td>Bookmark · ${t("夹在这一秒，事后可写一句")}</td></tr>
      <tr><td>C</td><td>${t("片上字幕条。打开后画面下方多一条可点的字幕")}</td></tr>
    </table>
    <p class="setup-lead">${t("书签会钉在视频自己的进度条上。事后可补一句。N 只在侧栏里按，避免抢掉 YouTube 的下一集。")}</p>`
}

function isLooping() {
  return state.lineLoop >= 0 || Boolean(state.loopSpan) || state.loopIndex >= 0;
}

function setVocabPop(open) {
  const pop = $("vocabLevelPop");
  if (!pop) return;
  pop.hidden = !open;
  if (open) {
    if ($("moreMenu")) $("moreMenu").hidden = true;
    setAchievePop(false);
    closeSettings();
    bindVocabBandUI("pop", () => applyVocabPick("pop"));
    bindVocabTestBtn("popVocabTest");
    paintVocabChrome();
    paintWordPackBoxes();
  }
}

function bindVocabTestBtn(id) {
  const btn = $(id);
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => openVocabTest());
}

let vocabTest = null;

function closeVocabTest() {
  vocabTest = null;
  if ($("vocabTestModal")) $("vocabTestModal").hidden = true;
}

function openVocabTest() {
  const modal = $("vocabTestModal");
  const pick = globalThis.WordLevel?.pickTest;
  if (!modal || !pick) {
    flashHint(t("词汇量测试还没准备好。"));
    return;
  }
  $("moreMenu") && ($("moreMenu").hidden = true);
  setVocabPop(false);
  if ($("themePop")) $("themePop").hidden = true;
  vocabTest = { items: pick(20), i: 0, answers: [] };
  modal.hidden = false;
  paintVocabTest();
}

function paintVocabTest() {
  const modal = $("vocabTestModal");
  if (!modal || !vocabTest) return;
  const { items, i, answers } = vocabTest;
  if (i >= items.length) {
    const known = globalThis.WordLevel.estimateKnown(answers);
    modal.innerHTML = `<div class="modal-card vocab-test-card">
      <h3>${t("大约的词汇量")}</h3>
      <p class="vocab-test-word">${known}</p>
      <p class="setup-lead">${t("按这个量筛字幕里可能还不熟的词。不是考试分数，随时能改。")}</p>
      <div class="vocab-test-actions">
        <button type="button" class="btn" data-vtest="again">${t("再测一次")}</button>
        <button type="button" class="btn btn-primary" data-vtest="use">${t("用这个水平")}</button>
      </div>
      <div class="modal-actions"><button type="button" class="text-btn" data-vtest="close">${t("关掉")}</button></div>
    </div>`;
    bindVocabTestActions(modal, known);
    return;
  }
  const row = items[i];
  modal.innerHTML = `<div class="modal-card vocab-test-card">
    <p class="vocab-test-bar">${t("认识这个词吗？")} · ${i + 1} / ${items.length}</p>
    <p class="vocab-test-word">${esc(row.word)}</p>
    <p class="setup-lead">${t("不用写意思。认识就点认识，估一个大概的量。")}</p>
    <div class="vocab-test-actions">
      <button type="button" class="btn" data-vtest="no">${t("不认识")}</button>
      <button type="button" class="btn btn-primary" data-vtest="yes">${t("认识")}</button>
    </div>
    <div class="modal-actions"><button type="button" class="text-btn" data-vtest="close">${t("关掉")}</button></div>
  </div>`;
  bindVocabTestActions(modal);
}

function bindVocabTestActions(modal, known) {
  modal.querySelectorAll("[data-vtest]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.vtest;
      if (act === "close") {
        closeVocabTest();
        return;
      }
      if (act === "again") {
        openVocabTest();
        return;
      }
      if (act === "use") {
        await saveSettings({ vocabBand: "custom", vocabScore: String(known || "") });
        state.levelScan = null;
        state.vocabPreviewDone = false;
        paintVocabChrome();
        bindVocabBandUI("setup");
        bindVocabBandUI("pop");
        bindVocabBandUI("state");
        if (!$("settingsDrawer")?.hidden) fillSettingsDrawer();
        if (resolveVocabLevel().id !== "off" && state.segments.length) scanVideoVocab({ force: true });
        closeVocabTest();
        flashHint(t("已按测出的量设好词汇水平。"));
        return;
      }
      if (!vocabTest || vocabTest.i >= vocabTest.items.length) return;
      vocabTest.answers.push({ rank: vocabTest.items[vocabTest.i].rank, yes: act === "yes" });
      vocabTest.i += 1;
      paintVocabTest();
    });
  });
}

function paintVocabChrome() {
  const level = resolveVocabLevel();
  const btn = $("vocabLevelBtn");
  if (btn) {
    btn.textContent = level.id === "off" ? t("设词汇水平") : `词汇 · ${level.label}`;
    btn.classList.toggle("need-set", level.id === "off");
  }
  const hint = $("popVocabHint");
  if (hint) {
    hint.textContent =
      level.id === "off"
        ? t("点一下就保存。也可以测 20 个词，估一个更准的量。不是官方考纲。")
        : wordPackReady(level.id)
          ? t("现在按「{name}」筛。这篇走本地词包，不花 token。", { name: level.label })
          : t("现在按「{name}」筛。下载词包后就不走 AI。", { name: level.label });
  }
  ["setup", "set", "pop", "state", "preview"].forEach((prefix) => {
    if (!$(`${prefix}VocabBand`)) return;
    const input = $(`${prefix}VocabScore`);
    if (input && document.activeElement !== input) input.value = settingsCache.vocabScore || "";
    paintVocabBand(prefix, settingsCache.vocabBand || "off");
  });
  renderLevelChip();
  renderVocabPreview();
}

function readVocabSettings(prefix) {
  const band = document.querySelector(`#${prefix}VocabBand [data-band].active`)?.dataset.band || "off";
  const raw = $(`${prefix}VocabScore`)?.value.trim() || "";
  return {
    vocabBand: band,
    vocabScore: globalThis.WordLevel?.parseScore(raw, band) || "",
  };
}

let quotes = [];
let cards = [];
let shelf = [];
let buddies = [];
let groupSnap = null;
let atlas = { concepts: [], propositions: [], focusQuestion: "" };
let lib = {};
let shelfMode = "videos";
let shelfQuery = "";
let openShelfId = "";
let openConceptId = "";
let openGraphId = "";
let graphFocusId = "";
let graphMode = "near";
let graphLayout = {};
let mapPick = null;
let vizPick = null;

const HL_ICON = {
  def: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" d="M2.1 2.7h3.2c.5 0 .9.3.9.8v5.8c0-.5-.4-.8-.9-.8H2.1V2.7zm7.8 0H6.7c-.5 0-.9.3-.9.8v5.8c0-.5.4-.8.9-.8h3.2V2.7z"/></svg>`,
  ex: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" d="M3.1 3.2h6.2v6.2H3.1zM4.4 2.3h6.2v6.2"/><path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" d="M4.6 5.4h3.2M4.6 7.2h2.2"/></svg>`,
  contra: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M3.1 3.1l5.8 5.8M8.9 3.1L3.1 8.9"/></svg>`,
  act: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M2.2 6h6.6M6.4 3.5L9.8 6l-3.4 2.5"/></svg>`,
  key: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 1.7l1.15 2.85h3.05L7.85 6.3l1.05 2.95L6 7.5 3.1 9.25 4.15 6.3 1.8 4.55h3.05z"/></svg>`,
  doubt: `<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M4.15 4.15c0-1.15.95-1.9 1.85-1.9s1.85.7 1.85 1.7c0 1.15-1.55 1.35-1.85 2.45"/><circle cx="6" cy="9.7" r=".7" fill="currentColor"/></svg>`,
};

const HL_COLOR = {
  def: { label: "定义", cls: "hl-def", icon: HL_ICON.def },
  ex: { label: "例子", cls: "hl-ex", icon: HL_ICON.ex },
  contra: { label: "反驳", cls: "hl-contra", icon: HL_ICON.contra },
  act: { label: "行动", cls: "hl-act", icon: HL_ICON.act },
  key: { label: "重点", cls: "hl-key", icon: HL_ICON.key },
  doubt: { label: "疑问", cls: "hl-doubt", icon: HL_ICON.doubt },
};

const HL_KIND_ORDER = Object.keys(HL_COLOR);

const HL_STYLE = {
  line: { label: "横线", cls: "hl-s-line" },
  wave: { label: "波浪", cls: "hl-s-wave" },
  dash: { label: "虚线", cls: "hl-s-dash" },
  box: { label: "方框", cls: "hl-s-box" },
  circle: { label: "圆圈", cls: "hl-s-circle" },
  marker: { label: "荧光笔", cls: "hl-s-marker" },
};

function lastHlColor() {
  return HL_COLOR[settingsCache.hlColor] ? settingsCache.hlColor : "def";
}

function lastHlStyle() {
  return HL_STYLE[settingsCache.hlStyle] ? settingsCache.hlStyle : "line";
}

function hlStyleId(value) {
  return HL_STYLE[value] ? value : "line";
}

function hlClassOf(h) {
  const color = HL_COLOR[h?.color]?.cls || "hl-def";
  const style = HL_STYLE[hlStyleId(h?.style)]?.cls || "hl-s-line";
  return `${color} ${style}`;
}

function hlKindOf(h) {
  return HL_COLOR[h?.color] ? h.color : "def";
}

function hlIconHtml(color, { title = true } = {}) {
  const meta = HL_COLOR[color] || HL_COLOR.def;
  const tip = title ? ` title="${escAttr(t(meta.label))}"` : "";
  return `<i class="hl-ico ${meta.cls}"${tip}>${meta.icon}</i>`;
}

function highlightRowIdxs(h) {
  const idxs = [];
  if (Array.isArray(h.spans)) {
    for (const span of h.spans) {
      const i = Number(span?.idx);
      if (Number.isInteger(i) && i >= 0) idxs.push(i);
    }
  }
  if (!idxs.length) {
    const i = segmentIndexAt(h.seconds);
    if (i >= 0) idxs.push(i);
  }
  return idxs;
}

function highlightKindsAt(idx) {
  return getDecorateCache().kindsByIdx.get(idx) || [];
}

function hlTimeButton({ seconds, idx, attr = "data-s", cls = "t-time" }) {
  const kinds = highlightKindsAt(idx);
  const labels = kinds.map((k) => t((HL_COLOR[k] || HL_COLOR.def).label));
  const tip = labels.length
    ? `${t("跳到")} ${clock(seconds)} · ${labels.join(" · ")}`
    : `${t("跳到")} ${clock(seconds)}`;
  const marks = kinds.length
    ? `<span class="t-hl-marks">${kinds.map((k) => hlIconHtml(k)).join("")}</span>`
    : "";
  return `<button class="${cls}" type="button" ${attr}="${seconds}" title="${escAttr(tip)}"><span class="t-clock">${clock(seconds)}</span>${marks}</button>`;
}

const UI_THEMES = [
  { id: "paper", label: "暖纸" },
  { id: "night", label: "夜间" },
  { id: "ink", label: "朱墨" },
  { id: "folio", label: "书页" },
  { id: "moss", label: "苔色" },
];

let shelfFilter = "new";

async function loadLists() {
  const stored = await chrome.storage.local.get([
    "vb_highlights",
    "vb_notes",
    "vb_vocab",
    "vb_marks",
    "vb_quotes",
    "vb_cards",
    "vb_shelf",
    "vb_atlas",
    "vb_lib",
    "vb_buddies",
    "vb_group",
    "vb_achieve",
  ]);
  highlights = stored.vb_highlights || [];
  notes = stored.vb_notes || [];
  vocab = stored.vb_vocab || [];
  marks = stored.vb_marks || [];
  quotes = stored.vb_quotes || [];
  cards = stored.vb_cards || [];
  shelf = stored.vb_shelf || [];
  atlas = stored.vb_atlas || { concepts: [], propositions: [], focusQuestion: "" };
  lib = stored.vb_lib || {};
  buddies = stored.vb_buddies || [];
  groupSnap = stored.vb_group || null;
  achieveStore = { ...emptyAchieve(), ...(stored.vb_achieve || {}) };
  achieveStore.unlocked = achieveStore.unlocked || {};
  achieveStore.seen = achieveStore.seen || {};
  achieveStore.flags = achieveStore.flags || {};
  achieveStore.doneKeys = achieveStore.doneKeys || {};
  achieveStore.days = Array.isArray(achieveStore.days) ? achieveStore.days : [];
}

async function saveList(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

let achieveStore = emptyAchieve();
let achieveTimer = 0;

function emptyAchieve() {
  return globalThis.Achieve?.emptyStore?.() || { unlocked: {}, seen: {}, flags: {}, days: [], doneKeys: {}, doneChapters: 0 };
}

function videoSiteKind(id) {
  const s = String(id || "");
  if (/^BV/i.test(s) || /^av\d+/i.test(s) || /:p\d+$/i.test(s)) return "bili";
  if (s) return "yt";
  return "";
}

function rememberCurrentDone() {
  const vid = state.videoId;
  if (!vid || !state.blocks?.length) return false;
  achieveStore.doneKeys = achieveStore.doneKeys || {};
  let added = false;
  state.blocks.forEach((_, i) => {
    if (blockProgress(i) !== "done") return;
    const key = `${vid}:${i}`;
    if (achieveStore.doneKeys[key]) return;
    achieveStore.doneKeys[key] = 1;
    added = true;
  });
  if (added) achieveStore.doneChapters = Object.keys(achieveStore.doneKeys).length;
  return added;
}

function collectAchieveStats() {
  const flags = achieveStore.flags || {};
  const touched = globalThis.Achieve?.touchDays?.(achieveStore.days) || { days: achieveStore.days || [], streak: 0 };
  let chapters = 0;
  for (const [id, rec] of Object.entries(lib || {})) {
    if (id === state.videoId) continue;
    chapters += rec?.bricks?.length || 0;
  }
  chapters += state.blocks?.length || 0;
  const doneNow = (state.blocks || []).filter((_, i) => blockProgress(i) === "done").length;
  const youtube = (shelf || []).filter((x) => videoSiteKind(x.videoId) === "yt").length;
  const bili = (shelf || []).filter((x) => videoSiteKind(x.videoId) === "bili").length;
  return {
    videos: (shelf || []).length,
    words: (vocab || []).length,
    highlights: (highlights || []).length,
    notes: (notes || []).length,
    marks: (marks || []).length,
    quotes: (quotes || []).length,
    chapters,
    doneChapters: Math.max(
      Number(achieveStore.doneChapters) || 0,
      Object.keys(achieveStore.doneKeys || {}).length,
      doneNow,
    ),
    reviews: (cards || []).filter((c) => Number(c.reps) > 0).length,
    packs: wordFreqList.length > 1000 || Object.keys(wordPacksHave || {}).length ? 1 : 0,
    youtube,
    bili,
    asks: Number(flags.ask || 0) + ((state.chat || []).some((m) => m?.role === "user") ? 1 : 0),
    maps: Boolean(flags.map || state.conceptMap || (atlas?.concepts || []).length),
    live: Boolean(flags.live || settingsCache.liveCc),
    loop: Boolean(flags.loop),
    shadow: Boolean(flags.shadow),
    exported: Boolean(flags.export),
    streak: touched.streak,
    days: (touched.days || []).length,
  };
}

function paintAchieveBadge() {
  const n = globalThis.Achieve?.unseen?.(achieveStore) || 0;
  const badge = $("achieveTopBadge");
  const btn = $("achieveTopBtn");
  if (badge) {
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? "99+" : String(n);
  }
  btn?.classList.toggle("pulse", n > 0);
}

function setAchievePop(open) {
  const pop = $("achievePop");
  if (!pop) return;
  if (open) {
    $("moreMenu") && ($("moreMenu").hidden = true);
    setVocabPop(false);
    if ($("themePop")) $("themePop").hidden = true;
    closeSettings();
    renderAchievePop();
    pop.hidden = false;
  } else if (!pop.hidden) {
    pop.hidden = true;
    markAchieveSeen().catch(() => {});
  }
}

function renderAchievePop() {
  const pop = $("achievePop");
  const api = globalThis.Achieve;
  if (!pop || !api) return;
  const stats = collectAchieveStats();
  const unlocked = achieveStore.unlocked || {};
  const total = api.DEFS.length;
  const got = api.DEFS.filter((d) => unlocked[d.id]).length;
  const groups = api.GROUPS.map((g) => {
    const rows = api.DEFS.filter((d) => d.group === g.id)
      .map((d) => {
        const on = Boolean(unlocked[d.id]);
        const fresh = on && !achieveStore.seen?.[d.id];
        const have = typeof d.have === "function" ? Number(d.have(stats) || 0) : 0;
        const need = Number(d.need) || 0;
        const bar =
          need && !on
            ? `<span class="achieve-bar">${Math.min(have, need)} / ${need}</span>`
            : "";
        return `<article class="achieve-card${on ? " on" : ""}">
          <div>
            <b>${t(d.title)}${fresh ? `<span class="achieve-new">${t("新")}</span>` : ""}</b>
            <p>${t(d.blurb)}</p>
          </div>
          ${bar || (on ? `<span class="achieve-on">${t("已得到")}</span>` : `<span class="achieve-wait">${t("还在路上")}</span>`)}
        </article>`;
      })
      .join("");
    return `<section class="achieve-group"><h3>${t(g.label)}</h3>${rows}</section>`;
  }).join("");
  pop.innerHTML = `
    <div class="achieve-head">
      <div>
        <p class="achieve-kicker">${t("成就")}</p>
        <p class="setup-lead">${t("看过的、记下的、拆过的，都会记在这里。不是分数，是你改过的痕迹。")}</p>
      </div>
      <strong>${got} / ${total}</strong>
    </div>
    ${groups}
  `;
}

async function persistAchieve() {
  await chrome.storage.local.set({ vb_achieve: achieveStore });
}

async function checkAchievements({ silent = false } = {}) {
  const api = globalThis.Achieve;
  if (!api) return [];
  const prevDays = achieveStore.days || [];
  const touched = api.touchDays(prevDays);
  const daysChanged =
    touched.days.length !== prevDays.length || touched.days.join("\0") !== prevDays.join("\0");
  achieveStore.days = touched.days;
  const doneChanged = rememberCurrentDone();
  const stats = collectAchieveStats();
  const result = api.evaluate(stats, achieveStore);
  const fresh = result.fresh || [];
  achieveStore.unlocked = result.unlocked;
  if (fresh.length || daysChanged || doneChanged) await persistAchieve();
  paintAchieveBadge();
  if ($("achievePop") && !$("achievePop").hidden) renderAchievePop();
  if (!silent && fresh.length) {
    const first = api.byId(fresh[0]);
    const text =
      fresh.length === 1
        ? t("成就：{name}", { name: t(first?.title || "改善") })
        : t("一下子解锁了 {n} 个成就", { n: fresh.length });
    flashHint(text, {
      extra: {
        label: t("看看"),
        run: () => setAchievePop(true),
      },
    });
  }
  return fresh;
}

function checkAchievementsSoon(flag) {
  if (flag) {
    achieveStore.flags[flag] = true;
    persistAchieve().catch(() => {});
  }
  clearTimeout(achieveTimer);
  achieveTimer = setTimeout(() => {
    checkAchievements().catch(() => {});
  }, 240);
}

async function markAchieveSeen() {
  const unlocked = achieveStore.unlocked || {};
  achieveStore.seen = { ...unlocked };
  Object.keys(unlocked).forEach((id) => {
    achieveStore.seen[id] = true;
  });
  await persistAchieve();
  paintAchieveBadge();
}

function normLabel(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[的了着是与和]/g, "")
    .slice(0, 12);
}

function writeLib(videoId, src) {
  if (!videoId || !src) return;
  lib[videoId] = {
    title: src.title || lib[videoId]?.title || "",
    gist: src.gist || "",
    bricks: (src.blocks || []).map((b, i) => ({
      i,
      title: b.title || "",
      category: b.category || "",
      start: Number(b.start) || 0,
      summary: b.summary || "",
    })),
    savedAt: Date.now(),
  };
  const ids = Object.keys(lib).sort((a, b) => (lib[b].savedAt || 0) - (lib[a].savedAt || 0));
  if (ids.length > 80) {
    for (const id of ids.slice(80)) delete lib[id];
  }
}

async function persistLib() {
  await chrome.storage.local.set({ vb_lib: lib });
}

async function hydrateLib() {
  const stored = await chrome.storage.local.get("vb_cache_index");
  const missing = (stored.vb_cache_index || []).filter((id) => !lib[id]?.bricks?.length);
  if (!missing.length) return;
  let changed = false;
  for (const id of missing) {
    const caches = await chrome.storage.local.get(`vb_cache_${id}`);
    const cache = caches[`vb_cache_${id}`];
    if (cache) {
      writeLib(id, cache);
      changed = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (changed) {
    await persistLib();
    checkAchievementsSoon();
  }
}

function goToVideo(videoId, seconds) {
  if (videoId === state.videoId) {
    seek(Number(seconds) || 0);
    switchView("read");
    return;
  }
  openVideoAt(videoId, seconds);
}

function quoteBlob(q) {
  return `${q.text || ""} ${q.en || ""} ${q.zh || ""} ${q.why || ""} ${q.take || ""}`;
}

function wikiLinks(text) {
  return [...String(text || "").matchAll(/\[\[([^[\]]{1,40})\]\]/g)].map((m) => m[1].trim()).filter(Boolean);
}

function mentionsLabel(text, label) {
  const raw = String(text || "");
  const lab = String(label || "").trim();
  if (!raw || !lab) return false;
  if (/^[a-z][a-z0-9\s'-]*$/i.test(lab)) {
    if (lab.length < 6) return false;
    let re = mentionReCache.get(lab);
    if (!re) {
      re = new RegExp(`\\b${lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (mentionReCache.size > 400) mentionReCache.clear();
      mentionReCache.set(lab, re);
    }
    return re.test(raw);
  }
  if (lab.length < 4) return false;
  return raw.includes(lab);
}

const ECHO_STOP = new Set([
  "本视频",
  "视频",
  "内容",
  "问题",
  "方法",
  "东西",
  "事情",
  "概念",
  "系统",
  "世界",
  "人们",
  "我们",
  "他们",
  "自己",
  "重要",
  "核心",
  "本质",
  "关键",
  "一点",
  "方面",
]);

function echoLabelOk(label) {
  const s = String(label || "").trim();
  if (ECHO_STOP.has(s)) return false;
  if (/^[a-z][a-z0-9\s'-]*$/i.test(s)) return s.length >= 6;
  return s.length >= 4;
}

function echoSourceOk(src) {
  if (!src?.videoId || src.videoId === state.videoId) return false;
  const bricks = lib[src.videoId]?.bricks || [];
  if (!bricks.length) return false;
  if (Number.isFinite(Number(src.block))) {
    if (bricks.some((b) => b.i === Number(src.block))) return true;
  }
  if (Number.isFinite(Number(src.seconds))) {
    return bricks.some((b) => Math.abs((b.start || 0) - Number(src.seconds)) < 25);
  }
  return false;
}

function atlasEchoes() {
  if (Object.keys(lib || {}).length < 2) return [];
  return (atlas.concepts || []).filter((c) => {
    if (!echoLabelOk(c.label)) return false;
    return (c.sources || []).filter(echoSourceOk).length >= 1;
  });
}

function echoMarksForSegments() {
  const concepts = atlasEchoes();
  const key = `${state.videoId}:${concepts.length}:${atlas.propositions?.length || 0}`;
  if (echoMarksKey === key && echoMarksCache) return echoMarksCache;
  const byIdx = new Map();
  if (!concepts.length) {
    echoMarksKey = key;
    echoMarksCache = byIdx;
    return byIdx;
  }
  const ranked = concepts.slice().sort((a, b) => b.label.length - a.label.length);
  const used = new Set();
  state.segments.forEach((seg, i) => {
    const zh = translationAt(i);
    for (const c of ranked) {
      if (used.has(c.id)) continue;
      const enHit = mentionsLabel(seg.text, c.label);
      const zhHit = mentionsLabel(zh, c.label);
      if (!enHit && !(zhHit && String(c.label).trim().length >= 5)) continue;
      used.add(c.id);
      byIdx.set(i, c);
      break;
    }
  });
  echoMarksKey = key;
  echoMarksCache = byIdx;
  return byIdx;
}

function openEcho(conceptId) {
  const box = $("echoBox");
  if (!box) return;
  openConceptId = conceptId;
  const n = ((atlas.concepts || []).find((c) => c.id === conceptId)?.sources || []).filter(echoSourceOk)
    .length;
  box.hidden = false;
  box.innerHTML = `<div class="echo-head">
    <span>${n} 支视频也讲过</span>
    <span>
      <button class="text-btn" id="echoAtlas" type="button">在总图看</button>
      <button class="text-btn" id="echoClose" type="button">收起</button>
    </span>
  </div>${renderConceptInspect(conceptId)}`;
  $("echoClose")?.addEventListener("click", () => {
    box.hidden = true;
    box.innerHTML = "";
  });
  $("echoAtlas")?.addEventListener("click", () => {
    mapKind = "atlas";
    mapMoreOpen = false;
    openGraphId = conceptId;
    graphFocusId = conceptId;
    syncMapTabs();
    switchView("maps");
    renderMaps();
    $("conceptCard")?.scrollIntoView({ block: "nearest" });
  });
  bindLibJumps(box);
  box.scrollIntoView({ block: "nearest" });
}

function syncMapTabs() {
  document.querySelectorAll("[data-map]").forEach((b) => b.classList.toggle("active", b.dataset.map === mapKind));
}

function evidenceForConcept(concept) {
  const sources = concept?.sources || [];
  return sources.map((src) => {
    const rec = lib[src.videoId];
    const brick =
      rec?.bricks?.find((b) => b.i === src.block) ||
      rec?.bricks?.find((b) => Math.abs((b.start || 0) - (src.seconds || 0)) < 45) ||
      null;
    const hits = quotes
      .filter((q) => q.videoId === src.videoId && mentionsLabel(quoteBlob(q), concept.label))
      .slice(0, 3);
    return { src, rec, brick, quotes: hits };
  });
}

function renderConceptInspect(conceptId) {
  const concept = (atlas.concepts || []).find((c) => c.id === conceptId);
  if (!concept) return `<div class="chat-empty">这个概念还没织进总图。</div>`;
  const rows = evidenceForConcept(concept);
  const body = rows.length
    ? rows
        .map((row) => {
          const here = row.src.videoId === state.videoId;
          const brickLine = row.brick
            ? `${CAT_LABEL[row.brick.category] || ""} · ${row.brick.title}`
            : "";
          const quotesHtml = row.quotes
            .map((q) => `<p class="lib-quote">${esc(q.zh || q.en || q.text)}</p>`)
            .join("");
          return `<article class="lib-source${here ? " on" : ""}">
            <div class="lib-src-title">${esc(row.src.title || row.rec?.title || row.src.videoId)}</div>
            <div class="note-meta">${clock(row.src.seconds || row.brick?.start || 0)}${here ? " · 正在看" : ""}${brickLine ? ` · ${esc(brickLine)}` : ""}</div>
            ${row.brick?.summary ? `<p class="lib-sum">${esc(row.brick.summary)}</p>` : row.rec?.gist ? `<p class="lib-sum">${esc(row.rec.gist)}</p>` : ""}
            ${quotesHtml}
            <div class="row-actions">
              <button class="text-btn" data-open="${row.src.videoId}" data-s="${row.src.seconds || row.brick?.start || 0}" type="button">${here ? "跳到这秒" : "打开这秒"}</button>
            </div>
          </article>`;
        })
        .join("")
    : `<div class="chat-empty">还没有来源。打开对应视频并生成概念图后，会记在这里。</div>`;
  const local = resolvePickFromLabel(concept.label);
  return `<section class="lib-inspect" id="conceptCard">
    <div class="lib-kicker">概念 · ${rows.length} 支视频</div>
    <h3 class="lib-title">${esc(concept.label)}</h3>
    ${
      local.block >= 0
        ? `<div class="row-actions"><button class="text-btn" type="button" data-fy="${local.block}" data-fy-topic="${escAttr(concept.label)}">${t("费曼这个概念")}</button></div>`
        : ""
    }
    ${body}
  </section>`;
}

function renderVideoInspect(videoId) {
  const rec = lib[videoId];
  const qs = quotes.filter((q) => q.videoId === videoId).slice(0, 6);
  const ns = notes.filter((n) => n.videoId === videoId).slice(0, 4);
  if (!rec && !qs.length && !ns.length) {
    return `<div class="lib-inspect"><div class="chat-empty">这篇还没有缓存。打开视频后会写入知识库。</div></div>`;
  }
  const bricks = (rec?.bricks || [])
    .map(
      (b) => `<button class="lib-brick" data-open="${videoId}" data-s="${b.start}" type="button">
        <span class="note-meta">${clock(b.start)} · ${esc(CAT_LABEL[b.category] || "")}</span>
        <strong>${esc(b.title)}</strong>
        ${b.summary ? `<span>${esc(b.summary)}</span>` : ""}
      </button>`,
    )
    .join("");
  const quoteHtml = qs
    .map((q) => `<p class="lib-quote">${esc(q.zh || q.en || q.text)}</p>`)
    .join("");
  const noteHtml = ns
    .map((n) => `<p class="lib-sum">${esc(n.text)}</p>`)
    .join("");
  return `<div class="lib-inspect">
    ${rec?.gist ? `<p class="lib-gist">${esc(rec.gist)}</p>` : ""}
    ${bricks ? `<div class="lib-kicker">知识块</div>${bricks}` : ""}
    ${quoteHtml ? `<div class="lib-kicker">金句</div>${quoteHtml}` : ""}
    ${noteHtml ? `<div class="lib-kicker">笔记</div>${noteHtml}` : ""}
  </div>`;
}

function resolvePickFromLabel(label, fallbackBlock = -1, conceptId = "") {
  const text = String(label || "").trim();
  let block = Number.isInteger(fallbackBlock) && state.blocks[fallbackBlock] ? fallbackBlock : -1;
  if (block < 0 && text) {
    let best = -1;
    let score = 0;
    state.blocks.forEach((b, i) => {
      const blob = `${b.title} ${b.summary || ""}`;
      if (mentionsLabel(blob, text) || mentionsLabel(text, b.title)) {
        const n = Math.min(text.length, String(b.title || "").length);
        if (n > score) {
          best = i;
          score = n;
        }
      }
    });
    if (best >= 0) block = best;
  }
  const seconds = block >= 0 ? state.blocks[block].start : null;
  const relatedQuotes = videoQuotes()
    .filter((q) => mentionsLabel(quoteBlob(q), text))
    .slice(0, 3);
  const relatedNotes = notes
    .filter((n) => n.videoId === state.videoId && mentionsLabel(`${n.text} ${n.quote || ""}`, text))
    .slice(0, 2);
  const concept = (atlas.concepts || []).find((c) => c.id === conceptId || c.label === text || mentionsLabel(c.label, text));
  const cid = conceptId || concept?.id || "";
  const links = (state.conceptMap?.propositions || [])
    .filter((e) => e.from === text || e.to === text || e.from === cid || e.to === cid || namesMatchConcept(e, text))
    .slice(0, 6);
  return {
    label: text,
    block,
    seconds,
    quotes: relatedQuotes,
    notes: relatedNotes,
    conceptId: cid,
    links,
  };
}

function namesMatchConcept(edge, text) {
  const names = new Map((state.conceptMap?.concepts || []).map((c) => [c.id, c.label]));
  return names.get(edge.from) === text || names.get(edge.to) === text;
}

function renderPickCard(pick, cardId = "mapInspect") {
  if (!pick || (!pick.label && !(pick.block >= 0))) return "";
  const block = pick.block >= 0 ? state.blocks[pick.block] : null;
  const names = new Map((state.conceptMap?.concepts || []).map((c) => [c.id, c.label]));
  const links = (pick.links || [])
    .map((e) => {
      const from = names.get(e.from) || e.from;
      const to = names.get(e.to) || e.to;
      return `<li>${esc(from)} <i>${esc(e.link || "")}</i> ${esc(to)}</li>`;
    })
    .join("");
  const quotes = (pick.quotes || [])
    .map(
      (q) =>
        `<button class="pick-quote" type="button" data-pick-jump="${q.seconds || 0}">${esc((q.en || q.zh || q.text || "").slice(0, 90))}</button>`,
    )
    .join("");
  const notesHtml = (pick.notes || [])
    .map((n) => `<p class="lib-sum">${esc(n.text)}</p>`)
    .join("");
  const kicker = pick.role || (block ? `${CAT_LABEL[block.category] || ""} · ${clock(block.start)}` : t("概念卡片"));
  return `<section class="lib-inspect pick-card" id="${cardId}">
    <div class="lib-kicker">${esc(kicker)}</div>
    <h3 class="lib-title">${esc(pick.label || block?.title || "")}</h3>
    ${block?.summary ? `<p class="lib-sum">${esc(block.summary)}</p>` : ""}
    ${links ? `<ol class="cmap-props">${links}</ol>` : ""}
    ${quotes ? `<div class="lib-kicker">${t("金句")}</div>${quotes}` : ""}
    ${notesHtml ? `<div class="lib-kicker">${t("笔记")}</div>${notesHtml}` : ""}
    <div class="row-actions">
      ${
        Number.isFinite(Number(pick.seconds)) || block
          ? `<button class="text-btn" type="button" data-pick-jump="${pick.seconds ?? block.start}">${t("跳到字幕")}</button>`
          : ""
      }
      ${
        block
          ? `<button class="text-btn" type="button" data-pick-block="${pick.block}">${t("看这块")}</button>
             <button class="text-btn" type="button" data-pick-loop="${pick.block}">${t("循环这块")}</button>
             <button class="text-btn" type="button" data-fy="${pick.block}" data-fy-topic="${escAttr(pick.label || block.title)}">${t("费曼")}</button>`
          : ""
      }
    </div>
  </section>`;
}

function bindPickCard(root, peekKind = "maps") {
  root?.querySelectorAll("[data-pick-jump]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      peekSeek(Number(btn.dataset.pickJump), { kind: peekKind, label: t("图谱") });
    });
  });
  root?.querySelectorAll("[data-pick-block]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectBlock(Number(btn.dataset.pickBlock), "bricks");
    });
  });
  root?.querySelectorAll("[data-pick-loop]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLoop(Number(btn.dataset.pickLoop));
    });
  });
  bindFeynmanOpens(root);
}

function openMapPick(el) {
  const label = el.dataset.label || "";
  const cid = el.dataset.cid || el.dataset.atlas || "";
  const block = Number(el.dataset.block);
  const jump = Number(el.dataset.jump);
  const same = mapPick && ((cid && mapPick.id === cid) || (!cid && mapPick.label === label && mapPick.block === (Number.isFinite(block) ? block : mapPick.block)));
  if (same) {
    mapPick = null;
    if (el.dataset.expand === "1" && Number.isFinite(block)) {
      state.selectedBlock = state.selectedBlock === block ? -1 : block;
    }
    renderMaps();
    return;
  }
  const extra = resolvePickFromLabel(label, Number.isFinite(block) ? block : -1, cid);
  mapPick = {
    ...extra,
    id: cid || extra.conceptId || "",
    label: label || extra.label || (Number.isFinite(block) ? state.blocks[block]?.title : ""),
    role: el.dataset.role || "",
    block: Number.isFinite(block) ? block : extra.block,
    seconds: Number.isFinite(jump) ? jump : extra.seconds,
  };
  if (el.dataset.expand === "1" && Number.isFinite(block)) {
    state.selectedBlock = block;
  }
  renderMaps();
  if (Number.isFinite(Number(mapPick.seconds))) seek(Number(mapPick.seconds));
  $("mapInspect")?.scrollIntoView({ block: "nearest" });
}

function vizHitAttrs(label, role = "") {
  const text = String(label || "").trim();
  const on = vizPick && vizPick.label === text;
  return `class="viz-hit${on ? " on" : ""}" data-vhit="1" data-vlabel="${escAttr(text)}"${role ? ` data-vrole="${escAttr(role)}"` : ""}`;
}

function openVizPick(i, el) {
  const label = el.dataset.vlabel || "";
  const same = vizPick && vizPick.i === i && vizPick.label === label;
  if (same) {
    vizPick = null;
    renderBrickList();
    return;
  }
  const extra = resolvePickFromLabel(label, i);
  vizPick = {
    ...extra,
    i,
    label: label || extra.label,
    role: el.dataset.vrole || "",
    block: extra.block >= 0 ? extra.block : i,
    seconds: extra.seconds ?? state.blocks[i]?.start,
  };
  renderBrickList();
  if (Number.isFinite(Number(vizPick.seconds))) seek(Number(vizPick.seconds));
  $("vizInspect")?.scrollIntoView({ block: "nearest" });
}

function bindVisualHits(root, i) {
  root?.querySelectorAll("[data-vhit]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      openVizPick(i, el);
    });
  });
}

function openVideoAt(videoId, seconds) {
  const url = watchUrl(videoId, seconds);
  if (!url) return;
  pendingSeek = { videoId, seconds: Number(seconds) || 0 };
  takeIncomingWatch({
    videoId,
    url,
    tabId: state.tabId,
    force: true,
    source: "user",
  });
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
  scheduleKoulingPush();
  renderShelf();
  checkAchievementsSoon();
}

function bindLibJumps(root) {
  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      goToVideo(btn.dataset.open, btn.dataset.s);
    });
  });
  bindFeynmanOpens(root);
}

function videoHaystack(item) {
  const rec = lib[item.videoId];
  const q = quotes.filter((x) => x.videoId === item.videoId).map((x) => quoteBlob(x)).join(" ");
  const n = notes.filter((x) => x.videoId === item.videoId).map((x) => x.text).join(" ");
  return [
    item.title,
    rec?.title,
    rec?.gist,
    ...(rec?.bricks || []).map((b) => `${b.title} ${b.summary}`),
    q,
    n,
  ]
    .join(" ")
    .toLowerCase();
}

function renderShelf() {
  const root = $("shelfBox");
  if (!root) return;
  const q = shelfQuery.trim().toLowerCase();
  const filterEl = $("shelfFilter");
  const help = $("shelfHelp");
  if (filterEl) filterEl.hidden = shelfMode !== "videos";
  const search = $("shelfSearch");
  if (search) search.hidden = shelfMode === "buddies";
  if (help) {
    help.textContent =
      shelfMode === "concepts"
        ? t("同一概念下是不同视频怎么讲。点开看知识块和金句，再跳回那一秒。")
        : shelfMode === "buddies"
          ? t("发给认识的人，看对方看过哪些。")
          : t("点标题先看这支的知识块和金句，不必先打开视频。");
  }

  if (shelfMode === "buddies") {
    root.innerHTML = renderBuddyPane();
    bindBuddyPane(root);
    return;
  }
  stopKoulingPoll();

  if (shelfMode === "concepts") {
    const concepts = (atlas.concepts || []).filter((c) => {
      if (!q) return true;
      const names = (c.sources || []).map((s) => s.title || "").join(" ");
      return `${c.label} ${names}`.toLowerCase().includes(q);
    });
    if (!concepts.length) {
      root.innerHTML = `<div class="chat-empty">${q ? "没有匹配的概念。" : "看过两支以上并生成概念图后，概念会汇到这里。"}</div>`;
      return;
    }
    root.innerHTML = concepts
      .map((c) => {
        const n = (c.sources || []).length;
        const names = (c.sources || []).map((s) => s.title || s.videoId).filter(Boolean).slice(0, 3).join(" · ");
        const open = openConceptId === c.id;
        return `<article class="shelf-item${open ? " on" : ""}">
          <button class="shelf-hit" data-concept="${c.id}" type="button">
            <div class="shelf-title">${esc(c.label)}</div>
            <div class="note-meta">${n} 支视频${names ? ` · ${esc(names)}` : ""}</div>
          </button>
          ${open ? renderConceptInspect(c.id) : ""}
        </article>`;
      })
      .join("");
    root.querySelectorAll("[data-concept]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openConceptId = openConceptId === btn.dataset.concept ? "" : btn.dataset.concept;
        renderShelf();
      });
    });
    bindLibJumps(root);
    return;
  }

  const rows = shelf.filter((x) => {
    if ((x.bucket || "new") !== shelfFilter) return false;
    return !q || videoHaystack(x).includes(q);
  });
  if (!rows.length) {
    const empty = {
      new: t("打开过的视频会出现在这里。"),
      later: t("以后再看的会进这一栏。"),
      shortlist: t("精选短名单还是空的。"),
      done: t("还没有标成看完的视频。"),
    };
    root.innerHTML = `<div class="chat-empty">${q ? "没有匹配的视频。" : empty[shelfFilter] || "空"}</div>`;
    return;
  }
  root.innerHTML = rows
    .map((item) => {
      const here = item.videoId === state.videoId;
      const rec = lib[item.videoId];
      const qn = quotes.filter((x) => x.videoId === item.videoId).length;
      const bn = rec?.bricks?.length || 0;
      const open = openShelfId === item.videoId;
      const meta = [
        item.lastSeconds ? `看到 ${clock(item.lastSeconds)}` : t("还没开始"),
        bn ? `${bn} 块` : "",
        qn ? `${qn} 金句` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<article class="shelf-item${here || open ? " on" : ""}">
        <button class="shelf-hit" data-peek="${item.videoId}" type="button">
          <div class="shelf-title">${esc(item.title || rec?.title || item.videoId)}</div>
          ${rec?.gist ? `<p class="shelf-gist">${esc(rec.gist)}</p>` : ""}
          <div class="note-meta">${esc(meta)}</div>
        </button>
        ${open ? renderVideoInspect(item.videoId) : ""}
        <div class="row-actions">
          <button class="text-btn" data-open="${item.videoId}" data-s="${item.lastSeconds || 0}" type="button">${here ? "继续这篇" : "打开视频"}</button>
          ${shelfFilter !== "later" ? `<button class="text-btn" data-bucket="later" data-id="${item.videoId}" type="button">以后</button>` : ""}
          ${shelfFilter !== "shortlist" ? `<button class="text-btn" data-bucket="shortlist" data-id="${item.videoId}" type="button">精选</button>` : ""}
          ${shelfFilter !== "done" ? `<button class="text-btn" data-bucket="done" data-id="${item.videoId}" type="button">看完</button>` : ""}
          ${shelfFilter !== "new" ? `<button class="text-btn" data-bucket="new" data-id="${item.videoId}" type="button">放回新进</button>` : ""}
        </div>
      </article>`;
    })
    .join("");
  root.querySelectorAll("[data-peek]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openShelfId = openShelfId === btn.dataset.peek ? "" : btn.dataset.peek;
      renderShelf();
    });
  });
  root.querySelectorAll("[data-bucket]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      upsertShelf({ videoId: btn.dataset.id, bucket: btn.dataset.bucket });
    });
  });
  bindLibJumps(root);
}

function buddySelfPack() {
  return {
    kind: "kaizen-buddy",
    version: 1,
    exportedAt: Date.now(),
    name: (settingsCache.buddyName || t("我")).trim() || t("我"),
    task: (settingsCache.buddyTask || "").trim(),
    videos: shelf.map((item) => ({
      videoId: item.videoId,
      title: item.title || lib[item.videoId]?.title || item.videoId,
      bucket: item.bucket || "new",
      lastSeconds: item.lastSeconds || 0,
      updatedAt: item.updatedAt || 0,
    })),
  };
}

function buddyPackToText(pack) {
  const lines = ["Kaizen搭子", `称呼 ${pack.name || t("我")}`, `任务 ${pack.task || ""}`, "---"];
  for (const v of pack.videos || []) {
    const title = String(v.title || v.videoId || "").replace(/\s+/g, " ").trim();
    lines.push(`${v.videoId} ${clock(v.lastSeconds || 0)} ${title}`);
  }
  return lines.join("\n");
}

function parseBuddyClock(token) {
  const raw = String(token || "").trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/^(\d+):([0-5]\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return 0;
}

function parseBuddyPayload(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error(t("先贴一段进度。"));
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text);
    if (parsed?.kind !== "kaizen-buddy" || !Array.isArray(parsed.videos)) {
      throw new Error(t("这不是搭子进度。"));
    }
    return parsed;
  }
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^Kaizen(搭子|口令|-buddy)\b/i.test(line.trim()));
  if (start < 0) {
    throw new Error(t("这不是搭子进度。"));
  }
  let name = "";
  let task = "";
  const videos = [];
  let body = false;
  for (const line of lines.slice(start + 1)) {
    const row = line.trim();
    if (!row) continue;
    if (row === "---") {
      body = true;
      continue;
    }
    if (!body && /^称呼\s+/.test(row)) {
      name = row.replace(/^称呼\s+/, "").trim();
      continue;
    }
    if (!body && /^任务\s+/.test(row)) {
      task = row.replace(/^任务\s+/, "").trim();
      continue;
    }
    const parts = row.split(/\s+/);
    if (parts.length < 2) continue;
    const videoId = parts[0];
    const lastSeconds = parseBuddyClock(parts[1]);
    const title = parts.slice(2).join(" ") || videoId;
    videos.push({ videoId, title, lastSeconds, bucket: "new", updatedAt: 0 });
  }
  return { kind: "kaizen-buddy", name, task, videos, exportedAt: Date.now() };
}

async function copyBuddyPack() {
  const text = buddyPackToText(buddySelfPack());
  await navigator.clipboard.writeText(text);
  flashHint(t("已复制。发给微信即可。"));
}

function exportBuddyPack() {
  const pack = buddySelfPack();
  downloadText(
    `Kaizen-搭子-${String(pack.name || "me").replace(/[\\/:*?"<>|]/g, "").slice(0, 42)}.json`,
    JSON.stringify(pack, null, 2),
    "application/json",
  );
  flashHint(t("已导出文件。发给对方导入即可。"));
}

async function applyBuddyPack(parsed) {
  if (parsed?.kind !== "kaizen-buddy" || !Array.isArray(parsed.videos)) {
    throw new Error(t("这不是搭子进度。"));
  }
  const id = String(parsed.name || "buddy").slice(0, 40) + "-" + (parsed.exportedAt || Date.now());
  const next = {
    id,
    name: String(parsed.name || t("搭子")).slice(0, 40),
    task: String(parsed.task || "").slice(0, 200),
    videos: parsed.videos
      .filter((v) => v?.videoId)
      .slice(0, 200)
      .map((v) => ({
        videoId: String(v.videoId),
        title: String(v.title || v.videoId).slice(0, 120),
        bucket: v.bucket || "new",
        lastSeconds: Number(v.lastSeconds) || 0,
        updatedAt: Number(v.updatedAt) || 0,
      })),
    importedAt: Date.now(),
  };
  buddies = [next, ...buddies.filter((b) => b.name !== next.name)].slice(0, 12);
  await saveList("vb_buddies", buddies);
  flashHint(t("已记下搭子的进度。"));
  renderShelf();
}

async function importBuddyPack(file) {
  await applyBuddyPack(parseBuddyPayload(await file.text()));
}

function normalizeKouling(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^Kaizen-?/i, "");
  if (!/^[A-HJ-NP-Z2-9]{4}$/i.test(text)) return "";
  return `Kaizen-${text.toUpperCase()}`;
}

function parseKoulingInvite(raw) {
  const text = String(raw || "").trim();
  const urlMatch = text.match(/https?:\/\/\S+/i);
  const url = urlMatch ? urlMatch[0].replace(/[),.;]+$/, "") : "";
  const codeMatch = text.match(/Kaizen-([A-HJ-NP-Z2-9]{4})/i);
  return {
    code: codeMatch ? `Kaizen-${codeMatch[1].toUpperCase()}` : normalizeKouling(urlMatch ? text.replace(urlMatch[0], "") : text),
    url,
  };
}

function koulingInviteText() {
  const code = settingsCache.kouling || "";
  if (code) {
    return `${t("我的 Kaizen 口令")}：${code}\n${t("用 Kaizen 打开「库 → 搭子」，把口令贴上，就能看到我看过哪些。")}`;
  }
  return `${t("用 Kaizen 打开「库 → 搭子」，把下面整段贴进去。")}\n\n${buddyPackToText(buddySelfPack())}`;
}

function koulingMemberPayload() {
  const pack = buddySelfPack();
  return {
    clientId: settingsCache.clientId,
    name: pack.name,
    task: pack.task,
    videos: pack.videos,
  };
}

async function koulingReq(payload) {
  const res = await sendToBg({ action: "vbKouling", ...payload });
  if (!res?.ok) throw new Error(res?.error || t("小组同步失败。"));
  return res;
}

async function saveGroupSnap(snap) {
  groupSnap = snap || null;
  await saveList("vb_group", groupSnap);
}

let koulingPushTimer = 0;
let koulingPollTimer = 0;

function scheduleKoulingPush() {
  if (!settingsCache.kouling) return;
  clearTimeout(koulingPushTimer);
  koulingPushTimer = setTimeout(() => {
    koulingPush().catch(() => {});
  }, 2500);
}

function stopKoulingPoll() {
  clearInterval(koulingPollTimer);
  koulingPollTimer = 0;
}

function startKoulingPoll() {
  stopKoulingPoll();
  if (!settingsCache.kouling) return;
  koulingPollTimer = setInterval(() => {
    koulingPull({ silent: true }).catch(() => {});
  }, 20000);
}

async function koulingPush() {
  const code = settingsCache.kouling;
  if (!code) return;
  const res = await koulingReq({ op: "put", code, member: koulingMemberPayload() });
  if (res.group) await saveGroupSnap(res.group);
}

async function koulingPull({ silent = false } = {}) {
  const code = settingsCache.kouling;
  if (!code) return;
  try {
    const res = await koulingReq({ op: "get", code });
    if (res.group) {
      await saveGroupSnap(res.group);
      if (shelfMode === "buddies") renderShelf();
    }
  } catch (error) {
    if (!silent) flashHint(friendlyAiError(error.message, t("还读不到小组。")));
  }
}

async function rememberBuddyMe() {
  await saveSettings({
    buddyName: $("buddyName")?.value.trim() || settingsCache.buddyName || "",
    buddyTask: $("buddyTask")?.value.trim() || settingsCache.buddyTask || "",
  });
}

function koulingServer() {
  return String(settingsCache.koulingUrl || "").replace(/\/$/, "");
}

async function inviteBuddy() {
  await rememberBuddyMe();
  const server = koulingServer();
  if (server) {
    try {
      if (!settingsCache.kouling) {
        const res = await koulingReq({ op: "create", task: settingsCache.buddyTask || "" });
        const code = res.group?.code;
        if (!code) throw new Error(t("口令没做成。"));
        await saveSettings({ kouling: code });
      }
      await koulingPush();
    } catch (_e) {}
  }
  await navigator.clipboard.writeText(koulingInviteText());
  flashHint(t("已复制，发给微信即可。"));
  renderShelf();
}

async function joinFromPaste(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error(t("先把朋友发来的口令贴进来。"));
  const invite = parseKoulingInvite(text);
  if (invite.url) await saveSettings({ koulingUrl: invite.url });
  if (invite.code && koulingServer()) {
    await koulingReq({ op: "get", code: invite.code });
    await saveSettings({ kouling: invite.code });
    await koulingPush();
    return;
  }
  await applyBuddyPack(parseBuddyPayload(text));
}

function renderGroupMembers() {
  const members = groupSnap?.members || [];
  if (!members.length) {
    return `<div class="chat-empty">${t("组里还没有别人。把口令发给朋友，对方加入后就能看到他看过哪些。")}</div>`;
  }
  const mineIds = new Set(shelf.map((x) => x.videoId));
  return members
    .map((m) => {
      const mine = m.clientId === settingsCache.clientId;
      const videos = m.videos || [];
      const seen = videos
        .map((v) => {
          const also = !mine && mineIds.has(v.videoId);
          return `<li>
            <button class="text-btn" data-open="${escAttr(v.videoId)}" data-s="${v.lastSeconds || 0}" type="button">${esc(v.title || v.videoId)}</button>
            <span class="note-meta">${clock(v.lastSeconds || 0)}${also ? ` · ${t("你也看过")}` : ""}</span>
          </li>`;
        })
        .join("");
      return `<article class="buddy-card">
        <div class="lib-kicker">${mine ? t("我") : esc(m.name || t("搭子"))}${m.task ? ` · ${esc(m.task)}` : ""}</div>
        <p class="note-meta">${videos.length} ${t("支看过")}${m.updatedAt ? ` · ${dateText(m.updatedAt)}` : ""}</p>
        ${seen ? `<ul class="buddy-list">${seen}</ul>` : `<p class="note-meta">${t("还没有看过的视频。")}</p>`}
      </article>`;
    })
    .join("");
}

function renderLocalBuddies() {
  if (!buddies.length) return "";
  const mineIds = new Set(shelf.map((x) => x.videoId));
  return buddies
    .map((b) => {
      const theirs = b.videos || [];
      const items = theirs
        .map((v) => {
          const also = mineIds.has(v.videoId);
          return `<li>
            <button class="text-btn" data-open="${escAttr(v.videoId)}" data-s="${v.lastSeconds || 0}" type="button">${esc(v.title)}</button>
            <span class="note-meta">${clock(v.lastSeconds || 0)}${also ? ` · ${t("你也看过")}` : ""}</span>
          </li>`;
        })
        .join("");
      return `<article class="buddy-card">
        <div class="lib-kicker">${esc(b.name)}</div>
        <p class="note-meta">${theirs.length} ${t("支看过")}</p>
        ${items ? `<ul class="buddy-list">${items}</ul>` : ""}
        <button class="text-btn" data-del-buddy="${escAttr(b.id)}" type="button">${t("去掉")}</button>
      </article>`;
    })
    .join("");
}

function renderBuddyPane() {
  const name = esc(settingsCache.buddyName || "");
  const code = settingsCache.kouling || "";
  const lists = [code ? renderGroupMembers() : "", renderLocalBuddies()].filter(Boolean).join("");
  return `<div class="buddy-pane">
    <p class="setup-lead">${t("发给认识的人，看对方看过哪些。")}</p>
    <label class="field"><span>${t("我叫")}</span><input type="text" id="buddyName" value="${name}" maxlength="24" placeholder="${t("怎么称呼你")}" /></label>
    ${code ? `<div class="kouling-box"><p class="kouling-code">${esc(code)}</p><p class="note-meta">${t("把口令发给朋友。对方贴上就能看到你看过哪些。")}</p></div>` : ""}
    <div class="row-actions">
      <button class="btn btn-primary" id="buddyInvite" type="button">${code ? t("再复制给朋友") : t("邀请搭子")}</button>
      ${code ? `<button class="btn" id="koulingLeave" type="button">${t("离开")}</button>` : ""}
    </div>
    <label class="field"><span>${t("朋友发来的口令")}</span><textarea id="koulingJoin" rows="3" placeholder="${t("整段贴在这里")}"></textarea></label>
    <div class="row-actions">
      <button class="btn" id="koulingJoinBtn" type="button">${t("加入")}</button>
    </div>
    ${lists || `<div class="chat-empty">${t("还没有搭子。点邀请，发给微信。")}</div>`}
  </div>`;
}

function bindBuddyPane(root) {
  startKoulingPoll();
  $("buddyInvite")?.addEventListener("click", async () => {
    try {
      await inviteBuddy();
    } catch (error) {
      flashHint(friendlyAiError(error.message, t("复制失败")));
    }
  });
  $("koulingJoinBtn")?.addEventListener("click", async () => {
    try {
      await rememberBuddyMe();
      await joinFromPaste($("koulingJoin")?.value || "");
      flashHint(t("已加入。可以看到对方看过哪些。"));
      renderShelf();
    } catch (error) {
      flashHint(friendlyAiError(error.message, t("这段口令读不出来。让对方再点一次邀请。")));
    }
  });
  $("koulingLeave")?.addEventListener("click", async () => {
    const code = settingsCache.kouling;
    try {
      if (code) await koulingReq({ op: "leave", code, clientId: settingsCache.clientId });
    } catch (_e) {}
    await saveSettings({ kouling: "" });
    await saveGroupSnap(null);
    stopKoulingPoll();
    flashHint(t("已离开。"));
    renderShelf();
  });
  root.querySelectorAll("[data-del-buddy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      buddies = buddies.filter((b) => b.id !== btn.dataset.delBuddy);
      await saveList("vb_buddies", buddies);
      renderShelf();
    });
  });
  bindLibJumps(root);
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
    focusQuestion: atlas.focusQuestion || t("这些视频共同在讲什么？"),
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

function otherLibraryVideos() {
  const ids = new Set([
    ...Object.keys(lib || {}),
    ...(shelf || []).map((s) => s.videoId),
  ]);
  ids.delete(state.videoId);
  return [...ids].filter(Boolean);
}

function otherVideoPayloads() {
  return otherLibraryVideos()
    .slice(0, 8)
    .map((id) => {
      const rec = lib[id];
      const slot = (shelf || []).find((s) => s.videoId === id);
      return {
        videoId: id,
        title: rec?.title || slot?.title || id,
        gist: rec?.gist || "",
        bricks: (rec?.bricks || []).slice(0, 8).map((b) => b.title).filter(Boolean),
      };
    });
}

function seedAtlasFromLib() {
  if (!atlas.concepts) atlas.concepts = [];
  if (!atlas.propositions) atlas.propositions = [];
  let added = false;
  for (const [vid, rec] of Object.entries(lib || {})) {
    const title = rec.title || vid;
    const gist = rec.gist || title;
    const rootId = `v-${vid}`.slice(0, 20);
    if (gist) {
      let root = atlas.concepts.find((c) => c.id === rootId);
      if (!root) {
        root = { id: rootId, label: String(gist).slice(0, 24), level: 0, sources: [] };
        atlas.concepts.push(root);
        added = true;
      }
      if (!root.sources.some((s) => s.videoId === vid)) {
        root.sources.push({ videoId: vid, title, block: -1, seconds: 0 });
        added = true;
      }
    }
    for (const b of rec.bricks || []) {
      const key = normLabel(b.title);
      if (!key || key.length < 2) continue;
      let node = atlas.concepts.find((c) => normLabel(c.label) === key);
      if (!node) {
        node = { id: `a-${key}`.slice(0, 20), label: String(b.title).slice(0, 24), level: 1, sources: [] };
        atlas.concepts.push(node);
        added = true;
      }
      if (!node.sources.some((s) => s.videoId === vid)) {
        node.sources.push({ videoId: vid, title, block: Number.isFinite(Number(b.i)) ? Number(b.i) : -1, seconds: b.start || 0 });
        added = true;
      }
      if (
        atlas.concepts.some((c) => c.id === rootId) &&
        !atlas.propositions.some((p) => p.from === rootId && p.to === node.id)
      ) {
        atlas.propositions.push({ from: rootId, link: "讲到", to: node.id, cross: false });
        added = true;
      }
    }
  }
  if (atlas.concepts.length > 80) atlas.concepts = atlas.concepts.slice(-80);
  if (atlas.propositions.length > 120) atlas.propositions = atlas.propositions.slice(-120);
  if (added) chrome.storage.local.set({ vb_atlas: atlas });
  return added;
}

function atlasHasOthers() {
  return (atlas.concepts || []).some((c) =>
    (c.sources || []).some((s) => s.videoId && s.videoId !== state.videoId),
  );
}

function atlasEmptyReason() {
  if (!otherLibraryVideos().length) return t("库里再看一支，相同的概念才会叠到这里。");
  if (!(atlas.concepts || []).length) return t("两支视频都先打开拆页或图谱，留下知识块，再点「织进总图」。");
  return "";
}

async function weaveAtlas({ quiet = false, force = false } = {}) {
  seedAtlasFromLib();
  const help = $("mapHelp");
  const current = isNovakMap(state.conceptMap) ? state.conceptMap : state.blocks.length ? fallbackConceptMap() : null;
  if (!current && !otherLibraryVideos().length && !(atlas.concepts || []).length) {
    const reason = atlasEmptyReason() || t("先拆出知识块，再织进总图。");
    if (help) help.textContent = reason;
    if (!quiet) flashHint(reason);
    return;
  }
  if (!force && atlasWoveFor === state.videoId) {
    if (!quiet) flashHint("这支已经织过了。再点一次「再织一版」。");
    return;
  }
  if (!quiet && help) help.textContent = t("正在把本视频织进总图…");
  atlasWoveFor = state.videoId;
  const videoId = state.videoId;
  const result = await sendToBg({
    action: "vbAtlas",
    current: current || { concepts: [], propositions: [], focusQuestion: "" },
    atlas,
    title: state.title,
    others: otherVideoPayloads(),
  });
  if (state.videoId !== videoId) return;
  if (!result?.ok) {
    atlasWoveFor = "";
    atlasQuietError = result?.error || t("织图失败");
    seedAtlasFromLib();
    if (help) help.textContent = quiet ? `总图这次没织上：${atlasQuietError}` : atlasQuietError;
    renderMaps();
    return;
  }
  atlasQuietError = "";
  atlas.focusQuestion = result.focusQuestion || atlas.focusQuestion;
  if (!atlas.concepts) atlas.concepts = [];
  if (!atlas.propositions) atlas.propositions = [];
  const byNorm = new Map(atlas.concepts.map((c) => [normLabel(c.label), c]));
  const idAlias = new Map();
  for (const c of result.concepts || []) {
    const key = normLabel(c.label);
    if (!key) continue;
    let node = byNorm.get(key);
    if (node) {
      node.label = c.label || node.label;
      if (Number.isFinite(Number(c.level))) node.level = Number(c.level);
    } else {
      node = {
        id: String(c.id || `a-${key}`).slice(0, 20),
        label: c.label,
        level: Number(c.level) || 1,
        sources: [],
      };
      atlas.concepts.push(node);
      byNorm.set(key, node);
    }
    if (c.id) idAlias.set(c.id, node.id);
  }
  for (const p of result.propositions || []) {
    const from = idAlias.get(p.from) || p.from;
    const to = idAlias.get(p.to) || p.to;
    if (!from || !to || from === to) continue;
    if (!atlas.concepts.some((c) => c.id === from) || !atlas.concepts.some((c) => c.id === to)) continue;
    if (atlas.propositions.some((x) => x.from === from && x.to === to && x.link === p.link)) continue;
    atlas.propositions.push({ from, to, link: p.link, cross: Boolean(p.cross) });
  }
  if (isNovakMap(state.conceptMap)) await mergeAtlasLocal(state.conceptMap);
  else seedAtlasFromLib();
  await chrome.storage.local.set({ vb_atlas: atlas });
  renderMaps();
  echoMarksCache = null;
  echoMarksKey = "";
  refreshTranscriptWhenIdle();
}

async function maybeWeaveAtlas() {
  seedAtlasFromLib();
  if (atlasWoveFor === state.videoId) return;
  if (!otherLibraryVideos().length && !atlasHasOthers()) return;
  await weaveAtlas({ quiet: true });
}

function ensureAtlasReady() {
  seedAtlasFromLib();
  if (!state.conceptMap || !isNovakMap(state.conceptMap)) {
    if (state.blocks.length) loadConceptMap();
  } else {
    maybeWeaveAtlas();
  }
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
      back: blocks[i].summary || t("打开视频对一下"),
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
    back: block.summary || t("打开视频对一下"),
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
  if (state.videoId !== videoId) return;
  if (!result?.ok) {
    state.resumeHint = { ...(state.resumeHint || {}), error: t("续读提示没生成出来，时间还在。") };
    renderResume();
    return;
  }
  state.resumeHint = { where: result.where, stuck: result.stuck, next: result.next };
  saveCache();
  renderResume();
}

async function saveCache() {
  clearTimeout(saveProgressTimer);
  saveProgressTimer = 0;
  if (!state.videoId) return;
  const key = `vb_cache_${state.videoId}`;
  const savedAt = Date.now();
  const payload = {
    title: state.title,
    gist: state.gist,
    blocks: state.blocks,
    dives: state.dives,
    scripts: state.scripts,
    translations: state.translations,
    segments: state.segments,
    chat: state.chat.slice(-30),
    study: state.study,
    lastSeconds: state.lastSeconds,
    progress: state.progress,
    conceptMap: state.conceptMap,
    argMap: state.argMap,
    visuals: state.visuals,
    graphLayout,
    resumeHint: state.resumeHint || null,
    quoteExtracted: Boolean(state.quoteExtracted),
    blocksLang: currentLang(),
    levelScan: state.levelScan || null,
    vocabPreviewDone: Boolean(state.vocabPreviewDone),
    vocabPreviewKey: state.vocabPreviewDone ? `${state.videoId}:${resolveVocabLevel().key}` : "",
    savedAt,
  };
  state._trackAt = savedAt;
  try {
    const idxStore = await chrome.storage.local.get("vb_cache_index");
    let index = [state.videoId, ...(idxStore.vb_cache_index || []).filter((id) => id !== state.videoId)];
    const evicted = index.slice(20);
    index = index.slice(0, 20);
    await chrome.storage.local.set({
      [key]: payload,
      vb_cache_index: index,
      vb_live: {
        videoId: state.videoId,
        title: state.title,
        language: state.language,
        segments: state.segments,
        savedAt,
      },
    });
    if (evicted.length) await chrome.storage.local.remove(evicted.map((id) => `vb_cache_${id}`));
    writeLib(state.videoId, payload);
    await persistLib();
    const slot = shelf.find((x) => x.videoId === state.videoId);
    if (slot) {
      slot.lastSeconds = state.lastSeconds;
      slot.title = state.title || slot.title;
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
  document.body.classList.toggle("setup-open", Boolean(show));
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
    bindVocabBandUI("setup");
    bindVocabTestBtn("setupVocabTest");
  }
}

function showStateBox(emoji, title, sub, retry, showIdea) {
  reviewOnly = false;
  setFocusMode(false);
  $("stateBox").hidden = false;
  $("mainBox").hidden = true;
  $("stateEmoji").textContent = emoji;
  $("stateTitle").textContent = title;
  $("stateSub").textContent = sub || "";
  $("stateRetry").hidden = !retry;
  if ($("ideaBlock")) $("ideaBlock").hidden = !showIdea;
  if ($("stateBy")) $("stateBy").hidden = !showIdea;
  if ($("stateNote")) $("stateNote").hidden = !showIdea;
  if ($("stateVocab")) $("stateVocab").hidden = !showIdea;
  if ($("stateOpen")) {
    $("stateOpen").hidden = false;
    paintStateTabs();
  }
  const due = dueCards().length;
  if ($("stateReview")) $("stateReview").hidden = Boolean(retry) || !due || !showIdea;
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
  $("videoTitle").textContent = t("今日复习");
  if ($("progressMeter")) $("progressMeter").innerHTML = "";
  paintMarkRail();
  if (dueVocabCards().length || (vocab.length && !dueOtherCards().length)) {
    openVocabTab("review");
    return;
  }
  switchView("review");
  renderReview();
}

function isSettingsOpen() {
  return Boolean($("settingsDrawer") && !$("settingsDrawer").hidden);
}

function closeSettings() {
  if ($("settingsDrawer")) $("settingsDrawer").hidden = true;
  document.body.classList.remove("settings-open");
  $("settingsTopBtn")?.classList.remove("on");
  const name = document.querySelector(".view.active")?.dataset.view || "read";
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
}

function openSettings(opts = {}) {
  $("moreMenu") && ($("moreMenu").hidden = true);
  setVocabPop(false);
  setAchievePop(false);
  if ($("themePop")) $("themePop").hidden = true;
  const page = $("settingsDrawer");
  if (!page) return;
  page.hidden = false;
  document.body.classList.add("settings-open");
  $("settingsTopBtn")?.classList.add("on");
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === "settings");
  });
  fillSettingsDrawer();
  if (opts.author || opts.feedback) {
    const note = $("authorCard")?.querySelector("details");
    if (note) note.open = true;
    if (opts.feedback) {
      $("authorMsg")?.scrollIntoView({ block: "nearest" });
      $("authorMsg")?.focus();
    } else {
      $("authorCard")?.scrollIntoView({ block: "nearest" });
    }
  }
}

function toggleSettings() {
  if (isSettingsOpen()) closeSettings();
  else openSettings();
}

function switchView(name) {
  const bar = $("selBar");
  if (bar) bar.hidden = true;
  setMarkFacePopOpen(false);
  if (name === "settings") {
    openSettings();
    return;
  }
  if (name !== "read") setFocusMode(false);
  closeSettings();
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === name);
  });
}

async function changeUiLang(lang) {
  const next = setUiLang(lang);
  if (settingsCache.uiLang === next) {
    document.querySelectorAll("[data-lang-picker]").forEach((el) => fillLangPicker(el, next));
    return;
  }
  await saveSettings({ uiLang: next });
  if (state.blocks.length) {
    const sample = `${state.blocks[0].title || ""} ${state.blocks[0].summary || ""}`;
    const staleEn = next.startsWith("zh") && !/[\u4e00-\u9fff]/.test(sample) && /[A-Za-z]{4,}/.test(sample);
    if (staleEn) {
      state.blocks = [];
      state.gist = "";
      state.dives = {};
      state.study = null;
      saveCacheSoon(200);
    }
  }
  refreshI18nChrome();
}

function refreshI18nChrome() {
  applyDomI18n(document);
  document.querySelectorAll("[data-lang-picker]").forEach((el) => fillLangPicker(el, currentLang()));
  paintThemeChrome();
  paintVocabChrome();
  paintVocabBand("setup", settingsCache.vocabBand || "off");
  paintVocabBand("pop", settingsCache.vocabBand || "off");
  paintVocabBand("state", settingsCache.vocabBand || "off");
  if (!$("tutorial")?.hidden) renderTutorial();
  if (!$("settingsDrawer")?.hidden) fillSettingsDrawer();
  if ($("achievePop") && !$("achievePop").hidden) renderAchievePop();
  updateLoopBtn();
  paintRateControls();
  if (!$("mainBox")?.hidden) {
    paintMarkRail({ forcePins: true });
    if (markNearId) showMarkCard(markNearId);
    renderBrickBar();
    renderBrickList();
    renderStudy();
    renderNotes();
    if (typeof renderVocabPage === "function") {
      try {
        renderVocabPage();
      } catch (_e) {}
    }
    if (typeof renderReview === "function") {
      try {
        renderReview();
      } catch (_e) {}
    }
  }
}

const AUTHOR_NOTE = [
  "Kaizen 的意思是改善。改是看见自己的不足，就动手改。善是改完之后，往更好的方向去。",
  "念作 kai-zen。这个词本来是工厂和公司里的说法：不指望一次巨大的颠覆，而是每个人每天在手边的事上改一点，攒下来就是质的变化。",
  "我们看了太多内容，更多是在囤积，很少真正内化成自己的东西。",
  "做这个插件，是希望自己能打破语言的墙，也把一些深的、偏长的内容，拆成更容易懂的短块。",
  "希望大家不断地精进自己、改善自己。这个工具有什么好的建议，可以留言，也可以微信找我。",
];

function authorNoteHtml(open = false) {
  const paras = AUTHOR_NOTE.map((line) => `<p>${t(line)}</p>`).join("");
  return `<details class="author-note"${open ? " open" : ""}>
    <summary>${t("作者的话")}</summary>
    <div class="author-note-body">${paras}</div>
  </details>`;
}

function authorBlockHtml(kind = "foot") {
  const wx = `<button type="button" class="made-wechat" data-copy-wechat title="${t("点击复制微信号")}">942966642</button>`;
  if (kind === "card") {
    return `<section class="author-card" id="authorCard">
      <div class="lib-kicker">${t("作者")}</div>
      <p class="author-made">Made by CharlieLam</p>
      <p class="author-wx">${t("微信")} ${wx}</p>
      ${authorNoteHtml()}
      <section class="author-feedback">
        <div class="lib-kicker">${t("留言")}</div>
        <p class="setup-lead">${t("写好后可以发到 GitHub，我在仓库 Issues 里看。不想公开就复制去微信。")}</p>
        <textarea id="authorMsg" rows="4" data-i18n-placeholder="哪里不好用，或想加什么…" placeholder="${t("哪里不好用，或想加什么…")}"></textarea>
        <div class="drawer-actions" style="margin-top:8px">
          <button id="authorMsgGit" class="btn btn-primary" type="button">${t("发到 GitHub")}</button>
          <button id="authorMsgCopy" class="btn" type="button">${t("复制去微信")}</button>
          <a class="text-btn" href="https://github.com/CharlieLam2025/Kaizen/issues" target="_blank" rel="noreferrer">${t("查看留言")}</a>
        </div>
        <p class="setup-lead" id="authorMsgHint" style="margin-top:8px"></p>
      </section>
    </section>`;
  }
  return `<p class="made-by">Made by CharlieLam<br>${t("微信")} ${wx}</p>${authorNoteHtml()}`;
}

async function copyWechat(btn) {
  try {
    await navigator.clipboard.writeText("942966642");
    btn.textContent = t("已复制");
    setTimeout(() => {
      if (btn.hasAttribute("data-copy-wechat")) btn.textContent = "942966642";
    }, 1200);
  } catch (_e) {
    flashHint(t("复制失败"));
  }
}

function openAuthorCard(focusMsg = false) {
  openSettings({ author: !focusMsg, feedback: focusMsg });
}

function fillSettingsDrawer() {
  const keep = {
    key: $("setKey")?.value,
    supa: $("setSupadata")?.value,
    base: $("setBase")?.value,
    kouling: $("setKoulingUrl")?.value,
    msg: $("authorMsg")?.value,
    captionsOnly: $("setCaptionsOnly")?.checked,
  };
  $("settingsDrawer").innerHTML = `
    <div class="settings-head">
      <h2>${t("设置")}</h2>
      <button id="settingsClose" class="text-btn" type="button">${t("返回")}</button>
    </div>
    <div class="field lang-field"><span>${t("界面语言")}</span><div id="setUiLang" class="lang-picker" data-lang-picker></div></div>
    <p class="setup-lead">${t("DeepSeek 用来拆解和查词。字幕优先用视频自己的；YouTube 没有原生字幕时再填 Supadata。")}</p>
    <label class="field"><span>DeepSeek API Key</span><input type="password" id="setKey" /></label>
    <label class="field"><span>Supadata API Key</span><input type="password" id="setSupadata" /></label>
    <p class="setup-lead">${t("日常和拆解可以分开选。Flash 快，Pro 更稳。")}</p>
    <label class="field"><span>${t("日常 · 翻译、提问、分块、做成图")}</span>
      <input type="hidden" id="setModel" />
      <div class="seg-toggle model-switch" id="setModelSwitch">
        <button type="button" class="seg-btn" data-m="deepseek-v4-flash">Flash</button>
        <button type="button" class="seg-btn" data-m="deepseek-v4-pro">Pro</button>
      </div>
    </label>
    <label class="field"><span>${t("拆解和长笔记")}</span>
      <input type="hidden" id="setDiveModel" />
      <div class="seg-toggle model-switch" id="setDiveSwitch">
        <button type="button" class="seg-btn" data-m="deepseek-v4-flash">Flash</button>
        <button type="button" class="seg-btn" data-m="deepseek-v4-pro">Pro</button>
      </div>
    </label>
    <label class="field"><span>${t("接口地址")}</span><input type="text" id="setBase" /></label>
    <p class="setup-lead">${t("英语大概到哪。用来从字幕里筛可能还不熟的词，不是官方考纲。")}</p>
    <div class="field"><span>${t("外观")}</span>
      <div class="theme-grid" id="setThemeGrid">${themeCardsHtml("data-set-theme", settingsCache.uiTheme || "paper")}</div>
    </div>
    <div class="band-toggle" id="setVocabBand">${vocabBandButtons()}</div>
    <label class="field" id="setVocabScoreWrap" hidden>
      <span id="setVocabScoreLabel">${t("总分（选填）")}</span>
      <input type="text" id="setVocabScore" inputmode="decimal" placeholder="${t("例如 6.5")}" />
    </label>
    <button id="setVocabTest" class="text-btn" type="button">${t("测一下词汇量")}</button>
    <div id="setWordPacks" class="wordpack-box"></div>
    <label class="field check"><span><input type="checkbox" id="setCaptionsOnly" ${captionsOnlyMode() ? "checked" : ""} /> ${t("只要字幕")}</span></label>
    <p class="setup-lead">${t("打开后不自动拆页或做学习包。双语仍会开着，点「原文」才不译。")}</p>
    <label class="field check switch"><span><input type="checkbox" id="setLiveCc" ${settingsCache.liveCc ? "checked" : ""} /> ${t("片上字幕条")}</span></label>
    <p class="setup-lead">${t("打开后，系统字幕会淡出，改由画面按播放头跟上这一句。点词可查可存，点「跳这句」会跟侧栏对齐。")}</p>
    <div class="field" id="setLiveStyle">
      <span>${t("片上字幕样式")}</span>
      <div class="live-style-row">
        <button type="button" class="icon-btn" id="setLiveSmaller" title="${t("字号减小")}">A−</button>
        <span id="setLiveSizeLabel">${liveCcSizeOf(settingsCache.liveCcSize)}</span>
        <button type="button" class="icon-btn" id="setLiveBigger" title="${t("字号增大")}">A+</button>
        <div class="seg-toggle" id="setLiveFont">
          <button type="button" class="seg-btn" data-font="sans">${t("无衬线")}</button>
          <button type="button" class="seg-btn" data-font="serif">${t("衬线")}</button>
          <button type="button" class="seg-btn" data-font="round">${t("圆体")}</button>
          <button type="button" class="seg-btn" data-font="mono">${t("等宽")}</button>
        </div>
        <button type="button" class="btn" id="setCopyTranscript">${t("复制全文")}</button>
      </div>
    </div>
    <div class="drawer-actions" style="margin-top:8px">
      <button id="settingsSave" class="btn btn-primary" type="button">${t("保存")}</button>
      <span id="settingsSaved" hidden style="color:#3aa06a;margin-left:8px">${t("已保存")}</span>
    </div>
    ${keysTableHtml()}
    <p class="setup-lead" style="margin-top:12px">${t("顶栏「导出」会打开当前视频的排版页。生词可以单独下 Markdown 或 Anki。下面是整机备份：笔记、生词、复习卡、知识库和设置（含 Key）。换电脑或重装前先导出。")}</p>
    <div class="drawer-actions" style="margin-top:8px">
      <button id="backupExport" class="btn" type="button">${t("导出全部数据")}</button>
      <button id="backupImport" class="btn" type="button">${t("导入恢复")}</button>
      <button id="vocabMdExport" class="btn" type="button">${t("生词本导出 Markdown")}</button>
      <button id="ankiExport" class="btn" type="button">${t("生词本导出 Anki")}</button>
      <button id="extReload" class="btn" type="button" title="Alt+R">${t("重载扩展")} · Alt+R</button>
    </div>
    <input type="file" id="backupFile" accept="application/json" hidden />
    <p class="setup-lead" id="backupHint" style="margin-top:8px"></p>
    <details class="author-note">
      <summary>${t("小组同步（选填，大众不用管）")}</summary>
      <label class="field"><span>${t("同步地址")}</span><input type="url" id="setKoulingUrl" placeholder="https://kaizen-kouling.xxx.workers.dev" /></label>
    </details>
    <p class="setup-foot" style="margin-top:10px">
      <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">申请 DeepSeek</a>
      ·
      <a href="https://dash.supadata.ai/auth/sign-up" target="_blank" rel="noreferrer">申请 Supadata</a>
      ·
      <a href="https://github.com/CharlieLam2025/Kaizen/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">${t("隐私说明")}</a>
      ·
      <a href="https://github.com/CharlieLam2025/Kaizen/issues" target="_blank" rel="noreferrer">Issues</a>
    </p>
    ${authorBlockHtml("card")}
  `;
  $("settingsClose")?.addEventListener("click", () => closeSettings());
  fillLangPicker($("setUiLang"), currentLang());
  $("setKey").value = keep.key != null ? keep.key : settingsCache.apiKey || "";
  $("setSupadata").value = keep.supa != null ? keep.supa : settingsCache.supadataKey || "";
  $("setBase").value = keep.base != null ? keep.base : settingsCache.baseUrl || "";
  $("setModel").value = settingsCache.model || "deepseek-v4-flash";
  $("setDiveModel").value = settingsCache.diveModel || "deepseek-v4-pro";
  if ($("setKoulingUrl")) $("setKoulingUrl").value = keep.kouling != null ? keep.kouling : settingsCache.koulingUrl || "";
  if ($("authorMsg") && keep.msg != null) $("authorMsg").value = keep.msg;
  if ($("setCaptionsOnly") && keep.captionsOnly != null) $("setCaptionsOnly").checked = keep.captionsOnly;
  bindVocabBandUI("set");
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
  $("settingsDrawer")?.querySelectorAll("[data-set-theme]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveSettings({ uiTheme: btn.dataset.setTheme, cardTpl: themeCardTpl(btn.dataset.setTheme) });
      fillSettingsDrawer();
    });
  });
  $("setVocabTest")?.addEventListener("click", () => openVocabTest());
  paintWordPackBoxes();
  $("setLiveCc")?.addEventListener("change", async () => {
    await saveSettings({ liveCc: Boolean($("setLiveCc").checked) });
    flashHint($("setLiveCc").checked ? t("片上字幕条已打开") : t("片上字幕条已关掉"));
    if ($("setLiveCc").checked) checkAchievementsSoon("live");
  });
  paintLiveStyleSettings();
  $("setLiveSmaller")?.addEventListener("click", async () => {
    const next = liveCcSizeOf((Number(settingsCache.liveCcSize) || 16) - 1);
    if (next === liveCcSizeOf(settingsCache.liveCcSize)) {
      flashHint(t("已经最小。"));
      return;
    }
    await saveSettings({ liveCcSize: next });
    paintLiveStyleSettings();
  });
  $("setLiveBigger")?.addEventListener("click", async () => {
    const next = liveCcSizeOf((Number(settingsCache.liveCcSize) || 16) + 1);
    if (next === liveCcSizeOf(settingsCache.liveCcSize)) {
      flashHint(t("已经最大。"));
      return;
    }
    await saveSettings({ liveCcSize: next });
    paintLiveStyleSettings();
  });
  $("setLiveFont")?.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await saveSettings({ liveCcFont: liveCcFontOf(btn.dataset.font) });
      paintLiveStyleSettings();
    });
  });
  $("setCopyTranscript")?.addEventListener("click", () => copyAllTranscript());
  $("settingsSave").addEventListener("click", async () => {
    const next = {
      apiKey: $("setKey").value.trim(),
      supadataKey: $("setSupadata").value.trim(),
      baseUrl: $("setBase").value.trim() || "https://api.deepseek.com/v1",
      model: $("setModel").value || "deepseek-v4-flash",
      diveModel: $("setDiveModel").value || "deepseek-v4-pro",
      uiLang: currentLang(),
      uiTheme: settingsCache.uiTheme || "paper",
      captionsOnly: Boolean($("setCaptionsOnly")?.checked),
      liveCcSize: liveCcSizeOf(settingsCache.liveCcSize),
      liveCcFont: liveCcFontOf(settingsCache.liveCcFont),
      ...readVocabSettings("set"),
      koulingUrl: $("setKoulingUrl")?.value.trim() || "",
    };
    await saveSettings(next);
    state.levelScan = null;
    state.vocabPreviewDone = false;
    vocabCardIndex = 0;
    if (resolveVocabLevel().id !== "off" && state.segments.length) scanVideoVocab({ force: true });
    paintVocabChrome();
    if (!keysReady()) {
      $("settingsSaved").hidden = true;
      closeSettings();
      showSetup(true);
      if ($("setupLead")) $("setupLead").textContent = t("先填 DeepSeek Key。字幕优先用视频自己的。");
      return;
    }
    const ping = await sendToBg({
      action: "vbPingKeys",
      apiKey: next.apiKey,
      supadataKey: next.supadataKey,
      baseUrl: next.baseUrl,
    }).catch(() => null);
    const bits = [];
    if (ping?.deepseek && !ping.deepseek.ok) bits.push(t("DeepSeek Key 连不上") + (ping.deepseek.error ? `：${ping.deepseek.error}` : ""));
    if (ping?.supadata && !ping.supadata.ok && !ping.supadata.skipped) {
      bits.push(t("Supadata Key 连不上") + (ping.supadata.error ? `：${ping.supadata.error}` : ""));
    }
    $("settingsSaved").hidden = false;
    $("settingsSaved").textContent = bits.length ? bits.join(" · ") : t("已保存");
    $("settingsSaved").style.color = bits.length ? "#b42318" : "#3aa06a";
    flashHint(bits.length ? bits.join(" · ") : t("设置已保存"));
    setTimeout(() => ($("settingsSaved").hidden = true), 2400);
  });
  $("backupExport")?.addEventListener("click", exportAllData);
  $("backupImport")?.addEventListener("click", () => $("backupFile")?.click());
  $("backupFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await importAllData(file);
  });
  $("vocabMdExport")?.addEventListener("click", () => exportVocabMarkdown("all"));
  $("ankiExport")?.addEventListener("click", () => exportVocabAnki("all"));
  $("extReload")?.addEventListener("click", () => sendToBg({ action: "vbReload" }));
  bindAuthorFeedback();
}

function authorMessageText() {
  return $("authorMsg")?.value.trim() || "";
}

function setAuthorMsgHint(text) {
  const el = $("authorMsgHint");
  if (el) el.textContent = text || "";
}

function bindAuthorFeedback() {
  $("authorMsgGit")?.addEventListener("click", () => {
    const text = authorMessageText();
    if (!text) {
      setAuthorMsgHint(t("先写一句。"));
      return;
    }
    const title = `Kaizen ${t("留言")} · ${text.slice(0, 36)}`;
    const body = `${text}\n\n---\n来自 Kaizen 侧栏 · ${dateText(Date.now())}`;
    const url = `https://github.com/CharlieLam2025/Kaizen/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    chrome.tabs.create({ url });
    setAuthorMsgHint(t("已打开 GitHub。登录后点 Create，我就能在 Issues 里看到。"));
  });
  $("authorMsgCopy")?.addEventListener("click", async () => {
    const text = authorMessageText();
    if (!text) {
      setAuthorMsgHint(t("先写一句。"));
      return;
    }
    try {
      await navigator.clipboard.writeText(`Kaizen ${t("留言")}\n${text}`);
      setAuthorMsgHint(t("已复制。打开微信发给 942966642 即可。"));
    } catch (_e) {
      setAuthorMsgHint(t("复制失败"));
    }
  });
}

// ---------- tutorial ----------

function clearTutSpot() {
  document.querySelectorAll(".tut-spot").forEach((el) => el.classList.remove("tut-spot"));
}

function renderTutorial() {
  const step = TUTORIAL[tutIndex];
  if (!step) return;
  $("tutKicker").textContent = step.kicker
    ? `${t(step.kicker)} · ${tutIndex + 1} / ${TUTORIAL.length}`
    : `${tutIndex + 1} / ${TUTORIAL.length}`;
  $("tutTitle").textContent = t(step.title);
  $("tutBody").textContent = [t(step.body), step.more ? t(step.more) : ""].filter(Boolean).join("");
  $("tutNext").textContent = tutIndex === TUTORIAL.length - 1 ? t("开始用") : t("下一步");
  $("tutPrev").hidden = tutIndex === 0 || TUTORIAL.length === 1;
  $("tutDots").innerHTML =
    TUTORIAL.length > 1
      ? TUTORIAL.map(
          (_, i) =>
            `<button type="button" class="tut-dot${i === tutIndex ? " on" : ""}" data-tut="${i}" aria-label="第 ${i + 1} 步"></button>`,
        ).join("")
      : "";
  $("tutDots")
    .querySelectorAll("[data-tut]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        tutIndex = Number(btn.dataset.tut);
        renderTutorial();
      });
    });
  clearTutSpot();
  if (step.view && !$("mainBox").hidden && step.view === "read") switchView("read");
  if (step.spot && !$("mainBox").hidden) {
    document.querySelectorAll(step.spot).forEach((el) => el.classList.add("tut-spot"));
  }
}

const TUTORIAL_REV = 9;

async function maybeStartTutorial() {
  if (!$("setupGate").hidden) return;
  if ($("mainBox") && !$("mainBox").hidden && state.segments.length) return;
  const flags = await chrome.storage.local.get(["vb_tutorial_done", "vb_tutorial_rev"]);
  if (flags.vb_tutorial_rev === TUTORIAL_REV) return;
  openTutorial(true);
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
  await chrome.storage.local.set({ vb_tutorial_done: true, vb_tutorial_rev: TUTORIAL_REV });
}

function friendlyAiError(raw, fallback) {
  const e = String(raw || "").trim();
  if (/还没有配置|NO_KEY|Key 无效|401|invalid api/i.test(e)) return t("钥匙无效或还没填，去设置里看一下。");
  if (/402|insufficient|balance|额度|欠费/i.test(e)) return t("DeepSeek 额度不够了，去官网看一下余额。");
  if (/429|too many|频繁/i.test(e)) return t("请求太密了，等几秒再试。");
  if (/超时|timeout|Failed to fetch|network|网络/i.test(e)) return t("网络卡住了，点重试。");
  if (/登录/.test(e)) return t("B 站字幕要先登录。打开这支视频确认能出字幕，再点重试。");
  if (/没有原生字幕|没有可用字幕|字幕是空/.test(e)) return t("这支视频没有可用字幕。");
  if (/翻译结果为空/.test(e)) return t("这批没翻出来，点重试。");
  if (/JSON|Unexpected token|Expected '|Expected "|position \d+|不是 JSON|格式乱了/i.test(e)) {
    return t("模型这次吐出来的格式乱了，再试一次。");
  }
  if (/[\u4e00-\u9fff]/.test(e) && e.length < 48 && !/Error|Exception|stack/i.test(e)) return e;
  return fallback || t("这一步没做成，点重试。");
}

function friendlyTranscriptError(raw) {
  const e = String(raw || "").trim();
  if (/429|limit[- ]?exceeded|额度用完|quota/i.test(e)) return t("字幕额度用完了");
  if (/401|Key 无效|invalid api|unauthorized/i.test(e)) return t("字幕 Key 无效，去设置里看一下。");
  if (/206|没有原生字幕|没有可用字幕|无字幕轨|字幕是空/i.test(e)) return t("这支视频没有可用字幕。");
  if (/超时|timeout/i.test(e)) return t("打开字幕超时了，点重试。");
  if (/412|拒绝了这次访问/i.test(e)) return t("B 站拒绝了这次访问，稍后重试");
  if (/登录/.test(e)) return t("B 站字幕要先登录。打开这支视频确认能出字幕，再点重试。");
  return friendlyAiError(raw, t("暂时读不到字幕。点重试。"));
}

function looksLikeFailedZh(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/翻译失败|筛词失败|拆块失败|额度不够|钥匙无效/.test(t)) return true;
  if (!looksZh(t) && t.length > 20 && /(error|exception|failed|request|api key)/i.test(t)) return true;
  return false;
}

function nearestPlayRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return 1;
  let best = PLAY_RATES[0];
  let dist = Math.abs(n - best);
  for (const r of PLAY_RATES) {
    const d = Math.abs(n - r);
    if (d < dist) {
      best = r;
      dist = d;
    }
  }
  return best;
}

function rateLabel(rate) {
  const n = Number(rate);
  return Number.isInteger(n) ? `${n}×` : `${n}×`;
}

function rateButtonsHtml(id) {
  return `<span class="seg-toggle rate-toggle" id="${id}">
    ${PLAY_RATES.map(
      (r) =>
        `<button type="button" class="seg-btn${playbackRate === r ? " active" : ""}" data-rate="${r}">${rateLabel(r)}</button>`,
    ).join("")}
  </span>`;
}

function paintRateControls() {
  const sel = $("rateSelect");
  if (sel) sel.value = String(playbackRate);
  document.querySelectorAll(".rate-toggle [data-rate]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.rate) === playbackRate);
  });
}

function applyPlayRate(rate, persist = true) {
  const next = nearestPlayRate(rate);
  playbackRate = next;
  sendToTabSure({ type: "VB_RATE", rate: next });
  if (persist) {
    if (state.shadowing) {
      shadowRate = next;
      saveSettings({ shadowRate: next });
    } else {
      watchRate = next;
      saveSettings({ playRate: next });
    }
  }
  paintRateControls();
}

function dateText(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function setBackupHint(text) {
  const el = $("backupHint");
  if (el) el.textContent = text || "";
}

async function exportAllData() {
  try {
    const indexStore = await chrome.storage.local.get("vb_cache_index");
    const cacheKeys = (indexStore.vb_cache_index || []).map((id) => `vb_cache_${id}`);
    const keys = [
      "vb_settings",
      "vb_highlights",
      "vb_notes",
      "vb_vocab",
      "vb_marks",
      "vb_quotes",
      "vb_cards",
      "vb_shelf",
      "vb_atlas",
      "vb_lib",
      "vb_buddies",
      "vb_cache_index",
      "vb_tutorial_done",
      "vb_tutorial_rev",
      ...cacheKeys,
    ];
    const stored = await chrome.storage.local.get(keys);
    downloadText(
      `kaizen-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ kind: "kaizen-backup", version: 1, exportedAt: Date.now(), data: stored }, null, 2),
      "application/json",
    );
    setBackupHint("已下载备份。文件在你自己手上，请收好。");
    flashHint("已导出全部数据");
  } catch (error) {
    setBackupHint(friendlyAiError(error.message, t("备份没做成，再试一次。")));
  }
}

async function importAllData(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.kind === "kaizen-backup" ? parsed.data : parsed?.data || parsed;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(t("这不是 Kaizen 备份文件。"));
    }
    if (!window.confirm(t("导入会覆盖这台电脑上现有的笔记、生词、书签、复习卡和设置。确定？"))) return;
    await chrome.storage.local.set(data);
    setBackupHint("已恢复。正在重新打开…");
    flashHint("已恢复备份");
    location.reload();
  } catch (error) {
    setBackupHint(friendlyAiError(error.message, t("这份备份读不出来。")));
  }
}

function vocabGlossOf(v) {
  const def = v?.definition;
  if (!def) return "";
  if (def.meaning) return String(def.meaning);
  const sense = (def.senses || [])[0];
  if (!sense) return "";
  return [sense.zh, sense.en].filter(Boolean).join(" / ");
}

function pickVocab(scope = "auto") {
  if (scope === "all") return vocab.slice();
  const here = vocabForThisVideo();
  if (scope === "video") return here;
  if (vocabScope === "all") return vocab.slice();
  return here.length ? here : vocab.slice();
}

function exportFileBase(title) {
  return `Kaizen-${String(title || t("生词")).replace(/[\\/:*?"<>|]/g, "").slice(0, 42)}`;
}

function vocabExportTitle(list) {
  const here = vocabForThisVideo();
  const videoOnly =
    here.length && list.length === here.length && list.every((v) => vocabHasVideo(v, state.videoId));
  return videoOnly ? `${state.title || t("未命名视频")} · ${t("生词")}` : t("生词本");
}

function exportVocabMarkdown(scope = "auto") {
  const list = pickVocab(scope);
  if (!list.length) {
    setBackupHint(t("生词本还是空的。"));
    flashHint(t("生词本还是空的"));
    return;
  }
  const title = vocabExportTitle(list);
  const lines = [`# ${title}`, "", `${dateText(Date.now())} · ${list.length} ${t("个生词")}`, ""];
  for (const v of list) {
    lines.push(`## ${v.word || ""}`);
    const gloss = vocabGlossOf(v);
    if (gloss) lines.push(gloss);
    const sources = vocabSources(v);
    for (const src of sources.length ? sources : [{ sentence: v.sentence, videoTitle: v.videoTitle, seconds: v.seconds }]) {
      if (src.sentence) lines.push(`> ${String(src.sentence).replace(/\s+/g, " ")}`);
      const meta = [src.videoTitle, Number.isFinite(Number(src.seconds)) ? clock(src.seconds) : ""]
        .filter(Boolean)
        .join(" · ");
      if (meta) lines.push(meta);
    }
    lines.push("");
  }
  downloadText(`${exportFileBase(title)}.md`, lines.join("\n").trim() + "\n", "text/markdown");
  setBackupHint(t("已导出生词 Markdown。"));
  flashHint(t("已导出生词"));
}

function exportVocabAnki(scope = "auto") {
  const list = pickVocab(scope);
  if (!list.length) {
    setBackupHint(t("生词本还是空的。"));
    flashHint(t("生词本还是空的"));
    return;
  }
  const rows = [["Front", "Back", "Sentence", "Source", "Time"]];
  for (const v of list) {
    const sources = vocabSources(v);
    const src = sources[0] || {};
    rows.push([
      v.word || "",
      vocabGlossOf(v),
      String(src.sentence || v.sentence || "").replace(/\s+/g, " "),
      sources.map((s) => s.videoTitle).filter(Boolean).join(" / ") || v.videoTitle || "",
      sources.map((s) => clock(s.seconds || 0)).join(" / ") || clock(v.seconds || 0),
    ]);
  }
  const tsv = rows
    .map((row) => row.map((cell) => String(cell).replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    .join("\n");
  downloadText(`${exportFileBase(vocabExportTitle(list))}.tsv`, tsv, "text/tab-separated-values");
  setBackupHint(t("已下载 TSV。Anki 里用「文件 → 导入」，字段对上 Front / Back 即可。"));
  flashHint(t("已导出生词本"));
}

function exportQuotesMarkdown() {
  const rows = videoQuotes();
  if (!rows.length) {
    flashHint(t("这篇还没有金句"));
    return;
  }
  const title = `${state.title || t("未命名视频")} · ${t("金句")}`;
  const lines = [`# ${title}`, "", `${dateText(Date.now())} · ${rows.length} ${t("条金句")}`, ""];
  for (const q of rows) {
    const { en, zh } = quotePairText(q);
    lines.push(`## ${clock(q.seconds || 0)}`);
    if (en) lines.push(en);
    if (zh) lines.push(zh);
    if (!en && !zh && q.text) lines.push(q.text);
    if (q.take) lines.push(`${t("理解")}：${q.take}`);
    lines.push("");
  }
  downloadText(`${exportFileBase(title)}.md`, lines.join("\n").trim() + "\n", "text/markdown");
  flashHint(t("已导出金句"));
}

function transcriptPlainText() {
  const mode = state.transcriptMode || preferredTranscriptMode();
  const lines = [];
  const title = String(state.title || "").trim();
  if (title) lines.push(title, "");
  for (const [i, seg] of state.segments.entries()) {
    const raw = String(seg.text || "").trim();
    const zh = translationAt(i);
    const time = clock(seg.start);
    if (mode === "zh") {
      if (zh || raw) lines.push(`${time}  ${zh || raw}`);
      continue;
    }
    if (mode === "bilingual") {
      if (raw) lines.push(`${time}  ${raw}`);
      if (zh) lines.push(zh);
      else if (raw) lines.push("");
      continue;
    }
    if (raw) lines.push(`${time}  ${raw}`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function copyAllTranscript() {
  const text = transcriptPlainText();
  if (!text) {
    flashHint(t("还没有字幕。"));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("copyTranscriptBtn");
    if (btn) {
      btn.textContent = t("已复制");
      clearTimeout(btn._copied);
      btn._copied = setTimeout(() => {
        btn.textContent = t("复制全文");
      }, 1400);
    }
    flashHint(t("已复制全部字幕"));
  } catch (_e) {
    flashHint(t("复制失败"));
  }
}

function exportNotesMarkdown() {
  const rows = notes.filter((n) => !state.videoId || n.videoId === state.videoId);
  if (!rows.length) {
    flashHint(t("这篇还没有笔记"));
    return;
  }
  const title = `${state.title || t("未命名视频")} · ${t("笔记")}`;
  const lines = [`# ${title}`, "", `${dateText(Date.now())} · ${rows.length} ${t("条笔记")}`, ""];
  for (const n of rows) {
    lines.push(`## ${clock(n.seconds || 0)}`);
    if (n.quote) lines.push(`> ${n.quote}`);
    if (n.text) lines.push(n.text);
    lines.push("");
  }
  downloadText(`${exportFileBase(title)}.md`, lines.join("\n").trim() + "\n", "text/markdown");
  flashHint(t("已导出笔记"));
}

function currentView() {
  const tab = document.querySelector(".view-tab.active");
  const name = tab?.dataset.view;
  if (name && name !== "settings") return name;
  return document.querySelector(".view.active")?.dataset.view || "read";
}

function hydrateVideoState(videoId, tabTitle, src, cached) {
  resetTranscriptCaches();
  brickKind = "all";
  const level = resolveVocabLevel();
  const cachedScan = cached?.levelScan;
  Object.assign(state, {
    videoId,
    title: src.title || cached?.title || tabTitle || "",
    language: src.language || cached?.language || "",
    segments: src.segments || [],
    gist: cached?.gist || "",
    blocks: cached?.blocks || [],
    selectedBlock: -1,
    dives: cached?.dives || {},
    scripts: cached?.scripts || {},
    translations: { ...(cached?.translations || {}), ...(src.translations || {}) },
    transcriptMode: preferredTranscriptMode(),
    chat: cached?.chat || [],
    askContext: null,
    study: cached?.study || null,
    lastSeconds: cached?.lastSeconds || 0,
    loopIndex: -1,
    lineLoop: -1,
    loopSpan: null,
    shadowing: false,
    shadowGap: settingsCache.shadowGap !== false,
    shadowGapSec: 1.6,
    progress: cached?.progress || {},
    conceptMap: isNovakMap(cached?.conceptMap) ? cached.conceptMap : null,
    argMap: cached?.argMap || null,
    visuals: cached?.visuals || {},
    scriptStudio: -1,
    resumeHint: cached?.resumeHint || null,
    quoteExtracted: Boolean(cached?.quoteExtracted),
    quoteError: "",
    levelScan: cachedScan && cachedScan.key === `${videoId}:${level.key}` ? cachedScan : null,
    vocabPreviewDone: Boolean(cached?.vocabPreviewDone && cached?.vocabPreviewKey === `${videoId}:${level.key}`),
    translateFailed: {},
    translateTries: {},
  });
  playbackRate = nearestPlayRate(settingsCache.playRate);
  watchRate = playbackRate;
  graphLayout = cached?.graphLayout && typeof cached.graphLayout === "object" ? { ...cached.graphLayout } : {};
  graphFocusId = "";
  openGraphId = "";
  mapPick = null;
  vizPick = null;
  quoteRailOpen = false;
  brickMoreOpen = -1;
  vocabCardIndex = 0;
  let zhDirty = false;
  Object.keys(state.translations || {}).forEach((k) => {
    const raw = state.translations[k];
    const cleaned = cleanZh(raw);
    const src = state.segments[Number(k)]?.text;
    if (!isRealTranslation(cleaned, src)) {
      delete state.translations[k];
      zhDirty = true;
      return;
    }
    if (cleaned !== raw) {
      state.translations[k] = cleaned;
      zhDirty = true;
    }
  });
  const uiLang = currentLang();
  const sample = `${cached?.blocks?.[0]?.title || ""} ${cached?.blocks?.[0]?.summary || ""}`;
  const staleEn =
    uiLang.startsWith("zh") &&
    cached?.blocks?.length &&
    !/[\u4e00-\u9fff]/.test(sample) &&
    /[A-Za-z]{4,}/.test(sample);
  if ((cached?.blocksLang && cached.blocksLang !== uiLang) || (!cached?.blocksLang && staleEn)) {
    state.blocks = [];
    state.gist = "";
    state.dives = {};
    state.study = null;
    state.resumeHint = null;
  }
  if (zhDirty) saveCacheSoon(400);
  if (state.quoteExtracted && !quotes.some((q) => q.videoId === videoId)) {
    state.quoteExtracted = false;
  }
  conceptMapFallback = false;
  argMapFallback = false;
  atlasQuietError = "";
  sendToTab({ type: "VB_LOOP_CLEAR" });
}

function paintOpenedVideo() {
  const videoId = state.videoId;
  showMain();
  const echo = $("echoBox");
  if (echo) {
    echo.hidden = true;
    echo.innerHTML = "";
  }
  const rail = $("quoteRail");
  if (rail) {
    rail.dataset.open = "0";
    rail.hidden = true;
    rail.innerHTML = "";
  }
  $("videoTitle").textContent = state.title;
  rememberWatchResume(state.videoId, state.lastSeconds);
  paintMarkRail({ forcePins: true });
  upsertShelf({
    videoId: state.videoId,
    title: state.title,
    lastSeconds: state.lastSeconds,
  });
  const needZh =
    state.transcriptMode !== "original" &&
    state.segments.some((_, i) => !translationAt(i));
  if (needZh) isTranslating = true;
  paintView(currentView());
  if (state.tabId) ensureContentScript(state.tabId).catch(() => {});
  if (pendingSeek?.videoId === videoId && Number.isFinite(Number(pendingSeek.seconds))) {
    state.lastSeconds = Number(pendingSeek.seconds);
    seek(state.lastSeconds);
    pendingSeek = null;
  }
  if (state.lastSeconds >= 20 && !state.resumeHint?.where && !state.resumeHint?.error && !captionsOnlyMode()) {
    loadResumeHint();
  }
  if (needZh) translateAll();
  renderTranslateBar();
  applyPlayRate(playbackRate, false);
  queueBackgroundWork(videoId);
  flushPendingHotkey();
  if (state.tabId) {
    void sendToTabSure({ type: "VB_VIDEO_INFO" }).then((info) => {
      if (info && state.videoId === videoId) applyPlayhead(info);
    });
  }
}

async function loadVideo(videoId, tabTitle = "", opts = {}) {
  const force = Boolean(opts && opts.force);
  if (!force && state.videoId === videoId && state.segments.length) {
    try {
      const [cached, liveStore] = await Promise.all([
        loadCache(videoId),
        chrome.storage.local.get("vb_live"),
      ]);
      const live = liveStore.vb_live?.videoId === videoId ? liveStore.vb_live : null;
      if (state.videoId !== videoId) return;
      const incomingAt = Math.max(Number(live?.savedAt) || 0, Number(cached?.savedAt) || 0);
      if (!incomingAt || incomingAt <= (Number(state._trackAt) || 0)) {
        if ($("mainBox")?.hidden && $("setupGate")?.hidden && !isSettingsOpen()) showMain();
        flushPendingHotkey();
        return;
      }
    } catch (_e) {
      if ($("mainBox")?.hidden && $("setupGate")?.hidden && !isSettingsOpen()) showMain();
      flushPendingHotkey();
      return;
    }
  }
  if (!force && loadingVideoId === videoId) return;
  videoJob += 1;
  const job = videoJob;
  loadingVideoId = videoId;
  if (state.videoId && state.videoId !== videoId) {
    resetTranscriptCaches();
    state.videoId = videoId;
    state.title = tabTitle || "";
    state.segments = [];
    state.translations = {};
    state.lastSeconds = 0;
    state.translateFailed = {};
    state.translateTries = {};
    lastFollowedStart = -1;
  }
  isTranslating = false;
  if (typeof translateAll === "function") translateAll.busy = false;
  clearQueuedWork();
  if (state.videoId !== videoId || !state.segments.length) {
    showStateBox("K", t("正在打开字幕…"), t("铺好之后就可以划线、拆知识。"), false, true);
  }

  try {
    const [cached, liveStore] = await Promise.all([
      loadCache(videoId),
      chrome.storage.local.get("vb_live"),
    ]);
    const live = liveStore.vb_live?.videoId === videoId ? liveStore.vb_live : null;
    const liveSegs = live?.segments;
    const cacheSegs = cached?.segments;
    const liveAt = Number(live?.savedAt) || 0;
    const cacheAt = Number(cached?.savedAt) || 0;
    const segs = (() => {
      const a = liveSegs?.length ? liveSegs : null;
      const b = cacheSegs?.length ? cacheSegs : null;
      if (!a) return b;
      if (!b) return a;
      if (liveAt && cacheAt && liveAt !== cacheAt) return liveAt > cacheAt ? a : b;
      return a.length >= b.length ? a : b;
    })();
    if (job !== videoJob || loadingVideoId !== videoId) return;
    if (segs?.length) {
      hydrateVideoState(
        videoId,
        tabTitle,
        { title: live?.title || cached?.title || tabTitle, language: live?.language || cached?.language || "", segments: segs },
        cached,
      );
      state._trackAt = Math.max(liveAt, cacheAt);
      transcriptFailId = "";
      transcriptFailAt = 0;
      paintOpenedVideo();
      markWatchStage("opened-cache", { videoId, tabId: state.tabId });
      return;
    }

    markWatchStage("captions", { videoId, tabId: state.tabId });
    const result = await Promise.race([
      sendToBg({ action: "vbSupadata", videoId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("打开字幕超时了")), 20000)),
    ]);
    if (job !== videoJob || loadingVideoId !== videoId) return;
    if (!result?.ok) {
      transcriptFailId = videoId;
      transcriptFailAt = Date.now();
      autoOpenKey = "";
      markWatchStage("caption-error", { videoId, error: String(result?.error || "").slice(0, 240) });
      showStateBox("K", t("暂时读不到字幕"), friendlyTranscriptError(result?.error), true, true);
      return;
    }
    transcriptFailId = "";
    transcriptFailAt = 0;
    hydrateVideoState(videoId, tabTitle, result, cached);
    state._trackAt = Date.now();
    paintOpenedVideo();
    markWatchStage("opened", { videoId, tabId: state.tabId });
    saveCache();
  } catch (error) {
    if (job !== videoJob || loadingVideoId !== videoId) return;
    transcriptFailId = videoId;
    transcriptFailAt = Date.now();
    autoOpenKey = "";
    markWatchStage("caption-error", { videoId, error: String(error?.message || error).slice(0, 240) });
    showStateBox("K", t("暂时读不到字幕"), friendlyTranscriptError(error?.message || error), true, true);
  } finally {
    if (job === videoJob && loadingVideoId === videoId) loadingVideoId = null;
  }
}

function syncReadBanners() {
  const loopOn = isLooping();
  const vocabEl = $("vocabPreview");
  const resumeEl = $("resumeBanner");
  const rail = $("quoteRail");
  const vocabOn = vocabEl?.dataset.open === "1";
  if (vocabEl) vocabEl.hidden = !vocabOn || loopOn;
  if (resumeEl) resumeEl.hidden = resumeEl.dataset.open !== "1" || loopOn || vocabOn;
  if (rail) rail.hidden = rail.dataset.open !== "1" || loopOn || vocabOn;
}

function renderResume() {
  const banner = $("resumeBanner");
  if (!banner) return;
  if (!state.lastSeconds || state.lastSeconds < 20) {
    banner.dataset.open = "0";
    banner.innerHTML = "";
    syncReadBanners();
    return;
  }
  const idx = state.blocks.findIndex((b) => state.lastSeconds >= b.start && state.lastSeconds < b.end);
  const block = idx >= 0 ? state.blocks[idx] : null;
  const hint = state.resumeHint || {};
  banner.dataset.open = "1";
  banner.innerHTML = `
    <div>上次看到 ${clock(state.lastSeconds)}${block ? `，讲到「${esc(block.title)}」` : ""}。
      <button class="text-btn" type="button" id="resumeGo">从这里继续</button>
    </div>
    ${hint.where ? `<div class="resume-line">${esc(hint.where)}</div>` : ""}
    ${hint.stuck ? `<div class="resume-line">卡住的可能是：${esc(hint.stuck)}</div>` : ""}
    ${hint.next ? `<div class="resume-line">接下来：${esc(hint.next)}</div>` : ""}
    ${hint.error ? `<div class="resume-line">${esc(hint.error)}</div>` : ""}
  `;
  $("resumeGo")?.addEventListener("click", () => seek(state.lastSeconds));
  syncReadBanners();
}

const MARK_NEAR = 12;
const MARK_PER_VIDEO = 80;
const MARK_TOTAL = 300;
const MARK_FACES = [
  { id: "cat", label: "金渐层" },
  { id: "dog", label: "萨摩耶" },
  { id: "ribbon", label: "丝带" },
  { id: "bird", label: "鸟" },
  { id: "enso", label: "圆" },
  { id: "seal", label: "印" },
];

function markFaceCaption(id) {
  if (id === "cat") return t("金渐层");
  if (id === "dog") return t("萨摩耶");
  return t(MARK_FACES.find((f) => f.id === id)?.label || id);
}

let markNearId = "";
let markCardDismissed = "";
let markPinsKey = "";
let markRailVideo = "";
let watchResumeAt = 0;
let watchResumeVideo = "";

function rememberWatchResume(videoId, seconds) {
  if (!videoId || watchResumeVideo === videoId) return;
  watchResumeVideo = videoId;
  watchResumeAt = Number(seconds) >= 20 ? Number(seconds) : 0;
  chrome.storage.local.set({ vb_watch_resume: { videoId, seconds: watchResumeAt } });
}

function watchResumeSeconds() {
  return watchResumeVideo === state.videoId ? watchResumeAt : 0;
}

function videoDuration() {
  const last = state.segments[state.segments.length - 1];
  const end = Number(last?.end) || Number(last?.start) + Number(last?.dur) || 0;
  return Math.max(end, Number(state.lastSeconds) || 0, 1);
}

function videoMarks() {
  return marks.filter((m) => m.videoId === state.videoId).sort((a, b) => a.seconds - b.seconds);
}

function markFaceId() {
  const id = settingsCache.markFace || "ribbon";
  if (id === "custom" && settingsCache.markFaceData) return "custom";
  return MARK_FACES.some((f) => f.id === id) ? id : "ribbon";
}

function markFaceKey() {
  const id = markFaceId();
  return id === "custom" ? `custom:${String(settingsCache.markFaceData || "").length}` : id;
}

function faceSvg(id, size = 22) {
  const s = Number(size) || 22;
  const wrap = (inner) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${inner}</svg>`;
  if (id === "cat") {
    return wrap(
      `<path fill="#3a3228" d="M4.2 9.2 7.6 3.4l2.2 5.2h4.4l2.2-5.2 3.4 5.8c.6 6.2-3.2 10.6-7.8 10.6S3.6 15.4 4.2 9.2z"/><circle fill="#f4e7c8" cx="9" cy="12.2" r="1.35"/><circle fill="#f4e7c8" cx="15" cy="12.2" r="1.35"/><path fill="#c45a48" d="M11.2 14.6h1.6l.7 1.1h-3z"/>`,
    );
  }
  if (id === "dog") {
    return wrap(
      `<ellipse fill="#c48a52" cx="6.8" cy="8.2" rx="2.3" ry="3"/><ellipse fill="#c48a52" cx="17.2" cy="8.2" rx="2.3" ry="3"/><path fill="#8a5a32" d="M5.2 10.2c0-3.2 2.4-5.2 6.8-5.2s6.8 2 6.8 5.2c0 4.4-2.6 7.8-6.8 7.8s-6.8-3.4-6.8-7.8z"/><circle fill="#2a2018" cx="9.5" cy="11.4" r="1"/><circle fill="#2a2018" cx="14.5" cy="11.4" r="1"/><ellipse fill="#2a2018" cx="12" cy="13.6" rx="1.15" ry=".75"/>`,
    );
  }
  if (id === "bird") {
    return wrap(
      `<ellipse fill="#4a7ea8" cx="12.4" cy="13.1" rx="6.8" ry="5"/><circle fill="#2d5478" cx="7.4" cy="11.5" r="3.1"/><circle fill="#f4e7c8" cx="6.4" cy="10.9" r=".85"/><path fill="#d4922a" d="M3.1 11.7h3.3l-3.3 1.5z"/><path fill="#3a6a92" d="M15.8 13.1c2.6.2 4.8 1.5 5.4 2.5"/>`,
    );
  }
  if (id === "enso") {
    return wrap(
      `<circle cx="12" cy="12" r="7.2" fill="none" stroke="#1a1611" stroke-width="2.1" stroke-linecap="round" stroke-dasharray="39 9"/>`,
    );
  }
  if (id === "seal") {
    return wrap(
      `<rect x="4" y="4" width="16" height="16" rx="3" fill="#b83c28"/><text x="12" y="16.4" text-anchor="middle" fill="#fffaf4" font-size="11" font-weight="700" font-family="Georgia, serif">K</text>`,
    );
  }
  return wrap(
    `<path fill="#b83c28" d="M7 2.6h10v18.2l-5-3.4-5 3.4z"/><path fill="#fff3e6" d="M9.1 5.2h5.8v2.1H9.1z"/>`,
  );
}

function markFaceInner(size = 22) {
  if (markFaceId() === "custom" && settingsCache.markFaceData) {
    return `<img class="mark-face-img" alt="" src="${settingsCache.markFaceData}">`;
  }
  const src = markFaceUrl(markFaceId());
  if (src) return `<img class="mark-face-img" alt="" src="${src}">`;
  return faceSvg(markFaceId(), size);
}

function markLabelAt(seconds, text = "") {
  const typed = String(text || "").replace(/\s+/g, " ").trim();
  const idx = blockIndexAt(seconds);
  const block = idx >= 0 ? state.blocks[idx] : null;
  const raw = typed || String(block?.title || segmentAt(seconds)?.text || "").replace(/\s+/g, " ").trim();
  return raw.slice(0, 18) || clock(seconds);
}

function trimMarks(videoId = state.videoId) {
  const here = marks.filter((m) => m.videoId === videoId);
  if (here.length > MARK_PER_VIDEO) {
    const drop = here.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, here.length - MARK_PER_VIDEO);
    const dropIds = new Set(drop.map((m) => m.id));
    marks = marks.filter((m) => !dropIds.has(m.id));
  }
  if (marks.length > MARK_TOTAL) {
    marks = marks
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, MARK_TOTAL);
  }
}

function afterMarkChange() {
  paintMarkRail({ forcePins: true });
  paintMarkRows();
  if (notesFilter === "pins") renderNotes();
}

function hintMarkDropped(mark, { near = false } = {}) {
  if (!mark) return;
  const at = clock(mark.seconds);
  flashHint(near ? t("刚夹过") : t("已夹在 {t}", { t: at }), {
    undo: near
      ? undefined
      : async () => {
          await removeMark(mark.id, { silent: true });
          flashHint(t("已拿掉书签"));
        },
    extra: {
      label: t("写一句"),
      run: () => openMarkModal({ id: mark.id }),
    },
  });
}

function nearestMark(seconds, windowSec = MARK_NEAR, videoId = state.videoId) {
  let best = null;
  let bestD = windowSec;
  for (const m of marks.filter((item) => item.videoId === videoId)) {
    const d = Math.abs(Number(m.seconds) - Number(seconds));
    if (d <= bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function openMarkModal(opts = {}) {
  if (!state.videoId) {
    flashHint(t("先打开一支视频。"));
    return;
  }
  const existing = opts.id ? marks.find((m) => m.id === opts.id) : null;
  if (!existing) {
    dropMark({ seconds: opts.seconds, label: opts.label || "" });
    return;
  }
  if ($("markModal") && !$("markModal").hidden && pendingMark?.id === existing.id) {
    $("markModalTitle")?.focus();
    return;
  }
  const at = Number(existing.seconds) || 0;
  pendingMark = { id: existing.id, seconds: at };
  const modal = $("markModal");
  if (!modal) return;
  const head = $("markModalHead");
  if (head) head.textContent = existing.note ? t("改这枚书签") : t("写一句");
  const quote = $("markModalQuote");
  if (quote) quote.textContent = `${clock(at)} · ${existing.label || markLabelAt(at)}`;
  if ($("markModalTitle")) $("markModalTitle").value = existing.label || "";
  if ($("markModalNote")) $("markModalNote").value = existing.note || "";
  const save = $("markModalSave");
  if (save) save.textContent = t("保存");
  modal.hidden = false;
  if (existing.note) $("markModalTitle")?.focus();
  else $("markModalNote")?.focus();
}

function closeMarkModal() {
  const modal = $("markModal");
  if (modal) modal.hidden = true;
  pendingMark = null;
}

async function saveMarkModal() {
  if (!pendingMark?.id) return;
  const title = String($("markModalTitle")?.value || "").trim();
  const note = String($("markModalNote")?.value || "").trim();
  const payload = {
    seconds: pendingMark.seconds,
    label: title,
    note,
    id: pendingMark.id,
  };
  closeMarkModal();
  await dropMark(payload);
}

async function dropMark(opts = {}) {
  const videoId = state.videoId || opts.videoId || "";
  if (!videoId) {
    flashHint(t("先打开一支视频。"));
    return;
  }
  const seconds = Number.isFinite(Number(opts.seconds)) ? Number(opts.seconds) : state.lastSeconds;
  if (opts.id) {
    const mark = marks.find((m) => m.id === opts.id);
    if (!mark) return;
    if (opts.label != null) {
      const next = String(opts.label || "").replace(/\s+/g, " ").trim().slice(0, 80);
      mark.label = next || mark.label || markLabelAt(mark.seconds);
    }
    if (opts.note != null) mark.note = String(opts.note || "").trim().slice(0, 800);
    await saveList("vb_marks", marks);
    afterMarkChange();
    flashHint(t("已记下"));
    return mark;
  }
  const existing = nearestMark(seconds, 4, videoId);
  if (existing) {
    afterMarkChange();
    hintMarkDropped(existing, { near: true });
    return existing;
  }
  const mark = {
    id: uid("mk"),
    videoId,
    videoTitle: state.title || opts.videoTitle || "",
    seconds,
    label: markLabelAt(seconds, opts.label),
    note: String(opts.note || "").trim().slice(0, 800),
    createdAt: Date.now(),
  };
  marks.unshift(mark);
  trimMarks(videoId);
  await saveList("vb_marks", marks);
  afterMarkChange();
  hintMarkDropped(mark);
  checkAchievementsSoon();
  return mark;
}

async function removeMark(id, { silent = false } = {}) {
  const hit = marks.find((m) => m.id === id);
  if (!hit) return false;
  marks = marks.filter((m) => m.id !== id);
  await saveList("vb_marks", marks);
  if (markNearId === id) {
    markNearId = "";
    hideMarkCard();
  }
  afterMarkChange();
  if (!silent) {
    flashHint(t("已拿掉书签"), {
      undo: async () => {
        marks.unshift(hit);
        await saveList("vb_marks", marks);
        afterMarkChange();
        flashHint(t("书签已夹回去"));
      },
    });
  }
  return true;
}

function paintMarkRail({ forcePins = false } = {}) {
  const rail = $("markRail");
  if (!rail) return;
  if (!state.videoId || !state.segments.length) {
    rail.hidden = true;
    return;
  }
  if (markRailVideo !== state.videoId) {
    markRailVideo = state.videoId;
    markNearId = "";
    markCardDismissed = "";
    markPinsKey = "";
    hideMarkCard();
  }
  rail.hidden = false;
  paintMarkFaces();
  const key = `${videoMarks()
    .map((m) => `${m.id}:${m.seconds}:${m.label}:${m.note}`)
    .join("|")}|${markFaceKey()}|${watchResumeSeconds()}`;
  if (forcePins || key !== markPinsKey) {
    markPinsKey = key;
    paintMarkPins();
  }
  paintMarkWalker(state.lastSeconds);
  paintMarkList();
}

function paintMarkFaces() {
  const html = markFaceInner(22);
  const key = markFaceKey();
  const btn = $("markFaceBtn");
  const walker = $("markWalker");
  if (btn && btn.dataset.face !== key) {
    btn.innerHTML = html;
    btn.dataset.face = key;
  }
  if (walker && walker.dataset.face !== key) {
    walker.innerHTML = html;
    walker.dataset.face = key;
  }
}

function paintMarkWalker(seconds) {
  const fill = $("markFill");
  const walker = $("markWalker");
  const clockEl = $("markClock");
  if (!fill && !walker) return;
  const dur = videoDuration();
  const pct = Math.round(Math.max(0, Math.min(100, ((Number(seconds) || 0) / dur) * 100)) * 10) / 10;
  const token = String(pct);
  if (walker && walker.dataset.pct !== token) {
    walker.dataset.pct = token;
    walker.style.left = `${pct}%`;
  }
  if (fill && fill.dataset.pct !== token) {
    fill.dataset.pct = token;
    fill.style.width = `${pct}%`;
  }
  if (clockEl) {
    const n = videoMarks().length;
    const text = n ? `${clock(seconds)} · ${n}` : clock(seconds);
    if (clockEl.textContent !== text) clockEl.textContent = text;
  }
  const near = nearestMark(seconds, MARK_NEAR);
  const nid = near?.id || "";
  if (nid === markNearId) return;
  markNearId = nid;
  $("markPins")?.querySelectorAll(".mark-pin").forEach((el) => {
    el.classList.toggle("near", el.dataset.id === nid);
  });
}

function paintMarkPins() {
  const box = $("markPins");
  if (!box) return;
  const dur = videoDuration();
  const face = markFaceInner(15);
  const resume = watchResumeSeconds();
  const resumeHtml =
    resume >= 20
      ? `<i class="mark-resume" style="left:${Math.max(0, Math.min(100, (resume / dur) * 100))}%" title="${escAttr(t("上次看到"))}"></i>`
      : "";
  box.innerHTML =
    resumeHtml +
    videoMarks()
      .map((m) => {
        const pct = Math.max(0, Math.min(100, (Number(m.seconds) / dur) * 100));
        const tip = m.note ? `${m.label}\n${m.note}` : m.label;
        return `<button type="button" class="mark-pin${m.note ? " has-note" : ""}${m.id === markNearId ? " near" : ""}" data-id="${escAttr(m.id)}" style="left:${pct}%" title="${escAttr(tip)}">${face}</button>`;
      })
      .join("");
}

function paintMarkList() {
  const box = $("markList");
  if (!box) return;
  const rows = videoMarks();
  if (!rows.length) {
    box.innerHTML = `<p class="mark-list-empty">${t("还没有书签。点「夹在这里」或视频右下的 B，会钉在进度条上。事后可写一句。")}</p>`;
    return;
  }
  box.innerHTML = rows
    .map(
      (m) => `<div class="mark-row">
          <button type="button" class="mark-row-go" data-mark-go="${escAttr(m.id)}">
            <span class="mark-card-time">${clock(m.seconds)}</span>
            <span class="mark-row-main">
              <span class="mark-row-title">${esc(m.label)}</span>
              ${m.note ? `<span class="mark-row-note">${esc(m.note)}</span>` : ""}
            </span>
          </button>
          <button type="button" class="text-btn" data-mark-edit="${escAttr(m.id)}">${t("改一下")}</button>
          <button type="button" class="text-btn" data-mark-del="${escAttr(m.id)}">${t("去掉")}</button>
        </div>`,
    )
    .join("");
}

function showMarkCard(id) {
  const card = $("markCard");
  const mark = marks.find((m) => m.id === id);
  if (!card || !mark) return;
  const list = videoMarks();
  const i = list.findIndex((m) => m.id === id);
  const next = list[i + 1] || list[0];
  markNearId = id;
  card.hidden = false;
  card.innerHTML = `
    <div class="mark-card-top">
      <span class="mark-card-time">${clock(mark.seconds)}</span>
      <span class="mark-card-label">${esc(mark.label)}</span>
    </div>
    ${mark.note ? `<p class="mark-card-note">${esc(mark.note)}</p>` : ""}
    <div class="row-actions">
      <button class="text-btn" type="button" data-mark-go="${escAttr(mark.id)}">${t("跳到这")}</button>
      ${next && next.id !== mark.id ? `<button class="text-btn" type="button" data-mark-go="${escAttr(next.id)}">${t("下一枚")}</button>` : ""}
      <button class="text-btn" type="button" data-mark-edit="${escAttr(mark.id)}">${t("改一下")}</button>
      <button class="text-btn" type="button" data-mark-del="${escAttr(mark.id)}">${t("去掉")}</button>
      <button class="text-btn" type="button" data-mark-hide>${t("收起")}</button>
    </div>`;
}

function hideMarkCard(dismiss = false) {
  if (dismiss && markNearId) markCardDismissed = markNearId;
  const card = $("markCard");
  if (!card) return;
  card.hidden = true;
  card.innerHTML = "";
}

function paintMarkRows() {
  const starts = new Set();
  for (const m of videoMarks()) {
    const seg = segmentAt(m.seconds);
    if (seg) starts.add(Number(seg.start));
  }
  transcriptRows.forEach((row) => {
    row?.classList.toggle("marked", starts.has(Number(row.dataset.start)));
  });
}

function setMarkFacePopOpen(open) {
  const pop = $("markFacePop");
  const rail = $("markRail");
  if (pop) pop.hidden = !open;
  rail?.classList.toggle("is-picking", Boolean(open));
}

function openMarkFacePop() {
  const pop = $("markFacePop");
  if (!pop) return;
  if (!pop.hidden) {
    setMarkFacePopOpen(false);
    return;
  }
  const cur = markFaceId();
  setMarkFacePopOpen(true);
  pop.innerHTML = `
    <div class="mark-face-grid">
      ${MARK_FACES.map((f) => {
        const caption = markFaceCaption(f.id);
        const src = markFaceUrl(f.id);
        const thumb = src
          ? `<img class="mark-face-img" alt="${escAttr(caption)}" src="${src}">`
          : faceSvg(f.id, 28);
        return `<button type="button" class="mark-face-opt${cur === f.id ? " on" : ""}" data-face="${f.id}">${thumb}<span data-i18n="${escAttr(f.label)}">${caption}</span></button>`;
      }).join("")}
      <button type="button" class="mark-face-opt${cur === "custom" ? " on" : ""}" data-face="upload">
        ${settingsCache.markFaceData ? `<img class="mark-face-img" alt="" src="${settingsCache.markFaceData}">` : `<span class="mark-upload-plus">+</span>`}
        <span>${t("上传照片")}</span>
      </button>
    </div>`;
}

function compressMarkFace(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("not-image"));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad-image"));
    };
    img.src = url;
  });
}

function bindMarkRail() {
  $("markDrop")?.addEventListener("click", () => dropMark());
  $("markFaceBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openMarkFacePop();
  });
  $("markWalker")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openMarkFacePop();
  });
  $("markTrack")?.addEventListener("click", (event) => {
    const pin = event.target.closest(".mark-pin");
    if (pin) {
      event.stopPropagation();
      const mark = marks.find((m) => m.id === pin.dataset.id);
      if (!mark) return;
      markCardDismissed = "";
      showMarkCard(mark.id);
      return;
    }
    const track = $("markTrack");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seek(pct * videoDuration());
  });
  $("markList")?.addEventListener("click", async (event) => {
    const seekBtn = event.target.closest("[data-mark-seek]");
    if (seekBtn) {
      seek(Number(seekBtn.dataset.markSeek));
      return;
    }
    const go = event.target.closest("[data-mark-go]");
    const edit = event.target.closest("[data-mark-edit]");
    const del = event.target.closest("[data-mark-del]");
    if (edit) {
      openMarkModal({ id: edit.dataset.markEdit });
      return;
    }
    if (go) {
      const mark = marks.find((m) => m.id === go.dataset.markGo);
      if (mark) {
        markCardDismissed = "";
        showMarkCard(mark.id);
        seek(mark.seconds);
      }
    }
    if (del) await removeMark(del.dataset.markDel);
  });
  $("markCard")?.addEventListener("click", async (event) => {
    if (event.target.closest("[data-mark-hide]")) {
      hideMarkCard(true);
      return;
    }
    const edit = event.target.closest("[data-mark-edit]");
    if (edit) {
      openMarkModal({ id: edit.dataset.markEdit });
      return;
    }
    const go = event.target.closest("[data-mark-go]");
    const del = event.target.closest("[data-mark-del]");
    if (go) {
      const mark = marks.find((m) => m.id === go.dataset.markGo);
      if (mark) seek(mark.seconds);
    }
    if (del) await removeMark(del.dataset.markDel);
  });
  $("markFacePop")?.addEventListener("click", async (event) => {
    const el = eventEl(event);
    const opt = el?.closest("[data-face]");
    if (!opt) {
      if (event.target === event.currentTarget) setMarkFacePopOpen(false);
      return;
    }
    if (opt.dataset.face === "upload") {
      $("markFaceFile")?.click();
      return;
    }
    await saveSettings({ markFace: opt.dataset.face });
    setMarkFacePopOpen(false);
    paintMarkRail({ forcePins: true });
  });
  $("markFaceFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = await compressMarkFace(file);
      await saveSettings({ markFace: "custom", markFaceData: data });
      setMarkFacePopOpen(false);
      paintMarkRail({ forcePins: true });
      flashHint(t("已换成你的照片"));
    } catch (_e) {
      flashHint(t("这张图读不出来"));
    }
  });
  document.addEventListener(
    "mousedown",
    (event) => {
      const pop = $("markFacePop");
      if (!pop || pop.hidden) return;
      const el = eventEl(event);
      if (el?.closest("#markFacePop, #markFaceBtn, #markWalker")) return;
      setMarkFacePopOpen(false);
    },
    true,
  );
}

async function analyzeBlocks() {
  if (isAnalyzing || !state.segments.length) return;
  isAnalyzing = true;
  const videoId = state.videoId;
  const job = videoJob;
  setBrickStatus(t("正在拆成知识块…"));
  try {
    const result = await sendToBg({
      action: "vbSegment",
      segments: state.segments,
      title: state.title,
      durationSeconds: state.segments.at(-1)?.end || 0,
      uiLang: currentLang(),
    });
    if (job !== videoJob || state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || t("拆块失败"));
    state.gist = result.gist;
    state.blocks = result.blocks;
    checkAchievementsSoon();
    renderBrickBar();
    renderBrickList();
    renderResume();
    if (state.lastSeconds >= 20) loadResumeHint();
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) setBrickStatus(friendlyAiError(error.message, t("知识块没拆出来，点拆页再试。")));
  } finally {
    isAnalyzing = false;
    if (state.videoId === videoId && state.blocks.length) setBrickStatus("");
  }
}

function clearQueuedWork() {
  clearTimeout(heavyWorkTimer);
}

function queueBackgroundWork(videoId) {
  clearQueuedWork();
  if (captionsOnlyMode()) {
    if (!state.blocks.length) setBrickStatus(t("点「拆」才拆页，不会一打开就花额度。"));
    return;
  }
  if (!state.blocks.length) {
    setBrickStatus(t("结构在后台切…"));
    heavyWorkTimer = setTimeout(() => {
      if (state.videoId === videoId && !state.blocks.length) analyzeBlocks();
    }, 4500);
  }
  if (!state.quoteExtracted) {
    setTimeout(() => {
      if (state.videoId === videoId) extractGoldQuotes({ quiet: true });
    }, 1400);
  }
}

function setBrickStatus(text) {
  const el = $("brickStatus");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text || "";
}

function flashHint(text, opts = {}) {
  const el = $("flashHint");
  if (!el) return;
  clearTimeout(flashHint._t);
  flashHint._undo = null;
  flashHint._extra = null;
  if (!text) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const extra = opts.extra?.label && typeof opts.extra.run === "function" ? opts.extra : null;
  if (opts.undo || extra) {
    flashHint._undo = opts.undo || null;
    flashHint._extra = extra;
    const actions = [
      extra ? `<button type="button" class="text-btn" id="flashExtra">${esc(extra.label)}</button>` : "",
      opts.undo ? `<button type="button" class="text-btn" id="flashUndo">${t("撤销")}</button>` : "",
    ].filter(Boolean).join("");
    el.innerHTML = `<span>${esc(text)}</span><span class="flash-actions">${actions}</span>`;
    $("flashExtra")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const fn = flashHint._extra?.run;
      flashHint._extra = null;
      el.hidden = true;
      el.innerHTML = "";
      if (fn) fn();
    });
    $("flashUndo")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      const fn = flashHint._undo;
      flashHint._undo = null;
      el.hidden = true;
      el.innerHTML = "";
      if (fn) await fn();
    });
  } else {
    el.textContent = text;
  }
  flashHint._t = setTimeout(() => {
    el.hidden = true;
    el.innerHTML = "";
    flashHint._undo = null;
    flashHint._extra = null;
  }, opts.undo || extra ? 8000 : 2800);
}

async function runFlashUndo() {
  const fn = flashHint._undo;
  if (!fn) return false;
  flashHint._undo = null;
  const el = $("flashHint");
  if (el) {
    el.hidden = true;
    el.innerHTML = "";
  }
  await fn();
  return true;
}

async function loadStudyPack({ force = false } = {}) {
  if (isStudying || !state.segments.length) return;
  if (state.study && !force) return;
  isStudying = true;
  const videoId = state.videoId;
  const job = videoJob;
  $("studyBox").innerHTML = `<div class="study-label">学习包</div><p style="color:var(--muted)">正在提炼提纲和问题…</p>`;
  try {
    const result = await sendToBg({
      action: "vbStudy",
      segments: state.segments,
      title: state.title,
      gist: state.gist || "",
      blocks: (state.blocks || []).map((b) => ({
        title: b.title,
        summary: b.summary,
        start: b.start,
        category: b.category,
      })),
    });
    if (job !== videoJob || state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || t("学习包失败"));
    state.study = {
      spine: result.spine || "",
      recap: result.recap,
      keywords: result.keywords,
      questions: result.questions,
    };
    renderStudy();
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) {
      $("studyBox").innerHTML = `<div class="dive-error">${esc(friendlyAiError(error.message, t("提纲没做成，点重做再试。")))}</div>`;
    }
  } finally {
    isStudying = false;
  }
}

// ---------- render ----------

function paintView(name) {
  if (name === "read") {
    renderTranscript();
    renderQuoteRail();
    renderLoopBanner();
    renderLevelChip();
    renderVocabPreview();
    renderResume();
    renderTranslateBar();
    return;
  }
  if (name === "bricks") {
    renderBrickBar();
    renderBrickList();
    renderStudy();
    return;
  }
  if (name === "maps") {
    if (!state.conceptMap || !isNovakMap(state.conceptMap)) loadConceptMap();
    if (!state.argMap) loadArgMap();
    if (mapKind === "atlas") ensureAtlasReady();
    renderMaps();
    return;
  }
  if (name === "ask") {
    renderAskContext();
    renderChat();
    return;
  }
  if (name === "notes") {
    renderNotes();
    return;
  }
  if (name === "vocab") {
    renderVocabPage();
    return;
  }
  if (name === "shelf") {
    renderShelf();
    return;
  }
  if (name === "review") renderReview();
}

function renderAll() {
  paintView(currentView());
}

function blockProgress(i) {
  return state.progress[i] || "fresh";
}

function setProgress(i, status, persist = true) {
  if (!state.blocks[i] || state.progress[i] === status) return;
  if (status === "learning" && state.progress[i] === "done") return;
  state.progress[i] = status;
  if (status === "done") {
    dropBrickCard(i);
    const key = state.videoId ? `${state.videoId}:${i}` : "";
    achieveStore.doneKeys = achieveStore.doneKeys || {};
    if (key && !achieveStore.doneKeys[key]) {
      achieveStore.doneKeys[key] = 1;
      achieveStore.doneChapters = Object.keys(achieveStore.doneKeys).length;
    }
    checkAchievementsSoon();
  }
  renderProgressMeter();
  const view = currentView();
  if (view === "bricks") {
    renderBrickBar();
    renderBrickList();
  } else if (view === "maps") {
    renderMaps();
  }
  if (persist) saveCacheSoon(800);
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
        `<button type="button" class="brick-index-item${brickKind === k ? " on" : ""}" data-kind="${k}" data-cat="${k}" title="${esc(DIVE_FRAME[k] || "")}">${CAT_LABEL[k]} ${counts[k]}</button>`,
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
    btn.title = `${CAT_LABEL[block.category]}${DIVE_FRAME[block.category] ? ` · ${DIVE_FRAME[block.category]}` : ""} · ${PROGRESS_LABEL[st]} · ${clock(block.start)}-${clock(block.end)}`;
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
    root.innerHTML = `<div class="chat-empty">知识块出来后，这里会出复述和问题。</div>`;
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
    const lines = study?.recap || [];
    body = `${study?.spine ? `<p class="study-spine">${esc(study.spine)}</p>` : ""}
      <ol class="study-recap">${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>
      <button class="text-btn" id="studyRedo" type="button">${t("提纲不够？重做")}</button>`;
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
      tabs.length || state.gist
        ? `<div class="study-tabs">${tabs
            .map(([id, label]) => `<button type="button" class="seg-btn${studyTab === id ? " active" : ""}" data-study="${id}">${label}</button>`)
            .join("")}<button type="button" class="seg-btn recall-btn" id="recallOpen">${t("闭卷复盘")}</button></div>`
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
  $("studyRedo")?.addEventListener("click", () => {
    state.study = null;
    studyTab = "recap";
    loadStudyPack({ force: true });
  });
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
    if (!result?.ok) throw new Error(result?.error || t("概念图失败"));
    state.conceptMap = {
      focusQuestion: result.focusQuestion,
      concepts: result.concepts,
      propositions: result.propositions,
    };
    await mergeAtlasLocal(state.conceptMap);
    saveCache();
    checkAchievementsSoon("map");
    renderMaps();
    echoMarksCache = null;
    echoMarksKey = "";
    refreshTranscriptWhenIdle();
    maybeWeaveAtlas();
  } catch (_error) {
    if (state.videoId === videoId && !state.conceptMap) {
      conceptMapFallback = true;
      state.conceptMap = fallbackConceptMap();
      mergeAtlasLocal(state.conceptMap);
      renderMaps();
      echoMarksCache = null;
      echoMarksKey = "";
      refreshTranscriptWhenIdle();
      maybeWeaveAtlas();
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
    if (!result?.ok) throw new Error(result?.error || t("论证图失败"));
    state.argMap = { claim: result.claim, supports: result.supports, rebuts: result.rebuts };
    saveCache();
    renderMaps();
  } catch (_error) {
    if (state.videoId === videoId && !state.argMap) {
      argMapFallback = true;
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
    { id: "root", label: state.gist || "本视频", level: 0, block: -1 },
    ...state.blocks.slice(0, 8).map((b, i) => ({
      id: `n${i}`,
      label: b.title,
      level: 1,
      block: i,
    })),
  ];
  return {
    focusQuestion: t("这支视频在讲什么？"),
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
    $("mapHelp").textContent = atlasQuietError
      ? `总图这次没织上：${atlasQuietError}`
      : t("可拖开节点。点一下打开，悬停看相连的边。");
    box.innerHTML = renderLinkGraph("global");
  } else if (mapKind === "concept") {
    $("mapHelp").textContent = t("可拖开节点。点中间走进下一层，字只出现在当前这一圈。");
    box.innerHTML = renderLinkGraph("local");
  } else if (mapKind === "novak") {
    $("mapHelp").textContent = conceptMapFallback
      ? t("层级图没做成，先用知识块拼了一张骨架。")
      : t("Novak 层级图：上边一般、下边具体。点框看概念卡片，再跳到视频。");
    box.innerHTML = renderConceptMapSvg();
  } else if (mapKind === "arg") {
    $("mapHelp").textContent = argMapFallback
      ? t("论证图没做成，先用知识块拼了一张骨架。")
      : t("论证图：上面是主张，左边支撑，右边限制。点卡片看概念，再跳到视频。");
    if (!state.argMap) loadArgMap();
    box.innerHTML = renderArgMapSvg();
  } else if (mapKind === "time") {
    $("mapHelp").textContent = t("知识块和金句按时间排。点节点看卡片，再跳到视频。");
    if (!state.quoteExtracted && state.segments.length) extractGoldQuotes({ quiet: true });
    box.innerHTML = renderTimeMapSvg();
  } else {
    $("mapHelp").textContent = t("从中心散开。点知识块展开，再点卡片跳到视频。");
    box.innerHTML = renderMindMapSvg();
  }
  if (mapPick && mapKind !== "concept" && mapKind !== "atlas") {
    box.insertAdjacentHTML("beforeend", renderPickCard(mapPick));
  }
  box.querySelectorAll("[data-pick]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (el.dataset.dragging === "1") return;
      event.stopPropagation();
      openMapPick(el);
    });
  });
  box.querySelectorAll("[data-block]").forEach((el) => {
    if (el.hasAttribute("data-pick")) return;
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
      peekSeek(state.blocks[i].start, { kind: "maps", label: "图谱" });
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
      openConceptId = openConceptId === el.dataset.atlas ? "" : el.dataset.atlas;
      renderMaps();
      $("conceptCard")?.scrollIntoView({ block: "nearest" });
    });
  });
  box.querySelectorAll("[data-jump]").forEach((el) => {
    if (el.hasAttribute("data-pick")) return;
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      peekSeek(Number(el.dataset.jump), { kind: "maps" });
    });
  });
  bindLinkGraph(box, mapKind === "atlas" ? "global" : "local");
  bindLibJumps(box);
  bindPickCard(box);
  $("atlasWeave")?.addEventListener("click", () => weaveAtlas({ force: true }));
}

function wrapText(text, maxChars) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return [""];
  const limit = Math.max(4, maxChars);
  const punct = "，。、；：!?！？,./ ";
  const lines = [];
  let rest = raw;
  while (rest.length) {
    if (rest.length <= limit) {
      lines.push(rest);
      break;
    }
    let cut = limit;
    for (let j = limit; j >= Math.ceil(limit * 0.55); j -= 1) {
      if (punct.includes(rest[j - 1])) {
        cut = j;
        break;
      }
    }
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return lines.filter(Boolean).length ? lines.filter(Boolean) : [""];
}

function svgLines(x, y, lines, opts = {}) {
  const size = opts.size || 11;
  const fill = opts.fill || "#1c1812";
  const anchor = opts.anchor || "middle";
  const weight = opts.weight || "400";
  const lh = opts.leading || Math.round(size * 1.35);
  const first = opts.top ? y + size : y - ((lines.length - 1) * lh) / 2 + size * 0.35;
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${first + i * lh}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`,
    )
    .join("");
}

function svgSheet(w, h, id) {
  return `<defs>
      <pattern id="vb-dots-${id}" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.55" fill="#d5cbb8"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="#fffaf3"/>
    <rect width="${w}" height="${h}" fill="url(#vb-dots-${id})"/>`;
}

function graphPosKey(scope, id) {
  return `${state.videoId || "_"}:${scope}:${graphMode}:${id}`;
}

function applyGraphLayout(view, scope, w, h) {
  view.nodes.forEach((n) => {
    const p = graphLayout[graphPosKey(scope, n.id)];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    n.x = Math.max(22, Math.min(w - 22, p.x));
    n.y = Math.max(22, Math.min(h - 22, p.y));
  });
  return view;
}

function clearGraphLayout(scope) {
  const prefix = `${state.videoId || "_"}:${scope}:${graphMode}:`;
  Object.keys(graphLayout).forEach((key) => {
    if (key.startsWith(prefix)) delete graphLayout[key];
  });
  saveCache();
  renderMaps();
}

function svgClientPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
}

function placeGraphNode(el, node) {
  const circle = el.querySelector("circle");
  if (circle) {
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
  }
  const pill = el.querySelector(".graph-pill");
  if (!pill) return;
  const rect = pill.querySelector("rect");
  const text = pill.querySelector("text");
  const r = Number(circle?.getAttribute("r") || 10);
  const tw = Number(rect?.getAttribute("width") || 40);
  const y = node.y + r + 6;
  if (rect) {
    rect.setAttribute("x", node.x - tw / 2);
    rect.setAttribute("y", y);
  }
  if (text) {
    text.setAttribute("x", node.x);
    text.setAttribute("y", y + 12.5);
  }
}

function refreshGraphEdges(svg, view) {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  svg.querySelectorAll(".graph-edge").forEach((el) => {
    const [a, b] = (el.dataset.edge || ">").split(">");
    const na = byId.get(a);
    const nb = byId.get(b);
    if (!na || !nb) return;
    el.setAttribute("x1", na.x);
    el.setAttribute("y1", na.y);
    el.setAttribute("x2", nb.x);
    el.setAttribute("y2", nb.y);
  });
}

function bindGraphDrag(svg, view, scope, w, h) {
  let drag = null;
  svg.querySelectorAll(".graph-node").forEach((el) => {
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const node = view.nodes.find((n) => n.id === el.dataset.gid);
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      const start = svgClientPoint(svg, event.clientX, event.clientY);
      drag = {
        el,
        node,
        x0: start.x,
        y0: start.y,
        nx: node.x,
        ny: node.y,
        moved: false,
      };
      el.dataset.dragging = "0";
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
    });
    el.addEventListener("pointermove", (event) => {
      if (!drag || drag.el !== el) return;
      const p = svgClientPoint(svg, event.clientX, event.clientY);
      const dx = p.x - drag.x0;
      const dy = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      el.dataset.dragging = "1";
      drag.node.x = Math.max(22, Math.min(w - 22, drag.nx + dx));
      drag.node.y = Math.max(22, Math.min(h - 22, drag.ny + dy));
      placeGraphNode(el, drag.node);
      refreshGraphEdges(svg, view);
    });
    const endDrag = () => {
      if (!drag || drag.el !== el) return;
      if (drag.moved) {
        graphLayout[graphPosKey(scope, drag.node.id)] = { x: drag.node.x, y: drag.node.y };
        saveCache();
      }
      const moved = drag.moved;
      drag = null;
      el.style.cursor = "grab";
      if (moved) {
        setTimeout(() => {
          el.dataset.dragging = "0";
        }, 0);
      }
    };
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  });
}

function textBoxSize(lines, opts = {}) {
  const charW = opts.charW || 12;
  const lineH = opts.lineH || 15;
  const padX = opts.padX ?? 10;
  const padY = opts.padY ?? 8;
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return {
    w: Math.min(opts.maxW || 168, Math.max(opts.minW || 72, longest * charW + padX * 2)),
    h: Math.max(opts.minH || 32, lines.length * lineH + padY * 2),
  };
}

function renderMindMapSvg() {
  if (!state.blocks.length) {
    return `<div class="chat-empty">知识块出来后，这里会生成可点击的思维导图。</div>`;
  }
  const width = 360;
  const gistLines = wrapText(state.gist || state.title || "本视频", 16);
  const open = state.selectedBlock;
  let y = 28 + gistLines.length * 16 + 18;
  const nodes = [];
  state.blocks.forEach((block, i) => {
    const titleLines = wrapText(block.title, 10);
    const kids = open === i ? diveParts(state.dives[i], i).slice(0, 4) : [];
    const kidLines = kids.map((p) => wrapText(p.name, 10));
    const boxH = Math.max(34, titleLines.length * 15 + 14);
    const kidH = kidLines.reduce((sum, lines) => sum + Math.max(22, lines.length * 13 + 8), 0);
    nodes.push({
      i,
      x: i % 2 === 0 ? 16 : 186,
      y,
      block,
      st: blockProgress(i),
      titleLines,
      boxH,
      kids,
      kidLines,
    });
    y += boxH + (kidH ? kidH + 10 : 0) + 12;
  });
  const height = Math.max(220, y + 12);
  const rootX = 180;
  const rootY = 18;
  const lines = nodes
    .map((n) => {
      const mx = (rootX + n.x + 74) / 2;
      return `<path d="M${rootX},${rootY + 12} Q${mx},${n.y - 8} ${n.x + 74},${n.y + 4}" fill="none" stroke="#e6dece" stroke-width="1.4"/>`;
    })
    .join("");
  const blockNodes = nodes
    .map((n) => {
      const fill = n.st === "done" ? "#eef6ee" : n.st === "learning" ? "#fff4e4" : "#fffdf8";
      const stroke = n.i === open ? "#c45c26" : "#e6dece";
      let ky = n.y + n.boxH + 4;
      const kids = n.kids
        .map((p, k) => {
          const h = Math.max(22, n.kidLines[k].length * 13 + 8);
          const kidId = `mind-${n.i}-${k}`;
          const kidOn = mapPick?.id === kidId;
          const g = `<g class="map-node${kidOn ? " on" : ""}" data-pick="1" data-cid="${kidId}" data-label="${escAttr(p.name)}" data-block="${n.i}" data-role="${escAttr(p.name)}">
            <rect x="${n.x + 8}" y="${ky}" width="148" height="${h}" rx="8" fill="#f4efe4" stroke="${kidOn ? "#c45c26" : "#e6dece"}" stroke-width="${kidOn ? 2 : 1}"/>
            ${svgLines(n.x + 82, ky + h / 2, n.kidLines[k], { size: 10, fill: "#6f675c" })}
          </g>`;
          ky += h + 4;
          return g;
        })
        .join("");
      const parentId = `mind-${n.i}`;
      const parentOn = mapPick?.id === parentId;
      return `<g class="map-node${parentOn ? " on" : ""}" data-pick="1" data-cid="${parentId}" data-label="${escAttr(n.block.title)}" data-block="${n.i}" data-expand="1">
        <rect x="${n.x}" y="${n.y}" width="158" height="${n.boxH}" rx="8" fill="${fill}" stroke="${parentOn || n.i === open ? "#c45c26" : stroke}" stroke-width="1.6"/>
        ${svgLines(n.x + 79, n.y + n.boxH / 2, n.titleLines, { size: 11, weight: "700", fill: "#2c2418" })}
      </g>${kids}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${lines}
    <g class="map-node${mapPick?.id === "mind-root" ? " on" : ""}" data-pick="1" data-cid="mind-root" data-label="${escAttr(state.gist || state.title || "")}" data-role="${escAttr(t("中心"))}">
      <circle cx="${rootX}" cy="${rootY}" r="14" fill="#c45c26"/>
      <text x="${rootX}" y="${rootY + 4}" text-anchor="middle" font-size="10" fill="#fffaf4" font-weight="700">${esc(t("根"))}</text>
    </g>
    ${svgLines(rootX, 40, gistLines, { size: 11, fill: "#6f675c", top: true })}
    ${blockNodes}
  </svg>`;
}

function layoutNovak(map, focusH = 36) {
  const W = 360;
  const concepts = map.concepts || [];
  const byLevel = new Map();
  for (const c of concepts) {
    const lv = Math.max(0, Math.min(3, Number(c.level) || 0));
    const lines = wrapText(c.label, 9);
    const box = textBoxSize(lines, { charW: 12, lineH: 15, padX: 9, padY: 8, minW: 96, maxW: 164, minH: 36 });
    const item = { c, lines, boxW: box.w, boxH: box.h };
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(item);
  }
  const pos = new Map();
  let y = focusH + 16;
  for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
    const all = byLevel.get(lv);
    const perRow = all.length === 1 ? 1 : 2;
    for (let i = 0; i < all.length; i += perRow) {
      const row = all.slice(i, i + perRow);
      const rowH = Math.max(...row.map((m) => m.boxH));
      const totalW = row.reduce((sum, m) => sum + m.boxW, 0);
      const gap = Math.max(12, (W - 20 - totalW) / (row.length + 1));
      let x = 10 + gap;
      row.forEach((m) => {
        pos.set(m.c.id, {
          x: x + m.boxW / 2,
          y: y + rowH / 2,
          c: m.c,
          lines: m.lines,
          boxW: m.boxW,
          boxH: m.boxH,
        });
        x += m.boxW + gap;
      });
      y += rowH + 46;
    }
  }
  return { pos, height: Math.max(240, y + 10), width: W };
}

function renderAtlasMap() {
  seedAtlasFromLib();
  const shared = (atlas.concepts || []).filter((c) => (c.sources || []).length > 1);
  const map = atlasAsNovak();
  const weave = `<div class="atlas-bar">
    <button class="btn" id="atlasWeave" type="button">${atlasWoveFor === state.videoId ? "再织一版" : "织进总图"}</button>
    <span>${(atlas.concepts || []).length} 个概念 · ${shared.length} 个跨视频</span>
  </div>`;
  if (!(atlas.concepts || []).length) {
    return `${weave}<div class="chat-empty">${atlasEmptyReason()}</div>`;
  }
  const svg = renderConceptMapSvgFrom(map, true);
  const bridges = shared
    .map((c) => {
      const names = (c.sources || []).map((s) => esc((s.title || s.videoId).slice(0, 18))).join(" · ");
      return `<li><button class="text-btn" data-atlas="${c.id}" type="button">${esc(c.label)}</button><span class="note-meta">${names}</span></li>`;
    })
    .join("");
  const inspect = openConceptId ? renderConceptInspect(openConceptId) : "";
  return `${weave}${svg}${inspect}${bridges ? `<ol class="cmap-props atlas-list">${bridges}</ol>` : ""}`;
}

function graphAdd(nodes, node) {
  if (!node?.id || nodes.some((x) => x.id === node.id)) return;
  nodes.push(node);
}

function graphLink(edges, from, to, kind, label) {
  if (!from || !to || from === to) return;
  if (edges.some((e) => e.from === from && e.to === to)) return;
  edges.push({ from, to, kind: kind || "prop", label: label || "" });
}

function findConceptNode(nodes, label) {
  const key = normLabel(label);
  if (!key) return null;
  return nodes.find((x) => x.kind === "concept" && (normLabel(x.label) === key || mentionsLabel(x.label, label)));
}

function linkMentions(nodes, edges, fromId, text) {
  wikiLinks(text).forEach((w) => {
    const hit = findConceptNode(nodes, w);
    if (hit) graphLink(edges, fromId, hit.id, "mentions", "提到");
  });
  nodes
    .filter((x) => x.kind === "concept" && mentionsLabel(text, x.label))
    .forEach((hit) => graphLink(edges, fromId, hit.id, "mentions", "提到"));
}

function buildLocalGraph() {
  const nodes = [];
  const edges = [];
  const vid = state.videoId || "here";
  graphAdd(nodes, {
    id: `v-${vid}`,
    kind: "video",
    label: (state.title || "本视频").slice(0, 18),
    seconds: 0,
    videoId: vid,
  });
  (state.blocks || []).forEach((b, i) => {
    const id = `b-${i}`;
    graphAdd(nodes, { id, kind: "brick", label: b.title, seconds: b.start, block: i });
    graphLink(edges, `v-${vid}`, id, "contains", "包含");
  });
  const cmap = state.conceptMap;
  if (isNovakMap(cmap)) {
    for (const c of cmap.concepts || []) {
      const id = `c-${c.id}`;
      graphAdd(nodes, {
        id,
        kind: "concept",
        label: c.label,
        seconds: state.blocks[c.block]?.start || 0,
        block: c.block,
        cid: c.id,
      });
      if (Number.isFinite(Number(c.block)) && Number(c.block) >= 0) graphLink(edges, `b-${c.block}`, id, "about", "讲到");
      else graphLink(edges, `v-${vid}`, id, "about", "讲到");
    }
    for (const p of cmap.propositions || []) {
      graphLink(edges, `c-${p.from}`, `c-${p.to}`, p.cross ? "cross" : "prop", p.link);
    }
  }
  notes
    .filter((n) => n.videoId === state.videoId)
    .slice(0, 8)
    .forEach((n) => {
      const id = `n-${n.id}`;
      graphAdd(nodes, { id, kind: "note", label: String(n.text || "").slice(0, 16), seconds: n.seconds, noteId: n.id });
      const bi = blockIndexAt(n.seconds);
      graphLink(edges, bi >= 0 ? `b-${bi}` : `v-${vid}`, id, "mentions", "记下");
      linkMentions(nodes, edges, id, `${n.text} ${n.quote || ""}`);
    });
  videoQuotes()
    .slice(0, 6)
    .forEach((q) => {
      const id = `q-${q.id}`;
      const { en, zh } = quotePairText(q);
      graphAdd(nodes, { id, kind: "quote", label: (en || zh || q.text || "").slice(0, 16), seconds: q.seconds, quoteId: q.id });
      const bi = blockIndexAt(q.seconds);
      graphLink(edges, bi >= 0 ? `b-${bi}` : `v-${vid}`, id, "mentions", "金句");
      linkMentions(nodes, edges, id, quoteBlob(q));
    });
  return { nodes: nodes.slice(0, 36), edges: edges.slice(0, 70) };
}

function buildGlobalGraph() {
  seedAtlasFromLib();
  const nodes = [];
  const edges = [];
  for (const [vid, rec] of Object.entries(lib || {})) {
    graphAdd(nodes, {
      id: `v-${vid}`,
      kind: "video",
      label: (rec.title || vid).slice(0, 16),
      videoId: vid,
    });
  }
  for (const c of atlas.concepts || []) {
    graphAdd(nodes, {
      id: c.id,
      kind: "concept",
      label: c.label,
      cid: c.id,
      shared: (c.sources || []).length > 1,
    });
    for (const s of c.sources || []) {
      if (s.videoId) graphLink(edges, `v-${s.videoId}`, c.id, "source", "讲到");
    }
  }
  for (const p of atlas.propositions || []) {
    graphLink(edges, p.from, p.to, p.cross ? "cross" : "prop", p.link);
  }
  notes.slice(0, 12).forEach((n) => {
    const hits = nodes.filter((x) => x.kind === "concept" && mentionsLabel(`${n.text} ${n.quote || ""}`, x.label));
    const wikis = wikiLinks(n.text).map((w) => findConceptNode(nodes, w)).filter(Boolean);
    const all = [...new Set([...hits, ...wikis])];
    if (!all.length) return;
    const id = `n-${n.id}`;
    graphAdd(nodes, {
      id,
      kind: "note",
      label: String(n.text || "").slice(0, 14),
      videoId: n.videoId,
      seconds: n.seconds,
      noteId: n.id,
    });
    if (n.videoId) graphLink(edges, `v-${n.videoId}`, id, "mentions", "记下");
    all.forEach((h) => graphLink(edges, id, h.id, "mentions", "提到"));
  });
  return { nodes: nodes.slice(0, 40), edges: edges.slice(0, 80) };
}

const GRAPH_KIND = {
  video: "视频",
  concept: "概念",
  brick: "知识块",
  note: "笔记",
  quote: "金句",
};

function graphNeighbors(graph, focusId) {
  const hop1 = new Set();
  const hop2 = new Set();
  for (const e of graph.edges) {
    if (e.from === focusId) hop1.add(e.to);
    if (e.to === focusId) hop1.add(e.from);
  }
  for (const e of graph.edges) {
    if (hop1.has(e.from) && e.to !== focusId && !hop1.has(e.to)) hop2.add(e.to);
    if (hop1.has(e.to) && e.from !== focusId && !hop1.has(e.from)) hop2.add(e.from);
  }
  return { hop1, hop2 };
}

function pickGraphFocus(graph) {
  return (
    graph.nodes.find((n) => n.id === graphFocusId) ||
    graph.nodes.find((n) => n.id === openGraphId) ||
    graph.nodes.find((n) => n.kind === "video") ||
    graph.nodes[0]
  );
}

function placeRing(nodes, cx, cy, r, start = -Math.PI / 2) {
  const n = nodes.length;
  nodes.forEach((node, i) => {
    const a = start + (i / Math.max(1, n)) * Math.PI * 2;
    node.x = cx + Math.cos(a) * r;
    node.y = cy + Math.sin(a) * r;
  });
}

function collideNodes(nodes, pad, w, h) {
  for (let t = 0; t < 36; t += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        const min = (nodes[i]._r || 12) + (nodes[j]._r || 12) + pad;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const f = ((min - d) / d) * 0.5;
        dx *= f;
        dy *= f;
        nodes[i].x += dx;
        nodes[i].y += dy;
        nodes[j].x -= dx;
        nodes[j].y -= dy;
      }
    }
    for (const node of nodes) {
      node.x = Math.max(28, Math.min(w - 28, node.x));
      node.y = Math.max(28, Math.min(h - 36, node.y));
    }
  }
}

function layoutNearGraph(graph, w, h) {
  const focus = pickGraphFocus(graph);
  if (!focus) return graph;
  const { hop1, hop2 } = graphNeighbors(graph, focus.id);
  const inner = graph.nodes.filter((n) => hop1.has(n.id));
  const outer = graph.nodes.filter((n) => hop2.has(n.id)).slice(0, 10);
  const shown = [focus, ...inner, ...outer];
  const ids = new Set(shown.map((n) => n.id));
  shown.forEach((n) => {
    n.hop = n.id === focus.id ? 0 : hop1.has(n.id) ? 1 : 2;
    n._r = n.hop === 0 ? 18 : n.hop === 1 ? 12 : 7;
  });
  const cx = w / 2;
  const cy = h / 2 - 8;
  focus.x = cx;
  focus.y = cy;
  placeRing(inner, cx, cy, Math.min(w, h) * 0.32);
  placeRing(outer, cx, cy, Math.min(w, h) * 0.44, -Math.PI / 3);
  collideNodes(shown, 18, w, h);
  focus.x = cx;
  focus.y = cy;
  return {
    nodes: shown,
    edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    focus,
  };
}

function layoutAllGraph(graph, w, h) {
  const groups = { video: [], brick: [], concept: [], note: [], quote: [] };
  graph.nodes.forEach((n) => (groups[n.kind] || groups.concept).push(n));
  const cx = w / 2;
  const cy = h / 2;
  if (groups.video.length === 1) {
    groups.video[0].x = cx;
    groups.video[0].y = cy;
  } else {
    placeRing(groups.video, cx, cy, Math.min(w, h) * 0.36);
  }
  placeRing(groups.brick, cx, cy, Math.min(w, h) * 0.22);
  placeRing(groups.concept, cx, cy, Math.min(w, h) * 0.34, -Math.PI / 5);
  placeRing([...groups.note, ...groups.quote], cx, cy, Math.min(w, h) * 0.45, Math.PI / 7);
  graph.nodes.forEach((n) => {
    n.hop = n.kind === "video" || n.kind === "concept" ? 1 : 2;
    n._r = GRAPH_STYLE[n.kind]?.r || 10;
  });
  collideNodes(graph.nodes, 16, w, h);
  return graph;
}

const GRAPH_STYLE = {
  video: { r: 16, fill: "#1c1812", stroke: "#1c1812", text: "#fffaf4" },
  concept: { r: 13, fill: "#fffdf8", stroke: "#c4472d", text: "#1c1812" },
  brick: { r: 11, fill: "#fffdf8", stroke: "#5b8def", text: "#1c1812" },
  note: { r: 10, fill: "#fffdf8", stroke: "#3aa06a", text: "#1c1812" },
  quote: { r: 10, fill: "#fffdf8", stroke: "#c4922a", text: "#1c1812" },
};

function renderGraphInspect(node, scope) {
  if (!node) return "";
  if (node.kind === "concept") {
    const atlasId = node.cid && (atlas.concepts || []).some((c) => c.id === node.cid) ? node.cid : "";
    if (atlasId) return renderConceptInspect(atlasId);
    const related = [
      ...notes.filter((n) => n.videoId === state.videoId && mentionsLabel(`${n.text} ${n.quote || ""}`, node.label)).slice(0, 3),
      ...quotes.filter((q) => q.videoId === state.videoId && mentionsLabel(quoteBlob(q), node.label)).slice(0, 3),
    ];
    const hit = resolvePickFromLabel(node.label, Number.isFinite(Number(node.block)) ? Number(node.block) : -1);
    return `<section class="lib-inspect" id="conceptCard">
      <div class="lib-kicker">概念</div>
      <h3 class="lib-title">${esc(node.label)}</h3>
      ${related.map((x) => `<p class="lib-sum">${esc(x.text || x.en || x.zh || "")}</p>`).join("")}
      <div class="row-actions">
        ${Number.isFinite(Number(node.seconds)) ? `<button class="text-btn" data-jump="${node.seconds}" type="button">${t("跳到这秒")}</button>` : ""}
        ${hit.block >= 0 ? `<button class="text-btn" type="button" data-fy="${hit.block}" data-fy-topic="${escAttr(node.label)}">${t("费曼这个概念")}</button>` : ""}
      </div>
    </section>`;
  }
  if (node.kind === "brick" && state.blocks[node.block]) {
    const b = state.blocks[node.block];
    return `<section class="lib-inspect" id="conceptCard">
      <div class="lib-kicker">知识块 · ${esc(CAT_LABEL[b.category] || "")}</div>
      <h3 class="lib-title">${esc(b.title)}</h3>
      ${b.summary ? `<p class="lib-sum">${esc(b.summary)}</p>` : ""}
      <div class="row-actions">
        <button class="text-btn" data-jump="${b.start}" type="button">${t("跳到这块")}</button>
        <button class="text-btn" type="button" data-fy="${node.block}" data-fy-topic="${escAttr(b.title)}">${t("费曼")}</button>
      </div>
    </section>`;
  }
  if (node.kind === "note") {
    const n = notes.find((x) => x.id === node.noteId);
    return `<section class="lib-inspect" id="conceptCard">
      <div class="lib-kicker">笔记</div>
      ${n?.quote ? `<p class="lib-quote">${esc(n.quote)}</p>` : ""}
      <p class="lib-sum">${esc(n?.text || node.label)}</p>
      <div class="row-actions"><button class="text-btn" data-jump="${n?.seconds || node.seconds || 0}" type="button">跳到这秒</button></div>
    </section>`;
  }
  if (node.kind === "quote") {
    const q = quotes.find((x) => x.id === node.quoteId);
    const { en, zh } = q ? quotePairText(q) : { en: node.label, zh: "" };
    return `<section class="lib-inspect" id="conceptCard">
      <div class="lib-kicker">金句</div>
      ${en ? `<p class="lib-quote">${esc(en)}</p>` : ""}
      ${zh ? `<p class="lib-sum">${esc(zh)}</p>` : ""}
      <div class="row-actions"><button class="text-btn" data-jump="${q?.seconds || node.seconds || 0}" type="button">跳到这秒</button></div>
    </section>`;
  }
  if (node.kind === "video") {
    if (scope === "global" && node.videoId) return `<div id="conceptCard">${renderVideoInspect(node.videoId)}</div>`;
    return `<section class="lib-inspect" id="conceptCard">
      <div class="lib-kicker">视频</div>
      <h3 class="lib-title">${esc(node.label)}</h3>
      ${state.gist ? `<p class="lib-sum">${esc(state.gist)}</p>` : ""}
    </section>`;
  }
  return "";
}

function graphPill(x, y, text, on) {
  const label = String(text || "").slice(0, 8);
  if (!label) return "";
  const tw = Math.min(120, Math.max(28, label.length * 8 + 12));
  return `<g class="graph-pill">
    <rect x="${x - tw / 2}" y="${y}" width="${tw}" height="18" rx="9" fill="#fffdf8" stroke="${on ? "#c4472d" : "#e4dccb"}"/>
    <text x="${x}" y="${y + 12.5}" text-anchor="middle" font-size="10" fill="#1c1812">${esc(label)}</text>
  </g>`;
}

function renderLinkGraph(scope) {
  const raw = scope === "global" ? buildGlobalGraph() : buildLocalGraph();
  const bar =
    scope === "global"
      ? `<div class="atlas-bar">
          <button class="btn" id="atlasWeave" type="button">${atlasWoveFor === state.videoId ? "再织一版" : "织进总图"}</button>
          <span>${raw.nodes.filter((n) => n.kind === "concept").length} 个概念 · ${raw.nodes.filter((n) => n.shared).length} 个跨视频</span>
        </div>`
      : `<div class="atlas-bar"><span>${raw.nodes.length} 个节点 · ${raw.edges.length} 条双链</span></div>`;
  if (!raw.nodes.length) {
    return `${bar}<div class="chat-empty">${
      scope === "global"
        ? atlasEmptyReason()
        : "知识块、笔记或金句出来后，会在这里连成一张总览图。笔记里写 [[概念]] 就能接到节点上。"
    }</div>`;
  }
  const W = 340;
  const H = graphMode === "near" ? 420 : 500;
  const view = applyGraphLayout(
    graphMode === "near" ? layoutNearGraph(raw, W, H) : layoutAllGraph(raw, W, H),
    scope,
    W,
    H,
  );
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const focusId = view.focus?.id || pickGraphFocus(view)?.id || "";
  if (focusId && !graphFocusId) graphFocusId = focusId;
  const lines = view.edges
    .map((e) => {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) return "";
      const faint = graphMode === "near" && a.hop === 2 && b.hop === 2;
      return `<line class="graph-edge" data-edge="${e.from}>${e.to}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.kind === "mentions" ? "#9a8b78" : "#b83c28"}" stroke-width="${faint ? 0.8 : 1.35}" stroke-opacity="${faint ? 0.28 : 0.42}"/>`;
    })
    .join("");
  const dots = view.nodes
    .map((n) => {
      const st = GRAPH_STYLE[n.kind] || GRAPH_STYLE.concept;
      const r = n.hop === 0 ? st.r + 6 : n.hop === 2 ? Math.max(6, st.r - 3) : st.r;
      const fill = n.shared ? "#fff3b0" : n.hop === 0 ? st.stroke : st.fill;
      const on = n.id === openGraphId || n.id === graphFocusId;
      const showLabel = graphMode === "near" ? n.hop < 2 : n.kind === "video" || n.kind === "concept" || n.shared;
      const nbs = view.edges
        .filter((e) => e.from === n.id || e.to === n.id)
        .map((e) => (e.from === n.id ? e.to : e.from))
        .join(" ");
      return `<g class="graph-node${on ? " on" : ""}" data-gid="${n.id}" data-gkind="${n.kind}" data-cid="${n.cid || ""}" data-glabel="${esc(n.label)}" data-nb="${nbs}">
        <circle cx="${n.x}" cy="${n.y}" r="${on ? r + 2 : r}" fill="${fill}" stroke="${st.stroke}" stroke-width="${on || n.hop === 0 ? 2 : 1.2}"/>
        ${showLabel ? graphPill(n.x, n.y + r + 6, n.label, on) : ""}
      </g>`;
    })
    .join("");
  const inspect = openGraphId ? renderGraphInspect(byId.get(openGraphId) || byId.get(graphFocusId), scope) : "";
  const focus = byId.get(graphFocusId) || view.focus;
  return `${bar}
    <div class="graph-tools">
      <button class="seg-btn${graphMode === "near" ? " active" : ""}" data-gmode="near" type="button">${t("附近")}</button>
      <button class="seg-btn${graphMode === "all" ? " active" : ""}" data-gmode="all" type="button">${t("全图")}</button>
      <button class="text-btn" id="graphReset" type="button">${t("复原位置")}</button>
      <span class="graph-legend">${t("拖开节点 · 点一下打开")}</span>
    </div>
    ${focus ? `<div class="graph-now">${esc(GRAPH_KIND[focus.kind] || "")} · ${esc(focus.label)}</div>` : ""}
    <svg class="link-graph" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${svgSheet(W, H, scope)}
      ${lines}${dots}
    </svg>
    <div class="graph-tip" hidden></div>
    <div id="graphInspect">${inspect}</div>`;
}

function bindLinkGraph(box, scope) {
  const svg = box.querySelector("svg.link-graph");
  if (!svg) return;
  const raw = scope === "global" ? buildGlobalGraph() : buildLocalGraph();
  const W = svg.viewBox.baseVal.width || 340;
  const H = svg.viewBox.baseVal.height || 420;
  const view = applyGraphLayout(
    graphMode === "near" ? layoutNearGraph(raw, W, H) : layoutAllGraph(raw, W, H),
    scope,
    W,
    H,
  );
  const tip = box.querySelector(".graph-tip");
  const setHot = (id) => {
    svg.classList.toggle("is-hot", Boolean(id));
    svg.querySelectorAll(".graph-node").forEach((el) => {
      const nbs = new Set((el.dataset.nb || "").split(" ").filter(Boolean));
      el.classList.toggle("hot", el.dataset.gid === id || nbs.has(id));
    });
    svg.querySelectorAll(".graph-edge").forEach((el) => {
      const [a, b] = (el.dataset.edge || ">").split(">");
      el.classList.toggle("hot", Boolean(id) && (a === id || b === id));
    });
  };
  svg.querySelectorAll(".graph-node").forEach((el) => {
    el.addEventListener("pointerenter", () => {
      setHot(el.dataset.gid);
      if (tip) {
        tip.hidden = false;
        tip.textContent = `${GRAPH_KIND[el.dataset.gkind] || ""} · ${el.dataset.glabel || ""}`;
      }
    });
    el.addEventListener("pointerleave", () => {
      setHot("");
      if (tip) tip.hidden = true;
    });
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (el.dataset.dragging === "1") return;
      const id = el.dataset.gid;
      openGraphId = id;
      if (el.dataset.gkind === "concept") openConceptId = el.dataset.cid || id;
      if (graphMode === "near" && id !== graphFocusId) {
        graphFocusId = id;
        renderMaps();
        $("graphInspect")?.scrollIntoView({ block: "nearest" });
        return;
      }
      graphFocusId = id;
      const host = $("graphInspect");
      if (host) {
        const raw = scope === "global" ? buildGlobalGraph() : buildLocalGraph();
        const node = raw.nodes.find((n) => n.id === id);
        host.innerHTML = renderGraphInspect(node, scope);
        bindLibJumps(host);
        host.querySelectorAll("[data-jump]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            peekSeek(Number(btn.dataset.jump), { kind: "maps" });
          });
        });
        bindFeynmanOpens(host);
      }
      svg.querySelectorAll(".graph-node").forEach((n) => n.classList.toggle("on", n.dataset.gid === id));
    });
  });
  box.querySelectorAll("[data-gmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      graphMode = btn.dataset.gmode;
      renderMaps();
    });
  });
  $("graphReset")?.addEventListener("click", () => clearGraphLayout(scope));
  bindGraphDrag(svg, view, scope, W, H);
}

function renderConceptMapSvg() {
  return renderConceptMapSvgFrom(state.conceptMap, false);
}

function renderConceptMapSvgFrom(map, atlasMode) {
  if (!isNovakMap(map)) {
    return `<div class="chat-empty">${state.blocks.length ? "概念图生成中。出来后是从上到下的层级：概念在框里，线上是连接词。" : "先等拆页切出知识块，再看层级图。"}</div>`;
  }
  const qLines = wrapText(map.focusQuestion || "", 16);
  const focusH = 16 + qLines.length * 16;
  const { pos, height, width } = layoutNovak(map, focusH);
  const names = new Map((map.concepts || []).map((c) => [c.id, c.label]));
  const props = map.propositions || [];
  const marker = atlasMode ? "vb-amap" : "vb-cmap";
  const links = props
    .map((e, i) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      const x1 = a.x;
      const y1 = a.y + a.boxH / 2;
      const x2 = b.x;
      const y2 = b.y - b.boxH / 2;
      const t = 0.42;
      const mx = x1 + (x2 - x1) * t + ((i % 3) - 1) * 12;
      const my = y1 + (y2 - y1) * t;
      const linkLines = wrapText(e.link, 8);
      const lw = Math.min(120, Math.max(36, Math.max(...linkLines.map((l) => l.length)) * 9 + 12));
      const lh = 8 + linkLines.length * 12;
      const dash = e.cross ? `stroke-dasharray="4 3"` : "";
      return `<path d="M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2} ${x2},${y2}" fill="none" stroke="${e.cross ? "#8d867c" : "#c4472d"}" stroke-width="1.2" ${dash} marker-end="url(#${marker})"/>
        <rect x="${mx - lw / 2}" y="${my - lh / 2}" width="${lw}" height="${lh}" rx="4" fill="#fffdf8"/>
        ${svgLines(mx, my, linkLines, { size: 9, fill: "#5f5a53" })}`;
    })
    .join("");
  const boxes = [...pos.values()]
    .map((p) => {
      const block = Number(p.c.block);
      const blockAttr = !atlasMode && Number.isFinite(block) && block >= 0 ? `data-block="${block}"` : "";
      const atlasAttr = atlasMode ? `data-atlas="${p.c.id}"` : "";
      const multi = atlasMode && (p.c.sources || []).length > 1;
      const on = !atlasMode && mapPick && (mapPick.id === p.c.id || mapPick.label === p.c.label);
      const pickAttr = atlasMode ? "" : `data-pick="1" data-cid="${escAttr(p.c.id)}" data-label="${escAttr(p.c.label)}"`;
      return `<g class="map-node${on ? " on" : ""}" ${pickAttr} ${blockAttr} ${atlasAttr}>
        <rect x="${p.x - p.boxW / 2}" y="${p.y - p.boxH / 2}" width="${p.boxW}" height="${p.boxH}" rx="6" fill="${multi ? "#fff3b0" : "#fffdf8"}" stroke="${on ? "#c45c26" : "#1c1812"}" stroke-width="${on ? 2.4 : 1.2}"/>
        ${svgLines(p.x, p.y, p.lines, { size: 11, fill: "#1c1812" })}
      </g>`;
    })
    .join("");
  const list = atlasMode
    ? ""
    : props
        .map((e) => {
          const from = names.get(e.from) || e.from;
          const to = names.get(e.to) || e.to;
          return `<li><button type="button" class="text-btn" data-pick="1" data-cid="${escAttr(e.from)}" data-label="${escAttr(from)}">${esc(from)}</button> <i>${esc(e.link)}</i> <button type="button" class="text-btn" data-pick="1" data-cid="${escAttr(e.to)}" data-label="${escAttr(to)}">${esc(to)}</button>${e.cross ? " <em>交叉</em>" : ""}</li>`;
        })
        .join("");
  return `<div class="cmap">
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="${marker}" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto">
          <path d="M0,0 L10,3.5 L0,7 Z" fill="#c4472d"/>
        </marker>
      </defs>
      ${svgSheet(width, height, marker)}
      ${svgLines(width / 2, 10, qLines, { size: 12, weight: "700", fill: "#1c1812", top: true, leading: 16 })}
      ${links}${boxes}
    </svg>
    ${list ? `<ol class="cmap-props">${list}</ol>` : ""}
  </div>`;
}

function argLink(x1, y1, x2, y2, color) {
  const midY = y1 + Math.max(16, (y2 - y1) * 0.42);
  return `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="1.1" opacity="0.55"/>`;
}

function argCard(item, x, y, w, lines, tone, id) {
  const stamp = tone === "ok" ? t("支撑") : t("限制");
  const ink = tone === "ok" ? "#5c6854" : "#a05650";
  const h = Math.max(52, lines.length * 15 + 28);
  const attr = item.block >= 0 ? `data-block="${item.block}"` : "";
  const on = mapPick?.id === id;
  return {
    h,
    svg: `<g class="map-node arg-card${on ? " on" : ""}" data-pick="1" data-cid="${escAttr(id)}" data-label="${escAttr(item.text || "")}" data-role="${escAttr(stamp)}" ${attr}>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fffaf3" stroke="${on ? "#c45c26" : "#d8cfc0"}" stroke-width="${on ? 2 : 1}"/>
      <path d="M${x + 0.5},${y + 6} L${x + 0.5},${y + h - 6}" stroke="${ink}" stroke-width="2.4"/>
      <text x="${x + 10}" y="${y + 14}" font-size="9" font-weight="700" fill="${ink}" letter-spacing="1.4">${esc(stamp)}</text>
      ${svgLines(x + w / 2, y + 16 + (h - 16) / 2, lines, { size: 11, fill: "#2c2418" })}
    </g>`,
  };
}

function renderArgMapSvg() {
  const map = state.argMap;
  if (!map?.claim) {
    return `<div class="chat-empty">${state.blocks.length ? "论证图生成中。" : "先等拆页切出知识块，再看论证图。"}</div>`;
  }
  const W = 360;
  const supports = map.supports || [];
  const rebuts = map.rebuts || [];
  const claimLines = wrapText(map.claim, 16);
  const claimH = Math.max(58, claimLines.length * 16 + 32);
  const claimW = 320;
  const claimX = (W - claimW) / 2;
  const claimTop = 14;
  const claimBottom = claimTop + claimH;
  const single = !supports.length || !rebuts.length;
  let y = claimBottom + 22;
  let cards = "";

  if (single) {
    const rows = supports.length ? supports : rebuts;
    const tone = supports.length ? "ok" : "no";
    const ink = tone === "ok" ? "#5c6854" : "#a05650";
    const fromX = tone === "ok" ? claimX + 28 : claimX + claimW - 28;
    rows.forEach((s, i) => {
      const lines = wrapText(s.text, 22);
      const card = argCard(s, 20, y, 320, lines, tone, `${tone === "ok" ? "arg-s" : "arg-r"}-${i}`);
      const toX = 20 + 28 + ((i % 3) - 1) * 18;
      cards += `${argLink(fromX, claimBottom, toX, y, ink)}${card.svg}`;
      y += card.h + 14;
    });
  } else {
    const lefts = supports.map((s) => ({ s, lines: wrapText(s.text, 11) }));
    const rights = rebuts.map((s) => ({ s, lines: wrapText(s.text, 11) }));
    const rows = Math.max(lefts.length, rights.length);
    for (let i = 0; i < rows; i++) {
      const L = lefts[i];
      const R = rights[i];
      const lCard = L ? argCard(L.s, 12, y, 160, L.lines, "ok", `arg-s-${i}`) : null;
      const rCard = R ? argCard(R.s, 188, y, 160, R.lines, "no", `arg-r-${i}`) : null;
      const rowH = Math.max(lCard?.h || 0, rCard?.h || 0);
      if (lCard) {
        cards += `${argLink(claimX + 36, claimBottom, 12 + 36, y, "#5c6854")}${lCard.svg}`;
      }
      if (rCard) {
        cards += `${argLink(claimX + claimW - 36, claimBottom, 188 + 124, y, "#a05650")}${rCard.svg}`;
      }
      y += rowH + 14;
    }
  }

  const H = y + 10;
  return `<svg class="arg-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${svgSheet(W, H, "arg")}
    ${cards}
    <g class="map-node arg-claim${mapPick?.id === "arg-claim" ? " on" : ""}" data-pick="1" data-cid="arg-claim" data-label="${escAttr(map.claim)}" data-role="${escAttr(t("主张"))}">
      <rect x="${claimX}" y="${claimTop}" width="${claimW}" height="${claimH}" rx="8" fill="#1c1812" stroke="${mapPick?.id === "arg-claim" ? "#c45c26" : "none"}" stroke-width="2"/>
      <text x="${claimX + 16}" y="${claimTop + 16}" font-size="9" font-weight="700" fill="#e6c2b4" letter-spacing="2">${esc(t("主张"))}</text>
      ${svgLines(W / 2, claimTop + 22 + (claimH - 22) / 2, claimLines, { size: 13, weight: "700", fill: "#fffaf4", leading: 16 })}
    </g>
  </svg>`;
}

function renderTimeMapSvg() {
  const golds = videoQuotes();
  const events = [
    ...state.blocks.map((b, i) => ({ kind: "block", start: b.start || 0, i, b })),
    ...golds.map((q) => ({ kind: "quote", start: q.seconds || 0, q })),
  ].sort((a, b) => a.start - b.start);
  if (!events.length) {
    return `<div class="chat-empty">${
      isExtractingQuotes ? "金句在抽，出来后会按时间排在这条线上。" : "知识块或金句出来后，这里按时间排成一条线。"
    }</div>`;
  }
  const W = 360;
  let y = 16;
  const items = events
    .map((ev, idx) => {
      if (ev.kind === "quote") {
        const { en, zh } = quotePairText(ev.q);
        const label = (en || zh || ev.q.text || "").slice(0, 36);
        const titleLines = wrapText(label, 18);
        const boxH = Math.max(40, titleLines.length * 16 + 14);
        const top = y;
        y += boxH + 12;
        return `${idx ? `<line x1="20" y1="${top - 10}" x2="20" y2="${top + 4}" stroke="#e6dece"/>` : ""}
          <g class="map-node${mapPick?.id === `time-q-${idx}` ? " on" : ""}" data-pick="1" data-cid="time-q-${idx}" data-label="${escAttr(label)}" data-jump="${ev.start}" data-role="${escAttr(t("金句"))}">
            <circle cx="20" cy="${top + boxH / 2}" r="5" fill="#c4472d"/>
            <text x="34" y="${top + boxH / 2 - 6}" font-size="10" fill="#9a9286">${clock(ev.start)}</text>
            <text x="34" y="${top + boxH / 2 + 8}" font-size="10" font-weight="700" fill="#c4472d">${esc(t("金句"))}</text>
            <rect x="96" y="${top}" width="248" height="${boxH}" rx="8" fill="#fff3ee" stroke="${mapPick?.id === `time-q-${idx}` ? "#c45c26" : "#e6dece"}"/>
            ${svgLines(220, top + boxH / 2, titleLines, { size: 12, fill: "#2c2418" })}
          </g>`;
      }
      const titleLines = wrapText(ev.b.title, 14);
      const boxH = Math.max(40, titleLines.length * 16 + 14);
      const st = blockProgress(ev.i);
      const fill = st === "done" ? "#eef6ee" : st === "learning" ? "#fff4e4" : "#fffdf8";
      const kind = CAT_LABEL[ev.b.category] || "";
      const color = CAT_COLOR[ev.b.category] || "#c45c26";
      const top = y;
      y += boxH + 12;
      return `${idx ? `<line x1="20" y1="${top - 10}" x2="20" y2="${top + 4}" stroke="#e6dece"/>` : ""}
        <g class="map-node${mapPick?.id === `time-b-${ev.i}` ? " on" : ""}" data-pick="1" data-cid="time-b-${ev.i}" data-label="${escAttr(ev.b.title)}" data-block="${ev.i}">
          <circle cx="20" cy="${top + boxH / 2}" r="5" fill="${color}"/>
          <text x="34" y="${top + boxH / 2 - 6}" font-size="10" fill="#9a9286">${clock(ev.b.start)}</text>
          <text x="34" y="${top + boxH / 2 + 8}" font-size="10" font-weight="700" fill="${color}">${esc(kind)}</text>
          <rect x="96" y="${top}" width="248" height="${boxH}" rx="8" fill="${fill}" stroke="${mapPick?.id === `time-b-${ev.i}` ? "#c45c26" : "#e6dece"}"/>
          ${svgLines(220, top + boxH / 2, titleLines, { size: 12, fill: "#2c2418" })}
        </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${y + 8}" xmlns="http://www.w3.org/2000/svg">
    ${svgSheet(W, y + 8, "time")}
    ${items}
  </svg>`;
}

function renderBrickList() {
  const root = $("brickList");
  root.innerHTML = "";
  if (!state.blocks.length) {
    root.innerHTML = `<div class="chat-empty">${
      isAnalyzing ? t("正在拆成知识块…") : t("点「拆」才拆页。拆完可以一块一块看，或闭卷讲一遍。")
    }${isAnalyzing ? "" : `<div class="row-actions"><button class="btn" type="button" id="brickRetry">${t("拆")}</button></div>`}</div>`;
    $("brickRetry")?.addEventListener("click", () => analyzeBlocks());
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
    const labels = { fresh: "未开始", learning: "进行中", done: "已学会" };
    root.innerHTML = `<div class="chat-empty">这一栏没有「${labels[brickFilter] || brickFilter}」。<button class="btn" type="button" id="brickShowAll">看全部</button></div>`;
    $("brickShowAll")?.addEventListener("click", () => {
      brickFilter = "all";
      document.querySelectorAll("[data-progress]").forEach((b) => b.classList.toggle("active", b.dataset.progress === "all"));
      renderBrickList();
    });
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
      scene.innerHTML = `<span>${CAT_LABEL[block.category] || ""}</span>${
        DIVE_FRAME[block.category] ? `<small>${DIVE_FRAME[block.category]}</small>` : ""
      }`;
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
            ${DIVE_FRAME[block.category] ? `<span class="brick-frame">${DIVE_FRAME[block.category]}</span>` : ""}
            <span class="brick-st">${PROGRESS_LABEL[st]}</span>
          </div>
          <div class="brick-title">${esc(block.title)}</div>
        </div>
        <span class="brick-time" data-s="${block.start}">${clock(block.start)}–${clock(block.end)}</span>
      </div>
      <p class="brick-summary">${esc(block.summary)}</p>
      <div class="brick-tools">
        <button class="btn" data-dive="${i}" type="button" title="${
          DIVE_FRAME[block.category]
            ? `按「${DIVE_FRAME[block.category]}」看这块是什么`
            : "拆解看这块是什么"
        }">${state.dives[i] ? "再拆" : "拆解"}</button>
        <button class="btn" data-script="${i}" type="button">${state.scriptStudio === i ? "收起费曼" : "费曼"}</button>
        <button class="btn${state.loopIndex === i ? " loop-on" : ""}" data-loop="${i}" type="button">${state.loopIndex === i ? "停循环" : "循环"}</button>
        <button class="btn" data-more="${i}" type="button">${brickMoreOpen === i ? "收起" : "···"}</button>
      </div>
      ${
        brickMoreOpen === i
          ? `<div class="brick-more-menu">
              <button class="btn" data-ask="${i}" type="button">提问</button>
              <button class="btn" data-learn="${i}" type="button">${st === "done" ? "未学会" : "已学会"}</button>
              <button class="btn" data-later="${i}" type="button">以后再看</button>
            </div>
            <div class="viz-bar">
              <span>做成图</span>
              <button class="viz-btn${viz?.kind === "info" ? " on" : ""}" data-viz="info" type="button">信息图</button>
              <button class="viz-btn${viz?.kind === "mind" ? " on" : ""}" data-viz="mind" type="button">导图</button>
              <button class="viz-btn${viz?.kind === "flow" ? " on" : ""}" data-viz="flow" type="button">流程</button>
            </div>`
          : ""
      }
      <div class="dive-slot" ${open ? "" : "hidden"}></div>
    `;
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, .brick-time, .viz-frame, .pick-card, a, textarea, input, .script-studio")) return;
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
    card.querySelector(`[data-more="${i}"]`)?.addEventListener("click", (event) => {
      event.stopPropagation();
      brickMoreOpen = brickMoreOpen === i ? -1 : i;
      renderBrickList();
    });
    card.querySelector(`[data-ask="${i}"]`)?.addEventListener("click", () => {
      selectBlock(i, "ask");
      $("askInput").focus();
    });
    card.querySelector(`[data-learn="${i}"]`)?.addEventListener("click", () => {
      setProgress(i, st === "done" ? "fresh" : "done");
    });
    card.querySelector(`[data-later="${i}"]`)?.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (st === "fresh") setProgress(i, "learning");
      await scheduleBrick(i);
      event.currentTarget.textContent = "已排入";
      flashHint("已排到明天复习。去顶栏「复习」能看到。");
    });
    card.querySelectorAll("[data-viz]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        makeVisual(i, btn.dataset.viz);
      });
    });
    const slot = card.querySelector(".dive-slot");
    if (open) {
      if (viz) {
        slot.insertAdjacentHTML("beforeend", renderVisualHtml(i, viz));
        bindVisualHits(slot, i);
        bindPickCard(slot, "bricks");
      }
      if (state.dives[i] && state.scriptStudio !== i) {
        slot.insertAdjacentHTML("beforeend", renderDiveHtml(state.dives[i], i));
        slot.querySelector("[data-to-feynman]")?.addEventListener("click", (event) => {
          event.stopPropagation();
          if (state.scriptStudio !== i) toggleScriptStudio(i);
        });
      }
      if (state.scriptStudio === i) {
        slot.insertAdjacentHTML("beforeend", renderScriptStudio(i));
        bindScriptStudio(slot, i);
      }
      slot.querySelector("[data-dlviz]")?.addEventListener("click", () => downloadVisual(i));
    }
    root.appendChild(card);
  });
}

function diveCard(name, role) {
  if (!role) return "";
  return `<div class="part-card"><b>${esc(name)}</b><p>${esc(role)}</p></div>`;
}

function diveNote(label, text) {
  if (!text) return "";
  return `<p class="dive-note"><b>${label}</b>${esc(text)}</p>`;
}

function diveCheckHtml(i) {
  return `<p class="dive-note own dive-check"><b>${t("怎样才算会了")}</b>${t("按几个问题讲出来，对照材料。")}<button class="text-btn" type="button" data-to-feynman="${i}">${t("去费曼检验")}</button></p>`;
}

function diveKindOf(dive, i) {
  if (CAT_ORDER.includes(dive?.kind)) return dive.kind;
  const cat = Number.isInteger(i) ? state.blocks[i]?.category : "";
  if (CAT_ORDER.includes(cat)) return cat;
  return "";
}

function diveHasTyped(kind, dive) {
  if (!dive || !kind) return false;
  if (kind === "concept") return Boolean(dive.essence || dive.elaborate || dive.example || dive.counter || dive.analogy);
  if (kind === "case") return Boolean(dive.claim || caseMechanismOf(dive) || dive.transfer || dive.hidden);
  if (kind === "story") return Boolean(dive.event || dive.pattern || dive.structure || dive.belief);
  if (kind === "action") return Boolean(dive.goal || dive.prereq?.length || dive.steps?.length || dive.fail || dive.experiment);
  if (kind === "qa") return Boolean(dive.question || dive.claim || dive.warrant || dive.qualifier);
  return false;
}

function diveFrameHtml(kind) {
  if (!kind) return "";
  return `<p class="dive-frame">${esc(CAT_LABEL[kind] || "")}${
    DIVE_FRAME[kind] ? ` · ${esc(DIVE_FRAME[kind])}` : ""
  }<span>拆解看这块是什么</span></p>`;
}

function diveParts(dive, i) {
  if (!dive) return [];
  if (dive.parts?.length) return dive.parts;
  const kind = diveKindOf(dive, i);
  const row = (name, role) => (role ? { name, role: String(role) } : null);
  const rows =
    kind === "concept"
      ? [row("定义", dive.essence), row("边界", dive.elaborate), row("正例", dive.example), row("反例", dive.counter), row("类比", dive.analogy)]
      : kind === "case"
        ? [row("主张", dive.claim), row("机制", caseMechanismOf(dive)), row("迁移", dive.transfer), row(t("没说的前提"), dive.hidden)]
        : kind === "story"
          ? [row("事件", dive.event), row("模式", dive.pattern), row("结构", dive.structure), row(t("想让你信"), dive.belief)]
          : kind === "action"
            ? [
                row("目标", dive.goal),
                ...(dive.steps || []).map((s) => row(s.name, s.judge || s.name)),
                row("易败点", dive.fail),
                row("小实验", dive.experiment),
              ]
            : kind === "qa"
              ? [row("问题", dive.question), row("主张", dive.claim), row("依据", dive.warrant), row("限定", dive.qualifier)]
              : [];
  return rows.filter(Boolean);
}

function caseMechanismOf(dive) {
  if (typeof dive?.caseMechanism === "string" && dive.caseMechanism) return dive.caseMechanism;
  if (typeof dive?.mechanism === "string") return dive.mechanism;
  return "";
}

function diveHeadline(dive) {
  if (!dive) return "";
  return dive.essence || dive.claim || dive.goal || dive.question || dive.event || dive.summary || "";
}

function renderDiveHtml(dive, i) {
  const kind = diveKindOf(dive, i);
  const frame = diveFrameHtml(kind);
  const list = (label, items) => {
    if (!items?.length) return "";
    return `<div class="dive-col"><div class="dive-label">${label}</div><ul>${items
      .map((item) => `<li>${linkifyTimes(item)}</li>`)
      .join("")}</ul></div>`;
  };
  const tail = () =>
    `<div class="dive-cols">
      ${list("何时用", dive.retrieve)}
      ${list("怎么记", dive.encode)}
      ${list("挂钩", dive.connect)}
    </div>
    ${dive.gap ? diveNote("缺口", dive.gap) : ""}
    ${diveCheckHtml(i)}`;
  const wrap = (body) => `<div class="dive" data-kind="${esc(kind || "legacy")}">${frame}${body}</div>`;

  if (diveHasTyped(kind, dive) && kind === "concept") {
    return wrap(`
      ${dive.essence ? `<p class="dive-hero">${esc(dive.essence)}</p>` : ""}
      <div class="part-grid">
        ${diveCard("边界", dive.elaborate)}
        ${diveCard("正例", dive.example)}
        ${diveCard("反例", dive.counter)}
        ${diveCard("类比", dive.analogy)}
      </div>
      ${tail()}`);
  }
  if (diveHasTyped(kind, dive) && kind === "case") {
    return wrap(`
      ${dive.claim ? `<p class="dive-hero">${esc(dive.claim)}</p>` : ""}
      ${diveNote("机制", caseMechanismOf(dive))}
      ${diveNote("换场景", dive.transfer)}
      ${diveNote(t("没说的前提"), dive.hidden)}
      ${tail()}`);
  }
  if (diveHasTyped(kind, dive) && kind === "story") {
    return wrap(`
      <div class="part-grid iceberg">
        ${diveCard("事件", dive.event)}
        ${diveCard("模式", dive.pattern)}
        ${diveCard("结构", dive.structure)}
        ${diveCard(t("想让你信"), dive.belief)}
      </div>
      ${tail()}`);
  }
  if (diveHasTyped(kind, dive) && kind === "action") {
    const steps = (dive.steps || [])
      .map((s) => `<div class="part-card"><b>${esc(s.name)}</b>${s.judge ? `<p>${esc(s.judge)}</p>` : ""}</div>`)
      .join("");
    return wrap(`
      ${dive.goal ? `<p class="dive-hero">${esc(dive.goal)}</p>` : ""}
      ${list("前提", dive.prereq)}
      ${steps ? `<div class="part-grid">${steps}</div>` : ""}
      ${diveNote("最容易失败", dive.fail)}
      ${diveNote("第一次小实验", dive.experiment)}
      ${tail()}`);
  }
  if (diveHasTyped(kind, dive) && kind === "qa") {
    return wrap(`
      ${dive.question ? `<p class="dive-hero">${esc(dive.question)}</p>` : ""}
      ${diveNote("主张", dive.claim)}
      ${diveNote("依据", dive.warrant)}
      ${diveNote("何时不适用", dive.qualifier)}
      ${tail()}`);
  }
  if (dive.essence || dive.parts?.length) {
    const parts = (dive.parts || [])
      .map(
        (p) =>
          `<div class="part-card"><b>${esc(p.name)}</b><p>${esc(p.role)}</p>${p.ifMissing ? `<em>缺了：${esc(p.ifMissing)}</em>` : ""}</div>`,
      )
      .join("");
    return wrap(`
      ${dive.essence ? `<p class="dive-hero">${esc(dive.essence)}</p>` : ""}
      ${parts ? `<div class="part-grid">${parts}</div>` : ""}
      ${dive.map ? `<p class="dive-map">${esc(dive.map)}</p>` : ""}
      ${tail()}`);
  }
  const concepts = (dive.concepts || [])
    .map((c) => `<div class="part-card"><b>${esc(c.term)}</b><p>${esc(c.def)}</p></div>`)
    .join("");
  return wrap(`
    ${dive.summary ? `<p class="dive-hero">${esc(dive.summary)}</p>` : ""}
    ${concepts ? `<div class="part-grid">${concepts}</div>` : ""}
    <div class="dive-cols">
      ${list("前置", dive.prereq)}
      ${list("原理", Array.isArray(dive.mechanism) ? dive.mechanism : [])}
      ${list("例子", dive.examples)}
      ${list("坑", dive.pitfalls)}
      ${list("自测", dive.selfTest)}
    </div>
    ${diveCheckHtml(i)}`);
}

function loopEndForSegment(idx) {
  const seg = state.segments[idx];
  if (!seg) return 0;
  const next = state.segments[idx + 1];
  const end =
    Number(seg.end) > Number(seg.start) + 0.4
      ? Number(seg.end)
      : next
        ? Number(next.start)
        : Number(seg.start) + 5;
  return Math.max(Number(seg.start) + 1.2, end);
}

function updateLoopBtn() {
  const btn = $("loopLineBtn");
  if (btn) {
    const on = isLooping() && !state.shadowing;
    const span = selectionLoopRange();
    btn.classList.toggle("active", on);
    btn.textContent = on ? t("停循环") : span && span.to > span.from ? t("循环这几句") : t("循环这句");
    btn.title = on ? t("再按 A 或 Esc 停") : t("循环正在说的这句，或你划过的几句");
  }
  updateShadowBtn();
  renderLoopBanner();
}

function refreshLoopChrome() {
  updateLoopBtn();
  paintLoopRows();
  if (currentView() === "bricks") {
    renderBrickBar();
    renderBrickList();
  }
}

function updateShadowBtn() {
  const btn = $("shadowBtn");
  if (!btn) return;
  btn.classList.toggle("active", Boolean(state.shadowing));
  btn.textContent = state.shadowing ? t("停跟读") : t("跟读");
  btn.title = state.shadowing ? t("再按一次或 Esc 停") : t("划一段再跟读。会自动降速，听完空一拍。");
}

function renderLoopBanner() {
  const el = $("loopBanner");
  if (!el) return;
  if (!isLooping()) {
    el.hidden = true;
    el.innerHTML = "";
    el.classList.remove("is-shadow");
    syncReadBanners();
    return;
  }
  const span = state.loopSpan;
  const shadow = Boolean(state.shadowing);
  const label = shadow
    ? state.loopIndex >= 0
      ? t("正在跟读这一块")
      : span && span.to > span.from
        ? t("正在跟读第 {from}–{to} 句", { from: span.from + 1, to: span.to + 1 })
        : t("正在跟读这一句")
    : state.loopIndex >= 0
      ? t("正在循环这一块")
      : span && span.to > span.from
        ? t("正在循环第 {from}–{to} 句", { from: span.from + 1, to: span.to + 1 })
        : t("正在循环这一句");
  const hint = shadow
    ? state.shadowGap
      ? t("听完空一拍，你再跟")
      : t("这段在循环，没有空拍")
    : t("再按 A 或 Esc 停");
  el.hidden = false;
  el.classList.toggle("is-shadow", shadow);
  el.innerHTML = `<span>${label}。${hint}。</span>
    ${rateButtonsHtml("loopRate")}
    ${
      shadow
        ? `<span class="seg-toggle rate-toggle" id="shadowGapToggle">
            <button type="button" class="seg-btn${state.shadowGap ? " active" : ""}" data-gap="1">${t("空拍")}</button>
            <button type="button" class="seg-btn${state.shadowGap ? "" : " active"}" data-gap="0">${t("不停")}</button>
          </span>`
        : ""
    }
    <button class="text-btn" type="button" id="loopStopBtn">${shadow ? t("停跟读") : t("停循环")}</button>`;
  $("loopStopBtn")?.addEventListener("click", () => {
    const wasShadow = state.shadowing;
    clearAllLoops();
    refreshLoopChrome();
    flashHint(wasShadow ? t("已停跟读") : t("已停循环"));
  });
  $("loopRate")?.querySelectorAll("[data-rate]").forEach((btn) => {
    btn.addEventListener("click", () => applyPlayRate(btn.dataset.rate));
  });
  $("shadowGapToggle")?.querySelectorAll("[data-gap]").forEach((btn) => {
    btn.addEventListener("click", () => setShadowGap(btn.dataset.gap === "1"));
  });
  syncReadBanners();
}

function setShadowGap(on) {
  state.shadowGap = Boolean(on);
  saveSettings({ shadowGap: state.shadowGap });
  if (state.shadowing && state.loopSpan) {
    state.shadowGapSec = state.shadowGap ? shadowGapSeconds(state.loopSpan) : 0;
    applyLoopToPage();
  }
  renderLoopBanner();
}

function shadowGapSeconds(span) {
  const dur = Math.max(0.8, Number(span.end) - Number(span.start) || 1.6);
  return Math.min(4.5, Math.max(1.2, dur * 0.9));
}

function clearAllLoops() {
  const wasShadow = state.shadowing;
  state.loopIndex = -1;
  state.lineLoop = -1;
  state.loopSpan = null;
  state.shadowing = false;
  sendToTabSure({ type: "VB_LOOP_CLEAR" });
  if (wasShadow && watchRate !== playbackRate) applyPlayRate(watchRate, false);
  updateLoopBtn();
}

function selectionLoopRange() {
  const sel = window.getSelection();
  const box = $("transcriptBox");
  if (!sel || sel.isCollapsed || !sel.rangeCount || !box) return null;
  const range = sel.getRangeAt(0);
  const rows = [...box.querySelectorAll(".t-row")].filter((row) => {
    try {
      return range.intersectsNode(row);
    } catch (_e) {
      return false;
    }
  });
  if (!rows.length) return null;
  const from = Number(rows[0].dataset.idx);
  const to = Number(rows[rows.length - 1].dataset.idx);
  if (!Number.isFinite(from) || !state.segments[from]) return null;
  const last = Number.isFinite(to) ? to : from;
  return {
    start: state.segments[from].start,
    end: loopEndForSegment(last),
    from,
    to: last,
  };
}

function sameLoopSpan(a, b) {
  return a && b && a.from === b.from && a.to === b.to;
}

function loopMessage(span, seek = true) {
  const msg = { type: "VB_LOOP", start: span.start, end: span.end, seek };
  if (state.shadowing) {
    msg.mode = "shadow";
    msg.gap = state.shadowGap ? state.shadowGapSec || shadowGapSeconds(span) : 0;
  }
  return msg;
}

async function startSpanLoop(span, opts = {}) {
  state.loopIndex = -1;
  state.loopSpan = span;
  state.lineLoop = span.from === span.to ? span.from : -1;
  state.shadowing = Boolean(opts.shadow);
  if (state.shadowing) {
    state.shadowGapSec = state.shadowGap ? shadowGapSeconds(span) : 0;
  }
  updateLoopBtn();
  paintLoopRows();
  const res = await sendToTabSure(loopMessage(span, true));
  if (!res) {
    state.loopSpan = null;
    state.lineLoop = -1;
    state.shadowing = false;
    updateLoopBtn();
    paintLoopRows();
    return false;
  }
  scrollToSeconds(span.start);
  checkAchievementsSoon(state.shadowing ? "shadow" : "loop");
  return true;
}

async function toggleLineLoop(idx) {
  if (idx < 0 || !state.segments[idx]) {
    flashHint("这一秒还对不上字幕。");
    return;
  }
  if (state.lineLoop === idx && !state.loopSpan) {
    clearAllLoops();
  } else {
    await startSpanLoop({
      start: state.segments[idx].start,
      end: loopEndForSegment(idx),
      from: idx,
      to: idx,
    });
  }
  refreshLoopChrome();
}

async function toggleReaderLoop(fallbackIdx) {
  const span = selectionLoopRange();
  if (span) {
    if (sameLoopSpan(state.loopSpan, span) && !state.shadowing) clearAllLoops();
    else await startSpanLoop(span);
    window.getSelection()?.removeAllRanges();
    refreshLoopChrome();
    return;
  }
  if (isLooping()) {
    clearAllLoops();
    refreshLoopChrome();
    return;
  }
  await toggleLineLoop(fallbackIdx);
}

function spanFromPayload(payload) {
  if (!payload) return null;
  const pieces = payload.pieces || [];
  if (pieces.length) {
    const from = Number(pieces[0].idx);
    const to = Number(pieces[pieces.length - 1].idx);
    if (Number.isFinite(from) && state.segments[from]) {
      const last = Number.isFinite(to) ? to : from;
      return {
        start: state.segments[from].start,
        end: loopEndForSegment(last),
        from,
        to: last,
      };
    }
  }
  const idx = Number.isFinite(payload.idx) ? payload.idx : segmentIndexAt(payload.seconds);
  if (!Number.isFinite(idx) || !state.segments[idx]) return null;
  return {
    start: state.segments[idx].start,
    end: loopEndForSegment(idx),
    from: idx,
    to: idx,
  };
}

function spanFromLine(idx) {
  if (idx < 0 || !state.segments[idx]) return null;
  return {
    start: state.segments[idx].start,
    end: loopEndForSegment(idx),
    from: idx,
    to: idx,
  };
}

function applyShadowRate() {
  if (!state.shadowing) watchRate = playbackRate;
  const prefer = shadowRate < 1 ? shadowRate : 0.75;
  if (playbackRate >= 1) applyPlayRate(prefer, false);
}

async function toggleShadowRead(fallbackIdx) {
  const liveSel = selectionLoopRange();
  if (state.shadowing && !liveSel) {
    clearAllLoops();
    refreshLoopChrome();
    flashHint(t("已停跟读"));
    return;
  }
  const span = liveSel || spanFromPayload(selPayload) || spanFromLine(fallbackIdx);
  if (!span) {
    flashHint(t("先在字幕里划一段，或等这句对上字幕。"));
    return;
  }
  if (state.shadowing && sameLoopSpan(state.loopSpan, span)) {
    clearAllLoops();
    refreshLoopChrome();
    flashHint(t("已停跟读"));
    return;
  }
  applyShadowRate();
  const ok = await startSpanLoop(span, { shadow: true });
  window.getSelection()?.removeAllRanges();
  selPayload = null;
  refreshLoopChrome();
  if (!ok) {
    applyPlayRate(watchRate, false);
    flashHint(t("视频页没接上。点一下视频再试。"));
    return;
  }
  if (!shadowHinted) {
    shadowHinted = true;
    flashHint(t("听完空一拍，你再跟。停了会回到原来的速度。"));
  }
}

async function toggleLoop(i) {
  if (state.loopIndex === i) {
    clearAllLoops();
  } else {
    const block = state.blocks[i];
    if (!block) return;
    state.lineLoop = -1;
    state.loopSpan = null;
    state.shadowing = false;
    state.loopIndex = i;
    state.selectedBlock = i;
    const res = await sendToTabSure({ type: "VB_LOOP", start: block.start, end: block.end });
    if (!res) {
      state.loopIndex = -1;
    } else {
      scrollToSeconds(block.start);
      setProgress(i, "learning");
      scheduleBrick(i);
    }
    updateLoopBtn();
  }
  renderBrickBar();
  renderBrickList();
}

function applyLoopToPage() {
  sendToTab({ type: "VB_RATE", rate: playbackRate });
  if (state.loopSpan) {
    sendToTab(loopMessage(state.loopSpan, false));
    return;
  }
  if (state.lineLoop >= 0 && state.segments[state.lineLoop]) {
    const seg = state.segments[state.lineLoop];
    sendToTab(
      loopMessage(
        {
          start: seg.start,
          end: loopEndForSegment(state.lineLoop),
          from: state.lineLoop,
          to: state.lineLoop,
        },
        false,
      ),
    );
    return;
  }
  if (state.loopIndex < 0 || !state.blocks[state.loopIndex]) return;
  const block = state.blocks[state.loopIndex];
  sendToTab(
    loopMessage(
      {
        start: block.start,
        end: block.end,
        from: 0,
        to: 0,
      },
      false,
    ),
  );
}

function normalizeGaps(gaps) {
  return (Array.isArray(gaps) ? gaps : [])
    .map((g) =>
      typeof g === "string"
        ? { point: g, at: "" }
        : { point: String(g?.point || ""), at: String(g?.at || "") },
    )
    .filter((g) => g.point);
}

function scriptRecord(i) {
  const cur = state.scripts[i] || {};
  return {
    take: cur.take || "",
    topic: cur.topic || "",
    guides: Array.isArray(cur.guides) ? cur.guides.filter(Boolean) : [],
    answers: Array.isArray(cur.answers) ? cur.answers : [],
    drafts: Array.isArray(cur.drafts) ? cur.drafts : [],
    clear: Array.isArray(cur.clear) ? cur.clear : [],
    gaps: normalizeGaps(cur.gaps),
    jargon: Array.isArray(cur.jargon) ? cur.jargon : [],
    solo: cur.solo || "",
    soloWhy: cur.soloWhy || "",
    probe: cur.probe || "",
    simpler: cur.simpler || [cur.hook, cur.script, cur.cta].filter(Boolean).join("\n\n"),
    next: cur.next || "",
    error: cur.error || "",
    busy: Boolean(cur.busy),
  };
}

function feynmanGuides(i, topic = "") {
  const block = state.blocks[i];
  const title = String(topic || block?.title || "").trim() || t("这块");
  const dive = state.dives[i];
  const kind = block?.category || diveKindOf(dive, i) || "concept";
  const byKind = {
    concept: [
      t("用一句话，跟没看过视频的人说清「{t}」是什么。", { t: title }),
      t("它为什么成立？中间靠什么推过来？"),
      t("举视频里的一个例子。"),
      t("什么情况下这话不成立，或别人容易听岔？"),
    ],
    case: [
      t("这件事里，主张是什么？"),
      t("证据或机制是什么？"),
      t("换一个场景，还能不能这么说？"),
      t("它藏着什么限制？"),
    ],
    story: [
      t("故事里发生了什么？"),
      t("底下重复出现的模式是什么？"),
      t("讲的人想让你信什么？"),
      t("你自己会怎么复述给别人？"),
    ],
    action: [
      t("要做成这件事，目标是什么？"),
      t("先要具备什么？"),
      t("步骤怎么走？卡在哪会失败？"),
      t("你下一步会试哪一步？"),
    ],
    qa: [
      t("问题本身在问什么？"),
      t("他的主张是什么？凭据是什么？"),
      t("这个主张的边界在哪？"),
      t("你同意哪一句，卡住哪一句？"),
    ],
  };
  let qs = (byKind[kind] || byKind.concept).slice();
  const parts = diveParts(dive, i).filter((p) => p?.name);
  if (parts.length) {
    const fromParts = parts
      .slice(0, 2)
      .map((p) => t("「{t}」是什么，它在这块里起什么作用？", { t: p.name }));
    qs = [qs[0], ...fromParts, qs[qs.length - 1]];
  }
  const seen = new Set();
  return qs
    .map((q) => String(q || "").trim())
    .filter((q) => q && (seen.has(q) ? false : (seen.add(q), true)))
    .slice(0, 4);
}

function composeFeynmanTake(rec) {
  const guides = rec.guides || [];
  const answers = rec.answers || [];
  const bits = guides
    .map((q, n) => {
      const a = String(answers[n] || "").trim();
      return a ? `${q}\n${a}` : "";
    })
    .filter(Boolean);
  if (bits.length) return bits.join("\n\n");
  return String(rec.take || "").trim();
}

function ensureFeynmanGuides(i, topic = "") {
  const rec = scriptRecord(i);
  const nextTopic = String(topic || rec.topic || state.blocks[i]?.title || "").trim();
  if (rec.guides.length && (!nextTopic || rec.topic === nextTopic)) {
    if (nextTopic && !rec.topic) state.scripts[i] = { ...rec, topic: nextTopic };
    return state.scripts[i] || rec;
  }
  const guides = feynmanGuides(i, nextTopic);
  const answers = guides.map((_, n) => rec.answers[n] || "");
  if (!answers.some(Boolean) && rec.take.trim() && guides.length) answers[0] = rec.take.trim();
  state.scripts[i] = { ...rec, topic: nextTopic, guides, answers };
  return state.scripts[i];
}

function openFeynmanFor(i, topic = "") {
  const idx = Number(i);
  if (!Number.isInteger(idx) || idx < 0 || !state.blocks[idx]) {
    flashHint(t("先拆出知识块，再对这个点做费曼。"));
    return;
  }
  state.selectedBlock = idx;
  state.scriptStudio = idx;
  if (blockProgress(idx) === "fresh") setProgress(idx, "learning", false);
  ensureFeynmanGuides(idx, topic);
  switchView("bricks");
  renderBrickBar();
  renderBrickList();
  requestAnimationFrame(() => {
    document.querySelector(".script-studio")?.scrollIntoView({ block: "nearest" });
    document.querySelector("[data-fy-q]")?.focus();
  });
}

function bindFeynmanOpens(root) {
  root?.querySelectorAll("[data-fy]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openFeynmanFor(Number(btn.dataset.fy), btn.dataset.fyTopic || "");
    });
  });
}

function feynmanHasResult(rec) {
  return Boolean(rec.solo || rec.probe || rec.gaps.length || rec.jargon.length || rec.clear.length);
}

function feynmanOwned(rec) {
  return rec.solo === "rel" || rec.solo === "ext";
}

function feynmanCopyText(rec) {
  const bits = [];
  const spoken = composeFeynmanTake(rec);
  if (spoken) bits.push(`我的讲法\n${spoken}`);
  if (rec.solo) bits.push(`这稿：${SOLO_LABEL[rec.solo] || rec.solo}${rec.soloWhy ? ` · ${rec.soloWhy}` : ""}`);
  if (rec.gaps.length) bits.push(`还没讲清\n- ${rec.gaps.map((g) => g.point).join("\n- ")}`);
  if (rec.jargon.length) {
    bits.push(`还在用的行话\n${rec.jargon.map((j) => `- ${j.word} → ${j.plain}`).join("\n")}`);
  }
  if (rec.probe) bits.push(`追问\n${rec.probe}`);
  return bits.join("\n\n");
}

function feynmanDraftTrail(rec) {
  if (!rec.drafts?.length) return "";
  const ord = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return rec.drafts
    .map((d, n) => `第${ord[n] || n + 1}稿：${SOLO_LABEL[d.solo] || d.solo || "?"}`)
    .join(" → ");
}

function feynmanList(label, items) {
  if (!items?.length) return "";
  return `<div class="feynman-col"><div class="dive-label">${label}</div><ul>${items
    .map((item) => `<li>${item}</li>`)
    .join("")}</ul></div>`;
}

function renderScriptStudio(i) {
  const rec = ensureFeynmanGuides(i);
  const hasDraft = feynmanHasResult(rec);
  const trail = feynmanDraftTrail(rec);
  const st = blockProgress(i);
  const sourceId = `fy-${state.videoId}-${i}`;
  const topic = rec.topic || state.blocks[i]?.title || t("这块");
  const guides = rec.guides.length ? rec.guides : feynmanGuides(i, topic);
  const guideHtml = guides
    .map((q, n) => {
      const probe = rec.probe && q === rec.probe;
      return `<li class="feynman-q${probe ? " is-probe" : ""}">
        <label>
          <span>${n + 1}. ${esc(q)}</span>
          <textarea data-fy-q="${n}" rows="2" placeholder="${escAttr(t("对着这问讲。说不出来就写最糊的一句。"))}">${esc(rec.answers[n] || "")}</textarea>
        </label>
      </li>`;
    })
    .join("");
  return `<div class="script-studio">
    <div class="dive-label">${t("费曼")}</div>
    <p class="feynman-lead">${state.dives[i] ? `${t("拆解已收起。")} ` : ""}${t("按这些问题把「{t}」讲出来。卡住的就是还没懂。", { t: topic })}</p>
    <ol class="feynman-guide">${guideHtml}</ol>
    <p class="feynman-voice">${t("可以用 Typeless、豆包输入法或微信输入法的语音转文字，对着某一问说就行。")}</p>
    <div class="script-actions">
      <button class="btn btn-primary" data-run-script type="button"${rec.busy ? " disabled" : ""}>${
        rec.busy ? t("正在对照…") : hasDraft ? t("再对照一次") : t("对照材料")
      }</button>
      <button class="text-btn" data-muddy type="button">${t("只写最糊的那一句")}</button>
      ${hasDraft ? `<button class="btn" data-copy-script type="button">${t("复制")}</button>` : ""}
    </div>
    ${rec.error ? `<p class="script-error">${esc(rec.error)}</p>` : ""}
    ${
      hasDraft
        ? `<div class="script-card feynman-card">
      ${trail ? `<p class="feynman-trail">${esc(trail)}</p>` : ""}
      ${
        rec.solo
          ? `<p class="feynman-solo"><span class="solo-chip ${esc(rec.solo)}">${esc(
              SOLO_LABEL[rec.solo] || rec.solo,
            )}</span>${rec.soloWhy ? ` ${esc(rec.soloWhy)}` : ""}</p>`
          : ""
      }
      ${feynmanList(
        t("还没讲清"),
        rec.gaps.map((g) => {
          const s = parseClock(g.at);
          const stamp =
            s != null ? `<span class="time-link" data-s="${s}">${esc(g.at)}</span> ` : "";
          return `${stamp}${linkifyTimes(g.point)}`;
        }),
      )}
      ${feynmanList(
        t("还在用的行话"),
        rec.jargon.map((j) => `<b>${esc(j.word)}</b> → ${esc(j.plain)}`),
      )}
      ${
        rec.probe
          ? `<div class="feynman-probe"><div class="dive-label">追问</div><p>${esc(rec.probe)}</p></div>`
          : ""
      }
      ${
        rec.clear.length
          ? feynmanList(
              t("讲清楚了"),
              rec.clear.map((x) => esc(x)),
            )
          : ""
      }
      <div class="feynman-next">对照完了，按追问改第二稿，再点一次对照。</div>
      ${
        feynmanOwned(rec)
          ? `<div class="feynman-actions">
              ${st === "done" ? `<span class="script-meta">已标为学会</span>` : `<button class="btn" data-mark-owned type="button">这块算学会了</button>`}
              ${
                hasCardFor(sourceId)
                  ? `<span class="script-meta">讲法已经做成卡</span>`
                  : `<button class="btn" data-card-take type="button">把我的讲法做成卡</button>`
              }
            </div>`
          : ""
      }
    </div>`
        : ""
    }
  </div>`;
}

function rememberScriptDraft(i, root) {
  const rec = scriptRecord(i);
  const answers = rec.guides.map((_, n) => root.querySelector(`[data-fy-q="${n}"]`)?.value ?? rec.answers[n] ?? "");
  const take = composeFeynmanTake({ ...rec, answers });
  state.scripts[i] = { ...rec, answers, take, error: "", busy: rec.busy };
}

function bindScriptStudio(slot, i) {
  const root = slot.querySelector(".script-studio");
  if (!root) return;
  root.querySelectorAll("[data-fy-q]").forEach((box) => {
    box.addEventListener("input", () => {
      rememberScriptDraft(i, root);
    });
  });
  root.querySelector("[data-run-script]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    generateScript(i);
  });
  root.querySelector("[data-muddy]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const empty = [...root.querySelectorAll("[data-fy-q]")].find((box) => !box.value.trim()) || root.querySelector("[data-fy-q]");
    if (empty) {
      empty.placeholder = t("这块最糊的是：……");
      empty.focus();
    }
    flashHint(t("只写最糊的那一句就行。"));
  });
  root.querySelector("[data-copy-script]")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(feynmanCopyText(scriptRecord(i)));
      event.currentTarget.textContent = "已复制";
    } catch (_e) {
      event.currentTarget.textContent = t("复制失败");
    }
  });
  root.querySelector("[data-mark-owned]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    setProgress(i, "done");
  });
  root.querySelector("[data-card-take]")?.addEventListener("click", async (event) => {
    event.stopPropagation();
    await addFeynmanCard(i);
    renderBrickList();
  });
}

function toggleScriptStudio(i) {
  if (state.scriptStudio === i) {
    state.scriptStudio = -1;
  } else {
    state.scriptStudio = i;
    state.selectedBlock = i;
    ensureFeynmanGuides(i);
  }
  renderBrickBar();
  renderBrickList();
}

async function addFeynmanCard(i) {
  const rec = scriptRecord(i);
  const block = state.blocks[i];
  const spoken = composeFeynmanTake(rec);
  if (!spoken || !block || !state.videoId) return;
  const sourceId = `fy-${state.videoId}-${i}`;
  if (hasCardFor(sourceId)) {
    flashHint("这张卡已经有了。");
    return;
  }
  await addCard({
    type: "feynman",
    sourceId,
    videoId: state.videoId,
    videoTitle: state.title,
    seconds: block.start || 0,
    front: t("用白话讲：「{t}」", { t: rec.topic || block.title }),
    back: spoken,
    hint: rec.probe || rec.soloWhy || "",
  });
  flashHint("已做成复习卡。");
}

async function generateScript(i) {
  if (scriptRecord(i).busy) return;
  const slot = document.querySelector(`.brick-card [data-script="${i}"]`)?.closest(".brick-card")?.querySelector(".script-studio");
  if (slot) rememberScriptDraft(i, slot);
  const rec = scriptRecord(i);
  const spoken = composeFeynmanTake(rec);
  const block = state.blocks[i];
  const videoId = state.videoId;
  if (!block) return;
  if (!spoken) {
    state.scripts[i] = { ...rec, error: t("先按上面的问题讲。写不出来就写最糊的那一句。") };
    renderBrickList();
    return;
  }
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
      action: "vbFeynman",
      block,
      excerpt,
      title: state.title,
      take: spoken,
      dive: dive
        ? {
            essence: diveHeadline(dive),
            parts: diveParts(dive, i)
              .map((p) => p.name)
              .filter(Boolean),
          }
        : null,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || t("对照失败"));
    const drafts = rec.drafts.slice();
    if (!drafts.length || drafts[drafts.length - 1].take !== spoken) {
      drafts.push({ take: spoken, solo: result.solo || "", at: Date.now() });
    } else {
      drafts[drafts.length - 1] = { ...drafts[drafts.length - 1], solo: result.solo || "" };
    }
    const guides = rec.guides.slice();
    const answers = rec.answers.slice();
    const probe = String(result.probe || "").trim();
    if (probe && !guides.includes(probe)) {
      guides.push(probe);
      answers.push("");
    }
    state.scripts[i] = {
      ...scriptRecord(i),
      take: spoken,
      guides,
      answers,
      drafts,
      clear: result.clear || [],
      gaps: normalizeGaps(result.gaps),
      jargon: result.jargon || [],
      solo: result.solo || "",
      soloWhy: result.soloWhy || "",
      probe,
      simpler: "",
      next: "",
      busy: false,
      error: "",
    };
    if (result.solo === "rel" || result.solo === "ext") setProgress(i, "done");
    saveCache();
  } catch (error) {
    if (state.videoId !== videoId) return;
    state.scripts[i] = { ...scriptRecord(i), busy: false, error: error.message };
  }
  renderBrickList();
}

function fallbackVisual(kind, block, dive) {
  const parts = diveParts(dive).length
    ? diveParts(dive)
    : [{ name: block.title, role: block.summary || "" }];
  if (kind === "mind") {
    return {
      title: block.title,
      center: block.title,
      nodes: parts.slice(0, 7).map((p, i) => ({ id: `n${i}`, label: p.name, detail: p.role })),
    };
  }
  if (kind === "flow") {
    const fromSteps = (dive?.steps || []).map((s) => s.name);
    const steps = (fromSteps.length ? fromSteps : dive?.encode?.length ? dive.encode : parts.map((p) => p.role || p.name)).slice(0, 6);
    return {
      title: block.title,
      steps: steps.map((s, i) => ({
        n: i + 1,
        h: typeof s === "string" ? s : s.name,
        b: typeof s === "string" ? "" : s.role,
      })),
    };
  }
  return {
    title: block.title,
    kicker: CAT_LABEL[block.category] || "知识块",
    lede: diveHeadline(dive) || block.summary || "",
    pills: parts.map((p) => p.name).slice(0, 4),
    rows: parts.slice(0, 5).map((p) => ({ h: p.name, b: p.role })),
    callout: (dive?.retrieve || [])[0] || dive?.gap || "",
  };
}

function layoutPills(pills, y, width) {
  let x = 20;
  let cy = y;
  const gap = 8;
  const out = [];
  pills.forEach((raw) => {
    const lines = wrapText(raw, 10);
    const w = Math.min(width - 40, Math.max(56, Math.max(...lines.map((l) => l.length)) * 11 + 22));
    const h = lines.length > 1 ? 32 : 24;
    if (x + w > width - 16) {
      x = 20;
      cy += h + gap;
    }
    out.push({ x, y: cy, w, h, lines, label: String(raw) });
    x += w + gap;
  });
  return { items: out, height: out.length ? out[out.length - 1].y + out[out.length - 1].h - y : 0 };
}

function renderInfoSvg(spec) {
  const W = 360;
  const pad = 20;
  const title = wrapText(spec.title, 12);
  const lede = wrapText(spec.lede, 20);
  const pills = (spec.pills || []).slice(0, 6);
  const rows = (spec.rows || []).slice(0, 5);
  const headerH = 28 + title.length * 24 + 16;
  const ledeH = lede.length ? lede.length * 18 + 16 : 8;
  const pillLayout = layoutPills(pills, headerH + ledeH, W);
  const pillH = pills.length ? pillLayout.height + 12 : 0;
  const measuredRows = rows.map((row, i) => {
    const head = wrapText(row.h, 16);
    const body = wrapText(row.b, 20);
    const h = 18 + head.length * 16 + body.length * 15 + 14;
    return { i, head, body, h, label: row.h };
  });
  let y = headerH + ledeH + pillH + 4;
  const rowStarts = measuredRows.map((row) => {
    const top = y;
    y += row.h + 10;
    return top;
  });
  const callLines = spec.callout ? wrapText(spec.callout, 20) : [];
  const callH = callLines.length ? callLines.length * 16 + 24 : 16;
  const H = y + callH;
  const pillSvg = pillLayout.items
    .map(
      (p) =>
        `<g ${vizHitAttrs(p.label, t("关键词"))}>
        <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="12" fill="#f4efe4"/>
        ${svgLines(p.x + p.w / 2, p.y + p.h / 2, p.lines, { size: 11, fill: "#2c2418" })}
        </g>`,
    )
    .join("");
  const rowSvg = measuredRows
    .map((row, i) => {
      const top = rowStarts[i];
      return `<g ${vizHitAttrs(row.label, t("条目"))}>
        <rect x="16" y="${top}" width="${W - 32}" height="${row.h}" rx="10" fill="#fffdf8" stroke="#e6dece"/>
        <rect x="16" y="${top}" width="4" height="${row.h}" rx="2" fill="#c45c26"/>
        <text x="36" y="${top + 22}" font-size="12" font-weight="700" fill="#c45c26">${String(i + 1).padStart(2, "0")}</text>
        ${svgLines(64, top + 14, row.head, { size: 13, weight: "700", fill: "#2c2418", top: true, leading: 16, anchor: "start" })}
        ${svgLines(64, top + 18 + row.head.length * 16, row.body, { size: 12, fill: "#6f675c", top: true, leading: 15, anchor: "start" })}
        </g>`;
    })
    .join("");
  const call = callLines.length
    ? `<rect x="0" y="${H - callH}" width="${W}" height="${callH}" fill="#c45c26"/>
       ${svgLines(pad, H - callH + 12, callLines, { size: 12, fill: "#fffaf4", top: true, leading: 16, anchor: "start" })}`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
    <rect width="${W}" height="${H}" fill="#fffdf8"/>
    <rect width="${W}" height="${headerH}" fill="#c45c26"/>
    <text x="${pad}" y="22" font-size="10" letter-spacing="2" fill="#f3ead8">${esc((spec.kicker || "信息图").slice(0, 12))}</text>
    <g ${vizHitAttrs(spec.title, t("标题"))}>
    ${svgLines(pad, 34, title, { size: 20, weight: "700", fill: "#fffdf8", top: true, leading: 24, anchor: "start" })}
    </g>
    ${svgLines(pad, headerH + 8, lede, { size: 13, fill: "#6f675c", top: true, leading: 18, anchor: "start" })}
    ${pillSvg}${rowSvg}${call}
  </svg>`;
}

function renderMindSvg(spec) {
  const W = 360;
  const nodes = (spec.nodes || []).slice(0, 8).map((n) => ({
    ...n,
    lines: wrapText(n.label, 8),
  }));
  const centerLines = wrapText(spec.center || spec.title, 8);
  const centerBox = textBoxSize(centerLines, { charW: 12, lineH: 15, padX: 12, padY: 10, minW: 72, maxW: 140, minH: 48 });
  const outer = nodes.map((n) =>
    textBoxSize(n.lines, { charW: 11, lineH: 14, padX: 10, padY: 8, minW: 78, maxW: 132, minH: 32 }),
  );
  const R = 118;
  const H = 360;
  const cx = 180;
  const cy = 180;
  const lines = nodes
    .map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.92;
      const box = outer[i];
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e6dece" stroke-width="1.4"/>
        <g ${vizHitAttrs(n.label, t("节点"))}>
        <rect x="${x - box.w / 2}" y="${y - box.h / 2}" width="${box.w}" height="${box.h}" rx="10" fill="#fffdf8" stroke="#c45c26"/>
        ${svgLines(x, y, n.lines, { size: 11, fill: "#2c2418" })}
        </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%">
    <rect width="${W}" height="${H}" fill="#f4efe4"/>
    ${lines}
    <g ${vizHitAttrs(spec.center || spec.title, t("中心"))}>
    <rect x="${cx - centerBox.w / 2}" y="${cy - centerBox.h / 2}" width="${centerBox.w}" height="${centerBox.h}" rx="12" fill="#c45c26"/>
    ${svgLines(cx, cy, centerLines, { size: 12, weight: "700", fill: "#fffaf4" })}
    </g>
  </svg>`;
}

function renderFlowSvg(spec) {
  const steps = (spec.steps || []).slice(0, 6);
  const W = 360;
  const titleLines = wrapText(spec.title || "", 18);
  let y = 16 + titleLines.length * 16 + 8;
  const items = steps
    .map((step, i) => {
      const head = wrapText(step.h, 16);
      const body = wrapText(step.b, 20);
      const boxH = 16 + head.length * 16 + body.length * 15 + 12;
      const top = y;
      y += boxH + 16;
      return `${i ? `<line x1="32" y1="${top - 14}" x2="32" y2="${top + 4}" stroke="#c45c26" stroke-width="2"/>` : ""}
        <g ${vizHitAttrs(step.h, t("步骤"))}>
        <circle cx="32" cy="${top + 18}" r="12" fill="#c45c26"/>
        <text x="32" y="${top + 22}" text-anchor="middle" font-size="11" fill="#fffaf4" font-weight="700">${step.n || i + 1}</text>
        <rect x="52" y="${top}" width="292" height="${boxH}" rx="10" fill="#fffdf8" stroke="#e6dece"/>
        ${svgLines(68, top + 10, head, { size: 13, weight: "700", fill: "#2c2418", top: true, leading: 16, anchor: "start" })}
        ${svgLines(68, top + 12 + head.length * 16, body, { size: 12, fill: "#6f675c", top: true, leading: 15, anchor: "start" })}
        </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${y + 8}" width="100%">
    <rect width="${W}" height="${y + 8}" fill="#f4efe4"/>
    ${svgLines(16, 8, titleLines, { size: 12, fill: "#9a9286", top: true, leading: 16, anchor: "start" })}
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
  const label = { info: "信息图", mind: t("思维导图"), flow: "流程" }[viz.kind] || "图";
  const inspect = vizPick?.i === i ? renderPickCard(vizPick, "vizInspect") : "";
  return `<div class="viz-wrap">
    <div class="viz-head">
      <span>${label}${viz.loading ? " · 生成中" : ""}</span>
      <button class="text-btn" data-dlviz type="button">下载 SVG</button>
    </div>
    <div class="viz-frame">${renderVisualSvg(viz)}</div>
    ${viz.loading ? "" : `<p class="viz-hint">${t("点色块看概念卡片")}</p>`}
    ${inspect}
    ${viz.error ? `<p class="map-help">${esc(viz.error)}</p>` : ""}
  </div>`;
}

function downloadVisual(i) {
  const viz = state.visuals[i];
  const svg = renderVisualSvg(viz);
  if (!svg) return;
  const name = `Kaizen-${(state.blocks[i]?.title || "图").slice(0, 20)}.svg`;
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
  if (vizPick?.i === i) vizPick = null;
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
      state.visuals[i].error = result?.error || t("图没做成，先用这张骨架。");
    }
  } catch (error) {
    if (state.visuals[i]) {
      state.visuals[i].loading = false;
      state.visuals[i].error = error.message || t("图没做成，先用这张骨架。");
    }
  }
  renderBrickList();
}

async function deepDive(i) {
  const videoId = state.videoId;
  state.selectedBlock = i;
  const diveBtn = document.querySelector(`[data-dive="${i}"]`);
  if (diveBtn) {
    diveBtn.disabled = true;
    diveBtn.textContent = t("拆解中…");
  }
  try {
    const result = await sendToBg({
      action: "vbDeepDive",
      block: state.blocks[i],
      segments: state.segments,
      videoTitle: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || t("拆解失败"));
    const { ok, error, code, ...dive } = result;
    state.dives[i] = dive;
    setProgress(i, "learning");
    scheduleBrick(i);
    saveCache();
    renderBrickList();
    renderMaps();
  } catch (error) {
    if (state.videoId === videoId) renderBrickList();
    flashHint(friendlyAiError(error.message, t("这块没拆出来，再试一次。")));
  }
}


// ---------- reader ----------

function vocabTerms() {
  return [...new Set(vocab.map((v) => String(v.word || "").trim().toLowerCase()).filter((w) => /^[a-z][a-z' -]{0,39}$/.test(w)))].sort(
    (a, b) => b.length - a.length,
  );
}

function levelWordSet() {
  return new Set((state.levelScan?.words || []).map((w) => String(w.word || "").toLowerCase()));
}

function highlightNeedles(h) {
  if (Array.isArray(h.spans) && h.spans.length) {
    return h.spans.map((s) => String(s?.text || "").trim()).filter(Boolean);
  }
  return h.text ? [String(h.text)] : [];
}

function collapseWs(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function escapeRe(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function locateSnippet(hay, needle) {
  const h = String(hay || "");
  const trimmed = String(needle || "").trim();
  if (!h || !trimmed) return null;
  let at = h.indexOf(trimmed);
  if (at >= 0) return { start: at, end: at + trimmed.length };
  const raw = collapseWs(trimmed);
  at = h.indexOf(raw);
  if (at >= 0) return { start: at, end: at + raw.length };
  try {
    const tokens = raw
      .split(/\s+/)
      .map((w) => w.replace(/^[^\w\u4e00-\u9fff]+|[^\w\u4e00-\u9fff]+$/g, "") || w)
      .filter(Boolean);
    if (tokens.length) {
      const re = new RegExp(tokens.map(escapeRe).join("[\\s\\p{P}\\p{S}]+"), "iu");
      const m = re.exec(h);
      if (m) return { start: m.index, end: m.index + m[0].length };
    }
  } catch (_e) {
    /* fall through */
  }
  if (!/\s/.test(raw) && raw.length >= 2) {
    try {
      const chars = [...raw].filter((ch) => /[\w\u4e00-\u9fff]/.test(ch));
      if (chars.length >= 2) {
        const re = new RegExp(chars.map(escapeRe).join("[\\s\\p{P}]*"), "u");
        const m = re.exec(h);
        if (m) return { start: m.index, end: m.index + m[0].length };
      }
    } catch (_e) {
      return null;
    }
  }
  return null;
}

function pickSnippet(hay, raw) {
  const loc = locateSnippet(hay, raw);
  return loc ? String(hay).slice(loc.start, loc.end) : "";
}

function getDecorateCache() {
  if (decorateCache) return decorateCache;
  const terms = vocabTerms();
  const here = highlights.filter((h) => h.videoId === state.videoId);
  const marks = here
    .flatMap((h) =>
      highlightNeedles(h).map((text) => ({
        id: h.id,
        text,
        cls: hlClassOf(h),
      })),
    )
    .filter((m) => m.text);
  const kindsByIdx = new Map();
  for (const h of here) {
    const kind = hlKindOf(h);
    for (const i of highlightRowIdxs(h)) {
      const set = kindsByIdx.get(i) || new Set();
      set.add(kind);
      kindsByIdx.set(i, set);
    }
  }
  kindsByIdx.forEach((set, i) => {
    kindsByIdx.set(i, HL_KIND_ORDER.filter((k) => set.has(k)));
  });
  decorateCache = {
    level: levelWordSet(),
    marks,
    kindsByIdx,
    termPattern: terms.length
      ? new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi")
      : null,
  };
  return decorateCache;
}

function wordFromClick(event) {
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
    node = pos?.offsetNode || null;
    offset = pos?.offset || 0;
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(event.clientX, event.clientY);
    node = range?.startContainer || null;
    offset = range?.startOffset || 0;
  }
  const text = node?.nodeType === Node.TEXT_NODE ? node.textContent || "" : "";
  if (!text) return "";
  const left = text.slice(0, offset).match(/[A-Za-z][A-Za-z'-]*$/)?.[0] || "";
  const right = text.slice(offset).match(/^[A-Za-z'-]*/)[0] || "";
  const word = `${left}${right}`.replace(/^['-]+|['-]+$/g, "");
  return word.length >= 2 ? word : "";
}

function openWordFromEl(el, row) {
  const word = el?.dataset?.vocab || el?.dataset?.word || "";
  if (!word) return;
  const idx = Number(row?.dataset.idx);
  const seg = state.segments[idx];
  openWordCard(word, {
    sentence: seg?.text || "",
    seconds: Number(row?.dataset.start) || 0,
    videoId: state.videoId,
    videoTitle: state.title,
  });
}

function decorateTextNodes(html, fn) {
  const box = document.createElement("div");
  box.innerHTML = html;
  const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue || node.parentElement?.closest("mark, .vocab-hit, .w-hit")) continue;
    const next = fn(node.nodeValue);
    if (next == null || next === node.nodeValue) continue;
    const wrap = document.createElement("span");
    wrap.innerHTML = next;
    node.replaceWith(...wrap.childNodes);
  }
  return box.innerHTML;
}

function markLevelWords(html) {
  const { level } = getDecorateCache();
  if (!level.size) return html;
  return decorateTextNodes(html, (text) =>
    text.replace(/\b([A-Za-z][A-Za-z'-]{1,39})\b/g, (word) => {
      if (!level.has(word.toLowerCase())) return word;
      return `<span class="w-hit level-hit" data-word="${word.replace(/"/g, "")}" role="button">${word}</span>`;
    }),
  );
}

function decorateText(text) {
  const cache = getDecorateCache();
  const plain = String(text || "");
  const cuts = [];
  for (const mark of cache.marks) {
    const loc = locateSnippet(plain, mark.text);
    if (!loc) continue;
    cuts.push({ ...loc, id: mark.id, cls: mark.cls });
  }
  cuts.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
  let html = "";
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start < cursor) continue;
    html += esc(plain.slice(cursor, cut.start));
    html += `<mark data-hid="${cut.id}" class="${cut.cls}">${esc(plain.slice(cut.start, cut.end))}</mark>`;
    cursor = cut.end;
  }
  html += esc(plain.slice(cursor));
  if (cache.termPattern) {
    html = decorateTextNodes(html, (text) =>
      text.replace(cache.termPattern, (m) => `<span class="vocab-hit" data-vocab="${m.toLowerCase()}">${m}</span>`),
    );
  }
  return html;
}

function goldIndexSet() {
  const rows = videoQuotes();
  const key = `${state.videoId}:${rows.length}:${state.segments.length}`;
  if (goldIndexCache && goldIndexKey === key) return goldIndexCache;
  const set = new Set();
  if (rows.length) {
    const times = rows.map((q) => Number(q.seconds) || 0).sort((a, b) => a - b);
    let j = 0;
    state.segments.forEach((seg, i) => {
      while (j < times.length && times[j] < seg.start - 4) j += 1;
      const hit = times[j] !== undefined && Math.abs(times[j] - seg.start) < 4;
      const prev = j > 0 && Math.abs(times[j - 1] - seg.start) < 4;
      if (hit || prev) set.add(i);
    });
  }
  goldIndexCache = set;
  goldIndexKey = key;
  return set;
}

function buildTranscriptRow(i, { mode, echoes, golds }) {
  const segment = state.segments[i];
  const zh = translationAt(i);
  const row = document.createElement("div");
  row.className = "t-row";
  row.dataset.idx = String(i);
  row.dataset.start = String(segment.start);
  const en = mode === "zh" ? "" : `<div class="t-en">${markLevelWords(decorateText(segment.text))}</div>`;
  const zhHtml = mode === "original" ? "" : zhSlotHtml(i, zh);
  if (golds.has(i)) row.classList.add("gold");
  if (state.lineLoop === i || (state.loopSpan && i >= state.loopSpan.from && i <= state.loopSpan.to)) {
    row.classList.add("looping");
  }
  const hit = echoes.get(i);
  const others = hit ? (hit.sources || []).filter((s) => s.videoId && s.videoId !== state.videoId).length : 0;
  const echoHtml = hit
    ? `<button class="echo-chip" type="button" data-echo="${hit.id}">${others} 支也讲过 · ${esc(hit.label)}</button>`
    : "";
  row.innerHTML = `${hlTimeButton({ seconds: segment.start, idx: i })}<div>${en}${zhHtml}${echoHtml}</div>`;
  return row;
}

function zhSlotHtml(i, zh = translationAt(i)) {
  if (zh) return `<div class="t-zh">${decorateText(zh)}</div>`;
  if (state.translateFailed?.[i]) {
    return `<div class="t-zh failed">${t("这句没翻出来")} · <button class="text-btn t-retry" type="button" data-retryzh="${i}">${t("重试")}</button></div>`;
  }
  if (state.transcriptMode !== "original") {
    return `<div class="t-zh pending"><span class="zh-skel" aria-hidden="true"></span></div>`;
  }
  return "";
}

function patchRowTranslation(i) {
  const row = transcriptRows[i];
  const zhEl = row?.querySelector(".t-zh");
  if (!zhEl) return;
  zhEl.outerHTML = zhSlotHtml(i);
}

function translationStats() {
  const total = state.segments.length;
  let done = 0;
  let failed = 0;
  for (let i = 0; i < total; i++) {
    if (translationAt(i)) done += 1;
    else if (state.translateFailed?.[i]) failed += 1;
  }
  return { total, done, failed, pending: total - done - failed };
}

function renderTranslateBar() {
  const el = $("translateBar");
  if (!el) return;
  if (state.transcriptMode === "original" || !state.segments.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const { total, done, failed } = translationStats();
  if (!isTranslating && done >= total && !failed) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const bits = [`已翻 ${done} / ${total} 句`];
  if (failed) bits.push(`${failed} 句没翻出来`);
  el.innerHTML = `<span>${bits.join(" · ")}</span>${
    failed && !isTranslating ? `<button class="text-btn" type="button" id="translateRetry">重试</button>` : ""
  }`;
  $("translateRetry")?.addEventListener("click", retryFailedTranslations);
}

function retryTranslationAt(i) {
  if (!state.translateFailed) state.translateFailed = {};
  if (!state.translateTries) state.translateTries = {};
  delete state.translateFailed[i];
  delete state.translateTries[i];
  delete state.translations[i];
  patchRowTranslation(i);
  renderTranslateBar();
  translateAll();
}

function retryFailedTranslations() {
  Object.keys(state.translateFailed || {}).forEach((k) => {
    delete state.translations[k];
    delete state.translateFailed[k];
    delete state.translateTries?.[k];
    patchRowTranslation(Number(k));
  });
  renderTranslateBar();
  translateAll();
}

function transcriptKey() {
  return `${state.videoId}|${state.transcriptMode}|${state.segments.length}`;
}

function finishTranscriptPaint(gen) {
  if (gen !== transcriptGen) return;
  transcriptReady = true;
  paintPlayingRow(state.lastSeconds);
  if (followPlayback && isReadView()) {
    lastFollowedStart = -1;
    const row = rowAtSeconds(state.lastSeconds);
    if (row) centerRowInView(row, { smooth: false });
  }
  renderTranslateBar();
  paintMarkRows();
}

function spiralIndex(step, focus) {
  if (step === 0) return focus;
  const d = Math.ceil(step / 2);
  return step % 2 === 1 ? focus + d : focus - d;
}

function renderTranscript(opts = {}) {
  const box = $("transcriptBox");
  if (!box) return;
  const key = transcriptKey();
  const n = state.segments.length;
  if (!opts.force && transcriptReady && transcriptPaintKey === key && transcriptRows.length === n && transcriptRows[0]) {
    paintPlayingRow(state.lastSeconds);
    renderTranslateBar();
    paintMarkRows();
    return;
  }
  const gen = ++transcriptGen;
  transcriptPaintKey = key;
  transcriptReady = false;
  const mode = state.transcriptMode;
  syncLangButtons();
  decorateCache = null;
  const echoes = echoMarksForSegments();
  const golds = goldIndexSet();
  const ctx = { mode, echoes, golds };
  playingRowEl = null;

  if (n <= 80) {
    const frag = document.createDocumentFragment();
    const rows = new Array(n);
    for (let i = 0; i < n; i++) {
      rows[i] = buildTranscriptRow(i, ctx);
      frag.appendChild(rows[i]);
    }
    box.replaceChildren(frag);
    transcriptRows = rows;
    finishTranscriptPaint(gen);
    return;
  }

  const frag = document.createDocumentFragment();
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.className = "t-row t-skel";
    row.dataset.idx = String(i);
    row.dataset.start = String(state.segments[i].start);
    rows[i] = row;
    frag.appendChild(row);
  }
  box.replaceChildren(frag);
  transcriptRows = rows;

  const focus = segmentIndexAt(state.lastSeconds);
  let step = 0;
  let done = 0;

  let needFollow = false;
  const hydrateOne = (i) => {
    const old = rows[i];
    if (!old?.classList.contains("t-skel")) return;
    const fresh = buildTranscriptRow(i, ctx);
    if (playingRowEl === old || i === segmentIndexAt(state.lastSeconds)) needFollow = true;
    old.replaceWith(fresh);
    rows[i] = fresh;
    transcriptRows[i] = fresh;
    if (playingRowEl === old) playingRowEl = null;
  };

  const pump = (budget) => {
    if (gen !== transcriptGen) return;
    while (done < n && budget > 0) {
      const i = spiralIndex(step, focus);
      step += 1;
      if (i < 0 || i >= n) continue;
      hydrateOne(i);
      done += 1;
      budget -= 1;
    }
    paintPlayingRow(state.lastSeconds);
    if (needFollow) lastFollowedStart = -1;
    needFollow = false;
    if (done < n) requestAnimationFrame(() => pump(28));
    else finishTranscriptPaint(gen);
  };

  pump(36);
}

async function translateAll() {
  if (translateAll.busy) return;
  translateAll.busy = true;
  isTranslating = true;
  if (!state.translateFailed) state.translateFailed = {};
  if (!state.translateTries) state.translateTries = {};
  const videoId = state.videoId;
  const job = videoJob;
  let batchFails = 0;
  renderTranslateBar();
  try {
    while (job === videoJob && state.videoId === videoId && state.transcriptMode !== "original") {
      const pending = [];
      const batch = typeof TRANSLATE_BATCH === "number" ? TRANSLATE_BATCH : 10;
      for (let i = 0; i < state.segments.length && pending.length < batch; i++) {
        if (translationAt(i) || state.translateFailed[i]) continue;
        if ((state.translateTries[i] || 0) >= 2) {
          state.translateFailed[i] = true;
          continue;
        }
        pending.push(i);
      }
      if (!pending.length) break;
      let result;
      try {
        result = await sendToBg({
          action: "vbTranslate",
          lines: pending.map((i) => state.segments[i].text),
        });
      } catch (e) {
        result = { ok: false, error: e?.message || "message failed" };
      }
      if (job !== videoJob || state.videoId !== videoId) break;
      if (!result?.ok) {
        batchFails += 1;
        const fatal = isTranslateFatal(result);
        pending.forEach((i) => {
          state.translateTries[i] = (state.translateTries[i] || 0) + 1;
          if (fatal || state.translateTries[i] >= 2) {
            delete state.translations[i];
            state.translateFailed[i] = true;
          }
          patchRowTranslation(i);
        });
        if (fatal) {
          flashHint(friendlyAiError(result?.error, t("这批没翻出来，点重试。")));
          break;
        }
        if (batchFails === 1 || batchFails % 3 === 0) {
          flashHint(friendlyAiError(result?.error, t("这批没翻出来，点重试。")));
        }
        await new Promise((ok) => setTimeout(ok, 900));
        continue;
      }
      let got = 0;
      pending.forEach((i, k) => {
        const zh = typeof usableTranslation === "function"
          ? usableTranslation(result.translations[k], state.segments[i]?.text)
          : cleanZh(result.translations[k] || "");
        if (zh) {
          state.translations[i] = zh;
          delete state.translateFailed[i];
          delete state.translateTries[i];
          got += 1;
        } else {
          delete state.translations[i];
          state.translateTries[i] = (state.translateTries[i] || 0) + 1;
          if (state.translateTries[i] >= 2) state.translateFailed[i] = true;
        }
        patchRowTranslation(i);
      });
      if (!got) {
        batchFails += 1;
        if (batchFails === 1 || batchFails % 3 === 0) {
          flashHint(t("这批没翻出来，点重试。"));
        }
      } else {
        batchFails = 0;
      }
      renderTranslateBar();
      backfillHandQuoteZh();
      await new Promise((ok) => setTimeout(ok, 220));
    }
  } finally {
    translateAll.busy = false;
    isTranslating = false;
    if (job === videoJob && state.videoId === videoId) {
      renderTranslateBar();
      saveCacheSoon(1500);
    }
  }
}

function setTranscriptMode(mode) {
  const next = mode === "zh" || mode === "original" ? mode : "bilingual";
  state.transcriptMode = next;
  void saveSettings({ transcriptMode: next });
  if (next !== "original") isTranslating = true;
  renderTranscript({ force: true });
  if (next !== "original") translateAll();
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
  state.segments.forEach((seg, i) => {
    const zh = translationAt(i);
    if (seg.text.toLowerCase().includes(q) || zh.toLowerCase().includes(q)) hits.push(seg);
  });
  if (!hits.length) {
    box.hidden = false;
    box.textContent = t("这篇里没有匹配。");
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

function selectedText() {
  return String(window.getSelection()?.toString() || "").trim();
}

function selectionHost(row, range) {
  const startEl = range.startContainer?.nodeType === 1 ? range.startContainer : range.startContainer?.parentElement;
  return startEl?.closest?.(".t-en, .t-zh") || row.querySelector(".t-en") || row.querySelector(".t-zh") || row;
}

function intersectSelectionText(range, row) {
  const host = selectionHost(row, range);
  try {
    const hostRange = document.createRange();
    hostRange.selectNodeContents(host);
    const sliced = range.cloneRange();
    if (sliced.compareBoundaryPoints(Range.START_TO_START, hostRange) < 0) {
      sliced.setStart(hostRange.startContainer, hostRange.startOffset);
    }
    if (sliced.compareBoundaryPoints(Range.END_TO_END, hostRange) > 0) {
      sliced.setEnd(hostRange.endContainer, hostRange.endOffset);
    }
    return String(sliced.toString() || "").replace(/\s+/g, " ").trim();
  } catch (_e) {
    return "";
  }
}

function phraseFromSelection(payload) {
  const raw = String(payload?.text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const words = raw.match(/[A-Za-z][A-Za-z'-]{0,39}/g) || [];
  if (words.length >= 2) return words.join(" ").slice(0, 80);
  if (words.length === 1) return words[0];
  return raw.slice(0, 80);
}

function captureSelection() {
  const text = selectedText().replace(/\s+/g, " ");
  if (!text || text === "[object Selection]") return null;
  const selection = window.getSelection();
  const box = $("transcriptBox");
  if (!selection?.rangeCount || !box) return null;
  const range = selection.getRangeAt(0);
  const rows = [...box.querySelectorAll(".t-row")].filter((row) => {
    if (row.classList.contains("t-skel")) return false;
    try {
      return range.intersectsNode(row);
    } catch (_e) {
      return false;
    }
  });
  if (!rows.length) return null;
  const pieces = rows
    .map((row) => {
      const idx = Number(row.dataset.idx);
      const seg = state.segments[idx];
      const piece = intersectSelectionText(range, row);
      if (!piece || !Number.isFinite(idx)) return null;
      return {
        text: piece.slice(0, 240),
        sentence: seg?.text || piece,
        seconds: Number(row.dataset.start) || 0,
        idx,
      };
    })
    .filter(Boolean);
  if (!pieces.length) return null;
  return {
    text: text.slice(0, 240),
    sentence: pieces[0].sentence,
    seconds: pieces[0].seconds,
    idx: pieces[0].idx,
    pieces,
  };
}

function placeSelBar() {
  const selection = window.getSelection();
  const payload = captureSelection();
  const bar = $("selBar");
  if (!bar) return;
  if (!payload || !selection?.rangeCount) {
    bar.hidden = true;
    selPayload = null;
    const text = selectedText();
    const box = $("transcriptBox");
    const node = selection?.anchorNode;
    if (text && box && node && box.contains(node)) {
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (el?.closest?.(".t-skel")) {
        flashHint("这行还在加载，滚近当前播放位置再划。");
      }
    }
    return;
  }
  selPayload = payload;
  selectingUntil = Date.now() + 8000;
  const marks = $("selMarks");
  if (marks) marks.hidden = false;
  paintSelBarChrome();
  bar.hidden = false;
  bar.style.left = "8px";
  bar.style.right = "8px";
  bar.style.top = "auto";
  bar.style.bottom = "8px";
  updateLoopBtn();
}

function paintSelBarChrome() {
  const color = lastHlColor();
  const style = lastHlStyle();
  $("selStyles")?.querySelectorAll("[data-style]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.style === style);
  });
  $("selMarks")?.querySelectorAll("[data-color]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.color === color);
    const ico = btn.querySelector(".hl-ico");
    if (ico && !ico.innerHTML) {
      ico.innerHTML = (HL_COLOR[btn.dataset.color] || HL_COLOR.def).icon;
    }
  });
  const covered = highlightsOnPayload(selPayload);
  const unmark = $("selUnmark");
  if (unmark) unmark.hidden = !covered.length;
  const phrase = phraseFromSelection(selPayload) || selPayload?.text || "";
  const saved = vocabByWord(phrase);
  const unvocab = $("selUnvocab");
  if (unvocab) unvocab.hidden = !saved;
}

function paintOneTranscriptRow(i) {
  const old = transcriptRows[i];
  if (!old || !state.segments[i]) return;
  const fresh = buildTranscriptRow(i, {
    mode: state.transcriptMode,
    echoes: echoMarksForSegments(),
    golds: goldIndexSet(),
  });
  old.replaceWith(fresh);
  transcriptRows[i] = fresh;
  if (playingRowEl === old) {
    playingRowEl = fresh;
    fresh.classList.add("playing");
  }
}

async function addHighlight(color, style) {
  if (!state.videoId) {
    flashHint("先打开一支视频再划。");
    return;
  }
  const payload = selPayload || captureSelection();
  if (!payload) {
    flashHint("先在字幕里选出要划的字。");
    return;
  }
  const tone = HL_COLOR[color] ? color : lastHlColor();
  const look = hlStyleId(style || lastHlStyle());
  const spans = (payload.pieces?.length ? payload.pieces : [payload])
    .map((p) => {
      const en = state.segments[p.idx]?.text || "";
      const zh = translationAt(p.idx);
      const snapped = pickSnippet(en, p.text) || pickSnippet(zh, p.text) || collapseWs(p.text);
      return {
        text: snapped.slice(0, 240),
        sentence: p.sentence || en || snapped,
        seconds: p.seconds,
        idx: p.idx,
      };
    })
    .filter((p) => p.text);
  if (!spans.length) {
    flashHint("这一句还没铺开，等字幕出来再划。");
    return;
  }
  const created = {
    id: uid("h"),
    videoId: state.videoId,
    videoTitle: state.title,
    text: payload.text,
    sentence: payload.sentence,
    seconds: payload.seconds,
    spans,
    color: tone,
    style: look,
    createdAt: Date.now(),
  };
  highlights.unshift(created);
  if (highlights.length > 800) highlights.length = 800;
  await saveList("vb_highlights", highlights);
  void saveSettings({ hlColor: tone, hlStyle: look });
  afterHighlightChange(spans.map((s) => s.idx));
  flashHint(t("已划上"), {
    undo: async () => {
      await removeHighlights([created.id], { silent: true });
      flashHint(t("已撤回划线"));
    },
  });
  checkAchievementsSoon();
}

function afterHighlightChange(idxs = []) {
  decorateCache = null;
  if (currentView() === "read") {
    const rows = [...new Set(idxs.filter((i) => Number.isInteger(i) && i >= 0))];
    if (rows.length) rows.forEach((i) => paintOneTranscriptRow(i));
    else refreshTranscriptWhenIdle();
  } else {
    transcriptPaintKey = "";
  }
  if (notesFilter === "highlights" || notesFilter === "page") renderNotes();
}

function highlightsOnPayload(payload) {
  if (!payload || !state.videoId) return [];
  const pieces = payload.pieces?.length ? payload.pieces : [payload];
  return highlights.filter((h) => {
    if (h.videoId !== state.videoId) return false;
    const needles = highlightNeedles(h);
    if (!needles.length) return false;
    return pieces.some((p) => {
      const hay = collapseWs(p.text || "");
      if (!hay) return false;
      return needles.some((n) => locateSnippet(hay, n) || locateSnippet(n, hay));
    });
  });
}

async function removeHighlights(ids, { silent = false } = {}) {
  const idSet = new Set((ids || []).filter(Boolean));
  const hits = highlights.filter((h) => idSet.has(h.id));
  if (!hits.length) return false;
  highlights = highlights.filter((h) => !idSet.has(h.id));
  await saveList("vb_highlights", highlights);
  afterHighlightChange(hits.flatMap((h) => highlightRowIdxs(h)));
  if (!silent) {
    flashHint(hits.length === 1 ? t("已去掉这条划线") : t("已去掉这些划线"), {
      undo: async () => {
        highlights.unshift(...hits);
        await saveList("vb_highlights", highlights);
        afterHighlightChange(hits.flatMap((h) => highlightRowIdxs(h)));
        flashHint(t("已划回去"));
      },
    });
  }
  return true;
}

async function removeHighlight(id, opts) {
  return removeHighlights([id], opts);
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
  if (!pendingNote) return;
  if (!text) {
    flashHint("先写一句再保存。");
    return;
  }
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
  checkAchievementsSoon();
  $("noteModal").hidden = true;
  pendingNote = null;
  renderNotes();
  if (document.querySelector('.view[data-view="maps"].active')) renderMaps();
}

function vocabSources(v) {
  if (!v) return [];
  if (Array.isArray(v.sources) && v.sources.length) {
    return v.sources
      .filter((s) => s && (s.videoId || s.sentence))
      .map((s) => ({
        videoId: s.videoId || "",
        videoTitle: s.videoTitle || "",
        sentence: s.sentence || "",
        seconds: Number(s.seconds) || 0,
      }));
  }
  if (v.videoId || v.sentence) {
    return [
      {
        videoId: v.videoId || "",
        videoTitle: v.videoTitle || "",
        sentence: v.sentence || "",
        seconds: Number(v.seconds) || 0,
      },
    ];
  }
  return [];
}

function vocabHasVideo(v, videoId) {
  if (!v || !videoId) return false;
  return v.videoId === videoId || vocabSources(v).some((s) => s.videoId === videoId);
}

function vocabForThisVideo(list = vocab) {
  if (!state.videoId) return (list || []).slice();
  return (list || []).filter((v) => vocabHasVideo(v, state.videoId));
}

function preferredVocabSource(v) {
  const sources = vocabSources(v);
  if (!sources.length) return null;
  return sources.find((s) => s.videoId && s.videoId === state.videoId) || sources[0];
}

function vocabMatchesQuery(v, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;
  const blob = [v.word, vocabGlossOf(v), ...vocabSources(v).flatMap((s) => [s.sentence, s.videoTitle])]
    .join(" ")
    .toLowerCase();
  return blob.includes(needle);
}

function syncVocabPrimary(v) {
  const src = vocabSources(v)[0];
  if (!src) return;
  v.videoId = src.videoId;
  v.videoTitle = src.videoTitle;
  v.sentence = src.sentence;
  v.seconds = src.seconds;
}

function attachVocabSource(v, src) {
  const next = {
    videoId: src.videoId || "",
    videoTitle: String(src.videoTitle || "").slice(0, 200),
    sentence: String(src.sentence || "").slice(0, 400),
    seconds: Number(src.seconds) || 0,
  };
  const sources = vocabSources(v);
  if (next.videoId && sources.some((s) => s.videoId === next.videoId)) return false;
  sources.push(next);
  v.sources = sources;
  return true;
}

function openVocabSource(v, src) {
  if (!v || !src) return;
  if (src.videoId && src.videoId === state.videoId) {
    jumpVocabHit(v.word, src.seconds, { source: "notes-vocab" });
    return;
  }
  if (src.videoId) {
    goToVideo(src.videoId, src.seconds);
    return;
  }
  if (Number.isFinite(Number(src.seconds))) {
    peekSeek(Number(src.seconds), { word: v.word, kind: "vocab-list" });
    return;
  }
  flashHint(t("找不到这个词的出处。"));
}

function jumpVocabEntry(v) {
  const src = preferredVocabSource(v);
  if (!src) {
    flashHint(t("找不到这个词的出处。"));
    return;
  }
  openVocabSource(v, src);
}

function visibleVocab() {
  const base = vocabScope === "here" ? vocabForThisVideo() : vocab.slice();
  const filtered = base.filter((v) => vocabMatchesQuery(v, vocabQuery));
  const hereId = state.videoId;
  return filtered.sort((a, b) => {
    const ah = vocabHasVideo(a, hereId) ? 0 : 1;
    const bh = vocabHasVideo(b, hereId) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function vocabItemHtml(v) {
  const sources = vocabSources(v);
  const src = preferredVocabSource(v);
  const here = vocabHasVideo(v, state.videoId);
  const sentence = src?.sentence || v.sentence || "";
  const sourceLines =
    sources.length > 1
      ? `<div class="vocab-sources">${sources
          .map((s) => {
            const isHere = Boolean(s.videoId && s.videoId === state.videoId);
            return `<div class="vocab-src-row">
              <button class="vocab-src-line" type="button" data-vsrc="${v.id}" data-vid="${esc(s.videoId)}" data-sec="${s.seconds}">
                <b>${clock(s.seconds)}</b>
                <span>${esc(s.videoTitle || t("未命名视频"))}</span>
                ${isHere ? `<em>${t("这篇")}</em>` : ""}
              </button>
              <button class="text-btn" type="button" data-dropsrc="${v.id}" data-vid="${esc(s.videoId)}">${t("去掉")}</button>
            </div>`;
          })
          .join("")}</div>`
      : `<button class="vocab-source vocab-src-one" type="button" data-vsrc="${v.id}" data-vid="${esc(src?.videoId || "")}" data-sec="${src?.seconds || 0}">${esc(src?.videoTitle || v.videoTitle || "")}</button>`;
  const card = cards.find((c) => c.type === "vocab" && c.sourceId === v.id);
  return `<div class="vocab-item">
    <div class="vocab-word">${esc(v.word)}${card ? `<span class="vocab-due">${esc(cardDueLabel(card))}</span>` : ""}</div>
    ${sentence ? `<div class="vocab-sentence">${esc(sentence)}</div>` : ""}
    ${sourceLines}
    <div class="row-actions">
      <button class="text-btn" data-def="${esc(v.word)}" type="button">${t("查词")}</button>
      <button class="text-btn" data-vopen="${v.id}" type="button">${here ? t("跳到这句") : t("打开这篇")}</button>
      ${here ? `<button class="text-btn" data-vnext="${esc(v.word)}" data-sec="${src?.seconds || 0}" type="button">${t("下一处")}</button>` : ""}
      <button class="text-btn" data-vreview="${v.id}" type="button">${t("背这个")}</button>
      <button class="text-btn" data-vcheck="${v.id}" type="button">${t("检验这个")}</button>
      <button class="text-btn" data-delv="${v.id}" type="button">${t("删除")}</button>
    </div>
    ${here ? vocabHitsHtml(v.word, { limit: 4 }) : ""}
  </div>`;
}

async function dropVocabSource(id, videoId) {
  const v = vocab.find((x) => x.id === id);
  if (!v) return;
  const rest = vocabSources(v).filter((s) => s.videoId !== videoId);
  if (!rest.length) vocab = vocab.filter((x) => x.id !== id);
  else {
    v.sources = rest;
    syncVocabPrimary(v);
  }
  await saveList("vb_vocab", vocab);
  await syncVocabCards();
  refreshTranscriptWhenIdle();
  renderNotes();
  if (currentView() === "vocab") renderVocabPage();
  paintVocabChrome();
}

function vocabByWord(word) {
  const key = String(word || "").trim().toLowerCase();
  return key ? vocab.find((v) => v.word.toLowerCase() === key) : null;
}

async function removeVocabWord(id, { silent = false } = {}) {
  const hit = vocab.find((v) => v.id === id);
  if (!hit) return false;
  const droppedCards = cards.filter((c) => c.sourceId === id);
  vocab = vocab.filter((v) => v.id !== id);
  cards = cards.filter((c) => c.sourceId !== id);
  await saveList("vb_vocab", vocab);
  await saveList("vb_cards", cards);
  refreshTranscriptWhenIdle();
  renderNotes();
  if (currentView() === "vocab") renderVocabPage();
  paintVocabChrome();
  if (!silent) {
    flashHint(t("已从生词本去掉"), {
      undo: async () => {
        vocab.unshift(hit);
        cards.push(...droppedCards);
        await saveList("vb_vocab", vocab);
        await saveList("vb_cards", cards);
        await syncVocabCards();
        refreshTranscriptWhenIdle();
        renderNotes();
        if (currentView() === "vocab") renderVocabPage();
        paintVocabChrome();
        flashHint(t("已放回生词本"));
      },
    });
  }
  return true;
}

async function addVocab(word, sentence, seconds) {
  const added = await addVocabMany([{ word, sentence, seconds }]);
  return added > 0;
}

async function addVocabMany(items) {
  let added = 0;
  let linked = 0;
  const created = [];
  const linkedIds = [];
  const srcVideo = state.videoId;
  for (const it of items || []) {
    const trimmed = String(it.word || "").trim();
    if (!trimmed) continue;
    const src = {
      videoId: it.videoId || state.videoId,
      videoTitle: it.videoTitle || state.title,
      sentence: String(it.sentence || "").slice(0, 400),
      seconds: Number(it.seconds) || 0,
    };
    const existing = vocab.find((v) => v.word.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (attachVocabSource(existing, src)) {
        linked += 1;
        linkedIds.push(existing.id);
      }
      continue;
    }
    const row = {
      id: uid("v"),
      word: trimmed.slice(0, 80),
      sentence: src.sentence,
      seconds: src.seconds,
      videoId: src.videoId,
      videoTitle: src.videoTitle,
      sources: [src],
      createdAt: Date.now(),
    };
    vocab.unshift(row);
    created.push(row);
    added += 1;
  }
  const needDef = [...created, ...linkedIds.map((id) => vocab.find((v) => v.id === id)).filter(Boolean)];
  for (const row of needDef) {
    if (row.definition?.senses?.[0]?.zh || row.definition?.meaning) continue;
    const result = await sendToBg({
      action: "vbDefine",
      word: row.word,
      sentence: row.sentence || "",
      videoTitle: row.videoTitle || "",
    }).catch(() => null);
    if (result?.ok && result.definition) row.definition = result.definition;
  }
  const changed = added + linked;
  if (changed) {
    if (vocab.length > 500) vocab.length = 500;
    await saveList("vb_vocab", vocab);
    await syncVocabCards();
    const undo = async () => {
      for (const row of created) await removeVocabWord(row.id, { silent: true });
      for (const id of linkedIds) await dropVocabSource(id, srcVideo);
      flashHint(t("已撤回存词"));
    };
    if (added && linked) flashHint(t("已存入 {n} 个词，另有 {m} 个补了这篇出处", { n: added, m: linked }), { undo });
    else if (linked) flashHint(linked === 1 ? t("已记下这篇也出现过。") : t("已给 {n} 个词补上这篇出处", { n: linked }), { undo });
    else flashHint(added === 1 ? t("已存入生词本") : t("已存入 {n} 个词", { n: added }), { undo });
  } else if ((items || []).some((it) => String(it.word || "").trim())) {
    flashHint(t("这个词已经在生词本里了。"));
  }
  const have = new Set(vocab.map((v) => v.word.toLowerCase()));
  if (state.levelScan?.words?.length) {
    state.levelScan.words = state.levelScan.words.filter((w) => !have.has(String(w.word || "").toLowerCase()));
    saveCache();
  }
  refreshTranscriptWhenIdle();
  renderNotes();
  if (currentView() === "vocab") renderVocabPage();
  paintVocabChrome();
  if (changed) checkAchievementsSoon();
  return changed;
}

function renderLevelChip() {
  const btn = $("levelScanBtn");
  if (!btn) return;
  const level = resolveVocabLevel();
  if (level.id === "off") {
    btn.hidden = true;
    return;
  }
  const n = state.levelScan?.words?.length || 0;
  btn.hidden = false;
  if (isScanningVocab) btn.textContent = t("正在筛生词…");
  else if (n) btn.textContent = `${n} 个可能生词`;
  else if (state.levelScan?.error) btn.textContent = t("再筛一次");
  else if (state.levelScan?.scanned) btn.textContent = t("这篇没有超纲词");
  else btn.textContent = t("本篇生词库");
}

function dismissVocabPreview() {
  state.vocabPreviewDone = true;
  saveCache();
  renderVocabPreview();
}

function skipVocabCand(index) {
  if (!state.levelScan?.words) return;
  state.levelScan.words = state.levelScan.words.filter((_, i) => i !== index);
  saveCache();
  refreshTranscriptWhenIdle();
  renderNotes();
  paintVocabChrome();
}

function wordHitRe(word) {
  const w = String(word || "").trim();
  if (!w) return null;
  if (/^[A-Za-z][A-Za-z'-]*$/.test(w)) {
    return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  }
  return null;
}

function vocabHits(word) {
  const w = String(word || "").trim();
  if (w.length < 2 || !state.segments.length) return [];
  const key = `${state.videoId}:${w.toLowerCase()}:${state.segments.length}`;
  if (vocabHitCache.has(key)) return vocabHitCache.get(key);
  const re = wordHitRe(w);
  const needle = w.toLowerCase();
  const hits = [];
  for (let i = 0; i < state.segments.length; i++) {
    const text = state.segments[i].text || "";
    if (re ? re.test(text) : text.toLowerCase().includes(needle)) {
      hits.push({ i, seconds: state.segments[i].start, text, zh: translationAt(i) });
    }
  }
  if (vocabHitCache.size > 80) vocabHitCache.clear();
  vocabHitCache.set(key, hits);
  return hits;
}

function highlightWord(text, word) {
  const raw = esc(text);
  const re = wordHitRe(word);
  if (!re) return raw;
  return raw.replace(new RegExp(re.source, "gi"), (m) => `<mark>${m}</mark>`);
}

function jumpKindFromExtra(extra) {
  if (extra?.source === "preview") return "vocab-preview";
  if (extra?.source === "word") return "word-card";
  if (extra?.source === "notes-vocab") return "vocab-list";
  if (extra?.source) return extra.source;
  return inferJumpKind();
}

function applyVocabJump(word, target, hits, extra = {}) {
  vocabJumpAt[String(word).toLowerCase()] = target.seconds;
  peekSeek(target.seconds, {
    word,
    kind: jumpKindFromExtra(extra),
    entry: extra.entry,
  });
  flashHint(`${hits.indexOf(target) + 1} / ${hits.length} 处。底下「回生词」或「下一处」。`);
}

function jumpVocabHit(word, seconds, extra) {
  const destId = String(extra?.entry?.videoId || extra?.videoId || "").trim();
  if (destId && destId !== state.videoId) {
    goToVideo(destId, seconds);
    return;
  }
  const hits = vocabHits(word);
  if (!hits.length) {
    if (destId && destId !== state.videoId) {
      goToVideo(destId, seconds);
      return;
    }
    if (Number.isFinite(seconds) && (!destId || destId === state.videoId)) {
      peekSeek(seconds, { word, kind: jumpKindFromExtra(extra), entry: extra?.entry });
      return;
    }
    flashHint("这篇字幕里没找到这个词。");
    return;
  }
  const target = Number.isFinite(seconds)
    ? hits.find((h) => Math.abs(h.seconds - seconds) < 2.5) || hits[0]
    : hits[0];
  applyVocabJump(word, target, hits, extra);
}

function jumpVocabNext(word, fromSeconds, extra) {
  const hits = vocabHits(word);
  if (!hits.length) {
    flashHint("这篇字幕里没找到这个词。");
    return;
  }
  const key = String(word).toLowerCase();
  const now = Number.isFinite(vocabJumpAt[key]) ? vocabJumpAt[key] : Number.isFinite(fromSeconds) ? fromSeconds : state.lastSeconds;
  const next = hits.find((h) => h.seconds > now + 0.4) || hits[0];
  applyVocabJump(word, next, hits, extra);
}

function jumpVocabPrev(word, fromSeconds, extra) {
  const hits = vocabHits(word);
  if (!hits.length) {
    flashHint("这篇字幕里没找到这个词。");
    return;
  }
  const key = String(word).toLowerCase();
  const now = Number.isFinite(vocabJumpAt[key]) ? vocabJumpAt[key] : Number.isFinite(fromSeconds) ? fromSeconds : state.lastSeconds;
  const prev = [...hits].reverse().find((h) => h.seconds < now - 0.4) || hits[hits.length - 1];
  applyVocabJump(word, prev, hits, extra);
}

function vocabHitsHtml(word, { open = false, limit = 6 } = {}) {
  const hits = vocabHits(word);
  if (!hits.length) return "";
  const rows = hits
    .slice(0, limit)
    .map(
      (h) =>
        `<button class="vocab-hit-line" type="button" data-vjump="${h.seconds}"><b>${clock(h.seconds)}</b><span>${highlightWord(
          h.text,
          word,
        )}</span></button>`,
    )
    .join("");
  const more = hits.length > limit ? `<p class="note-meta">共 ${hits.length} 处，先列 ${limit} 处</p>` : "";
  return `<details class="vocab-hits"${open ? " open" : ""}><summary>本篇 ${hits.length} 处</summary>${rows}${more}</details>`;
}

function bindVocabNav(root, word, seconds, extra) {
  if (!root) return;
  root.querySelectorAll("[data-vgo]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpVocabHit(word, Number.isFinite(Number(seconds)) ? Number(seconds) : undefined, extra);
    });
  });
  root.querySelectorAll("[data-vnext]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpVocabNext(word, Number.isFinite(Number(seconds)) ? Number(seconds) : undefined, extra);
    });
  });
  root.querySelectorAll("[data-vjump]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpVocabHit(word, Number(btn.dataset.vjump), extra);
    });
  });
}

function renderVocabPreview() {
  const el = $("vocabPreview");
  if (!el) return;
  const close = () => {
    el.dataset.open = "0";
    el.innerHTML = "";
    syncReadBanners();
  };
  const open = (html) => {
    el.dataset.open = "1";
    el.innerHTML = html;
    syncReadBanners();
  };
  if (!state.segments.length) {
    close();
    return;
  }
  const level = resolveVocabLevel();
  const words = state.levelScan?.words || [];
  if (level.id === "off") {
    open(`<div class="vocab-preview-kicker">看之前先设词汇水平</div>
      <p>设了之后，会按你的水平猜这篇里哪些可能是生词，先给一份生词库。建议先过一遍再看视频。</p>
      <div class="band-toggle" id="previewVocabBand">${vocabBandButtons()}</div>
      <label class="field" id="previewVocabScoreWrap" hidden>
        <span id="previewVocabScoreLabel">总分（选填）</span>
        <input type="text" id="previewVocabScore" inputmode="decimal" placeholder="${t("例如 6.5")}" autocomplete="off" />
      </label>`);
    bindVocabBandUI("preview", () => applyVocabPick("preview"));
    return;
  }
  if (state.vocabPreviewDone) {
    close();
    return;
  }
  if (isScanningVocab) {
    open(`<div class="vocab-preview-kicker">${wordPackReady(level.id) ? t("正在按「{name}」本地筛这篇的生词…", { name: level.label }) : t("正在按「{name}」筛这篇的生词…", { name: level.label })}</div>
      <p>筛完会先给你一份生词库。想直接看字幕也可以 <button class="text-btn" type="button" id="vocabPreviewSkip">先看视频</button></p>`);
    $("vocabPreviewSkip")?.addEventListener("click", dismissVocabPreview);
    return;
  }
  if (state.levelScan?.error) {
    open(`<div class="vocab-preview-kicker">${esc(friendlyAiError(state.levelScan.error, "这篇的生词没筛出来。"))}</div>
      <div class="row-actions">
        <button class="btn" type="button" id="vocabPreviewRetry">再筛一次</button>
        <button class="text-btn" type="button" id="vocabPreviewSkip">先看视频</button>
      </div>`);
    $("vocabPreviewRetry")?.addEventListener("click", () => scanVideoVocab({ force: true }));
    $("vocabPreviewSkip")?.addEventListener("click", dismissVocabPreview);
    return;
  }
  if (state.levelScan?.scanned && !words.length) {
    open(`<div class="vocab-preview-kicker">按你的「${esc(level.label)}」，这篇没有更多要过的词了。</div>
      <button class="btn" type="button" id="vocabPreviewGo">开始看</button>`);
    $("vocabPreviewGo")?.addEventListener("click", dismissVocabPreview);
    return;
  }
  if (!words.length) {
    open(`<div class="vocab-preview-kicker">打开后会按「${esc(level.label)}」筛这篇的生词</div>
      <p>筛完先给你一份生词库。也可以 <button class="text-btn" type="button" id="vocabPreviewSkip">先看视频</button></p>`);
    $("vocabPreviewSkip")?.addEventListener("click", dismissVocabPreview);
    return;
  }
  if (vocabCardIndex >= words.length) vocabCardIndex = 0;
  const i = vocabCardIndex;
  const w = words[i];
  const hits = vocabHits(w.word);
  open(`<div class="vocab-preview-kicker">先过生词 · ${i + 1} / ${words.length}</div>
    <div class="vocab-card">
      <div class="vocab-word">${esc(w.word)}</div>
      ${w.why ? `<div class="why">${esc(w.why)}</div>` : ""}
      <div class="vocab-sentence">${esc(w.sentence)}</div>
      <div class="row-actions">
        <button class="btn" type="button" data-skipv="${i}">会了</button>
        <button class="btn btn-primary" type="button" data-savev="${i}">存入</button>
        <button class="text-btn" type="button" data-def="${esc(w.word)}">查词</button>
        <button class="text-btn" type="button" data-vgo>跳到这句</button>
        ${hits.length > 1 ? `<button class="text-btn" type="button" data-vnext>下一处 · ${hits.length}</button>` : ""}
      </div>
      ${vocabHitsHtml(w.word, { limit: 5 })}
    </div>
    <div class="row-actions">
      <button class="text-btn" type="button" id="vocabPreviewSaveAll">全部存入生词本</button>
      <button class="text-btn" type="button" id="vocabPreviewGo">过完了，开始看</button>
    </div>`);
  $("vocabPreviewSaveAll")?.addEventListener("click", async () => {
    const added = await addVocabMany(state.levelScan?.words || []);
    if (added) dismissVocabPreview();
  });
  $("vocabPreviewGo")?.addEventListener("click", dismissVocabPreview);
  el.querySelectorAll("[data-def]").forEach((btn) => {
    btn.addEventListener("click", () => openWordCard(btn.dataset.def));
  });
  el.querySelectorAll("[data-savev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = (state.levelScan?.words || [])[Number(btn.dataset.savev)];
      if (item) addVocabMany([item]);
    });
  });
  el.querySelectorAll("[data-skipv]").forEach((btn) => {
    btn.addEventListener("click", () => skipVocabCand(Number(btn.dataset.skipv)));
  });
  bindVocabNav(el, w.word, w.seconds, { source: "preview" });
}

function openVocabTab(mode) {
  if (mode === "review" || mode === "deck" || mode === "check") vocabPageMode = mode;
  else vocabPageMode = dueVocabCards().length ? "review" : "deck";
  vocabReviewRevealed = false;
  switchView("vocab");
  renderVocabPage();
}

function dueOtherCards() {
  const now = Date.now();
  return cards
    .filter((c) => c.type !== "vocab" && c.due <= now)
    .sort((a, b) => a.due - b.due);
}

function dueVocabCards() {
  const now = Date.now();
  return cards
    .filter((c) => c.type === "vocab" && c.due <= now)
    .sort((a, b) => {
      if (reviewFocusId && a.id === reviewFocusId) return -1;
      if (reviewFocusId && b.id === reviewFocusId) return 1;
      return a.due - b.due;
    });
}

async function syncVocabCards() {
  const ids = new Set(vocab.map((v) => v.id));
  const have = new Set(cards.filter((c) => c.type === "vocab").map((c) => c.sourceId));
  let changed = false;
  for (const v of vocab) {
    if (have.has(v.id)) continue;
    const src = preferredVocabSource(v);
    cards.unshift({
      id: uid("c"),
      interval: 0,
      reps: 0,
      due: Date.now(),
      createdAt: Date.now(),
      type: "vocab",
      sourceId: v.id,
      videoId: src?.videoId || v.videoId,
      videoTitle: src?.videoTitle || v.videoTitle || "",
      seconds: src?.seconds || v.seconds || 0,
      ...vocabCardFrom(v),
    });
    changed = true;
  }
  const next = cards.filter((c) => c.type !== "vocab" || ids.has(c.sourceId));
  if (next.length !== cards.length) {
    cards = next;
    changed = true;
  }
  if (changed) {
    if (cards.length > 1000) cards.length = 1000;
    await saveList("vb_cards", cards);
  }
  renderReviewBadge();
}

function vocabScanHtml() {
  const level = resolveVocabLevel();
  const cands = state.levelScan?.words || [];
  const scanLabel = isScanningVocab
    ? t("正在筛…")
    : state.levelScan?.error
      ? t("再筛一次")
      : cands.length
        ? t("再筛一版")
        : t("筛这篇的生词");
  const scoreHint =
    level.id === "ielts" || level.id === "toefl"
      ? level.score
        ? ` · ${level.label}`
        : ` · ${t("可在顶栏补总分")}`
      : level.id !== "off"
        ? ` · ${level.label}`
        : "";
  return `<div class="vocab-scan">
      <div class="note-meta">${wordPackReady(level.id) ? t("这篇用本地词包筛，不花 token") : t("按你的水平筛字幕里可能还不熟的词")}${esc(scoreHint)}</div>
      ${
        level.id === "off"
          ? `<p class="setup-lead" style="margin:0">${t("点顶栏「设词汇水平」，或在阅读页直接选四级、六级、雅思或托福。雅思/托福也可以填总分。")}</p>`
          : `<div class="row-actions">
              <button class="btn" id="vocabScan" type="button"${isScanningVocab ? " disabled" : ""}>${scanLabel}</button>
              ${cands.length ? `<button class="btn" id="vocabSaveAll" type="button">${t("全部存入生词本")}</button>` : ""}
            </div>
            ${state.levelScan?.error ? `<p class="setup-lead" style="margin:8px 0 0">${esc(friendlyAiError(state.levelScan.error, t("这篇的生词没筛出来。")))}</p>` : ""}
            ${
              cands.length
                ? cands
                    .map(
                      (w, i) => `<div class="vocab-cand">
                  <div class="vocab-word">${esc(w.word)}</div>
                  ${w.why ? `<div class="why">${esc(w.why)}</div>` : ""}
                  <div class="vocab-sentence">${esc(w.sentence)}</div>
                  <div class="row-actions">
                    <button class="text-btn" data-def="${esc(w.word)}" type="button">${t("查词")}</button>
                    <button class="text-btn" data-vgo="${esc(w.word)}" data-sec="${w.seconds}" type="button">${t("跳到这句")}</button>
                    <button class="text-btn" data-vnext="${esc(w.word)}" data-sec="${w.seconds}" type="button">${t("下一处")}</button>
                    <button class="text-btn" data-savev="${i}" type="button">${t("存入")}</button>
                  </div>
                  ${vocabHitsHtml(w.word, { limit: 4 })}
                </div>`,
                    )
                    .join("")
                : state.levelScan?.scanned
                  ? `<p class="setup-lead" style="margin:8px 0 0">${t("按这个水平，这篇里没有明显超纲词。")}</p>`
                  : ""
            }`
      }
    </div>`;
}

function renderVocabDeck(root) {
  const hereVocab = vocabForThisVideo();
  const shown = visibleVocab();
  const keepSearch = document.activeElement?.id === "vocabSearch";
  const selStart = keepSearch ? document.activeElement.selectionStart : null;
  const selEnd = keepSearch ? document.activeElement.selectionEnd : null;
  const manage = vocab.length
    ? `<div class="vocab-manage">
          <div class="notes-tabs">
            <button class="seg-btn${vocabScope === "here" ? " active" : ""}" data-vscope="here" type="button">${t("本篇")}${hereVocab.length ? ` ${hereVocab.length}` : ""}</button>
            <button class="seg-btn${vocabScope === "all" ? " active" : ""}" data-vscope="all" type="button">${t("全部")} ${vocab.length}</button>
          </div>
          <input id="vocabSearch" class="lib-search" type="search" placeholder="${t("搜词、例句、视频标题")}" value="${esc(vocabQuery)}" />
          <p class="note-meta">${
            vocabScope === "all"
              ? t("一本总牌组。点出处就能跳回那一支。")
              : t("只看这篇。同一词在别的视频出现过，点出处也能打开。")
          }</p>
        </div>`
    : "";
  const batchBtn = vocab.length
    ? `<div class="vocab-batch">
      <button class="btn" id="vocabExportMd" type="button">${t("导出生词")}</button>
      ${vocabScope === "here" && hereVocab.length && vocab.length > hereVocab.length ? `<button class="btn" id="vocabExportAllMd" type="button">${t("全部生词")}</button>` : ""}
      <button class="btn" id="vocabExportCards" type="button">${t("导出卡片")}</button>
      <button class="btn" id="vocabAnki" type="button">${t("导出给 Anki")}</button>
      <button class="btn btn-primary" id="vocabCheckStart" type="button">${t("检验这些词")}</button>
    </div>`
    : "";
  const empty =
    !vocab.length
      ? `<div class="chat-empty">${t("选中单词，点「存词」或「查词」。筛出来的也可以一键存入。存进去就会按间隔再见到。")}</div>`
      : !shown.length
        ? `<div class="chat-empty">${
            vocabQuery
              ? t("没有对上的词。")
              : vocabScope === "here"
                ? t("这篇还没有生词。上面可以筛这篇，或看全部。")
                : t("生词本还是空的。")
          }</div>`
        : shown.map(vocabItemHtml).join("");
  root.innerHTML = vocabPageTabs() + vocabScanHtml() + manage + batchBtn + empty;
  $("vocabExportMd")?.addEventListener("click", () => exportVocabMarkdown(vocabScope === "all" ? "all" : "video"));
  $("vocabExportAllMd")?.addEventListener("click", () => exportVocabMarkdown("all"));
  $("vocabExportCards")?.addEventListener("click", () => openExportCards({ kind: "vocab" }));
  $("vocabAnki")?.addEventListener("click", () => exportVocabAnki(vocabScope === "all" ? "all" : "video"));
  $("vocabCheckStart")?.addEventListener("click", () => startVocabCheck(vocabScope === "here" ? "here" : "all", "mix"));
  $("vocabScan")?.addEventListener("click", () => scanVideoVocab({ force: true }));
  $("vocabSaveAll")?.addEventListener("click", () => addVocabMany(state.levelScan?.words || []));
  root.querySelectorAll("[data-vscope]").forEach((btn) => {
    btn.addEventListener("click", () => {
      vocabScope = btn.dataset.vscope === "here" ? "here" : "all";
      renderVocabPage();
    });
  });
  $("vocabSearch")?.addEventListener("input", (event) => {
    vocabQuery = event.target.value;
    renderVocabPage();
  });
  if (keepSearch) {
    const input = $("vocabSearch");
    if (input) {
      input.focus();
      if (selStart != null) input.setSelectionRange(selStart, selEnd ?? selStart);
    }
  }
  bindVocabPageTabs(root);
  bindVocabDeck(root);
}

function vocabPageTabs() {
  const dueN = dueVocabCards().length;
  return `<div class="notes-tabs">
    <button class="seg-btn${vocabPageMode === "review" ? " active" : ""}" data-vpage="review" type="button">${t("今日")}${dueN ? ` ${dueN}` : ""}</button>
    <button class="seg-btn${vocabPageMode === "check" ? " active" : ""}" data-vpage="check" type="button">${t("检验")}</button>
    <button class="seg-btn${vocabPageMode === "deck" ? " active" : ""}" data-vpage="deck" type="button">${t("牌组")} ${vocab.length}</button>
  </div>
  <p class="map-help">${
    vocabPageMode === "check"
      ? t("先自己写，再对答案。对了按间隔往后排，错了十分钟后再来。")
      : t("到期的词在「今日」翻卡。想现在验会不会，去「检验」自己写。")
  }</p>`;
}

function renderVocabReview(root) {
  const due = dueVocabCards();
  const total = vocab.length;
  if (!total) {
    root.innerHTML = `${vocabPageTabs()}<div class="chat-empty">${t("牌组还是空的。在阅读里点词存入，或到「牌组」筛这篇。")}<br><button class="btn" data-vpage="deck" type="button">${t("去牌组")}</button></div>`;
    bindVocabPageTabs(root);
    return;
  }
  if (!due.length) {
    const next = cards.filter((c) => c.type === "vocab").sort((a, b) => a.due - b.due)[0];
    const wait = next ? Math.max(0.1, Math.round(((next.due - Date.now()) / DAY) * 10) / 10) : 0;
    root.innerHTML = `${vocabPageTabs()}<div class="review-done">
      <div class="review-done-mark">✓</div>
      <p>${t("今天的生词背完了。牌组里共 {n} 个词，最近一张约 {d} 天后到期。", { n: total, d: wait })}</p>
      <div class="row-actions" style="justify-content:center">
        <button class="btn btn-primary" data-vpage="check" type="button">${t("去检验")}</button>
        <button class="btn" data-vpage="deck" type="button">${t("去牌组")}</button>
      </div>
    </div>`;
    bindVocabPageTabs(root);
    return;
  }
  const card = due[0];
  const sameVideo = card.videoId && card.videoId === state.videoId;
  root.innerHTML = `${vocabPageTabs()}
    <div class="review-card">
      <div class="review-meta">${t("生词")} · ${esc(card.videoTitle || "")}</div>
      <div class="review-front">${cardFrontHtml(card)}</div>
      ${
        vocabReviewRevealed
          ? `<div class="review-back">
              <div class="review-answer">${esc(card.back)}</div>
              ${card.hint ? `<div class="review-hint">${esc(card.hint)}</div>` : ""}
              <div class="row-actions">
                ${card.seconds != null && card.videoId ? `<button class="text-btn" id="vocabReviewJump" type="button">${sameVideo ? `${t("跳到出处")} ${clock(card.seconds)}` : t("打开出处")}</button>` : ""}
              </div>
            </div>
            <div class="review-grades">
              <button class="btn grade-again" id="vocabAgain" type="button">${t("忘了")}<i>${t("10 分钟后再来")}</i></button>
              <button class="btn grade-good" id="vocabGood" type="button">${t("想起来了")}<i>${card.interval ? Math.min(365, Math.round(card.interval * 2.5 * 10) / 10) : 1} ${t("天后")}</i></button>
              <button class="btn grade-easy" id="vocabEasy" type="button">${t("太简单")}<i>${card.interval ? Math.min(365, card.interval * 4) : 3} ${t("天后")}</i></button>
            </div>`
          : `<button class="btn btn-primary review-reveal" id="vocabReveal" type="button">${t("显示答案")}</button>`
      }
    </div>`;
  bindVocabPageTabs(root);
  $("vocabReveal")?.addEventListener("click", () => {
    vocabReviewRevealed = true;
    renderVocabPage();
  });
  $("vocabAgain")?.addEventListener("click", () => gradeCard(card, "again"));
  $("vocabGood")?.addEventListener("click", () => gradeCard(card, "good"));
  $("vocabEasy")?.addEventListener("click", () => gradeCard(card, "easy"));
  $("vocabReviewJump")?.addEventListener("click", () => {
    if (card.videoId === state.videoId) seek(card.seconds);
    else openVideoAt(card.videoId, card.seconds);
  });
}

function bindVocabPageTabs(root) {
  root?.querySelectorAll("[data-vpage]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      setVocabPage(btn.dataset.vpage);
    });
  });
}

function bindVocabDeck(root) {
  root.querySelectorAll("[data-savev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = (state.levelScan?.words || [])[Number(btn.dataset.savev)];
      if (item) addVocabMany([item]);
    });
  });
  root.querySelectorAll("[data-vgo]").forEach((btn) => {
    btn.addEventListener("click", () => jumpVocabHit(btn.dataset.vgo, Number(btn.dataset.sec), { source: "notes-vocab" }));
  });
  root.querySelectorAll("[data-vopen]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = vocab.find((v) => v.id === btn.dataset.vopen);
      if (item) jumpVocabEntry(item);
    });
  });
  root.querySelectorAll("[data-vsrc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = vocab.find((v) => v.id === btn.dataset.vsrc);
      const sec = Number(btn.dataset.sec);
      const src =
        vocabSources(item).find((s) => s.videoId === btn.dataset.vid && Math.abs((s.seconds || 0) - sec) < 0.6) ||
        vocabSources(item).find((s) => s.videoId === btn.dataset.vid);
      if (item && src) openVocabSource(item, src);
    });
  });
  root.querySelectorAll("[data-dropsrc]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      dropVocabSource(btn.dataset.dropsrc, btn.dataset.vid);
    });
  });
  root.querySelectorAll("[data-vnext]").forEach((btn) => {
    btn.addEventListener("click", () => jumpVocabNext(btn.dataset.vnext, Number(btn.dataset.sec), { source: "notes-vocab" }));
  });
  root.querySelectorAll(".vocab-item [data-vjump], .vocab-cand [data-vjump]").forEach((btn) => {
    const word = btn.closest(".vocab-item, .vocab-cand")?.querySelector(".vocab-word")?.childNodes[0]?.textContent;
    btn.addEventListener("click", () => jumpVocabHit(word, Number(btn.dataset.vjump), { source: "notes-vocab" }));
  });
  root.querySelectorAll("[data-def]").forEach((btn) => btn.addEventListener("click", () => openWordCard(btn.dataset.def)));
  root.querySelectorAll("[data-vreview]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = cards.find((c) => c.type === "vocab" && c.sourceId === btn.dataset.vreview);
      if (card) reviewFocusId = card.id;
      vocabPageMode = "review";
      vocabReviewRevealed = false;
      renderVocabPage();
    });
  });
  root.querySelectorAll("[data-vcheck]").forEach((btn) => {
    btn.addEventListener("click", () => startVocabCheck("all", "mix", { focusId: btn.dataset.vcheck }));
  });
  root.querySelectorAll("[data-delv]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await removeVocabWord(btn.dataset.delv);
    }),
  );
}

function renderVocabPage() {
  const root = $("vocabBox");
  if (!root) return;
  renderReviewBadge();
  if (vocabPageMode === "review") renderVocabReview(root);
  else if (vocabPageMode === "check") renderVocabCheck(root);
  else renderVocabDeck(root);
}

function shuffledCopy(list) {
  const copy = (list || []).slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function foldCheckText(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000.,，。！!？?；;：:、·•'"“”‘’`()（）[\]【】<>《》]/g, "");
}

function vocabWordOfCard(card) {
  const v = vocab.find((x) => x.id === card.sourceId);
  if (v?.word) return String(v.word).trim();
  if (/____/.test(card.front || "")) return String(card.back || "").trim();
  const m = String(card.front || "").match(/^(.+?)\s*是什么意思/);
  if (m) return m[1].trim();
  return String(card.back || "").trim();
}

function clozeFromSentence(sentence, word) {
  const text = String(sentence || "").trim();
  const token = String(word || "").trim();
  if (!text || !token) return "";
  const pattern = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  if (!pattern.test(text)) return "";
  return text.replace(pattern, "____");
}

function vocabCheckPool(scope) {
  if (scope === "due") return dueVocabCards();
  const hereIds = new Set(vocabForThisVideo().map((v) => v.id));
  return cards.filter((c) => {
    if (c.type !== "vocab") return false;
    if (scope === "here") return hereIds.has(c.sourceId) || (c.videoId && c.videoId === state.videoId);
    return true;
  });
}

function pickCheckCards(pool, n) {
  const now = Date.now();
  const due = shuffledCopy(pool.filter((c) => c.due <= now));
  const rest = shuffledCopy(pool.filter((c) => c.due > now));
  return due.concat(rest).slice(0, n);
}

function buildVocabCheckItem(card, preferKind) {
  const v = vocab.find((x) => x.id === card.sourceId);
  const word = vocabWordOfCard(card);
  const gloss = vocabGlossOf(v) || card.hint || (!/____/.test(card.front || "") ? String(card.back || "") : "");
  const sentence = String(preferredVocabSource(v)?.sentence || v?.sentence || "").trim();
  const cloze = clozeFromSentence(sentence, word) || (/____/.test(card.front || "") ? card.front : "");
  let kind = preferKind === "meaning" || preferKind === "cloze" ? preferKind : "meaning";
  if (kind === "cloze" && !cloze) kind = gloss ? "meaning" : "";
  if (kind === "meaning" && !foldCheckText(gloss) && cloze) kind = "cloze";
  if (!kind || !word) return null;
  if (kind === "cloze") {
    return { cardId: card.id, sourceId: card.sourceId, kind, word, gloss, sentence, prompt: cloze, answers: [word] };
  }
  const answers = [gloss, v?.definition?.meaning, (v?.definition?.senses || [])[0]?.zh, card.hint].filter(Boolean);
  if (!answers.some((a) => foldCheckText(a))) return null;
  return { cardId: card.id, sourceId: card.sourceId, kind, word, gloss, sentence, prompt: word, answers };
}

function vocabCheckCorrect(item, typed) {
  const raw = String(typed || "").trim();
  if (!raw || !item) return false;
  if (foldCheckText(raw) === foldCheckText(item.word)) return true;
  if (item.kind === "cloze") return foldCheckText(raw) === foldCheckText(item.word);
  const a = foldCheckText(raw);
  return (item.answers || []).some((ans) => {
    const b = foldCheckText(ans);
    if (!a || !b) return false;
    if (a === b) return true;
    return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
  });
}

function liveVocabCard(item) {
  return cards.find((c) => c.id === item.cardId) || cards.find((c) => c.type === "vocab" && c.sourceId === item.sourceId);
}

async function startVocabCheck(scope, kinds, opts = {}) {
  await syncVocabCards();
  const nextScope = scope === "here" || scope === "all" || scope === "due" ? scope : vocabCheckPref.scope;
  const nextKinds = kinds === "meaning" || kinds === "cloze" ? kinds : "mix";
  vocabCheckPref = { scope: nextScope, kinds: nextKinds };
  let pool = opts.focusId
    ? cards.filter((c) => c.type === "vocab" && (c.sourceId === opts.focusId || c.id === opts.focusId))
    : vocabCheckPool(nextScope);
  if (opts.misses?.length) pool = opts.misses.map((item) => liveVocabCard(item)).filter(Boolean);
  if (!pool.length) {
    vocabCheck = null;
    vocabPageMode = "check";
    switchView("vocab");
    renderVocabPage();
    flashHint(
      nextScope === "due"
        ? t("现在没有到期的词。可以改用本篇或全部。")
        : nextScope === "here"
          ? t("这篇还没有生词。")
          : t("牌组还是空的。"),
    );
    return;
  }
  const picked = opts.focusId ? pool.slice(0, 1) : pickCheckCards(pool, 10);
  const items = [];
  picked.forEach((card, i) => {
    const prefer = nextKinds === "mix" ? (i % 2 ? "meaning" : "cloze") : nextKinds;
    const item = buildVocabCheckItem(card, prefer);
    if (item) items.push(item);
  });
  if (!items.length) {
    vocabCheck = null;
    vocabPageMode = "check";
    switchView("vocab");
    renderVocabPage();
    flashHint(t("这些词还缺释义或原句，先去查词再检验。"));
    return;
  }
  vocabCheck = {
    items,
    i: 0,
    typed: "",
    revealed: false,
    ok: null,
    hits: [],
    misses: [],
    scope: nextScope,
    kinds: nextKinds,
    done: false,
  };
  vocabPageMode = "check";
  switchView("vocab");
  renderVocabPage();
}

async function submitVocabCheck({ giveUp = false } = {}) {
  if (!vocabCheck || vocabCheck.done || vocabCheck.revealed) return;
  const item = vocabCheck.items[vocabCheck.i];
  const typed = $("vocabCheckInput")?.value ?? vocabCheck.typed;
  vocabCheck.typed = typed;
  if (!giveUp && !String(typed).trim()) {
    flashHint(t("先写一点再对。"));
    $("vocabCheckInput")?.focus();
    return;
  }
  const ok = !giveUp && vocabCheckCorrect(item, typed);
  vocabCheck.revealed = true;
  vocabCheck.ok = ok;
  if (ok) vocabCheck.hits.push(item);
  else vocabCheck.misses.push(item);
  const card = liveVocabCard(item);
  if (card) await gradeCard(card, ok ? "good" : "again", { silent: true });
  renderVocabPage();
}

function advanceVocabCheck() {
  if (!vocabCheck) return;
  if (vocabCheck.i + 1 >= vocabCheck.items.length) vocabCheck.done = true;
  else {
    vocabCheck.i += 1;
    vocabCheck.typed = "";
    vocabCheck.revealed = false;
    vocabCheck.ok = null;
  }
  renderVocabPage();
}

function renderVocabCheckLobby(root) {
  const dueN = dueVocabCards().length;
  const hereN = vocabForThisVideo().length;
  const allN = vocab.length;
  if (!allN) {
    root.innerHTML = `${vocabPageTabs()}<div class="chat-empty">${t("牌组还是空的。在阅读里点词存入，或到「牌组」筛这篇。")}<br><button class="btn" data-vpage="deck" type="button">${t("去牌组")}</button></div>`;
    bindVocabPageTabs(root);
    return;
  }
  const scope = vocabCheckPref.scope;
  const kinds = vocabCheckPref.kinds;
  const ready =
    scope === "due" ? dueN : scope === "here" ? hereN : allN;
  root.innerHTML = `${vocabPageTabs()}
    <div class="vocab-check-lobby">
      <p class="note-meta">${t("选范围和题型。先自己写，再对答案。")}</p>
      <div class="notes-tabs">
        <button class="seg-btn${scope === "due" ? " active" : ""}" data-cscope="due" type="button">${t("到期")}${dueN ? ` ${dueN}` : ""}</button>
        <button class="seg-btn${scope === "here" ? " active" : ""}" data-cscope="here" type="button">${t("本篇")}${hereN ? ` ${hereN}` : ""}</button>
        <button class="seg-btn${scope === "all" ? " active" : ""}" data-cscope="all" type="button">${t("全部")} ${allN}</button>
      </div>
      <div class="notes-tabs">
        <button class="seg-btn${kinds === "mix" ? " active" : ""}" data-ckind="mix" type="button">${t("两种都来")}</button>
        <button class="seg-btn${kinds === "meaning" ? " active" : ""}" data-ckind="meaning" type="button">${t("看词写意思")}</button>
        <button class="seg-btn${kinds === "cloze" ? " active" : ""}" data-ckind="cloze" type="button">${t("看句子填空")}</button>
      </div>
      <button class="btn btn-primary" id="vocabCheckGo" type="button"${ready ? "" : " disabled"}>${t("开始检验")}</button>
    </div>`;
  bindVocabPageTabs(root);
  root.querySelectorAll("[data-cscope]").forEach((btn) => {
    btn.addEventListener("click", () => {
      vocabCheckPref.scope = btn.dataset.cscope;
      renderVocabPage();
    });
  });
  root.querySelectorAll("[data-ckind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      vocabCheckPref.kinds = btn.dataset.ckind;
      renderVocabPage();
    });
  });
  $("vocabCheckGo")?.addEventListener("click", () => startVocabCheck(vocabCheckPref.scope, vocabCheckPref.kinds));
}

function renderVocabCheckDone(root) {
  const total = vocabCheck.items.length;
  const hit = vocabCheck.hits.length;
  const misses = vocabCheck.misses;
  root.innerHTML = `${vocabPageTabs()}<div class="review-done">
      <div class="review-done-mark">${hit === total ? "✓" : hit}</div>
      <p>${t("{n} 个里对了 {m} 个。", { n: total, m: hit })}</p>
      ${
        misses.length
          ? `<ul class="vocab-check-misses">${misses
              .map((item) => `<li><b>${esc(item.word)}</b>${item.gloss ? ` · ${esc(item.gloss)}` : ""}</li>`)
              .join("")}</ul>`
          : `<p class="note-meta">${t("这轮都会了。")}</p>`
      }
      <div class="row-actions" style="justify-content:center">
        ${misses.length ? `<button class="btn btn-primary" id="vocabCheckRetry" type="button">${t("再练错过的")}</button>` : ""}
        <button class="btn${misses.length ? "" : " btn-primary"}" id="vocabCheckAgain" type="button">${t("再来一轮")}</button>
        <button class="btn" data-vpage="deck" type="button">${t("去牌组")}</button>
      </div>
    </div>`;
  bindVocabPageTabs(root);
  $("vocabCheckRetry")?.addEventListener("click", () => startVocabCheck(vocabCheck.scope, vocabCheck.kinds, { misses }));
  $("vocabCheckAgain")?.addEventListener("click", () => startVocabCheck(vocabCheck.scope, vocabCheck.kinds));
}

function renderVocabCheck(root) {
  if (!vocabCheck || vocabCheck.done === undefined) {
    renderVocabCheckLobby(root);
    return;
  }
  if (vocabCheck.done) {
    renderVocabCheckDone(root);
    return;
  }
  const item = vocabCheck.items[vocabCheck.i];
  const card = liveVocabCard(item);
  const sameVideo = card?.videoId && card.videoId === state.videoId;
  const kindLabel = item.kind === "cloze" ? t("看句子填空") : t("看词写意思");
  const placeholder = item.kind === "cloze" ? t("写出挖空的词") : t("写出这个词的意思");
  root.innerHTML = `${vocabPageTabs()}
    <div class="review-card vocab-check-card">
      <div class="review-meta">${t("检验")} · <span class="vocab-check-prog">${vocabCheck.i + 1} / ${vocabCheck.items.length}</span> · ${kindLabel}</div>
      <div class="review-front">${item.kind === "cloze" ? cardFrontHtml({ front: item.prompt }) : `<b>${esc(item.word)}</b>`}</div>
      ${
        vocabCheck.revealed
          ? `${
              vocabCheck.ok
                ? `<div class="vocab-check-verdict is-ok">${t("对了")}</div>`
                : `<div class="vocab-check-verdict is-miss">${t("还不会")}</div>`
            }
            ${
              !vocabCheck.ok && vocabCheck.typed
                ? `<div class="vocab-check-yours">${t("你写的")} ${esc(vocabCheck.typed)}</div>`
                : ""
            }
            <div class="review-back">
              <div class="review-answer">${esc(item.kind === "cloze" ? item.word : item.gloss || item.word)}</div>
              ${item.kind === "cloze" && item.gloss ? `<div class="review-hint">${esc(item.gloss)}</div>` : ""}
              ${item.kind === "meaning" && item.sentence ? `<div class="review-hint">${esc(item.sentence)}</div>` : ""}
              <div class="row-actions">
                ${card?.seconds != null && card.videoId ? `<button class="text-btn" id="vocabCheckJump" type="button">${sameVideo ? `${t("跳到出处")} ${clock(card.seconds)}` : t("打开出处")}</button>` : ""}
                <button class="text-btn" id="vocabCheckReset" type="button">${t("换一套")}</button>
              </div>
            </div>
            <button class="btn btn-primary review-reveal" id="vocabCheckNext" type="button">${
              vocabCheck.i + 1 >= vocabCheck.items.length ? t("看结果") : t("下一题")
            }</button>`
          : `<input id="vocabCheckInput" class="lib-search vocab-check-in" type="text" autocomplete="off" spellcheck="false" placeholder="${placeholder}" value="${esc(vocabCheck.typed)}" />
            <div class="row-actions">
              <button class="btn btn-primary" id="vocabCheckSubmit" type="button">${t("对答案")}</button>
              <button class="btn" id="vocabCheckMiss" type="button">${t("不会")}</button>
              <button class="text-btn" id="vocabCheckReset" type="button">${t("换一套")}</button>
            </div>`
      }
    </div>`;
  bindVocabPageTabs(root);
  $("vocabCheckSubmit")?.addEventListener("click", () => submitVocabCheck());
  $("vocabCheckMiss")?.addEventListener("click", () => submitVocabCheck({ giveUp: true }));
  $("vocabCheckNext")?.addEventListener("click", () => advanceVocabCheck());
  $("vocabCheckReset")?.addEventListener("click", () => {
    vocabCheck = null;
    renderVocabPage();
  });
  $("vocabCheckJump")?.addEventListener("click", () => {
    if (!card) return;
    if (card.videoId === state.videoId) seek(card.seconds);
    else openVideoAt(card.videoId, card.seconds);
  });
  const input = $("vocabCheckInput");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener("input", (event) => {
      vocabCheck.typed = event.target.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        submitVocabCheck();
      }
    });
  } else {
    $("vocabCheckNext")?.focus();
  }
}

async function scanVideoVocab({ force = false } = {}) {
  const level = resolveVocabLevel();
  if (level.id === "off" || !state.segments.length) {
    paintVocabChrome();
    return;
  }
  const key = `${state.videoId}:${level.key}`;
  if (!force && state.levelScan?.key === key && state.levelScan.scanned) {
    paintVocabChrome();
    return;
  }
  if (isScanningVocab) return;
  isScanningVocab = true;
  state.levelScan = { ...(state.levelScan || {}), scanning: true, error: "", key };
  paintVocabChrome();
  if (currentView() === "vocab") renderVocabPage();
  const videoId = state.videoId;
  try {
    const known = new Set(vocab.map((v) => String(v.word || "").toLowerCase()));
    if (wordPackReady(level.id)) {
      const words = (globalThis.WordLevel?.scanLocal(state.segments, {
        packWords: packKnownSet(level),
        userKnown: known,
        limit: 24,
      }) || []).map((w) => ({
        ...w,
        why: w.why || t("不在「{name}」词包里", { name: level.label }),
      }));
      if (state.videoId !== videoId) return;
      state.levelScan = { words, key, scanned: true, error: "", local: true };
      vocabCardIndex = 0;
      saveCache();
      return;
    }
    const tokens = globalThis.WordLevel?.candidates(state.segments, { known }) || [];
    if (!tokens.length) {
      state.levelScan = { words: [], key, scanned: true, error: "" };
      saveCache();
      return;
    }
    const result = await sendToBg({
      action: "vbScanVocab",
      level: { label: level.label, known: level.known, prompt: level.prompt },
      tokens,
      title: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(friendlyAiError(result?.error, "这篇的生词没筛出来。"));
    const allowed = new Set(tokens.map((t) => t.word));
    const words = (result.words || [])
      .map((w) => {
        const word = String(w.word || "").toLowerCase();
        const src = tokens.find((t) => t.word === word);
        return {
          word,
          why: String(w.why || "").slice(0, 40),
          sentence: src?.sentence || w.sentence || "",
          seconds: src?.seconds || 0,
        };
      })
      .filter((w) => allowed.has(w.word) && !known.has(w.word))
      .slice(0, 24);
    state.levelScan = { words, key, scanned: true, error: "" };
    vocabCardIndex = 0;
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) {
      state.levelScan = {
        words: state.levelScan?.words || [],
        key,
        scanned: false,
        error: friendlyAiError(error.message, "这篇的生词没筛出来。"),
      };
    }
  } finally {
    isScanningVocab = false;
    if (state.videoId === videoId) {
      refreshTranscriptWhenIdle();
      renderNotes();
      if (currentView() === "vocab") renderVocabPage();
      paintVocabChrome();
    }
  }
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
  const saved = vocabByWord(word);
  card.innerHTML = `
    <div class="word-card-top">
      <span class="word-card-word">${esc(word)} <button class="word-say" id="sayHead" type="button">🔊</button></span>
      <div class="row-actions">
        <button class="btn" id="wordSave" type="button">${saved ? t("从本里去掉") : t("存入生词本")}</button>
        <button class="text-btn" id="wordClose" type="button">关闭</button>
      </div>
    </div>
    ${entry.sentence ? `<p class="vocab-sentence">${esc(entry.sentence)}</p>` : ""}
    <div class="row-actions">
      <button class="text-btn" type="button" data-vgo>跳到这句</button>
      <button class="text-btn" type="button" data-vnext>下一处</button>
    </div>
    ${vocabHitsHtml(word, { open: true, limit: 8 })}
    <div id="wordBody">正在查词典…</div>
  `;
  document.body.appendChild(card);
  bindVocabNav(card, word, entry.seconds, { source: "word", entry });
  $("sayHead").addEventListener("click", () => pronounce(word));
  $("wordClose").addEventListener("click", () => card.remove());
  $("wordSave").addEventListener("click", async () => {
    const now = vocabByWord(word);
    if (now) {
      await removeVocabWord(now.id);
      $("wordSave").textContent = t("存入生词本");
    } else {
      const existingDef = vocab.find((v) => v.word.toLowerCase() === String(word).toLowerCase())?.definition;
      await addVocab(word, entry.sentence, entry.seconds);
      const row = vocab.find((v) => v.word.toLowerCase() === String(word).toLowerCase());
      if (row && existingDef && !row.definition) row.definition = existingDef;
      $("wordSave").textContent = vocabByWord(word) ? t("从本里去掉") : t("存入生词本");
    }
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
      $("wordBody").innerHTML = `<div class="dive-error">${esc(friendlyAiError(result?.error, t("查词失败")))}</div>`;
      return;
    }
    $("wordBody").innerHTML = renderDef(result.definition);
    const target = vocab.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (target) {
      target.definition = result.definition;
      await saveList("vb_vocab", vocab);
      const card = cards.find((c) => c.type === "vocab" && c.sourceId === target.id);
      if (card) {
        const body = vocabCardFrom(target);
        card.front = body.front;
        card.back = body.back;
        card.hint = body.hint;
        await saveList("vb_cards", cards);
      }
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
    title: state.title || t("未命名视频"),
    url: watchUrl(state.videoId),
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
    vocab: vocabForThisVideo().map((v) => {
      const src = preferredVocabSource(v);
      if (!src) return v;
      return {
        ...v,
        videoId: src.videoId || v.videoId,
        videoTitle: src.videoTitle || v.videoTitle,
        sentence: src.sentence || v.sentence,
        seconds: src.seconds,
      };
    }),
    chat: (state.chat || []).slice(-24),
    marks: forThisVideo(marks),
    segments: (state.segments || []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
    translations: state.translations || {},
    uiTheme: settingsCache.uiTheme || "paper",
  };
}

async function openExport() {
  const payload = buildExportPayload();
  const hasBody =
    payload.notes.length ||
    payload.quotes.length ||
    payload.highlights.length ||
    payload.vocab.length ||
    payload.blocks.length ||
    payload.chat.length ||
    payload.marks.length ||
    payload.segments?.length;
  if (!hasBody) {
    alert(t("先打开一支视频，或至少留下一条笔记、金句、划线、书签或生词。"));
    return;
  }
  await chrome.storage.local.set({ vb_export: payload });
  chrome.tabs.create({ url: chrome.runtime.getURL("export.html") });
  checkAchievementsSoon("export");
}

function looksZh(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

function zhForLine(text) {
  const i = state.segments.findIndex((s) => s.text === text);
  return i >= 0 ? translationAt(i) : "";
}

function backfillHandQuoteZh() {
  let changed = false;
  for (const q of quotes) {
    if (q.videoId !== state.videoId || q.zh || looksZh(q.text || q.en)) continue;
    const zh = zhForLine(q.text) || zhForLine(q.en);
    if (!zh || zh.includes("失败")) continue;
    q.zh = zh.slice(0, 280);
    changed = true;
  }
  if (!changed) return;
  saveList("vb_quotes", quotes);
  if (notesFilter === "quotes") renderNotes();
}

function snapQuoteTime(at, en, zh) {
  const clocked = parseClock(at);
  const hint = String(en || zh || "").slice(0, 40);
  if (hint) {
    const hit = state.segments.find(
      (s) => s.text.includes(hint) || hint.includes(s.text.slice(0, 40)),
    );
    if (hit) return hit.start;
  }
  return clocked != null ? clocked : 0;
}

function groundQuote(en, zh, at) {
  const hint = String(en || zh || "");
  const hit = state.segments.find(
    (s) => hint && (s.text.includes(hint.slice(0, 36)) || hint.includes(s.text.slice(0, 36))),
  );
  if (hit) {
    if (looksZh(hit.text)) return { en: en || "", zh: hit.text, seconds: hit.start };
    return { en: hit.text, zh: zh || "", seconds: hit.start };
  }
  return { en, zh, seconds: snapQuoteTime(at, en, zh) };
}

function videoQuotes() {
  return quotes
    .filter((q) => q.videoId === state.videoId)
    .slice()
    .sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
}

function quotePairText(q) {
  const en = q.en || (!looksZh(q.text) ? q.text : "");
  const zh = q.zh || (looksZh(q.text) ? q.text : "");
  return { en, zh };
}

function renderQuoteTimeline(rows, { limit = 0 } = {}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return `<ol class="quote-tl">${shown
    .map((q) => {
      const { en, zh } = quotePairText(q);
      return `<li class="quote-tl-item">
        <button class="quote-tl-time" type="button" data-jump="${q.seconds || 0}">${clock(q.seconds)}</button>
        <button class="quote-tl-card" type="button" data-jump="${q.seconds || 0}">
          ${en ? `<p class="q-en">${esc(en)}</p>` : ""}
          ${zh ? `<p class="q-zh">${esc(zh)}</p>` : !en ? `<p class="q-en">${esc(q.text || "")}</p>` : ""}
          ${q.why ? `<p class="q-why">${esc(q.why)}</p>` : ""}
        </button>
      </li>`;
    })
    .join("")}</ol>`;
}

function quoteExtractLabel() {
  if (isExtractingQuotes) return "正在抽…";
  if (state.quoteError) return "再抽一次";
  if (state.quoteExtracted) return "再抽一版";
  return "抽出金句";
}

function renderQuoteRail() {
  const el = $("quoteRail");
  if (!el) return;
  if (!state.segments.length) {
    el.dataset.open = "0";
    el.innerHTML = "";
    syncReadBanners();
    return;
  }
  const rows = videoQuotes();
  const extractBtn = `<button class="text-btn" id="railRetry" type="button"${isExtractingQuotes ? " disabled" : ""}>${quoteExtractLabel()}</button>`;
  el.dataset.open = "1";
  if (isExtractingQuotes && !rows.length) {
    el.innerHTML = `<div class="quote-rail-kicker">正在按时间抽出这篇的金句…</div>`;
    syncReadBanners();
    return;
  }
  if (!rows.length) {
    if (!state.quoteError && !state.quoteExtracted) {
      el.dataset.open = "0";
      el.innerHTML = "";
      syncReadBanners();
      return;
    }
    el.innerHTML = state.quoteError
      ? `<div class="quote-rail-kicker">${esc(state.quoteError)}</div><div class="row-actions">${extractBtn}</div>`
      : `<div class="quote-rail-kicker">这篇没有单独成卡的原话。按 R 自己记。</div>`;
    $("railRetry")?.addEventListener("click", () => extractGoldQuotes({ force: true }));
    syncReadBanners();
    return;
  }
  const extra = rows.length > 8 ? `<button class="text-btn" id="railAllQuotes" type="button">金句页看全部 ${rows.length} 句</button>` : "";
  el.innerHTML =
    `<button class="quote-rail-toggle" type="button" id="railToggle">${rows.length} 句金句 · ${quoteRailOpen ? "收起" : "展开"}</button>` +
    (quoteRailOpen
      ? renderQuoteTimeline(rows, { limit: 8 }) +
        `<div class="row-actions">
      ${extractBtn}
      ${extra}
      <button class="text-btn" id="railCards" type="button">导出卡片</button>
    </div>`
      : "");
  $("railToggle")?.addEventListener("click", () => {
    quoteRailOpen = !quoteRailOpen;
    renderQuoteRail();
  });
  el.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => seek(Number(btn.dataset.jump)));
  });
  $("railRetry")?.addEventListener("click", () => extractGoldQuotes({ force: true }));
  $("railCards")?.addEventListener("click", openQuoteCards);
  $("railAllQuotes")?.addEventListener("click", () => {
    switchView("notes");
    notesFilter = "quotes";
    document.querySelectorAll("[data-notes]").forEach((b) => b.classList.toggle("active", b.dataset.notes === "quotes"));
    renderNotes();
  });
  syncReadBanners();
}

function quoteKey(q) {
  return String(q.en || q.zh || q.text || "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 80);
}

async function extractGoldQuotes({ quiet = false, force = false } = {}) {
  if (!state.segments.length) return;
  if (!force && state.quoteExtracted) return;
  if (extractingQuotesFor === state.videoId) return;
  const videoId = state.videoId;
  extractingQuotesFor = videoId;
  isExtractingQuotes = true;
  renderQuoteRail();
  if (notesFilter === "quotes") renderNotes();
  try {
    const result = await sendToBg({
      action: "vbGoldQuotes",
      segments: state.segments,
      title: state.title,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "抽金句失败");
    if (!(result.quotes || []).length) {
      state.quoteExtracted = true;
      state.quoteError = "";
      saveCache();
      renderQuoteRail();
      if (notesFilter === "quotes") renderNotes();
      return;
    }
    const seen = new Set(
      quotes.filter((q) => q.videoId === videoId && q.source !== "auto").map(quoteKey),
    );
    const next = quotes.filter((q) => !(q.videoId === videoId && q.source === "auto"));
    const fresh = [];
    for (const row of result.quotes || []) {
      const grounded = groundQuote(row.en || "", row.zh || "", row.at);
      const en = grounded.en;
      const zh = grounded.zh;
      const key = quoteKey({ en, zh });
      if (!key || seen.has(key)) continue;
      seen.add(key);
      fresh.push({
        id: uid("q"),
        videoId,
        videoTitle: state.title,
        text: (en || zh).slice(0, 400),
        en,
        zh,
        why: row.why || "",
        seconds: grounded.seconds,
        source: "auto",
        createdAt: Date.now(),
      });
    }
    quotes = [...fresh, ...next].slice(0, 400);
    state.quoteExtracted = true;
    state.quoteError = "";
    await saveList("vb_quotes", quotes);
    if (fresh.length) checkAchievementsSoon();
    saveCache();
    renderQuoteRail();
    paintGoldRows();
    renderMaps();
    if (notesFilter === "quotes") renderNotes();
  } catch (error) {
    if (state.videoId === videoId) {
      state.quoteError = friendlyAiError(error.message, "金句没抽出来，再试一次。");
      renderQuoteRail();
      if (!quiet) flashHint(friendlyAiError(error.message, "金句没抽出来，再试一次。"));
      if (!quiet || notesFilter === "quotes") renderNotes();
    }
  } finally {
    if (extractingQuotesFor === videoId) {
      extractingQuotesFor = "";
      isExtractingQuotes = false;
    }
    if (state.videoId === videoId) renderQuoteRail();
    if (notesFilter === "quotes" && state.videoId === videoId) renderNotes();
  }
}

let cardStudio = { kind: "quotes", index: 0, tpl: "poster" };
let studioTakeTimer = 0;
let studioBound = false;

function studioRows(kind = cardStudio.kind) {
  if (kind === "vocab") {
    return vocab.map((v, i) => {
      const src = preferredVocabSource(v);
      return {
        id: v.id || `v-${i}`,
        kind: "vocab",
        seconds: src?.seconds || v.seconds,
        kicker: state.title || "",
        en: v.word || "",
        zh: src?.sentence || v.sentence || "",
        take: vocabGlossOf(v),
        why: "",
        foot: src?.videoTitle || v.videoTitle || state.title || "",
      };
    });
  }
  if (kind === "notes") {
    return notes
      .filter((n) => !state.videoId || n.videoId === state.videoId)
      .map((n, i) => ({
        id: n.id || `n-${i}`,
        kind: "notes",
        seconds: n.seconds,
        kicker: state.title || "",
        en: n.text || "",
        zh: n.quote || "",
        take: "",
        why: "",
        foot: state.title || "",
      }));
  }
  return videoQuotes().map((q) => {
    const pair = quotePairText(q);
    return {
      id: q.id,
      kind: "quotes",
      seconds: q.seconds,
      kicker: state.title || "",
      en: pair.en || q.text || "",
      zh: pair.zh || "",
      take: q.take || "",
      why: q.why || "",
      foot: state.title || "",
    };
  });
}

function currentStudioRow() {
  return studioRows()[cardStudio.index] || null;
}

function fitStudioTake() {
  const el = $("cardStudioTake");
  if (!el || el.hidden) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(168, Math.max(56, el.scrollHeight))}px`;
}

function paintCardStudio() {
  const root = $("cardStudio");
  if (!root || root.hidden) return;
  const rows = studioRows();
  if (!rows.length) {
    closeCardStudio();
    return;
  }
  if (cardStudio.index >= rows.length) cardStudio.index = rows.length - 1;
  if (cardStudio.index < 0) cardStudio.index = 0;
  const row = rows[cardStudio.index];
  const kinds = [
    ["quotes", t("金句"), studioRows("quotes").length],
    ["vocab", t("生词"), studioRows("vocab").length],
    ["notes", t("笔记"), studioRows("notes").length],
  ];
  $("cardStudioKinds").innerHTML = kinds
    .filter(([, , n]) => n)
    .map(
      ([id, label, n]) =>
        `<button class="seg-btn${cardStudio.kind === id ? " active" : ""}" data-skind="${id}" type="button">${label} ${n}</button>`,
    )
    .join("");
  $("cardStudioTpls").innerHTML = KaizenCard.TEMPLATES.map(
    (tpl) =>
      `<button class="card-tpl${cardStudio.tpl === tpl.id ? " on" : ""}" data-stpl="${tpl.id}" type="button">${t(tpl.label)}</button>`,
  ).join("");
  $("cardStudioPos").textContent = `${cardStudio.index + 1} / ${rows.length}`;
  $("cardStudioMeta").textContent = `${KaizenCard.kindLabel(row.kind)} · ${clock(row.seconds)}`;
  const take = $("cardStudioTake");
  if (cardStudio.kind === "quotes") {
    const q = quotes.find((item) => item.id === row.id);
    take.hidden = false;
    take.value = q?.take || "";
    fitStudioTake();
  } else {
    take.hidden = true;
  }
  paintStudioPreview();
  $("cardStudioKinds").querySelectorAll("[data-skind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cardStudio.kind = btn.dataset.skind;
      cardStudio.index = 0;
      paintCardStudio();
    });
  });
  $("cardStudioTpls").querySelectorAll("[data-stpl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cardStudio.tpl = btn.dataset.stpl;
      saveSettings({ cardTpl: cardStudio.tpl });
      paintCardStudio();
    });
  });
}

function paintStudioPreview() {
  const row = currentStudioRow();
  if (!row) return;
  if (cardStudio.kind === "quotes") row.take = $("cardStudioTake")?.value || row.take;
  const built = KaizenCard.buildCardSvg(row, { title: state.title }, cardStudio.tpl);
  $("cardStudioPreview").innerHTML = built.svg;
  $("cardStudioHint").textContent = built.clipped
    ? t("这段特别长，字号已经缩小。还可再删一点。")
    : t("换样子、写下理解，都在这张上。高度跟着文字长。");
}

function bindCardStudio() {
  if (studioBound) return;
  studioBound = true;
  $("cardStudioClose")?.addEventListener("click", closeCardStudio);
  $("cardStudioPrev")?.addEventListener("click", () => {
    const n = studioRows().length;
    if (!n) return;
    cardStudio.index = (cardStudio.index + n - 1) % n;
    paintCardStudio();
  });
  $("cardStudioNext")?.addEventListener("click", () => {
    const n = studioRows().length;
    if (!n) return;
    cardStudio.index = (cardStudio.index + 1) % n;
    paintCardStudio();
  });
  $("cardStudioTake")?.addEventListener("input", () => {
    const row = currentStudioRow();
    if (!row || cardStudio.kind !== "quotes") return;
    const q = quotes.find((item) => item.id === row.id);
    if (!q) return;
    q.take = String($("cardStudioTake").value || "").slice(0, 800);
    fitStudioTake();
    clearTimeout(studioTakeTimer);
    studioTakeTimer = setTimeout(() => {
      saveList("vb_quotes", quotes);
      if (notesFilter === "quotes") renderNotes();
    }, 400);
    paintStudioPreview();
  });
  $("cardStudioSvg")?.addEventListener("click", () => {
    const row = currentStudioRow();
    if (!row) return;
    const { svg } = KaizenCard.buildCardSvg(row, { title: state.title }, cardStudio.tpl);
    KaizenCard.downloadCardFile(`${KaizenCard.cardFileStem(state.title, row, cardStudio.index, row.kind)}.svg`, svg, "image/svg+xml;charset=utf-8");
    flashHint(t("已下载这张海报"));
  });
  $("cardStudioPng")?.addEventListener("click", async () => {
    const row = currentStudioRow();
    if (!row) return;
    const { svg, w, h, bg } = KaizenCard.buildCardSvg(row, { title: state.title }, cardStudio.tpl);
    try {
      const blob = await KaizenCard.svgToPngBlob(svg, w, h, bg);
      KaizenCard.downloadCardFile(`${KaizenCard.cardFileStem(state.title, row, cardStudio.index, row.kind)}.png`, blob, "image/png");
      flashHint(t("已下载这张海报"));
    } catch (error) {
      flashHint(error.message || t("PNG 没做成"));
    }
  });
}

function openCardStudio({ kind = "quotes", id, quoteId, tpl } = {}) {
  bindCardStudio();
  const nextKind = kind === "vocab" || kind === "notes" ? kind : "quotes";
  const rows = studioRows(nextKind);
  if (!rows.length) {
    flashHint(
      nextKind === "vocab" ? t("先生词，再导出卡片。") : nextKind === "notes" ? t("先写一句笔记。") : t("先抽出金句，或按 R 记下几句。"),
    );
    return;
  }
  const cardId = id || quoteId || "";
  const hit = cardId ? rows.findIndex((row) => row.id === cardId) : 0;
  cardStudio = {
    kind: nextKind,
    index: hit >= 0 ? hit : 0,
    tpl: KaizenCard.isTpl(tpl || settingsCache.cardTpl) ? tpl || settingsCache.cardTpl : "poster",
  };
  $("cardStudio").hidden = false;
  paintCardStudio();
}

function closeCardStudio() {
  const root = $("cardStudio");
  if (root) root.hidden = true;
}

async function openExportCards({ kind = "quotes", id, quoteId, tpl } = {}) {
  openCardStudio({ kind, id, quoteId, tpl });
}

async function openQuoteCards({ quoteId, tpl } = {}) {
  return openExportCards({ kind: "quotes", id: quoteId, tpl });
}

let quoteTakeTimer = 0;

function bindQuoteTakes(root) {
  root.querySelectorAll("[data-take]").forEach((box) => {
    box.addEventListener("click", (event) => event.stopPropagation());
    box.addEventListener("input", () => {
      const q = quotes.find((item) => item.id === box.dataset.take);
      if (!q) return;
      q.take = String(box.value || "").slice(0, 800);
      clearTimeout(quoteTakeTimer);
      quoteTakeTimer = setTimeout(() => saveList("vb_quotes", quotes), 400);
    });
    box.addEventListener("blur", () => {
      clearTimeout(quoteTakeTimer);
      saveList("vb_quotes", quotes);
    });
  });
}

async function saveQuote(seconds, text, videoId = state.videoId, videoTitle = state.title) {
  const line = text || segmentAt(seconds)?.text || "";
  const vid = videoId || state.videoId;
  if (!line || !vid) return false;
  const chinese = looksZh(line);
  quotes.unshift({
    id: uid("q"),
    videoId: vid,
    videoTitle: videoTitle || state.title,
    text: line.slice(0, 400),
    en: chinese ? "" : line.slice(0, 280),
    zh: chinese ? line.slice(0, 280) : String(zhForLine(line) || "").slice(0, 280),
    seconds: Number(seconds) || 0,
    source: "hand",
    createdAt: Date.now(),
  });
  if (quotes.length > 400) quotes.length = 400;
  await saveList("vb_quotes", quotes);
  checkAchievementsSoon();
  renderNotes();
  return true;
}

let lastInboxId = 0;
let pendingHotkey = null;

function flushPendingHotkey() {
  if (!pendingHotkey) return;
  const queued = pendingHotkey;
  pendingHotkey = null;
  applyHotkey(queued);
}

async function applyHotkey(payload) {
  if (!payload?.action) return;
  if (payload.id && payload.id === lastInboxId) return;
  const needsVideo = payload.action === "quote" || payload.action === "note" || payload.action === "loop" || payload.action === "mark";
  if (needsVideo && !state.segments.length && !payload.videoId) {
    pendingHotkey = payload;
    return;
  }
  if (payload.action === "loop" && !state.segments.length) {
    pendingHotkey = payload;
    return;
  }
  lastInboxId = payload.id || Date.now();
  if (payload.id) chrome.storage.local.set({ vb_inbox_seen: payload.id });
  const seconds = Number(payload.seconds);
  const t = Number.isFinite(seconds) ? seconds : state.lastSeconds;
  const line = payload.caption || segmentAt(t)?.text || "";
  const idx = blockIndexAt(t);
  const vid = state.videoId || payload.videoId || "";
  const title = state.title || payload.title || "";
  if (payload.action === "unloop") {
    if (!isLooping()) return;
    const wasShadow = state.shadowing;
    clearAllLoops();
    refreshLoopChrome();
    flashHint(wasShadow ? t("已停跟读") : t("已停循环"));
    return;
  }
  if (payload.action === "quote") {
    const ok = await saveQuote(t, line, vid, title);
    flashHint(ok ? t("已记下这句话") : t("这一秒对不上字幕，没记上。"));
    renderQuoteRail();
    paintGoldRows();
    if (notesFilter === "quotes") renderNotes();
    return;
  }
  if (payload.action === "note") {
    const quote = line || `在 ${clock(t)}`;
    if (String(payload.text || "").trim()) {
      notes.unshift({
        id: uid("n"),
        videoId: vid,
        videoTitle: title,
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
  if (payload.action === "mark") {
    const stored = await chrome.storage.local.get("vb_marks");
    if (Array.isArray(stored.vb_marks)) marks = stored.vb_marks;
    const existing = nearestMark(t, 4, vid);
    if (existing) {
      afterMarkChange();
      if (Date.now() - (existing.createdAt || 0) < 4000) hintMarkDropped(existing);
      return;
    }
    await dropMark({ seconds: t, label: line, videoId: vid, videoTitle: title });
    return;
  }
  if (payload.action === "peek") {
    if (vid && state.videoId && vid !== state.videoId) return;
    followPlayback = true;
    followPausedByUser = false;
    followLockUntil = Date.now() + 600;
    switchView("read");
    seek(t);
    updateFollowBtn();
    return;
  }
  if (payload.action === "highlight") {
    const stored = await chrome.storage.local.get("vb_highlights");
    if (Array.isArray(stored.vb_highlights)) highlights = stored.vb_highlights;
    afterHighlightChange([segmentIndexAt(t)]);
    return;
  }
  if (payload.action === "define") {
    const word = String(payload.text || "").trim();
    if (!word) return;
    switchView("read");
    openWordCard(word, { sentence: line, seconds: t });
    return;
  }
  if (payload.action === "vocab") {
    const word = String(payload.text || "").trim();
    if (word) {
      await addVocab(word, line, t);
      openWordCard(word, { sentence: line, seconds: t });
    }
    return;
  }
  if (payload.action === "loop") {
    toggleReaderLoop(segmentIndexAt(t));
    flashHint(isLooping() ? t("正在循环。再按 A 或 Esc 停。") : t("已停循环"));
    return;
  }
  if (payload.action === "learned" && idx >= 0) {
    setProgress(idx, blockProgress(idx) === "done" ? "fresh" : "done");
    return;
  }
  if (payload.action === "ask") {
    state.askContext = { type: "quote", text: line || payload.text || "", seconds: t };
    renderAskContext();
    switchView("ask");
    $("askInput").focus();
  }
}

function renderNotes() {
  if (notesFilter === "vocab") notesFilter = "highlights";
  const root = $("notesBox");
  const cardBtn = (item) =>
    hasCardFor(item.id)
      ? `<button class="text-btn" data-goto-review="${item.id}" type="button">去复习</button>`
      : `<button class="text-btn" data-card="${item.id}" type="button">做成卡</button>`;
  if (notesFilter === "page") {
    const segs = state.segments || [];
    const marked = highlights.filter((h) => h.videoId === state.videoId).length;
    const kicker = `<p class="quote-rail-kicker">${
      segs.length
        ? `${segs.length} ${t("句")} · ${marked ? `${marked} ${t("处划线标在原文上")}` : t("划过的字会标在原文上。点时间跳到视频。")}`
        : ""
    }</p>`;
    root.innerHTML = segs.length
      ? `${kicker}<div class="notes-page">${segs
          .map((s, i) => {
            const zh = state.translations[i];
            return `<div class="notes-page-row">
              ${hlTimeButton({ seconds: s.start, idx: i, attr: "data-jump", cls: "t-time" })}
              <div>
                <p class="notes-page-en">${markLevelWords(decorateText(s.text))}</p>
                ${zh ? `<p class="notes-page-zh">${esc(zh)}</p>` : ""}
              </div>
            </div>`;
          })
          .join("")}</div>`
      : `<div class="chat-empty">${t("先打开一支视频。")}<br><button class="btn" data-go-read type="button">${t("去阅读")}</button></div>`;
  } else if (notesFilter === "highlights") {
    const rows = highlights.filter((h) => h.videoId === state.videoId);
    root.innerHTML = rows.length
      ? rows
          .map(
            (h) => `<div class="note-item"><div class="note-meta">${hlIconHtml(hlKindOf(h))} ${clock(h.seconds)} · ${t(HL_COLOR[h.color]?.label || "定义")} · ${t(HL_STYLE[hlStyleId(h.style)]?.label || "横线")}</div><q class="${hlClassOf(h)}">${esc(h.text)}</q>
          <div class="row-actions"><button class="text-btn" data-jump="${h.seconds}" type="button">跳转</button>
          ${cardBtn(h)}
          <button class="text-btn" data-delh="${h.id}" type="button">删除</button></div></div>`,
          )
          .join("")
      : `<div class="chat-empty">在阅读里选出几个字，选横线、波浪或框，再点定义、例子这些意思。<br><button class="btn" data-go-read type="button">去阅读划线</button></div>`;
  } else if (notesFilter === "quotes") {
    const rows = videoQuotes();
    const carded = rows.filter((q) => hasCardFor(q.id)).length;
    const tools = `<div class="quote-tools">
      <button class="btn" id="quoteExtract" type="button"${isExtractingQuotes ? " disabled" : ""}>${quoteExtractLabel()}</button>
      <button class="btn" id="quoteExportMd" type="button">${t("导出金句")}</button>
      <button class="btn" id="quoteExport" type="button">导出卡片</button>
      ${carded ? `<button class="btn" id="quoteToReview" type="button">这篇 ${carded} 张卡在复习</button>` : ""}
    </div>
    <p class="quote-rail-kicker">${isExtractingQuotes && !rows.length ? "正在按时间抽出金句…" : rows.length ? `${rows.length} 句 · 按时间排列` : ""}</p>`;
    const list = rows.length
      ? `<ol class="quote-tl">${rows
          .map((q) => {
            const { en, zh } = quotePairText(q);
            return `<li class="quote-tl-item">
          <button class="quote-tl-time" type="button" data-jump="${q.seconds || 0}">${clock(q.seconds)}</button>
          <article class="quote-tl-card">
            <div class="note-meta">${q.source === "auto" ? "抽出" : "记下"}</div>
            ${en ? `<p class="q-en">${esc(en)}</p>` : ""}
            ${zh ? `<p class="q-zh">${esc(zh)}</p>` : !en ? `<p class="q-en">${esc(q.text)}</p>` : ""}
            ${q.why ? `<p class="q-why">${esc(q.why)}</p>` : ""}
            <textarea class="quote-take" data-take="${q.id}" rows="2" placeholder="这句对你来说是什么意思…">${esc(q.take || "")}</textarea>
            <div class="row-actions"><button class="text-btn" data-jump="${q.seconds}" type="button">跳转</button>
            ${cardBtn(q)}
            <button class="text-btn" data-poster="${q.id}" type="button">导出海报</button>
            <button class="text-btn" data-delq="${q.id}" type="button">删除</button></div>
          </article>
        </li>`;
          })
          .join("")}</ol>`
      : `<div class="chat-empty">${
          state.quoteError ||
          (isExtractingQuotes ? "正在按时间抽出金句…" : state.quoteExtracted ? "这篇没有单独成卡的原话。按 R 自己记。" : "打开后会自动按时间抽金句，也可以按 R 记下这句。")
        }</div>`;
    root.innerHTML = tools + list;
  } else if (notesFilter === "memos") {
    const rows = notes.filter((n) => n.videoId === state.videoId);
    const tools = rows.length
      ? `<div class="quote-tools">
          <button class="btn" id="memoExportMd" type="button">${t("导出笔记")}</button>
          <button class="btn" id="memoExport" type="button">导出卡片</button>
        </div>`
      : "";
    root.innerHTML = rows.length
      ? tools +
        rows
          .map(
            (n) => `<div class="note-item"><div class="note-meta">${clock(n.seconds)}</div><q>${esc(n.quote)}</q><p>${esc(n.text)}</p>
          <div class="row-actions"><button class="text-btn" data-jump="${n.seconds}" type="button">跳转</button>
          <button class="text-btn" data-deln="${n.id}" type="button">删除</button></div></div>`,
          )
          .join("")
      : `<div class="chat-empty">选中一句点「笔记」，或看视频时按 N。<br><button class="btn" data-go-read type="button">去阅读写笔记</button></div>`;
  } else if (notesFilter === "pins") {
    const rows = videoMarks();
    root.innerHTML = rows.length
      ? rows
          .map(
            (m) => `<div class="note-item">
          <div class="note-meta">${clock(m.seconds)}</div>
          <p>${esc(m.label)}</p>
          ${m.note ? `<p class="mark-row-note">${esc(m.note)}</p>` : ""}
          <div class="row-actions">
            <button class="text-btn" data-jump="${m.seconds}" type="button">跳转</button>
            <button class="text-btn" data-mark-edit="${escAttr(m.id)}" type="button">${t("改一下")}</button>
            <button class="text-btn" data-delm="${escAttr(m.id)}" type="button">${t("去掉")}</button>
          </div>
        </div>`,
          )
          .join("")
      : `<div class="chat-empty">${t("还没有书签。点「夹在这里」或视频右下的 B，会钉在进度条上。事后可写一句。")}<br><button class="btn" data-go-read type="button">${t("去阅读")}</button></div>`;
  }
  $("quoteExtract")?.addEventListener("click", () => {
    state.quoteError = "";
    extractGoldQuotes({ force: true });
  });
  $("quoteExport")?.addEventListener("click", () => openExportCards({ kind: "quotes" }));
  $("quoteExportMd")?.addEventListener("click", exportQuotesMarkdown);
  $("memoExport")?.addEventListener("click", () => openExportCards({ kind: "notes" }));
  $("memoExportMd")?.addEventListener("click", exportNotesMarkdown);
  bindQuoteTakes(root);
  root.querySelectorAll("[data-poster]").forEach((btn) => {
    btn.addEventListener("click", () => openQuoteCards({ quoteId: btn.dataset.poster, tpl: "poster" }));
  });
  $("quoteToReview")?.addEventListener("click", () => goReview());
  root.querySelectorAll("[data-go-read]").forEach((btn) => {
    btn.addEventListener("click", () => switchView("read"));
  });
  root.querySelectorAll("[data-goto-review]").forEach((btn) => {
    btn.addEventListener("click", () => goReview(btn.dataset.gotoReview));
  });
  root.querySelectorAll("[data-jump]").forEach((btn) =>
    btn.addEventListener("click", () => peekSeek(Number(btn.dataset.jump), { kind: "notes" })),
  );
  root.querySelectorAll("[data-vgo]").forEach((btn) => {
    btn.addEventListener("click", () => jumpVocabHit(btn.dataset.vgo, Number(btn.dataset.sec), { source: "notes-vocab" }));
  });
  root.querySelectorAll("[data-vopen]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = vocab.find((v) => v.id === btn.dataset.vopen);
      if (item) jumpVocabEntry(item);
    });
  });
  root.querySelectorAll("[data-vsrc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = vocab.find((v) => v.id === btn.dataset.vsrc);
      const sec = Number(btn.dataset.sec);
      const src =
        vocabSources(item).find((s) => s.videoId === btn.dataset.vid && Math.abs((s.seconds || 0) - sec) < 0.6) ||
        vocabSources(item).find((s) => s.videoId === btn.dataset.vid);
      if (item && src) openVocabSource(item, src);
    });
  });
  root.querySelectorAll("[data-dropsrc]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      dropVocabSource(btn.dataset.dropsrc, btn.dataset.vid);
    });
  });
  root.querySelectorAll("[data-vnext]").forEach((btn) => {
    btn.addEventListener("click", () => jumpVocabNext(btn.dataset.vnext, Number(btn.dataset.sec), { source: "notes-vocab" }));
  });
  root.querySelectorAll(".vocab-item [data-vjump], .vocab-cand [data-vjump]").forEach((btn) => {
    const word = btn.closest(".vocab-item, .vocab-cand")?.querySelector(".vocab-word")?.textContent;
    btn.addEventListener("click", () => jumpVocabHit(word, Number(btn.dataset.vjump), { source: "notes-vocab" }));
  });
  root.querySelectorAll(".notes-page .vocab-hit, .notes-page .w-hit").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const row = el.closest(".notes-page-row");
      const sentence = row?.querySelector(".notes-page-en")?.textContent || "";
      const seconds = Number(row?.querySelector("[data-jump]")?.dataset.jump) || 0;
      openWordCard(el.dataset.vocab || el.dataset.word || "", { sentence, seconds });
    });
  });
  root.querySelectorAll("[data-def]").forEach((btn) => btn.addEventListener("click", () => openWordCard(btn.dataset.def)));
  root.querySelectorAll("[data-card]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const item =
        highlights.find((h) => h.id === btn.dataset.card) || quotes.find((q) => q.id === btn.dataset.card);
      if (item) await makeClozeCard(item, btn);
    }),
  );
  root.querySelectorAll(".notes-page mark[data-hid]").forEach((el) => {
    el.addEventListener("click", async (event) => {
      if (event.target.closest(".vocab-hit, .w-hit")) return;
      event.stopPropagation();
      await removeHighlight(el.dataset.hid);
    });
  });
  root.querySelectorAll("[data-delh]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await removeHighlight(btn.dataset.delh);
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
  root.querySelectorAll("[data-mark-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openMarkModal({ id: btn.dataset.markEdit }));
  });
  root.querySelectorAll("[data-delm]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await removeMark(btn.dataset.delm);
    });
  });
  root.querySelectorAll("[data-delv]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await removeVocabWord(btn.dataset.delv);
    }),
  );
}

// ---------- review cards ----------

const DAY = 24 * 60 * 60 * 1000;
const CARD_TYPE_LABEL = liveLabels({ cloze: "挖空", qa: "问题", vocab: "生词", brick: "增量", feynman: "费曼" });
let reviewRevealed = false;
let reviewMode = "due";
let reviewFocusId = "";

function hasCardFor(sourceId) {
  return cards.some((c) => c.sourceId === sourceId);
}

async function addCard(card) {
  const row = {
    id: uid("c"),
    interval: 0,
    reps: 0,
    due: Date.now(),
    createdAt: Date.now(),
    ...card,
  };
  cards.unshift(row);
  if (cards.length > 1000) cards.length = 1000;
  await saveList("vb_cards", cards);
  renderReviewBadge();
  pulseReviewTab();
  return row;
}

function dueCards(kind = "all") {
  const now = Date.now();
  return cards
    .filter((c) => {
      if (c.due > now) return false;
      if (kind === "vocab") return c.type === "vocab";
      if (kind === "other") return c.type !== "vocab";
      return true;
    })
    .sort((a, b) => {
      if (reviewFocusId && a.id === reviewFocusId) return -1;
      if (reviewFocusId && b.id === reviewFocusId) return 1;
      return a.due - b.due;
    });
}

function goReview(sourceId) {
  const card = sourceId
    ? cards.find((c) => c.sourceId === sourceId || c.id === sourceId)
    : null;
  if (card) reviewFocusId = card.id;
  if (!card && dueVocabCards().length) {
    openVocabTab("review");
    return;
  }
  if (card?.type === "vocab") {
    vocabPageMode = "review";
    vocabReviewRevealed = false;
    if (!$("setupGate")?.hidden) {
      flashHint(t("先填 DeepSeek Key 并保存，再来复习。"));
      return;
    }
    if ($("mainBox")?.hidden) {
      showReviewOnly();
      return;
    }
    switchView("vocab");
    renderVocabPage();
    return;
  }
  reviewMode = card && card.due > Date.now() ? "all" : "due";
  reviewRevealed = false;
  if (!$("setupGate")?.hidden) {
    flashHint(t("先填 DeepSeek Key 并保存，再来复习。"));
    return;
  }
  if ($("mainBox")?.hidden) {
    showReviewOnly();
    return;
  }
  switchView("review");
  renderReview();
}

function pulseReviewTab() {
  document.querySelectorAll("#reviewTopBtn, .view-tab[data-view='review']").forEach((el) => {
    el.classList.add("pulse");
    clearTimeout(el._pulse);
    el._pulse = setTimeout(() => el.classList.remove("pulse"), 2400);
  });
}

async function gradeCard(card, grade, opts = {}) {
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
  if (grade !== "again") checkAchievementsSoon();
  if (reviewFocusId === card.id) reviewFocusId = "";
  reviewRevealed = false;
  vocabReviewRevealed = false;
  renderReviewBadge();
  if (opts.silent) return;
  if (currentView() === "vocab") renderVocabPage();
  else renderReview();
}

function renderReviewBadge() {
  const vocabN = dueVocabCards().length;
  const otherN = dueOtherCards().length;
  const allN = vocabN + otherN;
  const paint = (id, n) => {
    const badge = $(id);
    if (!badge) return;
    badge.hidden = n === 0;
    const text = n > 99 ? "99+" : String(n);
    if (badge.textContent !== text) badge.textContent = text;
  };
  paint("vocabBadge", vocabN);
  paint("reviewBadge", otherN);
  paint("reviewTopBadge", allN);
}

function uncardedVocab() {
  return vocab.filter((v) => !hasCardFor(v.id));
}

function vocabCardFrom(v) {
  const word = String(v.word || "").trim();
  const sentence = String(preferredVocabSource(v)?.sentence || v.sentence || "");
  const ipa = v.definition?.phonetic || "";
  const zh = v.definition?.senses?.[0]?.zh || v.definition?.meaning || "";
  const usage = v.definition?.usage || v.definition?.examples?.[0]?.en || "";
  const back = [ipa, zh, usage].filter(Boolean).join(" · ") || t("还没查到释义，点开词卡再查");
  const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (sentence && pattern.test(sentence)) {
    return { front: sentence.replace(pattern, "____"), back, hint: zh };
  }
  return { front: `${word} 是什么意思？`, back, hint: sentence || "" };
}

async function makeVocabCards(list) {
  const pending = (Array.isArray(list) ? list : uncardedVocab()).filter((v) => !hasCardFor(v.id));
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
  flashHint(pending.length ? `已做成 ${pending.length} 张复习卡。点顶栏「复习」。` : "这些词都已经有卡了。");
  if (pending.length) pulseReviewTab();
}

async function makeClozeCard(item, btn) {
  if (hasCardFor(item.id)) {
    goReview(item.id);
    return;
  }
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
  const card = await addCard({
    type: "cloze",
    sourceId: item.id,
    videoId: item.videoId,
    videoTitle: item.videoTitle || state.title,
    seconds: item.seconds || 0,
    front: result.front,
    back: result.back,
    hint: result.hint || "",
  });
  reviewFocusId = card?.id || "";
  flashHint("已放进「复习」。点顶栏「复习」就能看到。");
  pulseReviewTab();
  renderReview();
  renderNotes();
}

async function saveQuestionsAsCards() {
  const qs = state.study?.questions || [];
  let added = 0;
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
    added += 1;
  }
  renderStudy();
  renderReview();
  flashHint(added ? `已做成 ${added} 张卡。去顶栏「复习」。` : "这些提问已经做成卡了。");
}

function cardFrontHtml(card) {
  return esc(card.front).replace(/____/g, `<span class="cloze-gap">____</span>`);
}

function cardDueLabel(card) {
  const now = Date.now();
  if (card.due <= now) return "现在到期";
  const days = Math.max(0.1, Math.round(((card.due - now) / DAY) * 10) / 10);
  return days >= 1 ? `${days} 天后到期` : "今天稍后到期";
}

function renderReviewTabs(dueCount, total) {
  return `<div class="notes-tabs">
    <button class="seg-btn${reviewMode === "due" ? " active" : ""}" data-review="due">到期${dueCount ? ` ${dueCount}` : ""}</button>
    <button class="seg-btn${reviewMode === "all" ? " active" : ""}" data-review="all">全部 ${total}</button>
  </div>
  <p class="map-help">${t("金句和划线做成的卡在这里。生词去「生词」背。")}</p>`;
}

function bindReviewTabs(root) {
  root.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      reviewMode = btn.dataset.review;
      reviewRevealed = false;
      renderReview();
    });
  });
}

function renderCardList(list) {
  if (!list.length) return `<div class="chat-empty">还没有做成的卡。</div>`;
  return list
    .map((c) => {
      const due = c.due <= Date.now();
      return `<div class="note-item${c.id === reviewFocusId ? " on" : ""}">
        <div class="note-meta">${CARD_TYPE_LABEL[c.type] || "卡"} · ${esc(c.videoTitle || "")} · ${cardDueLabel(c)}</div>
        <p>${cardFrontHtml(c)}</p>
        <div class="row-actions">
          ${due ? `<button class="text-btn" data-review-now="${c.id}" type="button">现在复习</button>` : ""}
          ${c.seconds != null && c.videoId ? `<button class="text-btn" data-review-jump="${c.id}" type="button">跳到出处</button>` : ""}
          ${quotes.some((q) => q.id === c.sourceId) ? `<button class="text-btn" data-review-poster="${c.sourceId}" type="button">导出海报</button>` : ""}
          <button class="text-btn" data-review-del="${c.id}" type="button">删除</button>
        </div>
      </div>`;
    })
    .join("");
}

function bindCardList(root) {
  root.querySelectorAll("[data-review-now]").forEach((btn) => {
    btn.addEventListener("click", () => {
      reviewFocusId = btn.dataset.reviewNow;
      reviewMode = "due";
      reviewRevealed = false;
      renderReview();
    });
  });
  root.querySelectorAll("[data-review-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = cards.find((c) => c.id === btn.dataset.reviewJump);
      if (!card) return;
      if (card.videoId === state.videoId) peekSeek(card.seconds, { kind: "review", label: "复习" });
      else openVideoAt(card.videoId, card.seconds);
    });
  });
  root.querySelectorAll("[data-review-poster]").forEach((btn) => {
    btn.addEventListener("click", () => openQuoteCards({ quoteId: btn.dataset.reviewPoster, tpl: "poster" }));
  });
  root.querySelectorAll("[data-review-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      cards = cards.filter((c) => c.id !== btn.dataset.reviewDel);
      await saveList("vb_cards", cards);
      renderReview();
    });
  });
}

function renderReview() {
  const root = $("reviewBox");
  if (!root) return;
  renderReviewBadge();
  const pool = cards.filter((c) => c.type !== "vocab");
  const due = dueOtherCards();
  const total = pool.length;
  const tabs = renderReviewTabs(due.length, total);

  if (reviewMode === "all") {
    const list = pool.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    root.innerHTML = tabs + (total ? renderCardList(list) : `<div class="chat-empty">${t("还没有复习卡。")}<br><br>${t("在「笔记」里给金句、划线点「做成卡」。生词在「生词」里背。")}</div>`);
    bindReviewTabs(root);
    bindCardList(root);
    return;
  }

  if (!total) {
    root.innerHTML = `${tabs}<div class="chat-empty">${t("还没有复习卡。")}<br><br>
      ${t("在「笔记」里给金句、划线点「做成卡」。生词本已经是牌组，去「生词」背。")}</div>`;
    bindReviewTabs(root);
    return;
  }

  if (!due.length) {
    const next = pool.slice().sort((a, b) => a.due - b.due)[0];
    const wait = next ? Math.max(0.1, Math.round(((next.due - Date.now()) / DAY) * 10) / 10) : 0;
    root.innerHTML = `${tabs}<div class="review-done">
      <div class="review-done-mark">✓</div>
      <p>${t("今天的卡复习完了。共 {n} 张，最近的一张约 {d} 天后到期。", { n: total, d: wait })}</p>
      <p>${t("做成的卡都在「全部」里。生词去「生词」。")}</p>
    </div>`;
    bindReviewTabs(root);
    return;
  }

  const card = due[0];
  const sameVideo = card.videoId && card.videoId === state.videoId;
  root.innerHTML = `${tabs}
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
    if (reviewFocusId === card.id) reviewFocusId = "";
    renderReview();
  });
  bindReviewTabs(root);
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
  if (isRecalling) return;
  if (!text) {
    flashHint("先凭记忆写几句再对照。");
    return;
  }
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
    $("recallResult").innerHTML = `<div class="dive-error">${esc(friendlyAiError(error.message, t("对照没做成，再试一次。")))}</div>`;
    $("recallResult").hidden = false;
  } finally {
    isRecalling = false;
    btn.disabled = false;
    btn.textContent = "对照字幕批改";
  }
}

// ---------- ask ----------

function compactAskLines(maxChars = 8000) {
  const lines = (state.segments || []).map((s) => `[${clock(s.start)}] ${s.text}`);
  const joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  const part = Math.floor(maxChars / 3);
  const midStart = Math.max(part, Math.floor((joined.length - part) / 2));
  return `${joined.slice(0, part)}\n…\n${joined.slice(midStart, midStart + part)}\n…\n${joined.slice(-part)}`;
}

function nearbyAskSegments(center, span = 90) {
  const t = Math.max(0, Number(center) || 0);
  return (state.segments || [])
    .filter((s) => s.start >= t - span && s.start <= t + span)
    .map((s) => ({ start: s.start, text: s.text }));
}

function buildAskPayload(question) {
  const ctx = state.askContext;
  let focus = null;
  if (ctx?.type === "quote") {
    focus = {
      type: "quote",
      text: ctx.text,
      start: Number(ctx.seconds) || state.lastSeconds || 0,
    };
  } else if (ctx?.type === "block" && state.blocks[ctx.idx]) {
    const block = state.blocks[ctx.idx];
    focus = {
      type: "block",
      title: block.title,
      summary: block.summary,
      start: block.start,
      end: block.end,
    };
  }
  const center = Number(focus?.start) || state.lastSeconds || 0;
  return {
    question,
    title: state.title,
    gist: state.gist,
    at: state.lastSeconds,
    focus,
    outline: (state.blocks || []).map((b) => ({
      start: b.start,
      end: b.end,
      title: b.title,
      summary: b.summary,
    })),
    quotes: videoQuotes()
      .slice(0, 8)
      .map((q) => ({ at: q.seconds, text: q.en || q.zh || q.text })),
    contextText: compactAskLines(8000),
    segments: nearbyAskSegments(center),
    history: state.chat
      .filter((m) => m?.content && !String(m.content).startsWith("⚠"))
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content })),
  };
}

function askStarters() {
  const ctx = state.askContext;
  if (ctx?.type === "quote") {
    return ["这句话什么意思？", "他用什么来支撑这句？", "和整支主张怎么接上？"];
  }
  if (ctx?.type === "block") {
    return ["这块到底在讲什么？", "这一段的例子是什么？", "最容易听岔的是哪？"];
  }
  const rows = ["他在主张什么？", "最关键的论证拐弯在哪？"];
  if (state.lastSeconds >= 12) rows.unshift("刚才这句什么意思？");
  return rows.slice(0, 3);
}

function bindAskStarters(root) {
  root?.querySelectorAll("[data-ask-q]").forEach((btn) => {
    btn.addEventListener("click", () => askVideo(btn.dataset.askQ));
  });
}

function renderAskContext() {
  const root = $("askContext");
  const ctx = state.askContext;
  if (!ctx) {
    root.textContent = state.lastSeconds
      ? `范围：整支视频 · 看到 ${clock(state.lastSeconds)}`
      : "范围：整支视频";
    return;
  }
  const label = ctx.type === "quote" ? ctx.text.slice(0, 50) : state.blocks[ctx.idx]?.title || "";
  root.innerHTML = `范围：<span class="ctx-chip">${esc(label)} <button class="ctx-clear" type="button">✕</button></span>`;
  root.querySelector(".ctx-clear").addEventListener("click", () => {
    state.askContext = null;
    renderAskContext();
    renderChat();
  });
}

function renderChat() {
  const box = $("chatBox");
  box.querySelectorAll(".msg, .ask-starters").forEach((el) => el.remove());
  $("chatEmpty").style.display = state.chat.length ? "none" : "block";
  if (!state.chat.length) {
    $("chatEmpty").innerHTML = `先问主张、某一句，或你正看到的地方。答案里的时间能点。
      <div class="ask-starters">${askStarters()
        .map((q) => `<button type="button" class="ghost-chip" data-ask-q="${esc(q)}">${esc(q)}</button>`)
        .join("")}</div>`;
    bindAskStarters($("chatEmpty"));
  }
  state.chat.forEach((msg) => {
    const el = document.createElement("div");
    el.className = `msg ${msg.role === "user" ? "user" : "ai"}`;
    const quote = msg.quote ? `<span class="msg-quote">${esc(msg.quote)}</span>` : "";
    el.innerHTML = `<div class="msg-bubble">${quote}${msg.role === "user" ? esc(msg.content) : linkifyTimes(msg.content)}</div>`;
    box.appendChild(el);
  });
}

async function askVideo(question) {
  if (!question.trim()) {
    flashHint("先写问题再发送。");
    return;
  }
  const videoId = state.videoId;
  const quote = state.askContext?.type === "quote" ? state.askContext.text : "";
  const payload = buildAskPayload(question.trim());
  state.chat.push({ role: "user", content: question.trim(), quote });
  checkAchievementsSoon("ask");
  renderChat();
  $("askSend").disabled = true;
  try {
    const result = await sendToBg({
      action: "vbAsk",
      ...payload,
    });
    if (state.videoId !== videoId) return;
    if (!result?.ok) throw new Error(result?.error || "回答失败");
    state.chat.push({ role: "assistant", content: result.answer });
    saveCache();
  } catch (error) {
    if (state.videoId === videoId) {
      state.chat.push({ role: "assistant", content: `⚠ ${friendlyAiError(error.message, "这题没答出来，再问一次。")}` });
    }
  } finally {
    $("askSend").disabled = false;
    renderChat();
  }
}

// ---------- poll ----------

async function pollTick() {
  if (!keysReady()) return;
  if (pollBusy) {
    pollTick._again = true;
    return;
  }
  pollBusy = true;
  try {
    await pollTickWork();
  } finally {
    pollBusy = false;
    if (pollTick._again) {
      pollTick._again = false;
      pollTick();
    }
  }
}

function isIdleState() {
  return Boolean($("stateBox") && !$("stateBox").hidden && $("stateOpen") && !$("stateOpen").hidden);
}

function canShowIdle() {
  if (reviewOnly || state.videoId || loadingVideoId) return false;
  if (transcriptFailId && Date.now() - transcriptFailAt < 12000) return false;
  if ($("stateRetry") && !$("stateRetry").hidden) return false;
  return Boolean($("setupGate")?.hidden);
}

async function showIdleWatchState(sub) {
  if (!canShowIdle()) return;
  if ($("mainBox") && !$("mainBox").hidden) return;
  if (isIdleState()) {
    if (sub && $("stateSub") && $("stateSub").textContent !== sub) $("stateSub").textContent = sub;
    paintStateTabs();
    return;
  }
  showStateBox("K", t("改善"), sub || t("打开一支有字幕的 YouTube 或 B 站，就开始。"), false, true);
}

async function pollTickWork() {
  if (!keysReady()) return;
  const tab = await findWatchTab();
  if (!tab) {
    if (canShowIdle()) await showIdleWatchState(t("打开一支有字幕的 YouTube 或 B 站，就开始。"));
    return;
  }
  const hrefId = tabVideoId(tab) || videoIdFromHref(tabHref(tab));
  const watchPage = isWatchHost(tabHref(tab));
  const ready = await ensureContentScript(tab.id);
  if (isLooping() && ready) applyLoopToPage();
  const info = ready ? (await sendToTab({ type: "VB_VIDEO_INFO" }, tab.id)) || {} : {};
  if (ready && Number(info.rate) > 0 && Math.abs(Number(info.rate) - playbackRate) > 0.04) {
    sendToTab({ type: "VB_RATE", rate: playbackRate }, tab.id);
  }
  if (info.unavailable) {
    takeIncomingWatch({
      videoId: hrefId || "",
      title: info.title || tab.title || "",
      tabId: tab.id,
      url: tab.url || tabHref(tab),
      unavailable: true,
      watchPage,
      activeWatch: Boolean(tab.active),
      source: "poll",
    });
    return;
  }
  const videoId =
    pickPollVideoId(hrefId, info) || (await withTimeout(probePageVideoId(tab.id), 800));
  if (!videoId) {
    if (watchPage && tab.active) {
      if (state.videoId && state.segments.length) return;
      takeIncomingWatch({
        title: info.title || tab.title || "",
        tabId: tab.id,
        url: tab.url || tabHref(tab),
        watchPage: true,
        activeWatch: true,
        source: "poll",
      });
      return;
    }
    if (canShowIdle()) await showIdleWatchState(t("这页还没认出正在播的视频。点一下播放，或把链接贴在下面。"));
    return;
  }
  takeIncomingWatch({
    videoId,
    title: info.title || tab.title || "",
    tabId: tab.id,
    url: tab.url || tabHref(tab),
    ad: Boolean(info.ad),
    watchPage,
    activeWatch: Boolean(tab.active),
    source: "poll",
  });
  if (videoId !== state.videoId) return;
  if (Number.isFinite(info.currentTime)) {
    applyPlayhead({ ...info, tabId: tab.id, videoId });
  }
}

// ---------- boot ----------

function recoverBoot(err) {
  try {
    console.error("[kaizen] boot failed", err);
  } catch (_e) {}
  try {
    bindCoreClicks();
    closeClickBlockers();
  } catch (_e) {}
  try {
    showStateBox(
      "",
      t("侧栏刚才没打开"),
      t("点重试。如果还不行，刷新视频页，再点右上角 Kaizen。"),
      true,
      false,
    );
    $("stateRetry")?.addEventListener("click", () => location.reload());
  } catch (_e) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
  bindCoreClicks();
  closeClickBlockers();
  await Promise.all([loadSettings(), loadLists(), loadWordPacks()]);
  syncLangButtons();
  checkAchievements({ silent: true }).catch(() => {});
  if (pendingWatchInfo) takeIncomingWatch(pendingWatchInfo);
  await syncVocabCards();
  if (settingsCache.kouling) koulingPull({ silent: true }).catch(() => {});
  applyDomI18n(document);
  paintThemeChrome();
  bindMarkRail();
  document.querySelectorAll("[data-lang-picker]").forEach((el) => fillLangPicker(el, currentLang()));
  document.addEventListener("click", (event) => {
    const el = eventEl(event);
    const opt = el?.closest("[data-lang-id]");
    if (opt) {
      event.preventDefault();
      changeUiLang(opt.dataset.langId);
      return;
    }
    const btn = el?.closest(".lang-pick-btn");
    if (btn) {
      event.preventDefault();
      const host = btn.closest(".lang-picker");
      const open = host?.dataset.open === "1";
      document.querySelectorAll(".lang-picker").forEach((el) => {
        el.dataset.open = "0";
        const menu = el.querySelector(".lang-pick-menu");
        if (menu) menu.hidden = true;
        el.querySelector(".lang-pick-btn")?.setAttribute("aria-expanded", "false");
      });
      if (host && !open) {
        host.dataset.open = "1";
        const menu = host.querySelector(".lang-pick-menu");
        if (menu) menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
      return;
    }
    document.querySelectorAll(".lang-picker").forEach((el) => {
      el.dataset.open = "0";
      const menu = el.querySelector(".lang-pick-menu");
      if (menu) menu.hidden = true;
      el.querySelector(".lang-pick-btn")?.setAttribute("aria-expanded", "false");
    });
  });
  paintModelSwitch();
  paintSetupModelPick();
  bindVocabBandUI("state", () => applyVocabPick("state"));
  bindVocabBandUI("pop", () => applyVocabPick("pop"));
  bindVocabTestBtn("setupVocabTest");
  bindVocabTestBtn("popVocabTest");
  paintVocabChrome();
  setTimeout(() => hydrateLib(), 3000);

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

  try {
    const inbox = await chrome.storage.local.get(["vb_inbox", "vb_inbox_q", "vb_inbox_seen"]);
    const queued = Array.isArray(inbox.vb_inbox_q) && inbox.vb_inbox_q.length
      ? inbox.vb_inbox_q
      : inbox.vb_inbox ? [inbox.vb_inbox] : [];
    for (const item of queued) {
      if (item?.id && item.id === inbox.vb_inbox_seen && queued.length === 1) continue;
      const age = Date.now() - Number(item?.id || 0);
      if (age > 10000 && item?.action === "note") continue;
      try {
        await applyHotkey(item);
      } catch (_e) {}
    }
    if (queued.length) {
      await chrome.storage.local.set({
        vb_inbox_q: [],
        vb_inbox_seen: queued[queued.length - 1]?.id || inbox.vb_inbox_seen,
      });
    }
  } catch (_e) {}

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.vb_inbox?.newValue) {
      applyHotkey(changes.vb_inbox.newValue);
    }
    if (area === "local" && changes.vb_settings?.newValue) {
      const incoming = changes.vb_settings.newValue;
      settingsCache = { ...settingsCache, ...incoming };
      if ($("setLiveCc") && typeof incoming.liveCc === "boolean" && document.activeElement !== $("setLiveCc")) {
        $("setLiveCc").checked = incoming.liveCc;
      }
      paintLiveStyleSettings();
      const nextMode = incoming.transcriptMode;
      if (
        nextMode &&
        nextMode !== state.transcriptMode &&
        (nextMode === "original" || nextMode === "zh" || nextMode === "bilingual")
      ) {
        state.transcriptMode = nextMode;
        renderTranscript({ force: true });
        syncLangButtons();
        if (nextMode !== "original") translateAll();
      }
    }
    if (area === "local" && Array.isArray(changes.vb_highlights?.newValue)) {
      highlights = changes.vb_highlights.newValue;
      afterHighlightChange();
    }
    const cacheKey = state.videoId ? `vb_cache_${state.videoId}` : "";
    const incomingZh = cacheKey && changes[cacheKey]?.newValue?.translations;
    if (area === "local" && incomingZh && state.segments.length) {
      let added = false;
      Object.entries(incomingZh).forEach(([k, v]) => {
        const i = Number(k);
        if (!Number.isInteger(i) || translationAt(i)) return;
        const zh = cleanZh(v);
        if (!isRealTranslation(zh, state.segments[i]?.text)) return;
        state.translations[i] = zh;
        added = true;
        patchRowTranslation(i);
      });
      if (added) renderTranslateBar();
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === "vbHotkey") applyHotkey(message.hotkey || message);
  });
  document.addEventListener("keydown", async (event) => {
    if (event.repeat) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyR") {
      event.preventDefault();
      sendToBg({ action: "vbReload" });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === "KeyZ") {
      const tag = event.target?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable;
      if (!typing && flashHint._undo) {
        event.preventDefault();
        await runFlashUndo();
        return;
      }
    }
    const tag = event.target?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable;
    if (event.code === "Escape") {
      if ($("cardStudio") && !$("cardStudio").hidden) {
        closeCardStudio();
        event.preventDefault();
        return;
      }
      if ($("markModal") && !$("markModal").hidden) {
        closeMarkModal();
        event.preventDefault();
        return;
      }
      if ($("noteModal") && !$("noteModal").hidden) {
        $("noteModal").hidden = true;
        event.preventDefault();
        return;
      }
      if ($("vocabTestModal") && !$("vocabTestModal").hidden) {
        closeVocabTest();
        event.preventDefault();
        return;
      }
      if ($("recallModal") && !$("recallModal").hidden) {
        $("recallModal").hidden = true;
        event.preventDefault();
        return;
      }
      if (isSettingsOpen()) {
        closeSettings();
        event.preventDefault();
        return;
      }
      if ($("vocabLevelPop") && !$("vocabLevelPop").hidden) {
        setVocabPop(false);
        event.preventDefault();
        return;
      }
      if (jumpTrail) {
        event.preventDefault();
        returnFromJump();
        return;
      }
      if (!typing && isLooping()) {
        event.preventDefault();
        clearAllLoops();
        refreshLoopChrome();
        flashHint("已停循环");
        return;
      }
      if (!typing && jumpTrail) {
        event.preventDefault();
        returnFromJump();
      }
      return;
    }
    if (!typing && event.code === "Backspace" && jumpTrail) {
      event.preventDefault();
      returnFromJump();
      return;
    }
    if (typing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code === "KeyH") {
      event.preventDefault();
      flashHint(t("视频右下 K / R / A / N / B。书签在进度条上。"));
      return;
    }
    const map = { KeyR: "quote", KeyA: "loop", KeyN: "note", KeyB: "mark" };
    const action = map[event.code];
    if (!action) return;
    event.preventDefault();
    const info = (await sendToTab({ type: "VB_VIDEO_INFO" })) || {};
    const seconds = Number.isFinite(info.currentTime) ? info.currentTime : state.lastSeconds;
    applyHotkey({
      action,
      seconds,
      caption: segmentAt(seconds)?.text || "",
      id: Date.now(),
    });
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
      uiLang: currentLang(),
      ...readVocabSettings("setup"),
    });
    if (!keysReady()) {
      $("setupLead").textContent = t("先填 DeepSeek Key。字幕优先用视频自己的。");
      return;
    }
    showSetup(false);
    paintVocabChrome();
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
  $("reviewTopBtn")?.addEventListener("click", () => goReview());
  $("achieveTopBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = $("achievePop");
    setAchievePop(Boolean(pop?.hidden));
  });
  $("exportTopBtn")?.addEventListener("click", openExport);
  $("exportBtn")?.addEventListener("click", openExport);

  $("themeBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    $("moreMenu") && ($("moreMenu").hidden = true);
    if (isSettingsOpen()) closeSettings();
    setVocabPop(false);
    setAchievePop(false);
    const pop = $("themePop");
    const willOpen = Boolean(pop?.hidden);
    if (willOpen) paintThemeChrome();
    if (pop) pop.hidden = !willOpen;
  });
  $("moreBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = $("moreMenu");
    menu.hidden = !menu.hidden;
    $("moreBtn").setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) {
      if (isSettingsOpen()) closeSettings();
      setVocabPop(false);
      setAchievePop(false);
      if ($("themePop")) $("themePop").hidden = true;
    }
  });
  $("vocabLevelBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const pop = $("vocabLevelPop");
    setVocabPop(Boolean(pop?.hidden));
    setAchievePop(false);
    if ($("themePop")) $("themePop").hidden = true;
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#moreMenu") || event.target.closest?.("#moreBtn")) return;
    if ($("moreMenu")) $("moreMenu").hidden = true;
    if (event.target.closest?.("#themePop") || event.target.closest?.("#themeBtn")) return;
    if ($("themePop")) $("themePop").hidden = true;
    if (event.target.closest?.("#vocabLevelPop") || event.target.closest?.("#vocabLevelBtn")) return;
    setVocabPop(false);
    if (event.target.closest?.("#achievePop") || event.target.closest?.("#achieveTopBtn")) return;
    setAchievePop(false);
  });

  $("settingsTopBtn")?.addEventListener("click", () => toggleSettings());
  $("settingsBtn").addEventListener("click", () => toggleSettings());
  $("authorBtn")?.addEventListener("click", () => openAuthorCard());
  $("feedbackBtn")?.addEventListener("click", () => openAuthorCard(true));
  document.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-copy-wechat]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    copyWechat(btn);
  });

  $("stateReview")?.addEventListener("click", showReviewOnly);
  $("focusBtn")?.addEventListener("click", () => setFocusMode(!focusMode));
  $("focusExit")?.addEventListener("click", () => setFocusMode(false));
  $("focusLang")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tm]");
    if (btn) setTranscriptMode(btn.dataset.tm);
  });
  $("typeSmaller")?.addEventListener("click", async () => {
    if (typeSize <= 14) {
      flashHint("已经最小。");
      return;
    }
    typeSize = Math.max(14, typeSize - 1);
    applyTypeSize();
    await saveSettings({ readSize: typeSize });
  });
  $("typeBigger")?.addEventListener("click", async () => {
    if (typeSize >= 22) {
      flashHint("已经最大。");
      return;
    }
    typeSize = Math.min(22, typeSize + 1);
    applyTypeSize();
    await saveSettings({ readSize: typeSize });
  });

  $("stateRetry").addEventListener("click", () => {
    const id = transcriptFailId || loadingVideoId || state.videoId;
    loadingVideoId = null;
    transcriptFailId = "";
    transcriptFailAt = 0;
    if (id) loadVideo(id, "", { force: true });
    else {
      watchTabCache = { at: 0, tab: null };
      pollTick();
    }
  });
  $("statePasteGo")?.addEventListener("click", openPastedWatch);
  $("statePaste")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openPastedWatch();
    }
  });
  $("stateFindAgain")?.addEventListener("click", () => {
    watchTabCache = { at: 0, tab: null };
    pollTick();
  });
  $("stateTabList")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".state-tab");
    if (!btn) return;
    adoptWatchTab(btn.dataset.tabId, btn.dataset.videoId, btn.querySelector("b")?.textContent || "");
  });

  bindCoreClicks();
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
      syncMapTabs();
      if (mapKind === "atlas") ensureAtlasReady();
      renderMaps();
    });
  });
  syncMapTabs();
  document.querySelectorAll("[data-smode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      shelfMode = btn.dataset.smode;
      document.querySelectorAll("[data-smode]").forEach((b) => b.classList.toggle("active", b === btn));
      renderShelf();
    });
  });
  document.querySelectorAll("[data-shelf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      shelfFilter = btn.dataset.shelf;
      document.querySelectorAll("[data-shelf]").forEach((b) => b.classList.toggle("active", b === btn));
      renderShelf();
    });
  });
  $("shelfSearch")?.addEventListener("input", (event) => {
    shelfQuery = event.target.value || "";
    renderShelf();
  });
  $("loopLineBtn")?.addEventListener("click", () => {
    toggleReaderLoop(segmentIndexAt(state.lastSeconds));
  });
  $("shadowBtn")?.addEventListener("click", () => {
    toggleShadowRead(segmentIndexAt(state.lastSeconds));
  });
  $("rateSelect")?.addEventListener("change", () => {
    applyPlayRate($("rateSelect").value);
  });
  $("followBtn")?.addEventListener("click", () => {
    followPlayback = !followPlayback;
    followPausedByUser = false;
    if (followPlayback) {
      lastUserScrollAt = 0;
      lastFollowedStart = -1;
      lastFollowedRow = null;
      const row = rowAtSeconds(state.lastSeconds);
      if (row) centerRowInView(row, { smooth: true });
    }
    updateFollowBtn();
  });
  $("jumpForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const seconds = parseJumpInput($("jumpInput").value);
    if (seconds == null) {
      flashHint("时间写成 1:30:00、12:30 或秒数。");
      return;
    }
    seek(seconds);
  });
  $("transcriptBox")?.addEventListener("wheel", pauseFollowFromUser, { passive: true });
  $("transcriptBox")?.addEventListener("touchmove", pauseFollowFromUser, { passive: true });
  updateFollowBtn();

  $("modeOriginal").addEventListener("click", () => setTranscriptMode("original"));
  $("modeBilingual").addEventListener("click", () => setTranscriptMode("bilingual"));
  $("modeZh").addEventListener("click", () => setTranscriptMode("zh"));
  $("copyTranscriptBtn")?.addEventListener("click", () => copyAllTranscript());
  $("readerSearch").addEventListener("input", () => {
    clearTimeout($("readerSearch")._t);
    $("readerSearch")._t = setTimeout(runReaderSearch, 200);
  });
  $("levelScanBtn")?.addEventListener("click", () => {
    if (resolveVocabLevel().id === "off") {
      setVocabPop(true);
      return;
    }
    if (!state.vocabPreviewDone) {
      $("vocabPreview")?.scrollIntoView({ block: "nearest" });
      if (!state.levelScan?.scanned) scanVideoVocab();
      return;
    }
    openVocabTab("deck");
    if (!state.levelScan?.scanned) scanVideoVocab();
  });

  document.querySelectorAll("[data-notes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      notesFilter = btn.dataset.notes;
      document.querySelectorAll("[data-notes]").forEach((b) => b.classList.toggle("active", b === btn));
      renderNotes();
      if (notesFilter === "quotes" && !state.quoteExtracted && state.segments.length) {
        extractGoldQuotes({ quiet: true });
      }
    });
  });

  $("transcriptBox")?.addEventListener("mousedown", () => {
    selectingUntil = Date.now() + 8000;
  });
  document.addEventListener(
    "mousedown",
    (event) => {
      const el = eventEl(event);
      if (el?.closest("#selBar, #transcriptBox")) return;
      const bar = $("selBar");
      if (bar) bar.hidden = true;
    },
    true,
  );
  document.addEventListener("mouseup", (event) => {
    setTimeout(() => {
      const el = eventEl(event);
      if (el?.closest("#selBar")) return;
      if (!el?.closest("#transcriptBox")) return;
      placeSelBar();
    }, 0);
  });
  document.addEventListener(
    "scroll",
    () => {
      if (programmaticScroll || Date.now() < selectingUntil) return;
      const bar = $("selBar");
      if (bar) bar.hidden = true;
    },
    true,
  );
  $("selBar").addEventListener("mousedown", (e) => e.preventDefault());
  $("selBar").addEventListener("click", async (event) => {
    const btn = eventEl(event)?.closest("[data-act]");
    const act = btn?.dataset.act;
    if (!act) return;
    if (!selPayload) selPayload = captureSelection();
    if (act === "pin") {
      await dropMark({
        seconds: selPayload?.seconds ?? state.lastSeconds,
        label: selPayload?.text || "",
      });
    } else if (act === "hl-style") {
      void saveSettings({ hlStyle: hlStyleId(btn.dataset.style) });
      paintSelBarChrome();
      return;
    } else if (act === "mark") {
      await addHighlight(btn.dataset.color || lastHlColor(), lastHlStyle());
    } else if (act === "unmark") {
      const hits = highlightsOnPayload(selPayload);
      if (!hits.length) flashHint(t("这段还没有划线。"));
      else await removeHighlights(hits.map((h) => h.id));
    } else if (act === "unvocab") {
      const phrase = phraseFromSelection(selPayload) || selPayload?.text || "";
      const saved = vocabByWord(phrase);
      if (!saved) flashHint(t("这个词不在生词本里。"));
      else await removeVocabWord(saved.id);
    } else if (!selPayload) {
      flashHint("先在字幕里选出几个字。");
      return;
    } else if (act === "loop") {
      const span = spanFromPayload(selPayload);
      if (!span) {
        flashHint(t("先选出要循环的几句。"));
      } else if (sameLoopSpan(state.loopSpan, span) && !state.shadowing) {
        clearAllLoops();
        flashHint(t("已停循环"));
      } else {
        const ok = await startSpanLoop(span);
        if (!ok) {
          refreshLoopChrome();
          flashHint(t("视频页没接上。点一下视频再试。"));
          return;
        }
        flashHint(t("正在循环这段。再点一次或按 Esc 停。"));
      }
      refreshLoopChrome();
    } else if (act === "note") {
      openNoteModal();
    } else if (act === "define") {
      const phrase = phraseFromSelection(selPayload);
      if (!phrase) {
        flashHint(t("先选出要查的词或词组。"));
      } else {
        openWordCard(phrase, selPayload);
      }
    } else if (act === "vocab") {
      await addVocab(phraseFromSelection(selPayload) || selPayload.text, selPayload.sentence, selPayload.seconds);
    } else if (act === "shadow") {
      await toggleShadowRead(selPayload.idx ?? segmentIndexAt(selPayload.seconds));
    } else if (act === "ask") {
      const phrase = phraseFromSelection(selPayload);
      const text = String(selPayload.text || "").trim();
      state.askContext = { type: "quote", text, seconds: selPayload.seconds };
      renderAskContext();
      switchView("ask");
      if (phrase && text.split(/\s+/).length <= 10) {
        $("askInput").value = `「${phrase}」在这里是什么意思？`;
      }
      $("askInput").focus();
    }
    $("selBar").hidden = true;
    window.getSelection()?.removeAllRanges();
  });

  const dismissOverlay = (id, close) => {
    $(id)?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
  };
  dismissOverlay("noteModal", () => { $("noteModal").hidden = true; });
  dismissOverlay("markModal", closeMarkModal);
  dismissOverlay("vocabTestModal", closeVocabTest);
  dismissOverlay("recallModal", () => { $("recallModal").hidden = true; });
  dismissOverlay("cardStudio", closeCardStudio);

  $("noteCancel").addEventListener("click", () => {
    $("noteModal").hidden = true;
  });
  $("noteSave").addEventListener("click", saveNote);
  $("markModalCancel")?.addEventListener("click", closeMarkModal);
  $("markModalSave")?.addEventListener("click", saveMarkModal);
  $("markModalTitle")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveMarkModal();
    }
  });

  $("recallCancel").addEventListener("click", () => {
    $("recallModal").hidden = true;
  });
  $("recallSubmit").addEventListener("click", submitRecall);
  renderReviewBadge();
  setInterval(renderReviewBadge, 60 * 1000);

  $("askForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const q = $("askInput").value;
    if (!String(q).trim()) {
      flashHint("先写问题再发送。");
      return;
    }
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
    const el = eventEl(event);
    const link = el?.closest?.(".time-link");
    if (link) seek(Number(link.dataset.s));
    const hit = el?.closest?.(".vocab-hit, .w-hit");
    if (hit) {
      if (selectedText()) return;
      event.preventDefault();
      event.stopPropagation();
      openWordFromEl(hit, hit.closest(".t-row"));
    }
  });

  addEventListener("beforeunload", () => saveCache());
  adoptActiveWatchNow();
  readRememberedWatch().then((snap) => {
    if (!snap) return;
    takeIncomingWatch({
      videoId: snap.videoId,
      title: snap.title,
      tabId: snap.tabId,
      url: snap.url,
      source: "storage",
    });
  });
  pollTick();
  setInterval(pollTick, 1500);
  let watchWakeAt = 0;
  const wakeWatchPoll = () => {
    watchTabCache = { at: 0, tab: null };
    const now = Date.now();
    if (now - watchWakeAt < 400) return;
    watchWakeAt = now;
    adoptActiveWatchNow();
    pollTick();
  };
  try {
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      try {
        const tab = await chrome.tabs.get(tabId);
        takeIncomingWatch({
          videoId: videoIdFromHref(tabHref(tab)),
          title: tab.title || "",
          tabId,
          url: tabHref(tab),
          activeWatch: Boolean(tab.active),
          source: "tab",
        });
      } catch (_e) {}
      wakeWatchPoll();
    });
    chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
      if (!(info.url || info.status === "complete")) return;
      const href = tabHref(tab);
      const activeWatch = Boolean(tab?.active && typeof isWatchHost === "function" && isWatchHost(href));
      if (state.tabId && tabId !== state.tabId && !activeWatch) return;
      takeIncomingWatch({
        videoId: videoIdFromHref(href),
        title: tab?.title || "",
        tabId,
        url: href,
        activeWatch,
        source: "tab",
      });
      wakeWatchPoll();
    });
  } catch (_e) {}
  const bindFollowPort = () => {
    try {
      const port = chrome.runtime.connect({ name: "kaizen-follow" });
      port.onMessage.addListener((msg) => {
        if (msg?.action === "vbTick") {
          applyPlayhead(msg);
        }
      });
      port.onDisconnect.addListener(() => setTimeout(bindFollowPort, 500));
    } catch (_e) {}
  };
  bindFollowPort();
  setInterval(followTick, 480);
  } catch (err) {
    recoverBoot(err);
  }
});
