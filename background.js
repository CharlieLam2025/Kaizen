// VideoBricks service worker — owns every AI call.
// The panel sends transcripts/questions here; prompts live inline below.
importScripts("site.js", "i18n.js", "i18n-dict.js");

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

function isRestrictedTab(tab) {
  const url = String(tab?.url || tab?.pendingUrl || "");
  return !url || /^(chrome|edge|about|devtools|chrome-extension):/i.test(url);
}

async function openSidePanelSafe(tab) {
  const tryOpen = async (opts) => {
    try {
      await chrome.sidePanel.open(opts);
      return true;
    } catch (_e) {
      return false;
    }
  };
  if (tab?.id && !isRestrictedTab(tab) && (await tryOpen({ tabId: tab.id }))) return true;
  if (tab?.windowId != null && (await tryOpen({ windowId: tab.windowId }))) return true;
  const watch = (await chrome.tabs.query({ url: RELOAD_TAB_MATCH }).catch(() => [])) || [];
  watch.sort(sortWatchTabs);
  for (const hit of watch) {
    if (hit?.id && (await tryOpen({ tabId: hit.id }))) return true;
  }
  const wins = await chrome.windows.getLastFocused({ populate: false }).catch(() => null);
  if (wins?.id != null) return tryOpen({ windowId: wins.id });
  return false;
}

function openKaizenFromToolbar(tab) {
  openSidePanelSafe(tab).catch(() => {});
  const url = tabHref(tab);
  const videoId = videoIdFromHref(url) || "";
  const snap = {
    id: tab?.id || 0,
    tabId: tab?.id || 0,
    url,
    title: tab?.title || "",
    videoId,
    at: Date.now(),
    active: Boolean(tab?.active),
    lastAccessed: Date.now(),
  };
  if (videoId || isWatchHost(url)) {
    chrome.storage.local.set({ vb_watch: snap, vb_click: snap }).catch(() => {});
    if (tab?.id) rememberWatch(tab, videoId);
  }
}

chrome.action.onClicked.addListener((tab) => {
  openKaizenFromToolbar(tab);
});

const RELOAD_TAB_MATCH = [
  "*://*.youtube.com/*",
  "*://youtube.com/*",
  "*://youtu.be/*",
  "*://*.bilibili.com/*",
];

function rememberWatch(tab, videoId) {
  if (!tab?.id || !tab.active) return;
  const url = tabHref(tab);
  if (!isWatchHost(url)) return;
  const snap = {
    id: tab.id,
    tabId: tab.id,
    url,
    title: tab.title || "",
    active: Boolean(tab.active),
    lastAccessed: tab.lastAccessed || Date.now(),
    videoId: videoId || videoIdFromHref(url) || "",
    at: Date.now(),
  };
  chrome.storage.local.get("vb_watch", (stored) => {
    if (!shouldWriteWatch(stored.vb_watch, snap)) return;
    chrome.storage.local.set({ vb_watch: snap });
  });
}

async function handleFindWatch() {
  const tabs = await chrome.tabs.query({});
  return {
    tabs: (tabs || [])
      .filter((tab) => isWatchHost(tabHref(tab)))
      .map(summarizeWatchTab)
      .sort(sortWatchTabs),
  };
}

async function adoptOpenWatchTabs() {
  try {
    const stored = await chrome.storage.local.get("vb_watch");
    const prev = stored.vb_watch;
    const tabs = await chrome.tabs.query({});
    const hits = (tabs || [])
      .filter((tab) => isWatchHost(tabHref(tab)))
      .map(summarizeWatchTab)
      .sort(sortWatchTabs);
    for (const hit of hits) {
      chrome.tabs
        .sendMessage(hit.id, { type: "VB_VIDEO_INFO" })
        .catch(() => injectContentScripts(hit.id).catch(() => {}));
    }
    if (!hits[0] || !shouldAdoptOpenWatch(prev)) return;
    const snap = { ...hits[0], tabId: hits[0].id, at: Date.now() };
    if (!shouldWriteWatch(prev, snap)) return;
    chrome.storage.local.set({ vb_watch: snap });
  } catch (_e) {}
}
const CONTENT_SCRIPT_FILES = ["i18n.js", "i18n-dict.js", "site.js", "content.js"];

async function injectContentScripts(tabId) {
  if (!tabId) return false;
  let hasCore = false;
  try {
    const [shot] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(globalThis.__KAIZEN_CS__?.i18n && globalThis.__KAIZEN_CS__?.site),
    });
    hasCore = Boolean(shot?.result);
  } catch (_e) {}
  const files = hasCore ? ["content.js"] : CONTENT_SCRIPT_FILES;
  await chrome.scripting.executeScript({ target: { tabId }, files });
  return true;
}

async function recoverWatchPages() {
  const stored = await chrome.storage.local.get(["vb_reload_tabs", "vb_reopen"]);
  const reopen = stored.vb_reopen;
  await chrome.storage.local.remove(["vb_reload_tabs", "vb_reopen"]);
  const tabs = (await chrome.tabs.query({ url: RELOAD_TAB_MATCH }).catch(() => [])) || [];
  const ids = new Set([...(stored.vb_reload_tabs || []), ...tabs.map((tab) => tab.id)]);
  for (const id of ids) {
    if (id) injectContentScripts(id).catch(() => {});
  }
  if (reopen && Date.now() - Number(reopen.at || 0) < 20000) {
    const tab = reopen.tabId ? await chrome.tabs.get(reopen.tabId).catch(() => null) : null;
    await openSidePanelSafe(tab || { id: reopen.tabId, windowId: reopen.windowId });
  }
}

recoverWatchPages();
adoptOpenWatchTabs();

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    rememberWatch(tab);
  } catch (_e) {}
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!isWatchHost(tabHref(tab))) return;
  if (info.url || info.status === "complete") rememberWatch(tab);
  if (info.status === "complete") injectContentScripts(tabId).catch(() => {});
});

async function reloadKaizen() {
  const tabs = await chrome.tabs.query({ url: RELOAD_TAB_MATCH });
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const watch = (tabs || []).slice().sort(sortWatchTabs)[0];
  await chrome.storage.local.set({
    vb_reload_tabs: (tabs || []).map((tab) => tab.id).filter(Boolean),
    vb_reopen: {
      tabId: watch?.id || (!isRestrictedTab(active) && active?.id) || 0,
      windowId: watch?.windowId || active?.windowId || 0,
      at: Date.now(),
    },
  });
  chrome.runtime.reload();
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "reload-kaizen") reloadKaizen();
});

const followPorts = new Set();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "kaizen-follow") return;
  followPorts.add(port);
  port.onDisconnect.addListener(() => followPorts.delete(port));
});

const DEFAULT_SETTINGS = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  diveModel: "deepseek-v4-pro",
  supadataKey: "",
  koulingUrl: "",
  transcriptMode: "bilingual",
};

async function handleKouling(message) {
  const settings = await getSettings();
  const base = String(settings.koulingUrl || "").replace(/\/$/, "");
  if (!base) {
    const err = new Error("还没有填 Kaizen 口令的同步地址");
    err.code = "NO_KOULING_URL";
    throw err;
  }
  const op = message.op;
  let path = "";
  let method = "GET";
  let body = null;
  if (op === "create") {
    path = "/v1/groups";
    method = "POST";
    body = { task: message.task || "" };
  } else if (op === "get") {
    path = `/v1/groups/${encodeURIComponent(message.code)}`;
  } else if (op === "put") {
    path = `/v1/groups/${encodeURIComponent(message.code)}/me`;
    method = "PUT";
    body = message.member;
  } else if (op === "leave") {
    path = `/v1/groups/${encodeURIComponent(message.code)}/me`;
    method = "DELETE";
    body = { clientId: message.clientId };
  } else {
    throw new Error("未知操作");
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `同步失败 ${res.status}`);
  return data;
}

async function getSettings() {
  const stored = await chrome.storage.local.get("vb_settings");
  return { ...DEFAULT_SETTINGS, ...(stored.vb_settings || {}) };
}

function softenJson(text) {
  return String(text || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/m, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractJsonBlob(text) {
  const start = String(text || "").search(/[[{]/);
  if (start < 0) return "";
  const src = text.slice(start);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return src.slice(0, i + 1);
    }
  }
  return src;
}

/** Strips markdown fences and parses the first JSON object/array found. */
function parseLooseJson(text) {
  const cleaned = softenJson(text);
  const blob = extractJsonBlob(cleaned);
  const tries = [cleaned, blob, softenJson(blob)].filter(Boolean);
  for (const candidate of tries) {
    try {
      return JSON.parse(candidate);
    } catch (_e) {}
  }
  throw new Error("AI 这次返回的格式乱了，再试一次。");
}

function pickAiText(data, { json = false } = {}) {
  const msg = data?.choices?.[0]?.message || {};
  const content = String(msg.content ?? "").trim();
  if (content) return content;
  if (json) return "";
  return String(msg.reasoning_content || msg.reasoning || "").trim();
}

async function callAi({
  system,
  messages,
  json = false,
  maxTokens = 4096,
  model,
  temperature,
  think = false,
  _retried = false,
  _plain = false,
  _retriedJson = false,
  _retriedLength = false,
}) {
  const settings = await getSettings();
  setUiLang(settings.uiLang);
  if (!settings.apiKey) {
    const err = new Error("还没有配置 DeepSeek Key，请先完成初始设置");
    err.code = "NO_KEY";
    throw err;
  }

  const thinkingOn = think === true && !_plain;
  const res = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: model || settings.model || "deepseek-v4-flash",
      max_tokens: thinkingOn ? Math.max(maxTokens, 8192) : maxTokens,
      ...(!_plain ? { thinking: { type: thinkingOn ? "enabled" : "disabled" } } : {}),
      ...(!thinkingOn && Number.isFinite(temperature) ? { temperature } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: `${system}${aiLangLine(settings.uiLang)}` }, ...messages],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429 && !_retried) {
      await new Promise((ok) => setTimeout(ok, 1400));
      return callAi({
        system,
        messages,
        json,
        maxTokens,
        model,
        temperature,
        think,
        _retried: true,
        _plain,
        _retriedJson,
        _retriedLength,
      });
    }
    if (!_plain && res.status === 400) {
      return callAi({
        system,
        messages,
        json,
        maxTokens,
        model,
        temperature,
        think: false,
        _retried: true,
        _plain: true,
        _retriedJson,
        _retriedLength,
      });
    }
    throw new Error(`AI 请求失败（${res.status}）${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = pickAiText(data, { json });
  if (text) return text;
  const reason = data?.choices?.[0]?.finish_reason || "";
  if (json && !_retriedJson) {
    return callAi({
      system,
      messages,
      json: false,
      maxTokens: Math.max(maxTokens, 2048),
      model,
      temperature,
      think: false,
      _retried,
      _plain,
      _retriedJson: true,
      _retriedLength,
    });
  }
  if ((thinkingOn || reason === "length") && !_retriedLength) {
    return callAi({
      system,
      messages,
      json: false,
      maxTokens: Math.max(maxTokens * 2, 4096),
      model,
      temperature,
      think: false,
      _retried,
      _plain,
      _retriedJson,
      _retriedLength: true,
    });
  }
  throw new Error(reason === "length" ? "回答被截断了，再试一次。" : "AI 返回为空");
}

// ---------- helpers ----------

function clock(seconds) {
  return formatClock(seconds);
}

/** "[m:ss] line" transcript, truncated from the middle to keep both ends. */
function compactTranscript(segments, maxChars = 14000) {
  const lines = (segments || []).map((s) => `[${clock(s.start)}] ${s.text}`);
  let joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  const part = Math.floor(maxChars / 3);
  const midStart = Math.max(part, Math.floor((joined.length - part) / 2));
  return `${joined.slice(0, part)}\n…（前后各留一段，中间抽一截）…\n${joined.slice(midStart, midStart + part)}\n…\n${joined.slice(-part)}`;
}

function excerptBetween(segments, start, end, maxChars = 7000) {
  const lines = (segments || [])
    .filter((s) => s.start >= start - 2 && s.start < end + 2)
    .map((s) => `[${clock(s.start)}] ${s.text}`);
  return lines.join("\n").slice(0, maxChars);
}

// ---------- 1. 知识分块（色块时间轴） ----------

const SEGMENT_SYSTEM = `你是一个视频内容架构师。给你一支 YouTube 视频的带时间戳字幕，你把它切成 3 到 12 个"知识块"——每块是一个可以独立学习的知识点或叙事单元。

规则：
- 只依据字幕内容，不要编造。
- 相邻块首尾相接，覆盖整支视频（第一块从 0 开始，最后一块到视频结束）。
- title 用中文，8 字以内，具体到内容（写"复利的三个条件"而不是"第一部分"）。
- summary 一句话说清这一块讲了什么，中文，30 字以内。
- category 从这五个里选：concept(概念讲解) / case(案例演示) / story(经历故事) / action(可操作建议) / qa(问答互动)。

只输出 JSON，不要 markdown 围栏：
{"gist":"整支视频一句话","blocks":[{"start":0,"end":123,"title":"…","summary":"…","category":"concept"}]}
start/end 是秒数。`;

async function handleSegment({ segments, title, durationSeconds, uiLang }) {
  const settings = await getSettings();
  const lang = normalizeLang(uiLang || settings.uiLang) || "zh-CN";
  setUiLang(lang);
  const text = await callAi({
    system: SEGMENT_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `界面语言：${langMeta(lang).ai}\n视频标题：${title || "未知"}\n视频总长：${Math.round(durationSeconds || 0)} 秒\n块标题、摘要、gist 必须用${langMeta(lang).ai}写，不要用英文交差。\n\n字幕：\n${compactTranscript(segments)}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
    .map((b) => ({
      start: Math.max(0, Number(b.start) || 0),
      end: Math.max(0, Number(b.end) || 0),
      title: String(b.title || "").slice(0, 24),
      summary: String(b.summary || "").slice(0, 80),
      category: ["concept", "case", "story", "action", "qa"].includes(b.category)
        ? b.category
        : "concept",
    }))
    .filter((b) => b.title && b.end > b.start)
    .sort((a, b) => a.start - b.start)
    .slice(0, 12);
  if (!blocks.length) throw new Error("没有拆出有效的知识块");
  return { gist: String(parsed.gist || "").slice(0, 120), blocks };
}

// ---------- 2. 按块类型拆解（默认走 Pro） ----------

const DIVE_RULES = `你是知识教练，不是视频复述机。按指定框架拆这一块，不要用万能填空交差。

禁止：复述字幕或改写块标题；「很重要 / 本质上」后面没有新判断；罗列听一遍就懂的句子。
视频里没有、但内化必须补的，句前加 [补充]。
称「你」。专有名词可保留原文。只输出 JSON。`;

const DIVE_PROMPTS = {
  concept: `${DIVE_RULES}
这块是概念。用 SEE-I + 属加种差：X 是一种 Y，差别在 Z；再划边界、给正例反例、给一个类比。
{
  "kind":"concept",
  "essence":"X 是一种 Y，差别在 Z。不要重复块标题",
  "elaborate":"边界：什么时候不算、常被混成什么",
  "example":"材料里的正例，或 [补充] 一个更清楚的",
  "counter":"一个反例或近邻，用来划界",
  "analogy":"外行听得懂的一个类比",
  "retrieve":["一个真实情境：什么信号出现时该调用"],
  "encode":["最多一条最好记的挂钩；没有就空数组"],
  "gap":"视频没讲清、内化时必须补的一点"
}`,
  case: `${DIVE_RULES}
这块是案例。用类比编码 + 主张-证据-推理：这个例子在证明什么，深层机制是什么，换场景还成立吗。
{
  "kind":"case",
  "claim":"这个案例在证明什么主张",
  "mechanism":"深层机制：为什么这个例子能推出那个主张",
  "transfer":"换一个场景还成立吗？成立的条件",
  "hidden":"讲者没说、但推理依赖的前提",
  "retrieve":["一个真实情境：什么信号出现时该调用"],
  "encode":["最多一条最好记的挂钩；没有就空数组"],
  "gap":"视频没讲清、内化时必须补的一点"
}`,
  story: `${DIVE_RULES}
这块是故事。用冰山模型：事件 → 模式 → 结构 → 讲者想让你信什么。
{
  "kind":"story",
  "event":"表面上发生了什么",
  "pattern":"这类事重复出现时的模式",
  "structure":"底下的结构或激励",
  "belief":"讲者想让你信什么",
  "retrieve":["一个真实情境：什么信号出现时该调用"],
  "encode":["最多一条最好记的挂钩；没有就空数组"],
  "gap":"视频没讲清、内化时必须补的一点"
}`,
  action: `${DIVE_RULES}
这块是做法。用层次任务分析：目标、前提、带判断点的步骤、最容易失败的一步、看完立刻能做的小实验。
{
  "kind":"action",
  "goal":"做完之后你能独立完成什么",
  "prereq":["开始前必须具备的条件，1-3 条"],
  "steps":[{"name":"步骤名","judge":"这一步要判断什么；没有就空字符串"}],
  "fail":"最容易失败的一步，以及怎么察觉",
  "experiment":"看完立刻能做的一次小实验",
  "retrieve":["一个真实情境：什么信号出现时该调用"],
  "encode":["最多一条最好记的挂钩；没有就空数组"],
  "gap":"视频没讲清、内化时必须补的一点"
}`,
  qa: `${DIVE_RULES}
这块是问答。用 Toulmin 简版：真正的问题、主张、依据、什么时候不适用。
{
  "kind":"qa",
  "question":"真正在问的问题，不是字面标题",
  "claim":"他的主张，一句",
  "warrant":"依据：为什么这能推出那",
  "qualifier":"什么时候不适用",
  "retrieve":["一个真实情境：什么信号出现时该调用"],
  "encode":["最多一条最好记的挂钩；没有就空数组"],
  "gap":"视频没讲清、内化时必须补的一点"
}`,
};

function diveKindOf(block, parsed) {
  const allowed = ["concept", "case", "story", "action", "qa"];
  if (allowed.includes(parsed?.kind)) return parsed.kind;
  if (allowed.includes(block?.category)) return block.category;
  return "concept";
}

function clip(text, n) {
  return String(text || "").trim().slice(0, n);
}

function clipList(v, n, len) {
  return (Array.isArray(v) ? v : [])
    .map((item) => String(typeof item === "object" ? item.name || item.role || JSON.stringify(item) : item).trim().slice(0, len))
    .filter(Boolean)
    .slice(0, n);
}

function synthesizeDiveParts(kind, parsed) {
  const row = (name, role) => (role ? { name, role: clip(role, 200) } : null);
  const rows =
    kind === "concept"
      ? [
          row("定义", parsed.essence),
          row("边界", parsed.elaborate),
          row("正例", parsed.example),
          row("反例", parsed.counter),
          row("类比", parsed.analogy),
        ]
      : kind === "case"
        ? [
            row("主张", parsed.claim),
            row("机制", parsed.mechanism),
            row("迁移", parsed.transfer),
            row("没说的前提", parsed.hidden),
          ]
        : kind === "story"
          ? [
              row("事件", parsed.event),
              row("模式", parsed.pattern),
              row("结构", parsed.structure),
              row("想让你信", parsed.belief),
            ]
          : kind === "action"
            ? [
                row("目标", parsed.goal),
                ...(Array.isArray(parsed.steps) ? parsed.steps : []).map((s) =>
                  row(clip(s?.name, 40) || "步骤", s?.judge || s?.name),
                ),
                row("易败点", parsed.fail),
                row("小实验", parsed.experiment),
              ]
            : [
                row("问题", parsed.question),
                row("主张", parsed.claim),
                row("依据", parsed.warrant),
                row("限定", parsed.qualifier),
              ];
  return rows.filter(Boolean).slice(0, 8);
}

async function handleDeepDive({ block, segments, videoTitle }) {
  const excerpt = excerptBetween(segments, block.start, block.end);
  if (excerpt.length < 40) throw new Error("这一块的字幕太少，拆不动");
  const category = diveKindOf(block, {});
  const settings = await getSettings();
  const text = await callAi({
    system: DIVE_PROMPTS[category] || DIVE_PROMPTS.concept,
    json: true,
    maxTokens: 6144,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [
      {
        role: "user",
        content: `视频标题：${videoTitle || "未知"}\n知识块：${block.title}（${clock(block.start)} - ${clock(block.end)}）\n块类型：${category}\n块摘要：${block.summary || ""}\n\n字幕摘录：\n${excerpt}\n\n按这个类型的框架拆。不要复述字幕。`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const kind = diveKindOf(block, parsed);
  const fromModel = (Array.isArray(parsed.parts) ? parsed.parts : [])
    .map((p) => ({
      name: clip(p?.name, 40),
      role: clip(p?.role, 200),
      ifMissing: clip(p?.ifMissing, 160),
    }))
    .filter((p) => p.name && p.role)
    .slice(0, 8);
  const parts = fromModel.length ? fromModel : synthesizeDiveParts(kind, parsed);
  const headline =
    clip(parsed.essence, 200) ||
    clip(parsed.claim, 200) ||
    clip(parsed.goal, 200) ||
    clip(parsed.question, 200) ||
    clip(parsed.event, 200) ||
    clip(parsed.summary, 160);
  if (!headline && !parts.length) throw new Error("拆解结果为空");
  return {
    kind,
    essence: headline,
    parts,
    map: clip(parsed.map, 280),
    encode: clipList(parsed.encode, 1, 200),
    retrieve: clipList(parsed.retrieve, 2, 200),
    connect: clipList(parsed.connect, 2, 160),
    gap: clip(parsed.gap, 240),
    owned: "",
    elaborate: clip(parsed.elaborate, 240),
    example: clip(parsed.example, 240),
    counter: clip(parsed.counter, 200),
    analogy: clip(parsed.analogy, 200),
    claim: clip(parsed.claim, 200),
    caseMechanism: clip(parsed.mechanism, 240),
    transfer: clip(parsed.transfer, 200),
    hidden: clip(parsed.hidden, 200),
    event: clip(parsed.event, 200),
    pattern: clip(parsed.pattern, 200),
    structure: clip(parsed.structure, 200),
    belief: clip(parsed.belief, 200),
    goal: clip(parsed.goal, 200),
    prereq: clipList(parsed.prereq, 3, 160),
    steps: (Array.isArray(parsed.steps) ? parsed.steps : [])
      .map((s) => ({ name: clip(s?.name, 40), judge: clip(s?.judge, 160) }))
      .filter((s) => s.name)
      .slice(0, 8),
    fail: clip(parsed.fail, 200),
    experiment: clip(parsed.experiment, 200),
    question: clip(parsed.question, 200),
    warrant: clip(parsed.warrant, 240),
    qualifier: clip(parsed.qualifier, 200),
    concepts: [],
    mechanism: [],
    examples: [],
    pitfalls: [],
    summary: "",
    selfTest: [],
  };
}

// ---------- 3. AI 问视频 ----------

const ASK_SYSTEM = `你是这支视频的讲解员。读者一边看，一边问你。你不是搜索引擎，也不是鸡汤教练。

先给能站住的回答，再给证据。

怎么答：
- 第一句直接回答。不要「好问题」「根据视频」「简单来说」。
- 接着用这支视频自己的论证把答案钉住：他怎么定义、用了什么例子、在哪拐弯。需要时引用原词，不要整段复述字幕。
- 关键判断带出处，格式 [m:ss]，读者能点它跳转。2 到 4 个时间码够，不要句句都标。
- 问题含糊时，先用半句话钉你理解的问题，再答。
- 读者圈了某句或某块：围着它答，再接到整支的主张上。
- 字幕里没有：先写「视频里没讲这个」。需要时再另起「以下是视频外的补充：」。
- 视频前后打架时，把两边都点出来，不要抹平。
- 不要首先其次最后，不要列空提纲。专有名词可保留原文。
- 篇幅跟问题走：能三句说清就三句；机制、对比、为什么，可以写到 200-400 字。`;

function askFocusBlock(focus) {
  if (!focus) return "整支视频";
  if (focus.type === "quote") return `读者圈了这句话：「${String(focus.text || "").slice(0, 240)}」`;
  const span =
    Number.isFinite(Number(focus.start)) && Number.isFinite(Number(focus.end))
      ? ` ${clock(focus.start)}–${clock(focus.end)}`
      : "";
  return `读者在看知识块「${focus.title || "这块"}」${span}${focus.summary ? `：${focus.summary}` : ""}`;
}

async function handleAsk({ question, contextText, title, gist, at, focus, outline, quotes, segments, history }) {
  const settings = await getSettings();
  const segs = Array.isArray(segments) ? segments : [];
  const t = Math.max(0, Number(at) || Number(focus?.start) || 0);
  const focusStart = Number.isFinite(Number(focus?.start)) ? Number(focus.start) : Math.max(0, t - 90);
  const focusEnd = Number.isFinite(Number(focus?.end)) ? Number(focus.end) : t + 50;
  const nearby = excerptBetween(segs, Math.max(0, t - 80), t + 40, 2800);
  const focusLines =
    focus?.type === "quote"
      ? nearby
      : excerptBetween(segs, focusStart, focusEnd + 2, 4500);
  const outlineLines = (Array.isArray(outline) ? outline : [])
    .slice(0, 12)
    .map((b) => `[${clock(b.start)}–${clock(b.end)}] ${b.title || ""}${b.summary ? `：${b.summary}` : ""}`)
    .join("\n");
  const quoteLines = (Array.isArray(quotes) ? quotes : [])
    .slice(0, 8)
    .map((q) => `[${clock(q.at || q.seconds || 0)}] ${String(q.text || q.en || q.zh || "").slice(0, 160)}`)
    .join("\n");
  const transcript = String(contextText || "").trim()
    ? String(contextText).slice(0, 8000)
    : compactTranscript(segs, 8000);
  const packet = [
    `视频：${title || "未知"}`,
    gist ? `一句话：${gist}` : "",
    t ? `读者看到：${clock(t)}` : "",
    askFocusBlock(focus),
    outlineLines ? `结构：\n${outlineLines}` : "",
    quoteLines ? `已抽出的金句：\n${quoteLines}` : "",
    focusLines ? `焦点附近字幕：\n${focusLines}` : "",
    nearby && nearby !== focusLines ? `正在看的附近：\n${nearby}` : "",
    transcript ? `全文缩略：\n${transcript}` : "",
    `问题：\n${String(question || "").slice(0, 1000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const messages = [
    ...(Array.isArray(history) ? history.slice(-6) : [])
      .filter((m) => m?.content && !String(m.content).startsWith("⚠"))
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 1600),
      })),
    { role: "user", content: packet },
  ];
  const text = await callAi({
    system: ASK_SYSTEM,
    messages,
    maxTokens: 2200,
    temperature: 0.35,
    think: true,
    model: settings.diveModel || settings.model,
  });
  return { answer: text.trim() };
}

// ---------- 4. 双语字幕翻译 ----------

function translateSystem(settings) {
  const name = langMeta(normalizeLang(settings.uiLang) || "zh-CN").ai;
  return `把视频字幕逐行翻译成${name}。口语、自然、忠实原意；专有名词和常用技术词可夹在译文里，但整句必须是${name}，禁止整句照抄原文。
输入是一个字符串数组。输出数组长度必须相同，不要合并或拆分。
每条译文不要带序号，不要写成「1. …」「27. …」。

只输出 JSON，不要 markdown 围栏：{"t":["第一行译文","第二行译文"]}`;
}

function cleanZh(text) {
  return String(text ?? "")
    .replace(/^\s*\d{1,4}(?:\.|\．|、|\)|：|:)\s+/, "")
    .trim();
}

function polishTranslateLine(zh, line) {
  const cleaned = cleanZh(zh);
  if (!cleaned || sameAsSource(cleaned, line)) return "";
  if (/翻译失败|筛词失败|拆块失败|额度不够|钥匙无效/i.test(cleaned)) return "";
  if (!/[\u4e00-\u9fff]/.test(cleaned) && /(error|exception|failed|request|api key)/i.test(cleaned)) return "";
  return cleaned;
}

async function translateChunk(src, settings) {
  const chars = src.reduce((n, line) => n + line.length, 0);
  const maxTokens = Math.min(8192, 800 + chars + src.length * 80);
  const run = async (json, tokens = maxTokens) => {
    const text = await callAi({
      system: translateSystem(settings),
      json,
      maxTokens: tokens,
      temperature: 0.2,
      messages: [{ role: "user", content: `json\n${JSON.stringify(src)}` }],
    });
    return pickTranslateRows(parseLooseJson(text));
  };
  let raw = [];
  try {
    raw = await run(true);
  } catch (_e) {
    raw = await run(false);
  }
  let out = src.map((line, i) => polishTranslateLine(raw[i], line));
  const missing = out.map((zh, i) => (zh ? -1 : i)).filter((i) => i >= 0);
  if (missing.length === src.length && src.length) {
    try {
      raw = await run(false);
      out = src.map((line, i) => polishTranslateLine(raw[i], line));
    } catch (_e) {}
  }
  const still = out.map((zh, i) => (zh ? -1 : i)).filter((i) => i >= 0);
  if (still.length && still.length < src.length) {
    try {
      const mini = still.map((i) => src[i]);
      const text = await callAi({
        system: translateSystem(settings),
        json: false,
        maxTokens: Math.min(8192, 600 + mini.reduce((n, line) => n + line.length, 0) + mini.length * 80),
        temperature: 0.2,
        messages: [{ role: "user", content: `json\n${JSON.stringify(mini)}` }],
      });
      const extra = pickTranslateRows(parseLooseJson(text));
      still.forEach((i, k) => {
        const zh = polishTranslateLine(extra[k], src[i]);
        if (zh) out[i] = zh;
      });
    } catch (_e) {}
  }
  return out;
}

async function handleTranslate({ lines }) {
  const settings = await getSettings();
  const src = (Array.isArray(lines) ? lines : []).slice(0, 40).map((line) => String(line).slice(0, 500));
  if (!src.length) return { translations: [] };
  const size = typeof TRANSLATE_BATCH === "number" ? TRANSLATE_BATCH : 10;
  const out = [];
  for (let i = 0; i < src.length; i += size) {
    out.push(...(await translateChunk(src.slice(i, i + size), settings)));
  }
  return { translations: out };
}

// ---------- 学习词典 / 学习包 / 费曼 ----------

const DEFINE_SYSTEM = `你是给中文学习者用的英语学习词典（朗文/牛津风格）。查询可能是单词、词组、短语或俚语。必须把整个查询当作一个单位解释，不要拆成单个单词。只输出 JSON，不要 markdown 围栏：
{
  "phonetic": "/ˈlev.ər.ɪdʒ/",
  "senses": [{"pos":"v. / phrase / idiom","en":"plain-English B1 definition","zh":"中文释义"}],
  "usage": "常见搭配或语域（中文，可含英文搭配）",
  "examples": [{"en":"English sentence.","zh":"中文翻译。"}],
  "inContext": "它在这句字幕里的具体意思"
}
音标用美式 IPA；词组可留空。senses 1-3 个。examples 正好 3 条，不要抄字幕。`;

async function handleDefineWord({ word, sentence, videoTitle }) {
  const trimmed = String(word || "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 80) throw new Error("无效的词");
  const text = await callAi({
    system: DEFINE_SYSTEM,
    json: true,
    maxTokens: 1024,
    messages: [
      {
        role: "user",
        content: `Query: ${trimmed}\nTreat the whole query as one unit (word, phrase, or idiom).\nSubtitle: ${String(sentence || "None").slice(0, 500)}\nVideo: ${videoTitle || "Unknown"}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const safe = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const senses = (Array.isArray(parsed.senses) ? parsed.senses : [])
    .map((s) => ({ pos: safe(s?.pos, 24), en: safe(s?.en, 240), zh: safe(s?.zh, 240) }))
    .filter((s) => s.en || s.zh)
    .slice(0, 3);
  const examples = (Array.isArray(parsed.examples) ? parsed.examples : [])
    .map((e) => ({ en: safe(e?.en, 220), zh: safe(e?.zh, 220) }))
    .filter((e) => e.en && e.zh)
    .slice(0, 3);
  if (!senses.length && !safe(parsed.meaning, 200)) throw new Error("释义为空");
  return {
    definition: {
      phonetic: safe(parsed.phonetic, 60),
      senses,
      meaning: safe(parsed.meaning, 200),
      usage: safe(parsed.usage, 240),
      examples,
      inContext: safe(parsed.inContext, 240),
    },
  };
}

const STUDY_SYSTEM = `根据带时间戳的字幕（和知识块目录，如有）做学习包。复述必须是能罩住全文的提纲，不是三句正确的空话。只输出 JSON：
{
  "spine": "一句总纲：这支视频的主张，或它要回答的问题",
  "recap": ["按讲述顺序的骨干，中文"],
  "keywords": [{"word":"English","gloss":"中文释义"}],
  "questions": [{"q":"带着去视频里找答案的问题","at":"m:ss"}]
}
recap 写 6-10 条。必须覆盖开头提出的问题、中段关键论证和例子、转折、结尾的结论或行动。漏掉后半段或结论算失败。
每条写一层完整意思，是判断，不是「讲了…」「提到了…」。不要用万能句交差。
keywords 5-8 个，questions 4-6 个。at 尽量对应字幕时间。不要编造字幕里没有的事实。`;

function sampleTranscript(segments, limit) {
  const rows = (segments || []).map((s) => `[${clock(s.start)}] ${String(s.text || "").replace(/\s+/g, " ").trim()}`);
  const all = rows.join("\n");
  if (all.length <= limit) return all;
  const n = rows.length;
  if (n <= 36) return all.slice(0, limit);
  const picked = [];
  const head = 14;
  const tail = 14;
  const midWant = Math.max(24, Math.min(80, n - head - tail));
  const start = head;
  const end = Math.max(start, n - tail);
  const step = Math.max(1, Math.ceil((end - start) / midWant));
  for (let i = 0; i < head && i < n; i += 1) picked.push(rows[i]);
  for (let i = start; i < end; i += step) picked.push(rows[i]);
  for (let i = Math.max(head, n - tail); i < n; i += 1) picked.push(rows[i]);
  let out = picked.join("\n");
  if (out.length > limit) out = out.slice(0, limit);
  return out;
}

async function handleStudyPack({ segments, title, blocks, gist }) {
  const bricks = (blocks || [])
    .map((b, i) => `${i + 1}. [${clock(b.start)}] ${b.title || ""}${b.summary ? ` — ${b.summary}` : ""}`)
    .join("\n");
  const lines = sampleTranscript(segments, bricks ? 18000 : 24000);
  const text = await callAi({
    system: STUDY_SYSTEM,
    json: true,
    maxTokens: 3072,
    messages: [
      {
        role: "user",
        content: `标题：${title || "未知"}${gist ? `\n已有一句话：${gist}` : ""}${bricks ? `\n\n知识块目录：\n${bricks}` : ""}\n\n字幕：\n${lines}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const list = (arr, n, map) =>
    (Array.isArray(arr) ? arr : []).map(map).filter((x) => x.word || x.q || typeof x === "string").slice(0, n);
  return {
    spine: String(parsed.spine || "").trim().slice(0, 180),
    recap: (Array.isArray(parsed.recap) ? parsed.recap : [])
      .map((s) => String(s).trim().slice(0, 180))
      .filter(Boolean)
      .slice(0, 10),
    keywords: list(parsed.keywords, 8, (k) => ({
      word: String(k?.word || "").slice(0, 40),
      gloss: String(k?.gloss || "").slice(0, 80),
    })).filter((k) => k.word),
    questions: list(parsed.questions, 6, (q) => ({
      q: String(q?.q || "").slice(0, 120),
      at: String(q?.at || "").slice(0, 8),
    })).filter((q) => q.q),
  };
}

const CONCEPT_SYSTEM = `你在画 Joseph Novak 式概念图，不是思维导图，也不是星空/行星图。
概念图的单位是「命题」：概念—连接词—概念，必须能读成一句完整的话。
只输出 JSON：
{
  "focusQuestion":"这张图要回答的焦点问题",
  "concepts":[{"id":"c1","label":"概念","level":0,"block":0}],
  "propositions":[{"from":"c1","link":"需要","to":"c2","cross":false}]
}
规则：
- focusQuestion 是问句，不是标题。
- 概念是名词或名词短语，4-12字。不要截成半句，不要章节名，不要「第一部分」。
- level 0 最上位、最一般，画在最顶；数字越大越具体、越靠下。用 0-3 层。
- 每条 proposition 的 link 是连接词/连接短语（是、需要、导致、属于、用于、不同于），2-6字。
- 上下层级的边 cross=false；跨分支的交叉连接 cross=true，至少 1 条，至多 4 条。
- 概念 12-24 个，尽量覆盖这支视频里反复出现的名词。每条边两端都必须是已有概念。
- block 是知识块序号，不确定就 -1。`;

async function handleConceptMap({ blocks, keywords, title }) {
  const blockLines = (Array.isArray(blocks) ? blocks : [])
    .map((b, i) => `${i}. ${b.title}：${b.summary || ""}`)
    .join("\n");
  const kw = (Array.isArray(keywords) ? keywords : [])
    .map((k) => `${k.word}${k.gloss ? `（${k.gloss}）` : ""}`)
    .join("、");
  const settings = await getSettings();
  const text = await callAi({
    system: CONCEPT_SYSTEM,
    json: true,
    model: settings.diveModel || settings.model,
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n知识块：\n${blockLines}\n关键词：${kw || "无"}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
    .map((n) => ({
      id: String(n?.id || "").slice(0, 20),
      label: String(n?.label || "").slice(0, 24),
      level: Math.max(0, Math.min(3, Number(n?.level) || 0)),
      block: Number.isFinite(Number(n?.block)) ? Number(n.block) : -1,
    }))
    .filter((n) => n.id && n.label)
    .slice(0, 24);
  const ids = new Set(concepts.map((n) => n.id));
  const propositions = (Array.isArray(parsed.propositions) ? parsed.propositions : parsed.edges || [])
    .map((e) => ({
      from: String(e?.from || ""),
      link: String(e?.link || e?.rel || "").slice(0, 10),
      to: String(e?.to || ""),
      cross: Boolean(e?.cross),
    }))
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && e.link)
    .slice(0, 40);
  if (!concepts.length || !propositions.length) throw new Error("概念图缺少命题");
  return {
    focusQuestion: String(parsed.focusQuestion || "这支视频在讲什么？").slice(0, 56),
    concepts,
    propositions,
  };
}

const CLOZE_SYSTEM = `把一句视频原文做成一张挖空复习卡。只输出 JSON：
{"front":"原句，但把最关键的一个词或短语换成 ____","back":"被挖掉的词或短语","hint":"一句中文提示，说明这张卡在考什么"}
规则：只挖一个最有信息量的词或短语；front 其余部分保持原文；back 就是答案本身，不要解释；hint 不能直接泄露答案。`;

async function handleCloze({ text, sentence, videoTitle }) {
  const raw = await callAi({
    system: CLOZE_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `视频：${videoTitle || "未知"}\n划线：${text}\n所在句：${sentence || text}`,
      },
    ],
  });
  const parsed = parseLooseJson(raw);
  const front = String(parsed.front || "").replace(/_{3,}/g, "____").slice(0, 300);
  const back = String(parsed.back || "").slice(0, 120);
  if (!front.includes("____") || !back) throw new Error("挖空失败，换一句试试");
  return {
    front,
    back,
    hint: String(parsed.hint || "").slice(0, 120),
  };
}

const RECALL_SYSTEM = `学员刚看完一支视频，现在凭记忆闭卷默写要点。你对照字幕批改。只输出 JSON：
{
  "got":["确实记对的点，每条一句"],
  "missed":[{"point":"漏掉的重要点","at":"m:ss"}],
  "wrong":[{"said":"学员记岔的说法","fix":"按字幕纠正"}],
  "verdict":"一句不客套的总评"
}
got 最多 5 条，missed 最多 5 条（只挑真正重要的，带字幕时间），wrong 最多 3 条。学员没写到的细枝末节不算 missed。`;

async function handleRecall({ recall, segments, title }) {
  const lines = (segments || [])
    .map((s) => `[${clock(s.start)}] ${s.text}`)
    .join("\n")
    .slice(0, 13000);
  const raw = await callAi({
    system: RECALL_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n\n学员的默写：\n${String(recall || "").slice(0, 2000)}\n\n字幕：\n${lines}`,
      },
    ],
  });
  const parsed = parseLooseJson(raw);
  const strList = (arr, n, len) =>
    (Array.isArray(arr) ? arr : []).map((x) => String(x || "").slice(0, len)).filter(Boolean).slice(0, n);
  return {
    got: strList(parsed.got, 5, 120),
    missed: (Array.isArray(parsed.missed) ? parsed.missed : [])
      .map((m) => ({ point: String(m?.point || "").slice(0, 140), at: String(m?.at || "").slice(0, 8) }))
      .filter((m) => m.point)
      .slice(0, 5),
    wrong: (Array.isArray(parsed.wrong) ? parsed.wrong : [])
      .map((w) => ({ said: String(w?.said || "").slice(0, 120), fix: String(w?.fix || "").slice(0, 160) }))
      .filter((w) => w.said && w.fix)
      .slice(0, 3),
    verdict: String(parsed.verdict || "").slice(0, 80),
  };
}

const ATLAS_SYSTEM = `你把多支视频的概念织成一张 Novak 概念图。只输出 JSON：
{
  "focusQuestion":"这些视频共同在回答什么",
  "concepts":[{"id":"a1","label":"概念","level":0}],
  "propositions":[{"from":"a1","link":"用于","to":"a2","cross":true}]
}
规则：当前视频和其他视频两边都要留概念，禁止交空数组；同义合并成一条，标签用更短的中文；level 0 最一般；跨视频的边 cross=true；概念 8-18 个；连接词 2-6 字。id 用你这次编的短英文，命题 from/to 必须是本次 concepts 里的 id。不要章节名。`;

function atlasFallbackConcepts(current, atlas, others) {
  const out = [];
  const seen = new Set();
  const push = (id, label, level) => {
    const key = String(label || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .slice(0, 16);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      id: String(id || `c${out.length}`).slice(0, 20),
      label: String(label).slice(0, 24),
      level: Math.max(0, Math.min(3, Number(level) || 0)),
    });
  };
  for (const c of atlas?.concepts || []) push(c.id, c.label, c.level);
  for (const c of current?.concepts || []) push(c.id, c.label, c.level);
  for (const o of others || []) {
    if (o.gist) push(`g${out.length}`, String(o.gist).slice(0, 16), 0);
    for (const t of o.bricks || []) push(`b${out.length}`, t, 1);
  }
  return out.slice(0, 18);
}

function remapAtlasId(raw, concepts) {
  const id = String(raw || "");
  if (!id) return "";
  if (concepts.some((c) => c.id === id)) return id;
  const key = id.toLowerCase().replace(/\s+/g, "");
  const hit = concepts.find((c) => String(c.label || "").toLowerCase().replace(/\s+/g, "") === key);
  return hit?.id || "";
}

async function handleAtlas({ current, atlas, title, others }) {
  const cur = Array.isArray(current?.concepts) ? current.concepts : [];
  const old = Array.isArray(atlas?.concepts) ? atlas.concepts : [];
  const extra = Array.isArray(others) ? others : [];
  const curLines = cur.map((c) => `${c.id}:${c.label}`).join("、");
  const oldLines = old
    .slice(0, 40)
    .map((c) => `${c.id}:${c.label}（${(c.sources || []).map((s) => s.title).filter(Boolean).slice(0, 2).join(" / ")}）`)
    .join("\n");
  const otherLines = extra
    .slice(0, 8)
    .map((o) => `${o.title || o.videoId}：${o.gist || "无摘要"}｜${(o.bricks || []).slice(0, 8).join("、") || "无块"}`)
    .join("\n");
  const settings = await getSettings();
  let parsed = {};
  try {
    const text = await callAi({
      system: ATLAS_SYSTEM,
      json: true,
      model: settings.diveModel || settings.model,
      messages: [
        {
          role: "user",
          content: `当前视频：${title || "未知"}\n当前概念：${curLines || "无"}\n\n其他视频：\n${otherLines || "无"}\n\n已有总图：\n${oldLines || "空"}`,
        },
      ],
    });
    parsed = parseLooseJson(text);
  } catch (_e) {
    parsed = {};
  }
  let concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
    .map((n) => ({
      id: String(n?.id || "").slice(0, 20),
      label: String(n?.label || "").slice(0, 24),
      level: Math.max(0, Math.min(3, Number(n?.level) || 0)),
    }))
    .filter((n) => n.id && n.label)
    .slice(0, 18);
  if (!concepts.length) concepts = atlasFallbackConcepts(current, atlas, extra);
  const propositions = (Array.isArray(parsed.propositions) ? parsed.propositions : [])
    .map((e) => ({
      from: remapAtlasId(e?.from, concepts),
      link: String(e?.link || "").slice(0, 10),
      to: remapAtlasId(e?.to, concepts),
      cross: Boolean(e?.cross),
    }))
    .filter((e) => e.from && e.to && e.from !== e.to && e.link)
    .slice(0, 32);
  const kept = propositions.length
    ? propositions
    : (Array.isArray(atlas?.propositions) ? atlas.propositions : [])
        .map((e) => ({
          from: remapAtlasId(e.from, concepts),
          link: String(e.link || "").slice(0, 10),
          to: remapAtlasId(e.to, concepts),
          cross: Boolean(e.cross),
        }))
        .filter((e) => e.from && e.to && e.from !== e.to && e.link)
        .slice(0, 32);
  if (!concepts.length) throw new Error("总图是空的");
  return {
    focusQuestion: String(parsed.focusQuestion || atlas?.focusQuestion || "这些视频在讲什么？").slice(0, 40),
    concepts,
    propositions: kept,
  };
}

const SCAN_VOCAB_SYSTEM = `你根据学员已掌握的词汇量，从候选词里挑出他多半还不熟的词。只输出 JSON：
{"words":[{"word":"example","why":"超纲，学术书面词"}]}
规则：
- word 必须来自候选列表，原样抄小写
- 只收超出该水平的词；这个水平会的词一律丢掉
- 不要专有名词、缩写、人名地名品牌
- 词根已在该水平的常见派生不要收
- 宁可少、准，最多 24 个
- why 不超过 16 字，中文`;

async function handleScanVocab({ tokens, level, title }) {
  const rows = (Array.isArray(tokens) ? tokens : [])
    .map((t) => ({
      word: String(t?.word || "").toLowerCase().trim(),
      count: Number(t?.count) || 1,
      sentence: String(t?.sentence || "").slice(0, 120),
      seconds: Number(t?.seconds) || 0,
    }))
    .filter((t) => /^[a-z][a-z'-]{2,39}$/.test(t.word))
    .slice(0, 80);
  if (!rows.length) return { words: [] };
  const list = rows.map((t) => `${t.word}×${t.count}`).join("、");
  const samples = rows
    .slice(0, 16)
    .map((t) => `${t.word}: ${t.sentence}`)
    .join("\n");
  const text = await callAi({
    system: SCAN_VOCAB_SYSTEM,
    json: true,
    maxTokens: 1200,
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n学员水平：${level?.prompt || level?.label || "大学四级"}\n大约会 ${level?.known || 4500} 词。\n\n候选（词×出现次数）：\n${list}\n\n例句：\n${samples}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const allowed = new Set(rows.map((t) => t.word));
  const words = (Array.isArray(parsed.words) ? parsed.words : [])
    .map((w) => {
      const word = String(w?.word || "").toLowerCase().trim();
      const src = rows.find((t) => t.word === word);
      return {
        word,
        why: String(w?.why || "").slice(0, 24),
        sentence: src?.sentence || "",
        seconds: src?.seconds || 0,
      };
    })
    .filter((w) => allowed.has(w.word))
    .slice(0, 24);
  return { words };
}

const RESUME_SYSTEM = `学员中途离开又回来。根据字幕和知识块，用三句中文接上。只输出 JSON：
{"where":"上次看到哪，一句，不要时间码","stuck":"可能卡在哪个问题或概念","next":"接下来该听哪一块、听什么"}
每句不超过 28 字。不要客套，不要「欢迎回来」。`;

async function handleResume({ seconds, segments, blocks, title }) {
  const t = Math.max(0, Number(seconds) || 0);
  const nearby = (segments || [])
    .filter((s) => s.start >= t - 40 && s.start <= t + 90)
    .map((s) => `[${clock(s.start)}] ${s.text}`)
    .join("\n")
    .slice(0, 4000);
  const brickLines = (blocks || [])
    .map((b, i) => `${i}. ${clock(b.start)} ${b.title}：${b.summary || ""}`)
    .join("\n")
    .slice(0, 2500);
  const raw = await callAi({
    system: RESUME_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n停在：${clock(t)}\n附近字幕：\n${nearby || "无"}\n知识块：\n${brickLines || "无"}`,
      },
    ],
  });
  const parsed = parseLooseJson(raw);
  return {
    where: String(parsed.where || "").slice(0, 40),
    stuck: String(parsed.stuck || "").slice(0, 40),
    next: String(parsed.next || "").slice(0, 40),
  };
}

const ARG_SYSTEM = `把视频压成一张论证图。只输出 JSON：
{"claim":"中心主张，一句完整的话","supports":[{"id":"s1","text":"一条完整理由","block":0}],"rebuts":[{"id":"r1","text":"限制或反例","block":1}]}
claim 18-36字，理由 16-40字，不要截成半句。supports 3-5 条，rebuts 1-3 条。block 是知识块序号。不要鸡汤。`;

async function handleArgMap({ blocks, title, gist }) {
  const blockLines = (Array.isArray(blocks) ? blocks : [])
    .map((b, i) => `${i}. ${b.title}：${b.summary || ""}`)
    .join("\n");
  const text = await callAi({
    system: ARG_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `视频：${title || ""}\n gist：${gist || ""}\n知识块：\n${blockLines}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const row = (arr, n) =>
    (Array.isArray(arr) ? arr : [])
      .map((x, i) => ({
        id: String(x?.id || `x${i}`).slice(0, 12),
        text: String(x?.text || "").slice(0, 72),
        block: Number.isFinite(Number(x?.block)) ? Number(x.block) : -1,
      }))
      .filter((x) => x.text)
      .slice(0, n);
  const claim = String(parsed.claim || gist || title || "").slice(0, 48);
  if (!claim) throw new Error("论证图没有主张");
  return { claim, supports: row(parsed.supports, 5), rebuts: row(parsed.rebuts, 3) };
}

const FEYNMAN_SYSTEM = `你在对照一份闭卷讲法和材料。你是镜子，不是代写。不许给示范讲法、白话全文、可念的稿。用户必须自己改第二稿。

只输出 JSON：
{
  "solo":"pre|uni|multi|rel|ext",
  "soloWhy":"一句，为什么是这一级，点出他讲法里的证据",
  "gaps":[{"point":"材料里关键、他没讲清或讲错的点","at":"m:ss 或空"}],
  "jargon":[{"word":"他还当行话甩出来的词","plain":"可以怎么跟外行说"}],
  "probe":"一个追问，逼他自己补那个洞。不要替他答。"
}

SOLO：
- pre：几乎没碰到这块，或只重复标题
- uni：只抓住一个点
- multi：列了几个点，但没串起来
- rel：点与点接上了，能说明白为什么
- ext：能换个场景，或指出边界

纪律：
- 事实、数字、例子只许来自材料。没有的不要编。
- 用户没写：不要编讲法。solo 用 pre，gaps 空，probe 写成「先写出你最糊的那一句。」
- 用户写得很短或只写最糊的一句：当最泥点。solo 多半是 pre 或 uni。gaps 围着那个糊点。
- 不要嘲讽，不要客套。gaps 最多 4 条。jargon 最多 4 个。
- at 必须能对上材料附近的时间；对不上就留空。
- 不要标题，不要「本质上 / 值得注意的是」。`;

async function handleFeynman({ block, excerpt, title, take, dive }) {
  const userTake = String(take || "").trim();
  if (!userTake) throw new Error("先自己讲一遍。写不出来就写最糊的那一句。");
  const settings = await getSettings();
  const diveLine = dive?.essence
    ? `\n拆解要点（只作对照，不要写成示范稿）：${dive.essence}${
        dive.parts?.length ? `\n结构：${dive.parts.join("、")}` : ""
      }`
    : "";
  const text = await callAi({
    system: FEYNMAN_SYSTEM,
    json: true,
    maxTokens: 2048,
    temperature: 0.3,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n知识块：${block?.title || ""}\n\n用户自己的讲法：\n${userTake}${diveLine}\n\n材料：\n${String(
          excerpt || "",
        ).slice(0, 5000)}\n\n只判断他会了没有。不要替他重写。`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const soloRaw = String(parsed.solo || "").toLowerCase();
  const solo = ["pre", "uni", "multi", "rel", "ext"].includes(soloRaw) ? soloRaw : "uni";
  const gaps = (Array.isArray(parsed.gaps) ? parsed.gaps : [])
    .map((g) =>
      typeof g === "string"
        ? { point: g.trim().slice(0, 160), at: "" }
        : { point: String(g?.point || "").trim().slice(0, 160), at: String(g?.at || "").trim().slice(0, 8) },
    )
    .filter((g) => g.point)
    .slice(0, 4);
  return {
    solo,
    soloWhy: String(parsed.soloWhy || "").trim().slice(0, 120),
    gaps,
    jargon: (Array.isArray(parsed.jargon) ? parsed.jargon : [])
      .map((j) => ({
        word: String(j?.word || "").trim().slice(0, 40),
        plain: String(j?.plain || "").trim().slice(0, 80),
      }))
      .filter((j) => j.word && j.plain)
      .slice(0, 4),
    probe: String(parsed.probe || "").trim().slice(0, 140),
    clear: [],
    simpler: "",
    next: "",
  };
}


// ---------- 字幕：只走 Supadata（不再先试 YouTube 直连） ----------

/** Same line-merging rule the content script uses for direct captions. */
function mergeSupadataChunks(chunks) {
  const raw = [];
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const text = String(chunk.text || "")
      .replace(/>> ?/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const start = (Number(chunk.offset) || 0) / 1000;
    raw.push({
      start,
      end: start + (Number(chunk.duration) || 0) / 1000,
      text,
    });
  }

  const merged = [];
  let current = null;
  for (const seg of raw) {
    if (!current) {
      current = { ...seg };
      continue;
    }
    const gap = seg.start - current.end;
    const closed =
      /[.!?。！？…]["')\]]?$/.test(current.text) ||
      current.text.length >= 90 ||
      gap > 3.5;
    if (closed) {
      merged.push(current);
      current = { ...seg };
    } else {
      current.text += ` ${seg.text}`;
      current.end = Math.max(current.end, seg.end);
    }
  }
  if (current) merged.push(current);
  return merged.map((seg) => ({
    start: Math.round(seg.start * 10) / 10,
    end: Math.round(seg.end * 10) / 10,
    text: seg.text,
  }));
}

async function biliTranscriptFromMain(tabId, videoId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["site.js"],
    });
    const [shot] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [videoId],
      func: async (id) => {
        try {
          const data = await fetchBiliTranscript(id);
          return { ok: true, ...data };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
    });
    if (shot?.result?.ok && shot.result.segments?.length) return shot.result;
  } catch (_e) {
    /* isolated fallback */
  }
  return null;
}

async function biliTranscriptFromTab(videoId) {
  const tabs = await chrome.tabs.query({
    url: ["*://*.bilibili.com/video/*", "*://*.bilibili.com/list/*", "*://*.bilibili.com/medialist/*"],
  });
  for (const tab of tabs) {
    const here = videoIdFromHref(tab.url);
    if (here && here !== videoId) continue;
    const fromMain = await biliTranscriptFromMain(tab.id, videoId);
    if (fromMain) return fromMain;
    try {
      let res = await chrome.tabs.sendMessage(tab.id, { type: "VB_TRANSCRIPT", videoId }).catch(() => null);
      if (!res) {
        await injectContentScripts(tab.id);
        res = await chrome.tabs.sendMessage(tab.id, { type: "VB_TRANSCRIPT", videoId });
      }
      if (res?.ok && res.segments?.length) {
        return {
          segments: res.segments,
          translations: res.translations || {},
          language: res.language || "",
          trackKind: "bili",
          title: res.title || "",
        };
      }
    } catch (_e) {
      /* next tab */
    }
  }
  return null;
}

async function handleBiliTranscript({ videoId }) {
  const fromPage = await biliTranscriptFromTab(videoId);
  if (fromPage) return fromPage;
  try {
    return await fetchBiliTranscript(videoId);
  } catch (error) {
    throw new Error(error.message || "B 站字幕要先登录。打开这支视频确认能出字幕，再点重试。");
  }
}

async function youtubeTranscriptFromTab(videoId) {
  const stored = await chrome.storage.local.get("vb_watch");
  const tabIds = [];
  if (stored.vb_watch?.tabId && (!stored.vb_watch.videoId || stored.vb_watch.videoId === videoId)) {
    tabIds.push(stored.vb_watch.tabId);
  }
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "*://*.youtube.com/watch*",
        "*://*.youtube.com/shorts/*",
        "*://*.youtube.com/live/*",
        "*://youtube.com/watch*",
        "*://youtu.be/*",
      ],
    });
    for (const tab of tabs) {
      const here = videoIdFromHref(tab.url || tab.pendingUrl || "");
      if (here && here !== videoId) continue;
      if (tab.id && !tabIds.includes(tab.id)) tabIds.push(tab.id);
      if (tabIds.length >= 2) break;
    }
  } catch (_e) {}
  const askTab = (tabId, payload) =>
    Promise.race([
      chrome.tabs.sendMessage(tabId, payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]).catch(() => null);

  for (const tabId of tabIds) {
    try {
      let res = await askTab(tabId, { type: "VB_TRANSCRIPT", videoId });
      if (!res) {
        await injectContentScripts(tabId);
        res = await askTab(tabId, { type: "VB_TRANSCRIPT", videoId });
      }
      if (res?.ok && res.segments?.length) {
        return {
          segments: res.segments,
          translations: res.translations || {},
          language: res.language || "",
          trackKind: res.trackKind || "page",
          title: res.title || "",
          channel: res.channel || "",
        };
      }
    } catch (_e) {
      /* next tab */
    }
  }
  return null;
}

async function fetchSupadataTranscript(videoId, settings) {
  const apiUrl = new URL("https://api.supadata.ai/v1/transcript");
  apiUrl.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  apiUrl.searchParams.set("text", "false");
  apiUrl.searchParams.set("mode", "native");

  let response = await fetch(apiUrl.toString(), {
    headers: { "x-api-key": settings.supadataKey },
  });

  const failSupadata = async (res) => {
    const body = await res.text().catch(() => "");
    if (res.status === 429 || /limit[- ]?exceeded|quota|额度/i.test(body)) {
      throw new Error("字幕额度用完了");
    }
    if (res.status === 401 || /invalid api|unauthorized/i.test(body)) throw new Error("Supadata Key 无效");
    if (res.status === 206) throw new Error("这支视频没有可用字幕");
    throw new Error(`Supadata 请求失败（${res.status}）`);
  };

  if (response.status === 202) {
    const { jobId } = await response.json();
    let data = null;
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const poll = await fetch(
        `https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`,
        { headers: { "x-api-key": settings.supadataKey } },
      );
      if (!poll.ok) await failSupadata(poll);
      data = await poll.json();
      if (data.status === "completed") break;
      if (data.status === "failed") throw new Error("Supadata 转写任务失败");
      data = null;
    }
    if (!data) throw new Error("打开字幕超时了");
    return finishSupadata(data);
  }

  if (!response.ok) await failSupadata(response);
  return finishSupadata(await response.json());
}

function withHardTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function handleSupadataTranscriptWork({ videoId }) {
  if (isBiliId(videoId)) return handleBiliTranscript({ videoId });
  const fromPage = await Promise.race([
    youtubeTranscriptFromTab(videoId),
    new Promise((resolve) => setTimeout(() => resolve(null), 12000)),
  ]);
  if (fromPage) return fromPage;
  const settings = await getSettings();
  let remoteError = "";
  if (settings.supadataKey) {
    try {
      return await fetchSupadataTranscript(videoId, settings);
    } catch (error) {
      remoteError = error.message || "";
    }
  }
  try {
    return await handleDirectTranscript({ videoId });
  } catch (error) {
    if (remoteError) throw new Error(remoteError);
    throw new Error("这支视频自己的字幕读不到。打开视频确认有 CC，或在设置里填 Supadata Key 再试。");
  }
}

async function handleSupadataTranscript({ videoId }) {
  return withHardTimeout(handleSupadataTranscriptWork({ videoId }), 18000, "打开字幕超时了");
}

async function handlePingKeys({ apiKey, supadataKey, baseUrl }) {
  const settings = await getSettings();
  const dsKey = String(apiKey ?? settings.apiKey ?? "").trim();
  const sdKey = String(supadataKey ?? settings.supadataKey ?? "").trim();
  const base = String(baseUrl || settings.baseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const out = { deepseek: { ok: false, error: "" }, supadata: { ok: false, error: "", skipped: false } };
  if (!dsKey) {
    out.deepseek.error = "还没有填 DeepSeek Key";
  } else {
    try {
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${dsKey}` },
      });
      if (res.status === 401) throw new Error("DeepSeek Key 无效");
      if (!res.ok) throw new Error(`DeepSeek 请求失败（${res.status}）`);
      out.deepseek.ok = true;
    } catch (error) {
      out.deepseek.error = error.message || "DeepSeek Key 连不上";
    }
  }
  if (!sdKey) {
    out.supadata.skipped = true;
    out.supadata.ok = true;
  } else {
    try {
      const url = new URL("https://api.supadata.ai/v1/transcript");
      url.searchParams.set("url", "https://www.youtube.com/watch?v=kaizenping");
      url.searchParams.set("mode", "native");
      const res = await fetch(url.toString(), { headers: { "x-api-key": sdKey } });
      if (res.status === 401) throw new Error("Supadata Key 无效");
      if (res.status === 429) throw new Error("字幕额度用完了");
      out.supadata.ok = true;
    } catch (error) {
      out.supadata.error = error.message || "Supadata Key 连不上";
    }
  }
  return out;
}

function finishSupadata(data) {
  const segments = mergeSupadataChunks(data.content);
  if (!segments.length) throw new Error("Supadata 返回的字幕是空的");
  return { segments, language: data.lang || "", trackKind: "supadata" };
}

// ---------- routing ----------

/**
 * Direct caption fetch from the service worker (no content script needed).
 * Uses the Android InnerTube client, then json3 / XML caption bodies.
 */
async function handleDirectTranscript({ videoId }) {
  const id = String(videoId || "").trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error("无效的视频 ID");

  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: id,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US",
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`InnerTube ${res.status}`);
  const player = await res.json();
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  const track =
    (Array.isArray(tracks) ? tracks.find((t) => t.kind !== "asr") : null) ||
    tracks?.[0];
  if (!track?.baseUrl) throw new Error("这支视频没有可用字幕");

  const withFormat = (fmt) => {
    const url = new URL(track.baseUrl, "https://www.youtube.com");
    url.searchParams.delete("fmt");
    if (fmt) url.searchParams.set("fmt", fmt);
    return url.toString();
  };

  let segments = [];
  try {
    const cap = await fetch(withFormat("json3"));
    if (cap.ok) {
      const body = await cap.text();
      if (body.trim()) {
        const events = JSON.parse(body).events || [];
        const raw = [];
        for (const ev of events) {
          if (!Array.isArray(ev.segs)) continue;
          const text = ev.segs
            .map((s) => s.utf8 || "")
            .join("")
            .replace(/\s+/g, " ")
            .trim();
          if (!text) continue;
          const start = (ev.tStartMs || 0) / 1000;
          raw.push({
            start,
            end: start + (ev.dDurationMs || 0) / 1000,
            text,
          });
        }
        segments = mergeSupadataChunks(
          raw.map((s) => ({
            text: s.text,
            offset: s.start * 1000,
            duration: (s.end - s.start) * 1000,
          })),
        );
      }
    }
  } catch (_e) {
    /* fall through to XML */
  }

  if (!segments.length) {
    const cap = await fetch(withFormat(""));
    if (!cap.ok) throw new Error(`字幕请求失败（${cap.status}）`);
    const xml = await cap.text();
    if (!xml.trim()) throw new Error("字幕接口返回空内容");
    const texts = [...xml.matchAll(/<text start="([^"]*)"(?: dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g)];
    const decode = (value) =>
      String(value)
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
    segments = mergeSupadataChunks(
      texts.map((m) => ({
        text: decode(m[3]).replace(/\s+/g, " ").trim(),
        offset: Number(m[1]) * 1000,
        duration: Number(m[2] || 0) * 1000,
      })),
    );
  }

  if (!segments.length) throw new Error("InnerTube 字幕解析失败");
  let translations = {};
  const srcLang = String(track.languageCode || "");
  if (track.isTranslatable !== false && !isZhCaptionLang(srcLang)) {
    translations = await fetchTlangTranslations(track.baseUrl, segments);
  }
  const details = player.videoDetails || {};
  return {
    segments,
    translations,
    language: track.languageCode || "",
    trackKind: track.kind || "manual",
    title: details.title || "",
    channel: details.author || "",
  };
}

async function fetchTlangTranslations(baseUrl, segments) {
  if (!baseUrl || !segments?.length) return {};
  const tlang = typeof captionTlang === "function" ? captionTlang() : "zh-Hans";
  const url = new URL(baseUrl, "https://www.youtube.com");
  url.searchParams.delete("fmt");
  url.searchParams.set("fmt", "json3");
  url.searchParams.set("tlang", tlang);
  try {
    const cap = await fetch(url.toString());
    if (!cap.ok) return {};
    const events = JSON.parse(await cap.text()).events || [];
    const raw = [];
    for (const ev of events) {
      if (!Array.isArray(ev.segs)) continue;
      const text = ev.segs
        .map((s) => s.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const start = (ev.tStartMs || 0) / 1000;
      raw.push({
        text,
        offset: start * 1000,
        duration: ev.dDurationMs || 0,
      });
    }
    const zhSegs = mergeSupadataChunks(raw);
    return alignCaptionTranslations(segments, zhSegs);
  } catch (_e) {
    return {};
  }
}

const EXPORT_SYSTEM = `你是知识笔记编辑。把用户的学习材料整理成一篇可以长期保存的中文笔记。只输出 JSON：
{
  "title":"笔记标题，不要复述原视频名",
  "lede":"80字以内导语，点明这支视频真正值得记住的东西",
  "sections":[{"h":"小节标题","body":"180-360字"}],
  "takeaways":["3-6条可带走的结论"],
  "actions":["1-3件可以去做的事"]
}
规则：
- 用户笔记和金句是主线，拆解只当骨架。不要编造用户没写过的个人感受。
- 禁止鸡汤、赋能、首先其次最后、家人们。
- 写得像一个人学完后整理的笔记，不是课件大纲，不要复述字幕。`;

async function pinBookmark({ videoId, title, seconds, caption }) {
  if (!videoId) return { pinned: false };
  const at = Number(seconds) || 0;
  const stored = await chrome.storage.local.get("vb_marks");
  let list = Array.isArray(stored.vb_marks) ? stored.vb_marks.slice() : [];
  const near = list.find((m) => m.videoId === videoId && Math.abs(Number(m.seconds) - at) <= 4);
  if (near) return { pinned: false, near: true, at: Number(near.seconds) || at };
  const raw = String(caption || "").replace(/\s+/g, " ").trim();
  const mark = {
    id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    videoTitle: title || "",
    seconds: at,
    label: raw.slice(0, 18) || clock(at),
    note: "",
    createdAt: Date.now(),
  };
  list.unshift(mark);
  const here = list.filter((m) => m.videoId === videoId);
  if (here.length > 80) {
    const drop = here.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, here.length - 80);
    const dropIds = new Set(drop.map((m) => m.id));
    list = list.filter((m) => !dropIds.has(m.id));
  }
  if (list.length > 300) {
    list = list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 300);
  }
  await chrome.storage.local.set({ vb_marks: list });
  return { pinned: true, at, id: mark.id };
}

async function handleHotkeyAck(message) {
  const hotkey = message?.hotkey || {};
  let panel = false;
  try {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL"] });
    panel = Array.isArray(ctx) && ctx.length > 0;
  } catch (_e) {}
  if (hotkey.action === "mark" && !panel) {
    const result = await pinBookmark(hotkey);
    return { panel: false, ...result };
  }
  return { panel };
}

async function handleExportEssay({ payload }) {
  const src = payload || {};
  const compact = {
    title: src.title,
    gist: src.gist,
    notes: (src.notes || []).slice(0, 20).map((n) => ({ t: n.text, q: n.quote, at: n.seconds })),
    quotes: (src.quotes || []).slice(0, 16).map((q) => q.text),
    highlights: (src.highlights || []).slice(0, 12).map((h) => h.text),
    study: src.study,
    blocks: (src.blocks || []).map((b, i) => ({
      title: b.title,
      summary: b.summary,
      essence: src.dives?.[i]?.essence || src.dives?.[String(i)]?.essence || "",
    })),
    relations: (src.conceptMap?.edges || []).slice(0, 16).map((e) => `${e.from}->${e.rel}->${e.to}`),
    questions: (src.chat || []).filter((m) => m.role === "user").slice(0, 8).map((m) => m.content),
  };
  const settings = await getSettings();
  const text = await callAi({
    system: EXPORT_SYSTEM,
    json: true,
    maxTokens: 4096,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [{ role: "user", content: JSON.stringify(compact).slice(0, 12000) }],
  });
  const parsed = parseLooseJson(text);
  const title = String(parsed.title || "").slice(0, 40);
  const lede = String(parsed.lede || "").slice(0, 200);
  const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
    .map((s) => ({
      h: String(s?.h || s?.heading || "").slice(0, 40),
      body: String(s?.body || "").slice(0, 800),
    }))
    .filter((s) => s.h && s.body)
    .slice(0, 8);
  if (!lede && !sections.length) {
    throw new Error("这篇没写出来，再试一次。");
  }
  return {
    title,
    lede,
    sections,
    takeaways: (Array.isArray(parsed.takeaways) ? parsed.takeaways : [])
      .map((t) => String(t).slice(0, 120))
      .filter(Boolean)
      .slice(0, 6),
    actions: (Array.isArray(parsed.actions) ? parsed.actions : [])
      .map((t) => String(t).slice(0, 120))
      .filter(Boolean)
      .slice(0, 3),
  };
}

const VISUAL_SYSTEM = `把一个知识块压成可视化结构。只输出 JSON。句子要完整，不要写成半截。
用户指定 kind：
- info: {"title":"","kicker":"4字以内","lede":"一句导语","pills":["短语"],"rows":[{"h":"小标题","b":"一句说明"}],"callout":"一句收束"}
- mind: {"title":"","center":"中心词","nodes":[{"id":"n1","label":"完整短语"}]}
- flow: {"title":"","steps":[{"n":1,"h":"步骤名","b":"一句说明"}]}
规则：pills 3-4，rows 3-5，nodes 5-7，steps 4-6。title/lede/h/b 都写完整，不要用省略号。不要复述字幕。`;

async function handleVisual({ kind, block, dive, title, excerpt }) {
  const allowed = kind === "mind" || kind === "flow" ? kind : "info";
  const settings = await getSettings();
  const text = await callAi({
    system: VISUAL_SYSTEM,
    json: true,
    maxTokens: 1200,
    model: settings.model || "deepseek-v4-flash",
    messages: [
      {
        role: "user",
        content: `kind=${allowed}\n视频：${title || ""}\n块：${block?.title || ""} ${block?.summary || ""}\n拆解：${JSON.stringify({
          kind: dive?.kind || "",
          essence: dive?.essence || "",
          parts: dive?.parts || [],
          encode: dive?.encode || [],
          retrieve: dive?.retrieve || [],
          gap: dive?.gap || "",
        }).slice(0, 1800)}\n摘录：${String(excerpt || "").slice(0, 1200)}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  if (allowed === "mind") {
    return {
      spec: {
        title: String(parsed.title || block?.title || "").slice(0, 40),
        center: String(parsed.center || block?.title || "").slice(0, 20),
        nodes: (Array.isArray(parsed.nodes) ? parsed.nodes : [])
          .map((n, i) => ({ id: String(n?.id || `n${i}`), label: String(n?.label || "").slice(0, 20) }))
          .filter((n) => n.label)
          .slice(0, 8),
      },
    };
  }
  if (allowed === "flow") {
    return {
      spec: {
        title: String(parsed.title || block?.title || "").slice(0, 40),
        steps: (Array.isArray(parsed.steps) ? parsed.steps : [])
          .map((s, i) => ({
            n: i + 1,
            h: String(s?.h || "").slice(0, 28),
            b: String(s?.b || "").slice(0, 80),
          }))
          .filter((s) => s.h || s.b)
          .slice(0, 6),
      },
    };
  }
  return {
    spec: {
      title: String(parsed.title || block?.title || "").slice(0, 40),
      kicker: String(parsed.kicker || "").slice(0, 12),
      lede: String(parsed.lede || block?.summary || "").slice(0, 120),
      pills: (Array.isArray(parsed.pills) ? parsed.pills : []).map((p) => String(p).slice(0, 16)).filter(Boolean).slice(0, 6),
      rows: (Array.isArray(parsed.rows) ? parsed.rows : [])
        .map((r) => ({ h: String(r?.h || "").slice(0, 28), b: String(r?.b || "").slice(0, 80) }))
        .filter((r) => r.h)
        .slice(0, 5),
      callout: String(parsed.callout || "").slice(0, 80),
    },
  };
}

const GOLD_QUOTE_SYSTEM = `从带时间戳的字幕里，按时间顺序列出这场论证自己的承重句。不是好听，是这句话离开这支视频会变瘸。

什么才算：
- 说话人亲口说的原句（可去掉 um / you know / 那个）
- 单独读能猜出是哪一场：有人名、数字、机制、对立面、这讲者才用的切口
- 论证拐弯、定义翻案、案例收口、反常识判断的那一句

什么不算：
- 「可以带走」「点明本质」这类去语境鸡汤
- 哪支视频都套得上的判断
- 过渡、自我介绍、预告、把标题再说一遍
- 你自己总结的「作者认为…」「本视频讲述…」
- 模型润色后的漂亮句子

必须中英对照：
- 原句是英文：en 几乎照抄字幕，zh 译成自然中文
- 原句是中文：zh 几乎照抄字幕，en 译成自然英文
- at 用字幕里能对上的时间，如 12:30

只输出 JSON：
{"quotes":[{"at":"12:30","en":"...","zh":"...","why":"这句话在这场里承什么重量"}]}

目标 4 到 8 句，按时间从早到晚。整场都是闲聊才交空数组。why 用中文，不超过 36 字。`;

async function handleGoldQuotes({ segments, title }) {
  const settings = await getSettings();
  const text = await callAi({
    system: GOLD_QUOTE_SYSTEM,
    json: true,
    maxTokens: 2400,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n按时间顺序列出承重原话。\n\n字幕：\n${compactTranscript(segments, 12000)}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const quotes = (Array.isArray(parsed.quotes) ? parsed.quotes : [])
    .map((q) => ({
      at: String(q?.at || "").slice(0, 12),
      en: String(q?.en || "").replace(/\s+/g, " ").trim().slice(0, 280),
      zh: String(q?.zh || "").replace(/\s+/g, " ").trim().slice(0, 280),
      why: String(q?.why || "").slice(0, 48),
    }))
    .filter((q) => q.en || q.zh)
    .slice(0, 8);
  return { quotes };
}

const HANDLERS = {
  vbSegment: handleSegment,
  vbDeepDive: handleDeepDive,
  vbAsk: handleAsk,
  vbTranslate: handleTranslate,
  vbSupadata: handleSupadataTranscript,
  vbPingKeys: handlePingKeys,
  vbDirectTranscript: handleDirectTranscript,
  vbDefine: handleDefineWord,
  vbStudy: handleStudyPack,
  vbConceptMap: handleConceptMap,
  vbArgMap: handleArgMap,
  vbScript: handleFeynman,
  vbFeynman: handleFeynman,
  vbExportEssay: handleExportEssay,
  vbVisual: handleVisual,
  vbCloze: handleCloze,
  vbRecall: handleRecall,
  vbAtlas: handleAtlas,
  vbGoldQuotes: handleGoldQuotes,
  vbResume: handleResume,
  vbScanVocab: handleScanVocab,
  vbHotkey: handleHotkeyAck,
  vbKouling: handleKouling,
  vbFindWatch: handleFindWatch,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "vbTick") {
    if (sender.tab) rememberWatch(sender.tab, message.videoId);
    const payload = { ...message, tabId: sender.tab?.id };
    for (const port of followPorts) {
      try {
        port.postMessage(payload);
      } catch (_e) {}
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message?.action === "vbReload") {
    reloadKaizen();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.action === "vbOpenPanel") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "no tab" });
      return false;
    }
    const url = message.url || tabHref(sender.tab);
    const videoId = message.videoId || videoIdFromHref(url) || "";
    const snap = {
      id: tabId,
      tabId,
      url,
      title: message.title || sender.tab?.title || "",
      videoId,
      at: Date.now(),
      active: true,
      lastAccessed: Date.now(),
    };
    chrome.storage.local.set({ vb_watch: snap, vb_click: snap }).catch(() => {});
    openSidePanelSafe(sender.tab)
      .then((ok) => sendResponse(ok ? { ok: true, panel: true } : { ok: false, error: "side panel" }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  const handler = HANDLERS[message?.action];
  if (!handler) return false;
  handler(message)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) =>
      sendResponse({ ok: false, error: error.message, code: error.code }),
    );
  return true; // async
});
