import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteSrc = fs.readFileSync(path.join(root, "site.js"), "utf8");
const wordLevel = fs.readFileSync(path.join(root, "word-level.js"), "utf8");
const freqSrc = fs.readFileSync(path.join(root, "packs", "english-freq.txt"), "utf8");
const ctx = { URL, console };
vm.createContext(ctx);
vm.runInContext(siteSrc, ctx);

const {
  videoIdFromHref,
  sortWatchTabs,
  pickPollVideoId,
  shouldWriteWatch,
  shouldAdoptOpenWatch,
  watchAdoptDecision,
  markFaceUrl,
  formatClock,
  parseClockInput,
  sameAsSource,
  pickTranslateRows,
  usableTranslation,
  TRANSLATE_BATCH,
  alignCaptionTranslations,
  captionTlang,
} = ctx;

function opened(extra = {}) {
  return { videoId: "abc123", tabId: 11, segments: 40, loadingVideoId: null, ...extra };
}

// --- URL 认片 ---
assert.equal(videoIdFromHref("https://www.youtube.com/watch?v=abc123"), "abc123");
assert.equal(videoIdFromHref("https://youtu.be/abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube.com/shorts/abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube.com/embed/abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube.com/live/abc123"), "abc123");
assert.equal(videoIdFromHref("https://youtu.be/abc123?t=90"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube-nocookie.com/embed/abc123"), "abc123");
assert.equal(videoIdFromHref("https://m.youtube.com/watch?v=abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.bilibili.com/video/BV1xx411c7mD"), "BV1xx411c7mD");
assert.equal(videoIdFromHref("https://www.bilibili.com/video/BV1xx411c7mD?p=3"), "BV1xx411c7mD:p3");
assert.equal(videoIdFromHref("https://www.bilibili.com/video/av170001"), "av170001");

// --- 轮询必须信页面里的 videoId，不能信可能过期的地址栏 ---
assert.equal(pickPollVideoId("oldId", { videoId: "newId" }), "newId");
assert.equal(pickPollVideoId("oldId", { videoId: "newId", ad: true }), "");
assert.equal(pickPollVideoId("hrefId", {}), "hrefId");

// --- 同 tab、同片、同地址：不要因为时间戳重写 vb_watch ---
const snap = {
  tabId: 11,
  videoId: "abc123",
  url: "https://www.youtube.com/watch?v=abc123",
};
assert.equal(shouldWriteWatch({ ...snap, at: 1 }, { ...snap, at: 999999 }), false);
assert.equal(shouldWriteWatch({ ...snap, at: 1 }, { ...snap, videoId: "other", at: 2 }), true);
assert.equal(shouldWriteWatch(null, snap), true);
assert.equal(
  shouldWriteWatch(
    { tabId: 22, videoId: "keep", url: "https://www.youtube.com/watch?v=keep" },
    { tabId: 11, videoId: "", url: "https://www.youtube.com/watch?v=abc123" },
  ),
  false,
);

assert.equal(shouldAdoptOpenWatch({ videoId: "abc123", at: Date.now() - 1000 }), false);
assert.equal(shouldAdoptOpenWatch({ videoId: "abc123", at: Date.now() - 120000 }), true);

// --- 已打开时，别的标签不许抢 ---
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 22, source: "poll" }, opened()),
  "skip-opened",
);
assert.equal(
  watchAdoptDecision({ videoId: "abc123", tabId: 22, source: "poll" }, opened()),
  "keep",
);
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 11, source: "poll" }, opened()),
  "open",
);
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 22, source: "storage" }, opened()),
  "skip-opened",
);
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 22, source: "user" }, opened()),
  "open",
);
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 22, force: true }, opened()),
  "open",
);
assert.equal(watchAdoptDecision({ videoId: "abc123", ad: true }, opened()), "skip-ad");
assert.equal(watchAdoptDecision({ videoId: "xyz" }, { loadingVideoId: "xyz", segments: 0 }), "skip-loading");
assert.equal(watchAdoptDecision({ videoId: "fresh", tabId: 9, source: "poll" }, { segments: 0 }), "open");
assert.equal(watchAdoptDecision({ unavailable: true, videoId: "dead" }, opened()), "clear");
assert.equal(watchAdoptDecision({ watchPage: true }, opened()), "clear");
assert.equal(
  watchAdoptDecision({ videoId: "other", tabId: 22, source: "poll", activeWatch: true }, opened()),
  "open",
);
assert.equal(formatClock(5400), "1:30:00");
assert.equal(formatClock(90), "1:30");
assert.equal(parseClockInput("1:30:00"), 5400);
assert.equal(parseClockInput("1:30"), 90);
assert.equal(sameAsSource("Hello, world!", "hello world"), true);
assert.equal(sameAsSource("你好世界", "Hello world"), false);
assert.equal(pickTranslateRows({ t: ["你好", "世界"] }).join("|"), "你好|世界");
assert.equal(pickTranslateRows({ translations: ["甲", "乙"] }).join("|"), "甲|乙");
assert.equal(pickTranslateRows(["一", "二"]).join("|"), "一|二");
assert.equal(pickTranslateRows({ 1: "后", 0: "先" }).join("|"), "先|后");
assert.equal(pickTranslateRows({ 0: "甲", 2: "丙" }, 3).join("|"), "甲||丙");
assert.equal(pickTranslateRows({ gist: "x" }).length, 0);
assert.equal(usableTranslation("Hello world", "Hello world"), "");
assert.equal(usableTranslation("你好世界", "Hello world"), "你好世界");
assert.equal(captionTlang("zh-CN"), "zh-Hans");
assert.equal(captionTlang("zh-TW"), "zh-Hant");
{
  const aligned = alignCaptionTranslations(
    [{ start: 0, end: 2, text: "Hello" }, { start: 2, end: 4, text: "World" }],
    [{ start: 0.1, end: 1.9, text: "你好" }, { start: 2.1, end: 3.8, text: "世界" }],
  );
  assert.equal(aligned[0], "你好");
  assert.equal(aligned[1], "世界");
}

// 旧轮询的致命顺序：先写 state.tabId，再比 tab.id，保护永远失效
const broken = { tabId: 11, videoId: "abc123", segments: 40 };
const otherTab = { id: 22, videoId: "other" };
broken.tabId = otherTab.id;
const oldGuard = Boolean(
  broken.videoId && broken.segments && broken.tabId && otherTab.id !== broken.tabId,
);
assert.equal(oldGuard, false, "再现：先改 tabId 会让“别的标签不换片”失效");
assert.equal(
  watchAdoptDecision({ videoId: otherTab.videoId, tabId: otherTab.id, source: "poll" }, opened()),
  "skip-opened",
  "新锁必须挡住别的标签",
);

// 活跃标签排序不能压过“已经打开的这支”
const ranked = [
  { id: 22, videoId: "other", active: true, lastAccessed: 9 },
  { id: 11, videoId: "abc123", active: false, lastAccessed: 1 },
].sort(sortWatchTabs);
assert.equal(ranked[0].id, 22);
assert.equal(
  watchAdoptDecision({ videoId: ranked[0].videoId, tabId: ranked[0].id, source: "poll" }, opened()),
  "skip-opened",
);

const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
assert.match(bg, /openPanelOnActionClick:\s*false/, "工具栏必须自己 open，才能同时写下 vb_click");
assert.match(bg, /action\.onClicked/, "工具栏点击要自己绑视频");
assert.match(bg, /function isRestrictedTab/, "chrome:// 页不能用 tabId 开侧栏");
assert.match(bg, /function openSidePanelSafe/, "工具栏要能落到 windowId 或已打开的视频页");
assert.match(bg, /tryOpen\(\{ tabId:/, "普通视频页仍要带 tabId 打开");
assert.match(bg, /tryOpen\(\{ windowId:/, "扩展页要点工具栏也能开");
assert.match(bg, /function recoverWatchPages/, "重载后要给已打开的视频页补注入");
assert.match(bg, /injectContentScripts\(id\)/, "重载后不能只靠整页刷新");

const panel = fs.readFileSync(path.join(root, "panel.js"), "utf8");
assert.match(panel, /watchAdoptDecision\(/, "认片必须走统一的锁");
assert.doesNotMatch(
  panel,
  /state\.tabId = tab\.id;\s*const hrefId/,
  "轮询不能先改 tabId 再判断",
);
assert.match(panel, /source:\s*"poll"/, "轮询必须带 source，才能被 opened 锁挡住");
assert.doesNotMatch(
  panel,
  /else if \(videoId !== state\.videoId && videoId !== loadingVideoId\) \{\s*if \(state\.videoId && state\.segments.length && state\.tabId && tab\.id !== state\.tabId\) return;/,
  "轮询不能再直连 loadVideo",
);

const panelCss = fs.readFileSync(path.join(root, "panel.css"), "utf8");
assert.match(panelCss, /#flashHint:not\(\[hidden\]\)[\s\S]*pointer-events:\s*none/, "提示条不能挡住顶栏按钮");
assert.match(panelCss, /\.modal:empty/, "空弹层不能盖住整页");

const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
assert.match(content, /#kz-dock \{[\s\S]*pointer-events:\s*none/, "K 条容器不能抢走播放器按钮");
assert.match(content, /closest\("button"\)/, "只有点到 K/R/A/N/B 才拦截事件");
assert.match(panel, /closest\("#selBar, #transcriptBox"\)/, "点顶栏/页签时要收起划线条");
assert.match(panel, /if \(\$\("mainBox"\) && !\$\("mainBox"\)\.hidden\) return/, "已打开正文时轮询不能盖回空状态");
assert.match(panel, /dismissOverlay\("recallModal"/, "复述弹层要点空白处能关");
assert.match(panel, /function bindCoreClicks/, "页签和字幕要点要在启动最前面绑上");
assert.match(panel, /function setVocabPage/, "今日/检验/牌组必须走统一切页");
assert.match(panel, /closest\("\[data-vpage\]"\)/, "生词子页要点要在启动时绑上，不能只靠牌组重绘");
assert.match(panel, /bindVocabPageTabs\(root\);\s*bindVocabDeck\(root\)/, "牌组页也要绑今日/检验/牌组");
assert.match(panel, /tabs\.length \|\| state\.gist/, "有摘要时也要能进闭卷复盘");
assert.match(panel, /function recoverBoot/, "侧栏启动失败不能白屏");
assert.match(panel, /function activateView/, "拆页/图谱必须走统一切页");
assert.doesNotMatch(panel, /猫是金渐层，狗是萨摩耶/);
assert.match(panel, /function markFaceCaption/, "选脸文案走金渐层/萨摩耶");
assert.match(panel, /id: "cat", label: "金渐层"/);
assert.match(panel, /id: "dog", label: "萨摩耶"/);
assert.match(panel, /function feynmanGuides/, "费曼要按节点出引导问题");
assert.match(panel, /Typeless、豆包输入法或微信输入法/, "费曼要提示语音转文字");
assert.match(panel, /function openFeynmanFor/, "图谱节点要能打开费曼");
const panelHtml = fs.readFileSync(path.join(root, "panel.html"), "utf8");
assert.ok(panelHtml.indexOf('class="views"') < panelHtml.indexOf('id="markRail"'), "页签要在书签条上面，避免选脸板盖住");
assert.match(panelCss, /\.tutorial \{[\s\S]*pointer-events:\s*none/, "教程层不能挡住页签和正文");
assert.match(panelCss, /\.views \{[\s\S]*z-index:\s*22/, "页签要叠在划线条上面");
assert.match(panelCss, /\.selbar \{[\s\S]*bottom:\s*8px/, "划线条要钉在底部，不能盖住页签和正文");
assert.match(panelCss, /\.selbar \{[\s\S]*z-index:\s*110/, "划线条要压过「回生词」底栏");
assert.match(panelCss, /#jumpBackBar:not\(\[hidden\]\)/, "有回生词条时划线条要抬高");
assert.match(markFaceUrl("cat"), /mark-cat-golden/);
assert.match(markFaceUrl("dog"), /mark-dog-samoyed/);
assert.equal(markFaceUrl("ribbon"), "");
assert.match(content, /document\.body\.appendChild\(next\)/, "K 条要挂在页面上，不能埋进播放器图层");
assert.match(content, /VB_CONTENT_REV = 36/, "重载后要升 rev，才能重装 K");
assert.doesNotMatch(content, /data-mode="original"/, "字幕语言不要堆在片子上反复点");
assert.match(content, /liveModeOf\(stored\.vb_settings\?\.transcriptMode\)/, "片上字幕要跟侧栏记住的双语");
assert.match(content, /function bindLivePointerGuard/, "片子上要点得着，先在页面上拦住播放器");
assert.match(content, /addEventListener\(type, on, true\)/, "全屏时要在捕获阶段挡住播放器");
assert.doesNotMatch(content, /pointerdown[\s\S]{0,80}preventDefault/, "pointerdown 上 preventDefault 会把 click 吃掉");
assert.match(content, /function liveBarBusy/, "按着的时候不能拆掉词按钮");
assert.match(content, /function paintLiveWordFlags/, "点词只改高亮，不要重写整行");
assert.match(content, /function liveSelectionText/, "字幕条上要能划选再划线");
assert.match(content, /function sendLiveBg/, "查词失败要把后台原因带回条子");
assert.match(content, /data-act="retry"/, "查词失败后要能再试一次");
assert.match(content, /function liveCaptionReady[\s\S]{0,80}liveSegments\.length > 0/, "没拉到字幕轨时不能把系统 CC 藏掉");
assert.match(content, /"pointerup"/, "松手也要拦住播放器");
assert.match(content, /liveDragging/, "划词拖着时不能拆掉词按钮");
assert.match(content, /timeupdate/, "句切要跟播放头，不能只靠 220ms 定时器");
assert.match(content, /function liveSegFinger/, "侧栏写缓存时不能整轨重拉片上字幕");
assert.match(content, /Math\.floor\(segs\.length \/ 2\)/, "轨指纹要抽中段，不能只比首尾");
assert.match(content, /function pickLiveSegs\(live, pack\)/, "选轨要吃整包，不能只传数组");
assert.match(content, /tLive > tPack/, "新轨即使更短也要盖过旧长缓存");
assert.match(content, /function persistLiveTranslations[\s\S]{0,280}if \(!pack\) return/, "片子上只合并译文，不能改轨或抬 savedAt");
assert.match(content, /function fillLiveEn/, "按住划词时英文也要换成这一句");
assert.match(content, /liveWordsKey = ""/, "松手后要重建词按钮");
assert.match(content, /paintKey === livePaintKey && !geomDirty && \(busy \|\| liveWordsKey\)/, "松手后 paintKey 相同也要重建词按钮");
assert.match(content, /function syncLiveVideo/, "B 站换片也要丢掉上一支的轨");
assert.match(content, /function liveStill/, "拉轨和补译回来后要确认还是这一支");
assert.match(content, /function applyLiveSegs/, "换轨要丢掉黏着的旧句");
assert.match(content, /!track\.segs\.length && liveSegId === id/, "驱逐后 storage 空轨必须清片上内存");
assert.match(content, /resetLiveTrack\(\)/, "空轨要走统一清场");
assert.match(bg, /!tab\.active/, "后台页的 tick 不能改正在看的片");
assert.match(panel, /activeWatch/, "前台 tab 换片要马上认，不能等下一轮轮询");
assert.match(panel, /state\._trackAt/, "同片再开要先比轨是不是新的");
assert.match(panel, /if \(job !== videoJob \|\| loadingVideoId !== videoId\) return;[\s\S]{0,80}if \(segs\?\.length\)/, "缓存开片也要挡住过期的 loadVideo");
assert.match(panel, /if \(state\.videoId !== videoId\) return;/, "同片刷新等缓存时切走了就不能再往下跑");
assert.match(panel, /if \(state\.videoId && state\.segments\.length\) return;/, "认不出 id 时不要清掉已经打开的字幕");
assert.match(panel, /sendToTabSure\(\{ type: "VB_VIDEO_INFO" \}\)\.then/, "开片后马上跟上真实播放头");
assert.match(content, /addEventListener\("scroll"/, "滚动时条子要跟上播放器");
assert.match(content, /onGeom\._raf/, "滚动重放条子要合到一帧，不能每像素都量");
assert.match(panel, /info\.videoId !== state\.videoId/, "其它页的播放头不能带动这一支");
assert.match(content, /liveSegFinger\(a\) === liveSegFinger\(b\)/, "只写译文不能靠 savedAt 把旧长轨抢回来");
assert.match(content, /wasFs === nowFs/, "B 站 class 抖一下不能重放条子");
assert.match(content, /bpx-state-web-fullscreen/, "B 站网页全屏要跟进条子");
assert.match(panel, /translateAll\.busy/, "快切视频时漏翻的翻译要能再进");
assert.equal(TRANSLATE_BATCH, 6, "侧栏和后台要同一批大小");
assert.match(panel, /pending.length < batch/, "DeepSeek 一次不要塞 40 句");
assert.match(panel, /translateTries/, "空译文要再试一次，不能立刻钉死");
assert.match(bg, /function translateChunk/, "多句要按块翻，不能只切前 12 条把后面钉死");
assert.match(bg, /missing.length === src.length/, "整块都空要再翻一次");
assert.match(bg, /_retriedJson/, "JSON 空了和截断要分开重试");
assert.match(bg, /pickAiText\(data, \{ json \}\)/, "JSON 任务不能把思维链当译文解析");
assert.match(bg, /json \|\| !allowReasoning/, "翻译和 JSON 都不能把思维链当正文");
assert.match(bg, /_retried429 < 5/, "429 要多歇几次，不能只问一次");
assert.match(bg, /raw = \[\]/, "plain 回退再抛也不能把整批打成失败");
assert.match(bg, /function isRethrowTranslateError/, "钥匙和额度错误不能吞成空成功");
assert.match(bg, /let aiChain/, "翻译和问老师不能同时挤爆 DeepSeek");
assert.match(bg, /AbortSignal\.timeout\(90000\)/, "DeepSeek 卡住要自己断，不能把后台挂死");
assert.doesNotMatch(panel, /function isTranslateFatal[\s\S]{0,220}429/, "限流不能当成整片翻译失败");
assert.match(panel, /2800/, "429 之后要多歇一会儿再翻");
assert.match(content, /want\.length < 4/, "片子上一次不要再塞 8 句");
assert.doesNotMatch(bg, /still\.length && still\.length < src\.length/, "整块都空也要补翻，不能跳过 mini");
assert.match(content, /liveZhTries/, "片子上译文空了也要再试一次");
assert.match(content, /usableTranslation/, "片子上英文回声不能当对照成功");
assert.match(content, /function fillLiveZhPane/, "同句只更新对照，不能拆掉词按钮");
assert.match(content, /else if \(same && liveCcOn\)/, "只写译文不要清 paintKey 重绘整条");
assert.match(content, /function pickLiveTrack/, "选哪条轨就只用那条轨的译文");
assert.match(content, /function adoptLiveTrack/, "过期的拉轨不能把新轨盖回去");
assert.match(content, /t > Number\(end\) \+ 0\.12/, "两句之间的空档不要黏上一句");
assert.match(content, /prev\?\.classList\.remove\("on"\)/, "换句时旧 pane 要马上关掉");
assert.match(content, /t \+ 0\.05 < firstStart/, "片头还没到第一句不要提前显示");
assert.match(panel, /next\.activeWatch/, "同片换到前台标签要跟上 tabId");
assert.doesNotMatch(panel, /batchFails >= 3/, "一批失败不能整段退出 translateAll");
assert.match(panel, /\$\("selBar"\) && !\$\("selBar"\)\.hidden/, "划线条在时才停自动滚");
assert.match(panel, /function saveProgressSoon/, "播放中只记进度，不要整包写缓存");
assert.match(content, /function liveZhBlocked/, "对照失败 30 秒后还要再试");
assert.match(content, /Date.now\(\) - at >= 30000/, "对照失败冷却是 30 秒");
assert.match(panel, /if \(needFollow\) lastFollowedStart = -1/, "长字幕骨架换成真实行后要重新居中");
assert.match(panelCss, /\.t-row\.playing \{[\s\S]*overflow-anchor:\s*auto/, "骨架变高时锚定正在读的那一行");
assert.match(panel, /function sendToTab\(message, tabId/, "poll 要问正在看的标签，不能问旧 tab");
assert.match(panel, /function isTranslateFatal/, "钥匙错误要认 code，不能只扫 error 字");
assert.match(panel, /saveCacheSoon\(1500\)/, "翻译收尾不要同步写整包缓存");
assert.match(bg, /isRethrowTranslateError\(e\)/, "mini 补翻的致命错误也要再抛");
assert.match(content, /fillLiveZhPane\(panes\[liveFront\], line\)/, "按住划词时不要拆英文词按钮");
assert.match(content, /Number.isInteger\(idx\) && !liveZhBlocked/, "空档不要白跑对照");
assert.match(panel, /usableTranslation\(result\.translations/, "侧栏也要用同一套译文过滤");
assert.match(panel, /message failed/, "后台挂了也要记失败，不能整轮卡住");
assert.match(panel, /translationKind\(zh, en\) === "ok"/, "空译文或回声不能当成功");
assert.match(panel, /state\.translateFailed\[i\] = true/, "翻失败要标出来，不能一直转骨架");
assert.match(panel, /function refreshLoopChrome/, "阅读页循环不能整表重绘知识块");
assert.match(panel, /currentView\(\) === "bricks"/, "循环按钮只在拆页才重画砖条");
assert.match(panel, /Math\.abs\(delta\) < 72/, "跟随要有滞回，不能每句硬跳");
assert.match(panel, /lastPlayheadAt/, "port 已经在跟随时不要再 280ms 问一遍");
assert.match(panel, /liveAt > cacheAt/, "侧栏开片也要比保存时间，不能只比轨长");
assert.match(panel, /const savedAt = Date\.now\(\)/, "cache 和 vb_live 要同一时间戳");
assert.match(panel, /paintOneTranscriptRow\(i\)/, "划线后不要整页拆掉字幕");
assert.match(panel, /refreshTranscriptWhenIdle\.gen/, "长字幕刷新要分帧，不能一次 replace 几百行");
assert.match(panel, /if \(nid === markNearId\) return/, "跟随不要每 tick 扫一遍书签钉");
assert.match(panel, /saveProgressSoon\(4000\)/, "播放中只记进度，不要整包写缓存");
assert.doesNotMatch(panel, /setInterval\(\(\) => \{\s*if \(state\.videoId\) saveCache\(\)/, "不要定时全量 saveCache");
assert.match(panelCss, /\.t-row\.playing \.zh-skel/, "译文骨架动画只开在正在读的那一行");
assert.doesNotMatch(panel, /state\.segments\.length > 80/, "长字幕刷新不能整页拆成骨架");
assert.match(panel, /pollTick\._again/, "换 tab 时轮询忙着也要补跑一次");
assert.match(panel, /start === lastFollowedStart\) return/, "跟读锁住时换句仍要跟上");
assert.match(panel, /const ok = await startSpanLoop\(span\)/, "选区循环失败不能假装成功");
assert.match(panelCss, /\.top-actions \{[\s\S]*overflow-x:\s*auto/, "顶栏挤了要能横滑");
assert.match(panelCss, /\.top-actions \{[\s\S]*min-width:\s*0/, "顶栏要能收缩，overflow 才生效");
assert.match(panel, /transcriptFailId \|\| loadingVideoId \|\| state\.videoId/, "重试要加载失败的那支，不能回到旧片");
assert.match(panel, /async function saveSettings[\s\S]{0,280}chrome\.storage\.local\.get\("vb_settings"\)/, "侧栏存设置前要先读回页面上改过的开关");
assert.match(panel, /setLiveCc"\)\.checked = incoming\.liveCc/, "K 条开了字幕条，设置里的开关要跟着变");
assert.match(content, /fullscreenElement/, "全屏时条子要跟进播放器");
assert.match(content, /wordsKey !== liveWordsKey/, "对照刷新时不能拆掉正在点的词");
assert.match(panelHtml, /id="modeBilingual" class="seg-btn active"/, "侧栏默认就是双语");
assert.match(panel, /transcriptMode = "bilingual"/, "没设过语言时要写成双语并记住");
assert.match(content, /kz-lex/, "片上点词要出悬浮词卡");
assert.match(content, /action: "vbDefine"/, "词卡要在页面上直接查，不进侧栏");
assert.match(panel, /action === "highlight"/, "片上划线要能写进侧栏原文");
assert.match(content, /style\?\.dataset\.rev === String\(VB_CONTENT_REV\)/, "样式不能每两秒重写一遍");
assert.doesNotMatch(content, /observe\(player, \{ childList: true, subtree: true \}\)/, "不能整棵监听播放器 DOM");
assert.match(content, /setTimeout\(pulse, 220\)/, "片上字幕条不能逐帧重画");
assert.match(content, /oldRev >= VB_CONTENT_REV/, "旧页要能丢掉旧世界再装新条");
assert.match(content, /kz-live/, "片上字幕要走自己的条，不改系统 CC");
assert.match(content, /kz-live-on/, "打开片上字幕条时系统 CC 要淡出");
assert.match(content, /kz-live-pane/, "换句要用交叉淡入，不要硬切");
assert.match(content, /data-act="cc"/, "K 条仍能开关片上字幕条");
assert.match(content, /kz-cc-w/, "片上点词只包我们自己的条");
assert.match(content, /liveCc === true/, "片上字幕条默认关，要显式打开");
assert.match(content, /liveCcSize/, "片上字号要记进设置");
assert.match(content, /liveCcFont/, "片上字体要记进设置");
assert.match(content, /tlang/, "YouTube 双语要走平台自带译文轨");
assert.match(content, /alignCaptionTranslations/, "双语要对齐到原句时间");
assert.match(content, /fillLiveZh/, "片上双语不能只等侧栏翻完");
assert.doesNotMatch(content, /data-act="bigger"/, "字号不要堆在字幕条上");
assert.match(panel, /id="setLiveCc"/, "设置里要有片上字幕条开关");
assert.match(panel, /id="setLiveStyle"/, "字幕样式要放在设置里");
assert.match(panel, /id="setCopyTranscript"/, "一键复制全文要放在设置里");
assert.match(siteSrc, /function alignCaptionTranslations/, "双语对齐要能单测");
assert.match(bg, /translations: res\.translations/, "侧栏打开时要带上平台译文");
assert.match(panelCss, /\.check\.switch input/, "设置开关要是拨动样子");
assert.match(panel, /action === "peek"/, "跳这句要能对齐侧栏");
assert.match(content, /pageUnavailable/, "不可播的页要能上报");
assert.match(bg, /hasCore \? \["content\.js"\]/, "已注入过的页不能再跑 i18n.js");
assert.match(panel, /20000/, "字幕链路要有硬超时");
assert.match(panel, /function clearOpenedVideo/, "当前页不可读时必须清空阅读器");
assert.match(panel, /captionsOnly/, "要有只要字幕开关");
assert.match(panel, /function preferredTranscriptMode/, "阅读默认双语");
assert.match(panel, /transcriptMode: "bilingual"/, "初始状态就是双语");
assert.match(panel, /function isRealTranslation/, "失败或原文不能当译文");
assert.match(panel, /followPausedByUser/, "跟随只能暂时停");
assert.match(panel, /decorateTextNodes/, "decorate 只能改文本节点");
assert.match(content, /__vbRemountDock/, "已打开的视频页要能拆掉旧 K 再绑");
assert.match(panelHtml, /id="achievePop"/, "顶栏成就要有抽屉");
assert.match(panel, /function checkAchievements/, "学过的痕迹要能解锁成就");
assert.match(panel, /vb_achieve/, "成就要记在本机");
assert.match(panel, /doneKeys/, "同一块反复标已学会不能再加一次");
assert.match(panelCss, /\.achieve-card/, "成就抽屉要有卡片样式");
{
  const achieveSrc = fs.readFileSync(path.join(root, "achieve.js"), "utf8");
  const aCtx = {};
  vm.createContext(aCtx);
  vm.runInContext(achieveSrc, aCtx);
  const api = aCtx.Achieve;
  const empty = api.emptyStore();
  assert.equal(api.evaluate({}, empty).fresh.length, 0);
  const first = api.evaluate({ videos: 1, words: 1, highlights: 1, doneChapters: 1 }, empty);
  assert.ok(first.fresh.includes("first_watch"));
  assert.ok(first.fresh.includes("first_word"));
  assert.ok(first.fresh.includes("first_done"));
  assert.equal(api.evaluate({ videos: 1 }, { unlocked: first.unlocked }).fresh.length, 0);
  assert.equal(api.dayKey(Date.parse("2026-08-22T12:00:00")), "2026-08-22");
  assert.equal(api.streak(["2026-08-20", "2026-08-21", "2026-08-22"], "2026-08-22"), 3);
  assert.equal(api.streak(["2026-08-20", "2026-08-22"], "2026-08-22"), 1);
  assert.equal(api.touchDays(["2026-08-21"], Date.parse("2026-08-22T18:00:00")).streak, 2);
  assert.equal(api.unseen({ unlocked: { a: 1, b: 1 }, seen: { a: true } }), 1);
  const pile = api.evaluate({ words: 30, videos: 5, chapters: 5, reviews: 20 }, empty);
  assert.ok(pile.fresh.includes("words_30"));
  assert.ok(pile.fresh.includes("videos_5"));
  assert.ok(!pile.fresh.includes("words_100"));
  assert.ok(!pile.fresh.includes("videos_20"));
}
assert.match(panel, /function installWordPack/, "词汇包要能下载到本机");
assert.match(panel, /scanLocal/, "有词包时筛生词要走本地，不花 token");
assert.match(wordLevel, /function scanLocal/, "本地筛词要能单测");
assert.match(freqSrc, /^the\n/m, "词频表要能装进扩展");
assert.ok(freqSrc.trim().split(/\s+/).length > 8000, "词频表要够切出雅思托福");
{
  const packCtx = { console };
  vm.createContext(packCtx);
  vm.runInContext(wordLevel, packCtx);
  const known = packCtx.WordLevel.knownFromFreq(["the", "of", "and", "leverage", "ubiquitous"], 3);
  assert.equal(known.has("the"), true);
  assert.equal(known.has("leverage"), false);
  const hits = packCtx.WordLevel.scanLocal(
    [{ text: "The team will leverage ubiquitous tools today.", start: 12 }],
    { packWords: known, userKnown: [], limit: 10 },
  );
  assert.ok(hits.some((w) => w.word === "leverage"));
  assert.ok(!hits.some((w) => w.word === "the" || w.word === "team"));
  const head = packCtx.WordLevel.scanLocal(
    [{ text: "Leverage the ubiquitous tools today.", start: 0 }],
    { packWords: known, userKnown: [], limit: 10 },
  );
  assert.ok(head.some((w) => w.word === "leverage"), "句首生词不能当专有名词丢掉");
}
assert.match(bg, /name === "kaizen-ai"/, "翻译时要留一条端口，别让后台被掐掉");
assert.match(bg, /vb_ai_busy/, "后台在问 DeepSeek 时要标忙，片子上别再挤");
assert.match(bg, /function beginAi/, "问 DeepSeek 时要撑住 Service Worker");
assert.match(bg, /!out\.some\(Boolean\) && isRethrowTranslateError/, "已经翻出一部分就不要整块丢掉");
assert.match(panel, /function sendToBgSure/, "后台被掐后要再送一次，不能算这句翻失败");
assert.match(panel, /connect\(\{ name: "kaizen-ai" \}\)/, "侧栏翻译时要拉住后台");
assert.match(panel, /leftover/, "还有没翻的句子要自己再进一轮");
assert.match(content, /vb_ai_busy/, "片子上看到侧栏在翻就先等缓存");
assert.match(content, /120000/, "侧栏忙着时片子上至少等两分钟");
assert.match(fs.readFileSync(path.join(root, "i18n.js"), "utf8"), /"拆解已收起。"|"正在对照…"/);
try {
  new Function(fs.readFileSync(path.join(root, "i18n.js"), "utf8"));
} catch (error) {
  assert.fail(`i18n.js 必须能解析，否则重载后扩展起不来: ${error.message}`);
}

console.log("test-watch: ok");
