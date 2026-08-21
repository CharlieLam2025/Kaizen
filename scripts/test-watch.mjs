import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteSrc = fs.readFileSync(path.join(root, "site.js"), "utf8");
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
} = ctx;

function opened(extra = {}) {
  return { videoId: "abc123", tabId: 11, segments: 40, loadingVideoId: null, ...extra };
}

// --- URL 认片 ---
assert.equal(videoIdFromHref("https://www.youtube.com/watch?v=abc123"), "abc123");
assert.equal(videoIdFromHref("https://youtu.be/abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube.com/shorts/abc123"), "abc123");
assert.equal(videoIdFromHref("https://www.youtube.com/embed/abc123"), "abc123");
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
assert.match(content, /VB_CONTENT_REV = 8/, "重载后要升 rev，才能重装 K");
assert.match(content, /__vbRemountDock/, "已打开的视频页要能拆掉旧 K 再绑");
assert.match(fs.readFileSync(path.join(root, "i18n.js"), "utf8"), /"拆解已收起。"|"正在对照…"/);
try {
  new Function(fs.readFileSync(path.join(root, "i18n.js"), "utf8"));
} catch (error) {
  assert.fail(`i18n.js 必须能解析，否则重载后扩展起不来: ${error.message}`);
}

console.log("test-watch: ok");
