// VideoBricks service worker — owns every AI call.
// The panel sends transcripts/questions here; prompts live inline below.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

const DEFAULT_SETTINGS = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  diveModel: "deepseek-v4-pro",
  supadataKey: "",
};

async function getSettings() {
  const stored = await chrome.storage.local.get("vb_settings");
  return { ...DEFAULT_SETTINGS, ...(stored.vb_settings || {}) };
}

/** Strips markdown fences and parses the first JSON object/array found. */
function parseLooseJson(text) {
  const cleaned = String(text || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    const start = cleaned.search(/[[{]/);
    if (start < 0) throw new Error("AI 返回的不是 JSON");
    const open = cleaned[start];
    const close = open === "{" ? "}" : "]";
    const end = cleaned.lastIndexOf(close);
    if (end <= start) throw new Error("AI 返回的 JSON 不完整");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

async function callAi({ system, messages, json = false, maxTokens = 4096, model }) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    const err = new Error("还没有配置 DeepSeek Key，请先完成初始设置");
    err.code = "NO_KEY";
    throw err;
  }

  const res = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: model || settings.model || "deepseek-v4-flash",
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 请求失败（${res.status}）${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI 返回为空");
  return text;
}

// ---------- helpers ----------

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "[m:ss] line" transcript, truncated from the middle to keep both ends. */
function compactTranscript(segments, maxChars = 14000) {
  const lines = (segments || []).map((s) => `[${clock(s.start)}] ${s.text}`);
  let joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  const head = Math.floor(maxChars * 0.65);
  const tail = maxChars - head;
  return `${joined.slice(0, head)}\n…（中段字幕省略）…\n${joined.slice(-tail)}`;
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

async function handleSegment({ segments, title, durationSeconds }) {
  const text = await callAi({
    system: SEGMENT_SYSTEM,
    json: true,
    messages: [
      {
        role: "user",
        content: `视频标题：${title || "未知"}\n视频总长：${Math.round(durationSeconds || 0)} 秒\n\n字幕：\n${compactTranscript(segments)}`,
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

// ---------- 2. 知识管理式拆解（默认走 Pro，追求信息增量） ----------

const DEEP_DIVE_SYSTEM = `你是知识管理教练，不是视频复述机。学员卡在一个视频片段上，你要把这段话变成可内化、可检索、可调用的知识。

禁止：
- 用自己的话把字幕再说一遍，或改写块标题交差
- 「很重要 / 需要理解 / 本质上」后面没有新判断
- 罗列学员听一遍就懂、视频已经说清的句子

必须有信息增量：
- 把隐含结构显性化：这段知识通常由哪几部分组成、部分之间什么关系
- 给出编码（怎么记进长期记忆）和提取（什么信号出现时该调出来用）
- 指出听完仍不会用的缺口；视频外补充在句前加 [补充]

用现代口语化简体中文，称「你」。英文专有名词保留英文。只输出 JSON：
{
  "essence": "这块到底是哪一类知识 + 一句话定义，不要重复块标题",
  "parts": [{"name":"组成部分","role":"它在整体里干什么","ifMissing":"缺了它会怎样"}],
  "map": "用文字画出结构：A → B → C，或一行对比",
  "encode": ["2-4 条可执行的记忆法：组块、类比、口诀、图像，要具体"],
  "retrieve": ["2-4 个真实情境：什么信号出现时该调用这知识"],
  "connect": ["和常见相关知识怎么挂钩；没有就空数组"],
  "gap": "视频没讲清、但内化时必须补的一点",
  "owned": "怎样才算真正学会：一个你能独立完成的检验"
}
parts 2-5 个。每条短、具体、有判断。`;

async function handleDeepDive({ block, segments, videoTitle }) {
  const excerpt = excerptBetween(segments, block.start, block.end);
  if (excerpt.length < 40) throw new Error("这一块的字幕太少，拆不动");
  const settings = await getSettings();
  const text = await callAi({
    system: DEEP_DIVE_SYSTEM,
    json: true,
    maxTokens: 6144,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [
      {
        role: "user",
        content: `视频标题：${videoTitle || "未知"}\n知识块：${block.title}（${clock(block.start)} - ${clock(block.end)}）\n块摘要：${block.summary}\n\n字幕摘录：\n${excerpt}\n\n不要复述上面的字幕。只输出把这知识装进脑子所需的结构。`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const list = (v, n, len) =>
    (Array.isArray(v) ? v : [])
      .map((item) => String(typeof item === "object" ? JSON.stringify(item) : item).slice(0, len))
      .filter(Boolean)
      .slice(0, n);
  const parts = (Array.isArray(parsed.parts) ? parsed.parts : [])
    .map((p) => ({
      name: String(p?.name || "").slice(0, 40),
      role: String(p?.role || "").slice(0, 200),
      ifMissing: String(p?.ifMissing || "").slice(0, 160),
    }))
    .filter((p) => p.name && p.role)
    .slice(0, 5);
  return {
    essence: String(parsed.essence || "").slice(0, 200),
    parts,
    map: String(parsed.map || "").slice(0, 280),
    encode: list(parsed.encode, 4, 200),
    retrieve: list(parsed.retrieve, 4, 200),
    connect: list(parsed.connect, 4, 160),
    gap: String(parsed.gap || "").slice(0, 240),
    owned: String(parsed.owned || "").slice(0, 200),
    // 旧缓存字段仍返回空，避免旧渲染报错
    prereq: list(parsed.prereq, 4, 160),
    concepts: (Array.isArray(parsed.concepts) ? parsed.concepts : [])
      .map((c) => ({
        term: String(c?.term || "").slice(0, 60),
        def: String(c?.def || "").slice(0, 300),
      }))
      .filter((c) => c.term && c.def)
      .slice(0, 4),
    mechanism: list(parsed.mechanism, 7, 240),
    examples: list(parsed.examples, 4, 240),
    pitfalls: list(parsed.pitfalls, 4, 240),
    summary: String(parsed.summary || "").slice(0, 160),
    selfTest: list(parsed.selfTest, 3, 160),
  };
}

// ---------- 3. AI 问视频 ----------

const ASK_SYSTEM = `你是这支视频的"驻场答疑官"。观众会针对视频内容提问，你只根据提供的字幕材料回答。

规则：
- 答案在字幕里：直接回答，并标注出处时间点，格式 [m:ss]，观众可以点它跳转。
- 字幕里没有：明确说"视频里没讲这个"，可以补充一两句你自己的知识，但要声明"以下是视频外的补充"。
- 观众引用了具体片段或划线内容时，围绕那段回答，不要跑题。
- 现代口语化简体中文，直接、简短，一般 3-6 句。英文专有名词保留英文。`;

async function handleAsk({ question, contextText, history }) {
  const messages = [
    ...(Array.isArray(history) ? history.slice(-8) : []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 2000),
    })),
    {
      role: "user",
      content: `【字幕材料】\n${String(contextText || "").slice(0, 13000)}\n\n【问题】\n${String(question || "").slice(0, 1000)}`,
    },
  ];
  const text = await callAi({ system: ASK_SYSTEM, messages, maxTokens: 2048 });
  return { answer: text.trim() };
}

// ---------- 4. 双语字幕翻译 ----------

const TRANSLATE_SYSTEM = `把编号的视频字幕逐行翻译成简体中文。口语、自然、忠实原意；英文专有名词和常用技术词保留英文。行数必须与输入一致，不要合并或拆分。

只输出 JSON，不要 markdown 围栏：{"t":["第1行译文","第2行译文"]}`;

async function handleTranslate({ lines }) {
  const input = (Array.isArray(lines) ? lines : [])
    .slice(0, 40)
    .map((line, i) => `${i + 1}. ${String(line).slice(0, 500)}`)
    .join("\n");
  const text = await callAi({
    system: TRANSLATE_SYSTEM,
    json: true,
    messages: [{ role: "user", content: input }],
  });
  const parsed = parseLooseJson(text);
  const out = Array.isArray(parsed.t) ? parsed.t.map((s) => String(s)) : [];
  if (!out.length) throw new Error("翻译结果为空");
  return { translations: out };
}

// ---------- 学习词典 / 学习包 / 口播稿 ----------

const DEFINE_SYSTEM = `你是给中文学习者用的英语学习词典（朗文/牛津风格）。只输出 JSON，不要 markdown 围栏：
{
  "phonetic": "/ˈlev.ər.ɪdʒ/",
  "senses": [{"pos":"v.","en":"plain-English B1 definition","zh":"中文释义"}],
  "usage": "常见搭配或语域（中文，可含英文搭配）",
  "examples": [{"en":"English sentence.","zh":"中文翻译。"}],
  "inContext": "它在这句字幕里的具体意思"
}
音标用美式 IPA。senses 1-3 个。examples 正好 3 条，不要抄字幕。`;

async function handleDefineWord({ word, sentence, videoTitle }) {
  const trimmed = String(word || "").trim();
  if (!trimmed || trimmed.length > 60) throw new Error("无效的词");
  const text = await callAi({
    system: DEFINE_SYSTEM,
    json: true,
    maxTokens: 1024,
    messages: [
      {
        role: "user",
        content: `Word: ${trimmed}\nSubtitle: ${String(sentence || "None").slice(0, 500)}\nVideo: ${videoTitle || "Unknown"}`,
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

const STUDY_SYSTEM = `根据带时间戳的字幕，为中文学习者做一份学习包。只输出 JSON：
{
  "recap": ["三句以内的关键词复述，中文"],
  "keywords": [{"word":"English","gloss":"中文释义"}],
  "questions": [{"q":"带着去视频里找答案的问题","at":"m:ss"}]
}
keywords 5-8 个，questions 4-6 个。at 尽量对应字幕时间。不要编造字幕里没有的事实。`;

async function handleStudyPack({ segments, title }) {
  const lines = (segments || [])
    .map((s) => `[${clock(s.start)}] ${s.text}`)
    .join("\n")
    .slice(0, 14000);
  const text = await callAi({
    system: STUDY_SYSTEM,
    json: true,
    messages: [{ role: "user", content: `标题：${title || "未知"}\n\n${lines}` }],
  });
  const parsed = parseLooseJson(text);
  const list = (arr, n, map) =>
    (Array.isArray(arr) ? arr : []).map(map).filter((x) => x.word || x.q || typeof x === "string").slice(0, n);
  return {
    recap: (Array.isArray(parsed.recap) ? parsed.recap : [])
      .map((s) => String(s).slice(0, 80))
      .filter(Boolean)
      .slice(0, 3),
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
- 概念是名词或名词短语，6字以内。不要章节名、不要「第一部分」。
- level 0 最上位、最一般，画在最顶；数字越大越具体、越靠下。用 0-3 层。
- 每条 proposition 的 link 是连接词/连接短语（是、需要、导致、属于、用于、不同于），2-6字。
- 上下层级的边 cross=false；跨分支的交叉连接 cross=true，至少 1 条，至多 4 条。
- 概念 8-16 个。每条边两端都必须是已有概念。
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
      label: String(n?.label || "").slice(0, 16),
      level: Math.max(0, Math.min(3, Number(n?.level) || 0)),
      block: Number.isFinite(Number(n?.block)) ? Number(n.block) : -1,
    }))
    .filter((n) => n.id && n.label)
    .slice(0, 16);
  const ids = new Set(concepts.map((n) => n.id));
  const propositions = (Array.isArray(parsed.propositions) ? parsed.propositions : parsed.edges || [])
    .map((e) => ({
      from: String(e?.from || ""),
      link: String(e?.link || e?.rel || "").slice(0, 10),
      to: String(e?.to || ""),
      cross: Boolean(e?.cross),
    }))
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && e.link)
    .slice(0, 28);
  if (!concepts.length || !propositions.length) throw new Error("概念图缺少命题");
  return {
    focusQuestion: String(parsed.focusQuestion || "这支视频在讲什么？").slice(0, 40),
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
规则：同义概念合并成一条；level 0 最一般；跨视频的边 cross=true；概念 8-18 个；连接词 2-6 字。不要章节名。`;

async function handleAtlas({ current, atlas, title }) {
  const cur = Array.isArray(current?.concepts) ? current.concepts : [];
  const old = Array.isArray(atlas?.concepts) ? atlas.concepts : [];
  const curLines = cur.map((c) => `${c.id}:${c.label}`).join("、");
  const oldLines = old
    .slice(0, 40)
    .map((c) => `${c.id}:${c.label}（${(c.sources || []).map((s) => s.title).filter(Boolean).slice(0, 2).join(" / ")}）`)
    .join("\n");
  const settings = await getSettings();
  const text = await callAi({
    system: ATLAS_SYSTEM,
    json: true,
    model: settings.diveModel || settings.model,
    messages: [
      {
        role: "user",
        content: `当前视频：${title || "未知"}\n当前概念：${curLines || "无"}\n\n已有总图：\n${oldLines || "空"}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
    .map((n) => ({
      id: String(n?.id || "").slice(0, 20),
      label: String(n?.label || "").slice(0, 16),
      level: Math.max(0, Math.min(3, Number(n?.level) || 0)),
    }))
    .filter((n) => n.id && n.label)
    .slice(0, 18);
  const ids = new Set(concepts.map((n) => n.id));
  const propositions = (Array.isArray(parsed.propositions) ? parsed.propositions : [])
    .map((e) => ({
      from: String(e?.from || ""),
      link: String(e?.link || "").slice(0, 10),
      to: String(e?.to || ""),
      cross: Boolean(e?.cross),
    }))
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && e.link)
    .slice(0, 32);
  if (!concepts.length) throw new Error("总图是空的");
  return {
    focusQuestion: String(parsed.focusQuestion || "这些视频在讲什么？").slice(0, 40),
    concepts,
    propositions,
  };
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
{"claim":"中心主张，不超过22字","supports":[{"id":"s1","text":"一条理由","block":0}],"rebuts":[{"id":"r1","text":"限制或反例","block":1}]}
supports 3-5 条，rebuts 1-3 条。block 是知识块序号。不要鸡汤。`;

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
        text: String(x?.text || "").slice(0, 40),
        block: Number.isFinite(Number(x?.block)) ? Number(x.block) : -1,
      }))
      .filter((x) => x.text)
      .slice(0, n);
  const claim = String(parsed.claim || gist || title || "").slice(0, 28);
  if (!claim) throw new Error("论证图没有主张");
  return { claim, supports: row(parsed.supports, 5), rebuts: row(parsed.rebuts, 3) };
}

const SCRIPT_PURPOSE = {
  retell: "复述给自己：合上材料之后讲给自己听。不要短视频腔，不要关注、点赞、收藏。",
  teach: "讲给一个人：对面坐着一个聪明但没看过这视频的人，你要让他听懂你的判断。",
  short: "发短视频：前两句必须留人，句子短，一口气能说完。不要「大家好」「家人们」。",
};

const SCRIPT_TONE = {
  talk: "对一个人说，像聊天。用你、那、其实、你看、说白了。",
  calm: "冷静、清楚、少情绪词。把一件事摊开讲明白。",
  sharp: "有判断、有锋芒，但不骂人、不贩卖焦虑。",
};

const SCRIPT_OPEN = {
  take: "第一句就要像用户自己在开口，从他的理解进，不要先总结视频。",
  hook: "先用一句反常识或痛点钩子（不超过 20 字），再进入正文。",
  scene: "从一句具体场景进，不要抽象开头。",
  none: "不要单独钩子。hook 输出空字符串，直接进入正文。",
};

const SCRIPT_CLOSE = {
  one: "收成一句判断或金句。不要行动号召。",
  cta: "结尾一句下一步：记住、去做、或下次怎么用。不要求点赞、关注。",
  none: "说完就停。cta 输出空字符串，不要总结腔。",
};

function scriptSystemPrompt(prefs) {
  const chars = Math.min(600, Math.max(60, Number(prefs?.chars) || 200));
  const min = Math.round(chars * 0.85);
  const max = Math.round(chars * 1.15);
  const secs = Math.max(12, Math.round(chars / 4.5));
  const purpose = SCRIPT_PURPOSE[prefs?.purpose] || SCRIPT_PURPOSE.teach;
  const tone = SCRIPT_TONE[prefs?.tone] || SCRIPT_TONE.talk;
  const open = SCRIPT_OPEN[prefs?.open] || SCRIPT_OPEN.take;
  const close = SCRIPT_CLOSE[prefs?.close] || SCRIPT_CLOSE.one;
  return `你是口播写手，不是总结器。把一块视频材料写成能读出声的稿。

约束：
- 现代口语化简体中文。对一个人说。英文专有名词保留英文。
- 一句一事，多数句子不超过 20 字。禁用：首先、其次、综上所述、赋能、闭环、抓手、干货、家人们、大家好、今天我们来聊聊。
- 事实只许来自「材料」。角度、取舍、口气跟「用户的理解」。用户强调的要写进骨头里；用户没说的观点不要硬加。
- 用户理解和材料冲突时：事实跟材料，立场跟用户，写得像他想通了，而不是在纠正他。
- 不要编数字、例子、出处。

篇幅：正文（script）写 ${chars} 字左右，必须落在 ${min}–${max} 个汉字（不计空白）。按大约 ${secs} 秒能说完来写。
用途：${purpose}
语气：${tone}
开场：${open}
结尾：${close}

只输出 JSON：
{"hook":"开场，可空","script":"口播正文","cta":"结尾，可空"}`;
}

async function handleScript({ block, excerpt, title, take, dive, prefs }) {
  const chars = Math.min(600, Math.max(60, Number(prefs?.chars) || 200));
  const settings = await getSettings();
  const userTake = String(take || "").trim();
  const diveLine = dive?.essence
    ? `\n拆解要点：${dive.essence}${dive.parts?.length ? `\n结构：${dive.parts.join("、")}` : ""}`
    : "";
  const text = await callAi({
    system: scriptSystemPrompt(prefs),
    json: true,
    maxTokens: 4096,
    model: settings.diveModel || "deepseek-v4-pro",
    messages: [
      {
        role: "user",
        content: `视频：${title || "未知"}\n知识块：${block?.title || ""}\n\n用户的理解：\n${
          userTake || "（用户没写。仍要像人在说，不要写成摘要。）"
        }${diveLine}\n\n材料：\n${String(excerpt || "").slice(0, 5000)}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  const limit = chars + 80;
  return {
    hook: String(parsed.hook || "").slice(0, 48),
    script: String(parsed.script || "").slice(0, limit),
    cta: String(parsed.cta || "").slice(0, 80),
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

async function handleSupadataTranscript({ videoId }) {
  const settings = await getSettings();
  if (!settings.supadataKey) {
    throw new Error("还没有配置 Supadata Key，请先完成初始设置");
  }

  const apiUrl = new URL("https://api.supadata.ai/v1/transcript");
  apiUrl.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  apiUrl.searchParams.set("text", "false");
  apiUrl.searchParams.set("mode", "native");

  let response = await fetch(apiUrl.toString(), {
    headers: { "x-api-key": settings.supadataKey },
  });

  // Long videos return 202 + a job id; poll until it completes.
  if (response.status === 202) {
    const { jobId } = await response.json();
    let data = null;
    for (let i = 0; i < 24; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const poll = await fetch(
        `https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`,
        { headers: { "x-api-key": settings.supadataKey } },
      );
      if (!poll.ok) throw new Error(`Supadata 任务查询失败（${poll.status}）`);
      data = await poll.json();
      if (data.status === "completed") break;
      if (data.status === "failed") throw new Error("Supadata 转写任务失败");
      data = null;
    }
    if (!data) throw new Error("Supadata 任务超时（60 秒）");
    return finishSupadata(data);
  }

  if (response.status === 206) throw new Error("Supadata：这支视频没有原生字幕轨");
  if (response.status === 401) throw new Error("Supadata Key 无效");
  if (!response.ok) throw new Error(`Supadata 请求失败（${response.status}）`);
  return finishSupadata(await response.json());
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
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
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
  if (!track?.baseUrl) throw new Error("InnerTube：无字幕轨");

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
  const details = player.videoDetails || {};
  return {
    segments,
    language: track.languageCode || "",
    trackKind: track.kind || "manual",
    title: details.title || "",
    channel: details.author || "",
  };
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
  return {
    title: String(parsed.title || "").slice(0, 40),
    lede: String(parsed.lede || "").slice(0, 200),
    sections: (Array.isArray(parsed.sections) ? parsed.sections : [])
      .map((s) => ({
        h: String(s?.h || s?.heading || "").slice(0, 40),
        body: String(s?.body || "").slice(0, 800),
      }))
      .filter((s) => s.h && s.body)
      .slice(0, 8),
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

const VISUAL_SYSTEM = `把一个知识块压成可视化结构。只输出 JSON，词要短。
用户指定 kind：
- info: {"title":"","kicker":"4字以内","lede":"不超过36字","pills":["短词"],"rows":[{"h":"6字内","b":"18字内"}],"callout":"一句收束"}
- mind: {"title":"","center":"中心词","nodes":[{"id":"n1","label":"6字内"}]}
- flow: {"title":"","steps":[{"n":1,"h":"6字内","b":"18字内"}]}
规则：pills 3-4，rows 3-5，nodes 5-7，steps 4-6。不要段落，不要复述字幕。`;

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
          essence: dive?.essence || "",
          parts: dive?.parts || [],
          encode: dive?.encode || [],
        }).slice(0, 1800)}\n摘录：${String(excerpt || "").slice(0, 1200)}`,
      },
    ],
  });
  const parsed = parseLooseJson(text);
  if (allowed === "mind") {
    return {
      spec: {
        title: String(parsed.title || block?.title || "").slice(0, 24),
        center: String(parsed.center || block?.title || "").slice(0, 10),
        nodes: (Array.isArray(parsed.nodes) ? parsed.nodes : [])
          .map((n, i) => ({ id: String(n?.id || `n${i}`), label: String(n?.label || "").slice(0, 10) }))
          .filter((n) => n.label)
          .slice(0, 8),
      },
    };
  }
  if (allowed === "flow") {
    return {
      spec: {
        title: String(parsed.title || block?.title || "").slice(0, 24),
        steps: (Array.isArray(parsed.steps) ? parsed.steps : [])
          .map((s, i) => ({
            n: i + 1,
            h: String(s?.h || "").slice(0, 12),
            b: String(s?.b || "").slice(0, 40),
          }))
          .filter((s) => s.h || s.b)
          .slice(0, 6),
      },
    };
  }
  return {
    spec: {
      title: String(parsed.title || block?.title || "").slice(0, 24),
      kicker: String(parsed.kicker || "").slice(0, 8),
      lede: String(parsed.lede || block?.summary || "").slice(0, 80),
      pills: (Array.isArray(parsed.pills) ? parsed.pills : []).map((p) => String(p).slice(0, 8)).filter(Boolean).slice(0, 4),
      rows: (Array.isArray(parsed.rows) ? parsed.rows : [])
        .map((r) => ({ h: String(r?.h || "").slice(0, 12), b: String(r?.b || "").slice(0, 40) }))
        .filter((r) => r.h)
        .slice(0, 5),
      callout: String(parsed.callout || "").slice(0, 40),
    },
  };
}

const HANDLERS = {
  vbSegment: handleSegment,
  vbDeepDive: handleDeepDive,
  vbAsk: handleAsk,
  vbTranslate: handleTranslate,
  vbSupadata: handleSupadataTranscript,
  vbDefine: handleDefineWord,
  vbStudy: handleStudyPack,
  vbConceptMap: handleConceptMap,
  vbArgMap: handleArgMap,
  vbScript: handleScript,
  vbExportEssay: handleExportEssay,
  vbVisual: handleVisual,
  vbCloze: handleCloze,
  vbRecall: handleRecall,
  vbAtlas: handleAtlas,
  vbResume: handleResume,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = HANDLERS[message?.action];
  if (!handler) return false;
  handler(message)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) =>
      sendResponse({ ok: false, error: error.message, code: error.code }),
    );
  return true; // async
});
