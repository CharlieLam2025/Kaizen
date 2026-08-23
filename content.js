// VideoBricks content script — runs on youtube.com and bilibili.com.
// Jobs: report which video is open, pull the video's own caption track
// (no third-party transcript API), and control playback for the panel.
//
// Guard: the panel may inject this file again if the tab was open before
// the extension loaded. A second listener would double-answer messages.
// After chrome.runtime.reload(), the old world stays on the page; bump
// the rev and remount the dock so K works without a full tab refresh.
const VB_CONTENT_REV = 34;

(function bootKaizenContent() {
  document.getElementById("kz-dock")?.remove();
  document.getElementById("kz-live")?.remove();
  document.getElementById("kz-lex")?.remove();
  const oldRev = Number(globalThis.__vbContentRev) || 0;
  if (oldRev >= VB_CONTENT_REV && typeof globalThis.__vbRemountDock === "function") {
    try {
      globalThis.__vbRemountDock();
      return;
    } catch (_e) {}
  }
  globalThis.__vbContentGen = (Number(globalThis.__vbContentGen) || 0) + 1;
  globalThis.__vbContentRev = VB_CONTENT_REV;
  globalThis.__vbContentReady = true;
  vbInstallContentScript();
})();

function vbInstallContentScript() {
  const contentGen = globalThis.__vbContentGen;
  const contentLive = () => globalThis.__vbContentGen === contentGen;
  chrome.storage.local.get("vb_settings", (stored) => {
    setUiLang(stored.vb_settings?.uiLang || "zh-CN");
  });
//
// Caption fetching is layered because YouTube throttles naive approaches:
//   player response: live page scripts → fetched watch HTML → InnerTube
//   (Android client, the most reliable channel for caption URLs)
//   caption body:   json3 → timedtext XML fallback

// Public web InnerTube key — ships inside every YouTube page, not a secret.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

function videoIdFromUrl(href) {
  return videoIdFromHref(href);
}

/**
 * Pulls a balanced JSON object out of `source` starting at the first "{"
 * after `marker`. Brace counting skips string literals so URLs and quotes
 * inside the player response don't break the scan.
 */
function extractJsonAfter(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const start = source.indexOf("{", at);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch (_e) {
          return null;
        }
      }
    }
  }
  return null;
}

// ---------- player response: three sources ----------

/** Source 1: inline scripts of the currently loaded page (full page loads). */
function playerResponseFromDom(videoId) {
  if (videoIdFromUrl(location.href) !== videoId) return null;
  for (const script of document.querySelectorAll("script")) {
    const text = script.textContent;
    if (!text || !text.includes("ytInitialPlayerResponse")) continue;
    const parsed = extractJsonAfter(text, "ytInitialPlayerResponse");
    if (parsed?.videoDetails?.videoId === videoId) return parsed;
  }
  return null;
}

/** Source 2: refetch the watch page HTML (correct after SPA navigations). */
async function playerResponseFromWatchHtml(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`视频页 ${res.status}`);
  const html = await res.text();
  const parsed = extractJsonAfter(html, "ytInitialPlayerResponse");
  if (parsed?.videoDetails?.videoId !== videoId) return null;
  return parsed;
}

/**
 * Source 3: InnerTube player API with an Android client identity. Caption
 * URLs issued to the mobile client skip the web player's extra token
 * requirements, so this is the most reliable path.
 */
async function playerResponseFromInnerTube(videoId) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
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
  return await res.json();
}

/** Prefers English (manual then ASR), then other non-Chinese, then Chinese. */
function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const score = (t) => {
    const lang = String(t.languageCode || "").toLowerCase();
    const asr = t.kind === "asr" ? 8 : 0;
    if (/^en\b/.test(lang)) return asr;
    if (!isZhCaptionLang(lang)) return 4 + asr;
    return 16 + asr;
  };
  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}

function pickNativeZhTrack(tracks, source) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const score = (t) => {
    if (t === source) return 99;
    const lang = String(t.languageCode || "").toLowerCase();
    const asr = t.kind === "asr" ? 8 : 0;
    if (lang === "zh-hans" || lang === "zh-cn") return asr;
    if (lang === "zh") return 1 + asr;
    if (lang.startsWith("zh")) return 2 + asr;
    return 99;
  };
  const hit = [...tracks].sort((a, b) => score(a) - score(b))[0];
  return hit && score(hit) < 99 ? hit : null;
}

function withTlang(baseUrl, tlang) {
  const url = new URL(baseUrl, "https://www.youtube.com");
  if (tlang) url.searchParams.set("tlang", tlang);
  return url.toString();
}

async function fetchYtTranslations(track, tracks, segments) {
  if (!track?.baseUrl || !segments?.length) return {};
  const srcLang = String(track.languageCode || "");
  if (isZhCaptionLang(srcLang)) return {};
  const urls = [];
  const native = pickNativeZhTrack(tracks, track);
  if (native?.baseUrl) urls.push(native.baseUrl);
  if (track.isTranslatable !== false) urls.push(withTlang(track.baseUrl, captionTlang()));
  for (const url of urls) {
    try {
      const zhSegs = await fetchCaptionSegments(url);
      const aligned = alignCaptionTranslations(segments, zhSegs);
      if (Object.keys(aligned).length >= Math.min(3, segments.length)) return aligned;
      if (Object.keys(aligned).length) return aligned;
    } catch (_e) {}
  }
  return {};
}

// ---------- caption body: json3 with XML fallback ----------

/** Rebuilds the caption URL with exactly one fmt value (or none for XML). */
function withFormat(baseUrl, fmt) {
  const url = new URL(baseUrl, "https://www.youtube.com");
  url.searchParams.delete("fmt");
  if (fmt) url.searchParams.set("fmt", fmt);
  return url.toString();
}

/**
 * Merges raw caption pieces into readable lines: a line closes on
 * sentence-ending punctuation, when it grows past ~90 chars, or when the
 * next piece starts after a clear pause.
 */
function mergeRawSegments(raw) {
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

function rawFromJson3Events(events) {
  const raw = [];
  for (const ev of events || []) {
    if (!Array.isArray(ev.segs)) continue;
    const text = ev.segs
      .map((s) => s.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    raw.push({
      start: (ev.tStartMs || 0) / 1000,
      end: ((ev.tStartMs || 0) + (ev.dDurationMs || 0)) / 1000,
      text,
    });
  }
  return raw;
}

function rawFromTimedTextXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const decoder = document.createElement("textarea");
  const decode = (value) => {
    decoder.innerHTML = value;
    return decoder.value;
  };
  return [...doc.querySelectorAll("text")]
    .map((node) => {
      const start = Number(node.getAttribute("start")) || 0;
      const dur = Number(node.getAttribute("dur")) || 0;
      return {
        start,
        end: start + dur,
        // YouTube double-encodes entities in this format (&amp;#39;)
        text: decode(node.textContent || "").replace(/\s+/g, " ").trim(),
      };
    })
    .filter((seg) => seg.text);
}

async function fetchCaptionSegments(baseUrl) {
  // Preferred: json3. A 200 with an empty body means YouTube refused this
  // URL variant (bot protection) — fall through to XML instead of failing.
  try {
    const res = await fetch(withFormat(baseUrl, "json3"), {
      credentials: "include",
    });
    if (res.ok) {
      const body = await res.text();
      if (body.trim()) {
        const segments = mergeRawSegments(rawFromJson3Events(JSON.parse(body).events));
        if (segments.length) return segments;
      }
    }
  } catch (_e) {
    // fall through to XML
  }

  const res = await fetch(withFormat(baseUrl, ""), { credentials: "include" });
  if (!res.ok) throw new Error(`字幕请求失败（${res.status}）`);
  const xml = await res.text();
  if (!xml.trim()) {
    throw new Error(t("字幕接口返回空内容（YouTube 风控）"));
  }
  const segments = mergeRawSegments(rawFromTimedTextXml(xml));
  if (!segments.length) throw new Error(t("字幕内容解析失败"));
  return segments;
}

// ---------- transcript assembly ----------

function biliTracksFromDom() {
  for (const script of document.querySelectorAll("script")) {
    const t = script.textContent || "";
    if (t.length < 80 || !t.includes("subtitle")) continue;
    if (!t.includes("__INITIAL_STATE__")) continue;
    const parsed = extractJsonAfter(t, "__INITIAL_STATE__");
    const vd = parsed?.videoData || parsed?.videoInfo || {};
    const list = collectBiliTracks(vd.subtitle?.list, vd.subtitle?.subtitles);
    if (list.length) return { title: vd.title || "", list };
  }
  return null;
}

async function getTranscript(videoId) {
  if (isBiliId(videoId)) {
    const fromDom = biliTracksFromDom();
    if (fromDom?.list?.length) return finishBiliTracks(fromDom.list, fromDom.title);
    return fetchBiliTranscript(videoId);
  }
  const attempts = [];
  const sources = [
    ["页面", async () => playerResponseFromDom(videoId)],
    [t("网页抓取"), () => playerResponseFromWatchHtml(videoId)],
    ["InnerTube", () => playerResponseFromInnerTube(videoId)],
  ];

  let lastError = null;
  for (const [name, getPlayer] of sources) {
    let player = null;
    try {
      player = await getPlayer();
    } catch (error) {
      attempts.push(`${name}：${error.message}`);
      continue;
    }
    const tracks =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const track = pickCaptionTrack(tracks);
    if (!track?.baseUrl) {
      attempts.push(`${name}：无字幕轨`);
      continue;
    }

    try {
      const segments = await fetchCaptionSegments(track.baseUrl);
      console.info(`[VideoBricks] 字幕来源：${name}（${track.languageCode}）`);
      const details = player.videoDetails || {};
      const translations = await fetchYtTranslations(track, tracks, segments);
      return {
        segments,
        translations,
        language: track.languageCode || "",
        trackKind: track.kind || "manual",
        title: details.title || "",
        channel: details.author || "",
        durationSeconds: Number(details.lengthSeconds) || 0,
      };
    } catch (error) {
      lastError = error;
      attempts.push(`${name}：${error.message}`);
    }
  }

  throw new Error(
    `三条通道都没拿到字幕（${attempts.join("；")}）。` +
      (lastError ? "" : t("这支视频可能确实没有字幕轨。")) +
      t("可以刷新视频页后重试。"),
  );
}

// ---------- playback + messaging ----------

let loopRange = null; // { start, end, shadow, gap } seconds, or null
let lastPanelLoopAt = 0;
let loopWaitTimer = 0;
let loopWaiting = false;
let loopGuardUntil = 0;

function clearLoopWait() {
  if (loopWaitTimer) {
    clearTimeout(loopWaitTimer);
    loopWaitTimer = 0;
  }
  loopWaiting = false;
}

function isYouTubeAd() {
  const player = document.querySelector("#movie_player");
  return Boolean(
    player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting"),
  );
}

function bindPlayhead(video) {
  if (!video) return video;
  let last = -1;
  let lastAt = 0;
  const send = () => {
    if (!contentLive()) return;
    const info = currentVideoInfo();
    if (info.ad) return;
    if (!info.videoId && !Number.isFinite(info.currentTime)) return;
    if (Number.isFinite(info.currentTime) && Math.abs(info.currentTime - last) < 0.08 && Date.now() - lastAt < 360) return;
    if (Number.isFinite(info.currentTime)) last = info.currentTime;
    lastAt = Date.now();
    chrome.runtime.sendMessage({ action: "vbTick", ...info }, () => void chrome.runtime.lastError);
    if (typeof paintPlayerMarks === "function") paintPlayerMarks();
  };
  globalThis.__vbHeadSend = send;
  if (video.__vbHeadBound) return video;
  video.__vbHeadBound = true;
  const relay = () => globalThis.__vbHeadSend?.();
  video.addEventListener("timeupdate", relay);
  video.addEventListener("seeked", relay);
  video.addEventListener("ratechange", relay);
  return video;
}

function bindVideoLoop(video) {
  if (!video || video.__vbLoopBound) return video;
  video.__vbLoopBound = true;
  video.addEventListener("timeupdate", () => {
    if (!loopRange || loopWaiting || Date.now() < loopGuardUntil) return;
    const t = video.currentTime;
    if (t >= loopRange.end - 0.12 || t < loopRange.start - 0.6) {
      if (loopRange.shadow && loopRange.gap > 0) {
        loopWaiting = true;
        video.pause();
        clearTimeout(loopWaitTimer);
        loopWaitTimer = setTimeout(() => {
          loopWaitTimer = 0;
          loopWaiting = false;
          if (!loopRange) return;
          const v = pageVideo();
          if (!v) return;
          loopGuardUntil = Date.now() + 400;
          v.currentTime = loopRange.start;
          v.play().catch(() => {});
        }, loopRange.gap * 1000);
        return;
      }
      loopGuardUntil = Date.now() + 280;
      video.currentTime = loopRange.start;
      video.play().catch(() => {});
    }
  });
  return video;
}

function pageVideo() {
  const main =
    document.querySelector("#movie_player video.html5-main-video") ||
    document.querySelector("#movie_player video") ||
    document.querySelector(".bpx-player-video-wrap video") ||
    document.querySelector(".bilibili-player-video video");
  const el =
    main ||
    [...document.querySelectorAll("video")]
      .filter((v) => v.readyState > 0 && v.offsetWidth > 120)
      .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0] ||
    document.querySelector("video");
  return bindPlayhead(bindVideoLoop(el));
}

function pageTitle() {
  return document.title
    .replace(/ - YouTube$/, "")
    .replace(/_哔哩哔哩_bilibili$/, "")
    .replace(/_哔哩哔哩.*$/, "")
    .replace(/\s*[|_－-].*哔哩.*$/, "")
    .trim();
}

function pageVideoIdFromDom() {
  const flexy = document.querySelector("ytd-watch-flexy")?.getAttribute("video-id");
  if (flexy) return flexy;
  const mini = document.querySelector("ytd-miniplayer")?.getAttribute("video-id");
  if (mini) return mini;
  const meta = document.querySelector('meta[itemprop="videoId"]')?.content;
  if (meta) return meta;
  const og = document.querySelector('meta[property="og:url"]')?.content;
  if (og) {
    const fromOg = videoIdFromUrl(og);
    if (fromOg) return fromOg;
  }
  for (const script of document.querySelectorAll("script")) {
    const text = script.textContent || "";
    if (text.includes("ytInitialPlayerResponse")) {
      const parsed = extractJsonAfter(text, "ytInitialPlayerResponse");
      const id = parsed?.videoDetails?.videoId;
      if (id) return id;
    }
    if (text.includes("__INITIAL_STATE__")) {
      const parsed = extractJsonAfter(text, "__INITIAL_STATE__");
      const bvid = parsed?.bvid || parsed?.videoData?.bvid || parsed?.videoInfo?.bvid || parsed?.epInfo?.bvid;
      if (bvid) {
        const p = Number(parsed?.p || 1);
        return p > 1 ? `${bvid}:p${p}` : bvid;
      }
      const aid = parsed?.aid || parsed?.videoData?.aid || parsed?.epInfo?.aid;
      if (aid) return `av${aid}`;
    }
  }
  return null;
}

function currentVideoInfo() {
  const videoId = videoIdFromUrl(location.href) || pageVideoIdFromDom();
  const video = pageVideo();
  const ad = isYouTubeAd();
  return {
    videoId,
    title: pageTitle(),
    currentTime: ad || !video ? null : video.currentTime,
    duration: video ? video.duration || 0 : 0,
    paused: video ? video.paused : true,
    looping: Boolean(loopRange),
    rate: video ? video.playbackRate : 1,
    ad,
    unavailable: pageUnavailable(),
  };
}

function pageUnavailable() {
  const title = String(document.title || "");
  if (/video unavailable|此视频无法播放|视频无法播放|private video|此视频不可用/i.test(title)) return true;
  const err = document.querySelector(".ytp-error-content-wrap-reason, .ytp-error, yt-player-error-message-renderer");
  const text = String(err?.textContent || "");
  return /unavailable|无法播放|不可用|copyright/i.test(text);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!contentLive()) return;
  if (message?.type === "VB_VIDEO_INFO") {
    sendResponse(currentVideoInfo());
    return false;
  }

  if (message?.type === "VB_TRANSCRIPT") {
    getTranscript(message.videoId)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true; // async
  }

  if (message?.type === "VB_SEEK") {
    const video = pageVideo();
    if (video && Number.isFinite(message.seconds)) {
      video.currentTime = Math.max(0, message.seconds);
      video.play().catch(() => {});
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }

  if (message?.type === "VB_LOOP") {
    const start = Number(message.start);
    const end = Number(message.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const shadow = message.mode === "shadow";
      const gap = shadow ? Math.max(0, Number(message.gap) || 0) : 0;
      const same =
        loopRange &&
        Math.abs(loopRange.start - start) < 0.05 &&
        Math.abs(loopRange.end - end) < 0.05 &&
        Boolean(loopRange.shadow) === shadow &&
        Math.abs((loopRange.gap || 0) - gap) < 0.05;
      loopRange = { start, end, shadow, gap };
      lastPanelLoopAt = Date.now();
      const video = pageVideo();
      if (video && message.seek !== false) {
        clearLoopWait();
        loopGuardUntil = Date.now() + 280;
        video.currentTime = start;
        video.play().catch(() => {});
      } else if (!same) {
        clearLoopWait();
      }
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }

  if (message?.type === "VB_LOOP_CLEAR") {
    clearLoopWait();
    loopRange = null;
    lastPanelLoopAt = Date.now();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "VB_RATE") {
    const video = pageVideo();
    const rate = Number(message.rate);
    if (video && rate > 0) {
      video.playbackRate = rate;
      sendResponse({ ok: true, rate: video.playbackRate });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }

  return false;
});

  // 只绑「视频还在走、来不及看侧栏」的几件事。不用 Alt：很多人把它设成语音输入。
  // 也不用 Ctrl/Cmd+数字：会切标签页。R / A / N / B 按英文记：Record、Again、Note、Bookmark。
  const HOTKEYS = {
    KeyR: "quote",
    KeyA: "loop",
    KeyB: "mark",
  };

  function pageCaption() {
    const bili = [...document.querySelectorAll(".bpx-player-subtitle-panel-text, .bpx-player-subtitle")]
      .map((el) => el.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (bili) return bili;
    return [...document.querySelectorAll(".ytp-caption-segment")]
      .map((el) => el.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function typingIn(el) {
    const tag = el?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
  }

  function playerHost() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector(".bpx-player-container") ||
      document.querySelector(".bilibili-player") ||
      null
    );
  }

  function injectDockStyle() {
    let style = document.getElementById("kz-dock-css");
    if (style?.dataset.rev === String(VB_CONTENT_REV)) return;
    if (!style) {
      style = document.createElement("style");
      style.id = "kz-dock-css";
      document.documentElement.appendChild(style);
    }
    style.dataset.rev = String(VB_CONTENT_REV);
    style.textContent = `
      #kz-dock {
        position: absolute;
        right: 12px;
        bottom: 88px;
        z-index: 60;
        display: flex;
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(20,17,12,0.82);
        font: 12px/1 sans-serif;
        user-select: none;
        pointer-events: none;
      }
      #kz-dock[data-place="page"] {
        position: fixed;
        bottom: 88px;
        z-index: 999998;
      }
      #kz-dock button {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #f3ead8;
        font: 700 11px/28px sans-serif;
        cursor: pointer;
        padding: 0;
        pointer-events: auto;
        transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      }
      #kz-dock button:hover,
      #kz-dock button.on { background: rgba(243,234,216,0.18); }
      #kz-dock button.hit {
        background: rgba(243,234,216,0.36);
        transform: scale(1.14);
        box-shadow: 0 0 0 2px rgba(243,234,216,0.5);
      }
      #kz-dock button[data-act="open"] { letter-spacing: -0.04em; }
      html.kz-live-on .ytp-caption-window-container,
      html.kz-live-on .caption-window,
      html.kz-live-on .bpx-player-subtitle-panel,
      html.kz-live-on .bpx-player-subtitle-area,
      html.kz-live-on .bpx-player-subtitle-panel-text {
        opacity: 0 !important;
        transition: opacity 0.28s ease;
        pointer-events: none !important;
      }
      #kz-live {
        position: fixed;
        z-index: 2147483646;
        box-sizing: border-box;
        max-width: min(760px, calc(100vw - 24px));
        padding: 7px 16px 8px;
        border-radius: 10px;
        background: rgba(8, 8, 8, 0.52);
        color: #fff;
        font-size: var(--kz-live-size, 16px);
        font-family: var(--kz-live-font, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
        line-height: 1.45;
        text-align: center;
        letter-spacing: 0.01em;
        text-shadow: 0 1px 2px rgba(0,0,0,0.55);
        box-shadow: none;
        pointer-events: auto;
        isolation: isolate;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-font-smoothing: antialiased;
        transition: opacity 0.2s ease;
      }
      #kz-live .kz-live-en {
        user-select: text;
        -webkit-user-select: text;
      }
      #kz-live[data-host="player"] { position: absolute; }
      #kz-lex[data-host="player"] { position: absolute; }
      #kz-live[hidden] { display: none !important; }
      #kz-live .kz-live-top {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 0 0 6px;
        font-size: 12px;
        color: #cfc4b0;
        text-shadow: none;
      }
      #kz-live .kz-sw {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
      }
      #kz-live .kz-sw input {
        appearance: none;
        -webkit-appearance: none;
        display: inline-block;
        width: 28px;
        height: 16px;
        margin: 0;
        border: 0;
        border-radius: 999px;
        background: #5a5348;
        position: relative;
        cursor: pointer;
      }
      #kz-live .kz-sw input::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #f3ead8;
        transition: transform 0.15s ease;
      }
      #kz-live .kz-sw input:checked { background: #c4472d; }
      #kz-live .kz-sw input:checked::after { transform: translateX(12px); }
      #kz-live .kz-live-top button {
        border: 0;
        background: rgba(243,234,216,0.12);
        color: #f3ead8;
        border-radius: 999px;
        padding: 5px 11px;
        min-height: 26px;
        font: 12px/1.2 sans-serif;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.12s ease;
      }
      #kz-live .kz-live-top button:hover { background: rgba(243,234,216,0.22); }
      #kz-live .kz-live-top button:active { transform: scale(0.97); }
      #kz-live .kz-live-stage {
        display: grid;
      }
      #kz-live .kz-live-pane {
        grid-area: 1 / 1;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.28s ease;
      }
      #kz-live .kz-live-pane.on {
        opacity: 1;
        z-index: 1;
        pointer-events: auto;
      }
      #kz-live .kz-live-en { font-weight: 500; }
      #kz-live .kz-live-zh {
        margin-top: 3px;
        color: rgba(255,255,255,0.82);
        font-size: calc(var(--kz-live-size, 16px) * 0.82);
        font-weight: 400;
      }
      #kz-live .kz-cc-w {
        display: inline-block;
        margin: 0 -1px;
        padding: 1px 4px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        line-height: 1.35;
        cursor: pointer;
        border-radius: 4px;
        border-bottom: 1px dotted rgba(243,234,216,0.55);
        user-select: text;
        -webkit-user-select: text;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      #kz-live .kz-cc-w:hover { background: rgba(243,234,216,0.16); }
      #kz-live .kz-cc-w.kz-cc-hit,
      #kz-live .kz-cc-w.on {
        background: rgba(196, 71, 45, 0.45);
        border-bottom-color: transparent;
      }
      #kz-live .kz-cc-w.kz-cc-mark {
        border-bottom: 2px solid #f0c36a;
      }
      #kz-lex {
        position: fixed;
        z-index: 2147483647;
        box-sizing: border-box;
        width: min(360px, calc(100vw - 24px));
        padding: 10px 12px 12px;
        border-radius: 12px;
        background: rgba(20, 17, 12, 0.94);
        color: #f3ead8;
        font: 13.5px/1.45 sans-serif;
        box-shadow: 0 10px 28px rgba(0,0,0,0.4);
        pointer-events: auto;
      }
      #kz-lex[hidden] { display: none !important; }
      #kz-lex .kz-lex-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      #kz-lex .kz-lex-word {
        margin: 0;
        border: 0;
        background: none;
        color: inherit;
        font: 700 18px/1.2 sans-serif;
        cursor: pointer;
        padding: 0;
      }
      #kz-lex .kz-lex-acts {
        display: flex;
        gap: 6px;
        margin-left: auto;
      }
      #kz-lex .kz-lex-acts button,
      #kz-lex .kz-lex-more,
      #kz-lex .kz-lex-err button {
        border: 0;
        background: rgba(243,234,216,0.12);
        color: #f3ead8;
        border-radius: 999px;
        padding: 5px 11px;
        min-height: 26px;
        font: 12px/1.2 sans-serif;
        cursor: pointer;
      }
      #kz-lex .kz-lex-err button { margin-left: 8px; }
      #kz-lex .kz-lex-ph { margin-top: 4px; color: #cfc4b0; font-size: 12px; }
      #kz-lex .kz-lex-zh { margin-top: 6px; font-size: 14px; }
      #kz-lex .kz-lex-en { margin-top: 3px; color: #d8cbb6; font-size: 12.5px; }
      #kz-lex .kz-lex-ctx { margin-top: 8px; color: #d8cbb6; font-size: 12.5px; }
      #kz-lex .kz-lex-wait,
      #kz-lex .kz-lex-err { margin-top: 8px; color: #cfc4b0; font-size: 12.5px; }
      #kz-marks {
        position: absolute;
        z-index: 42;
        pointer-events: none;
        overflow: visible;
      }
      #kz-marks .kz-chapters {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 100%;
        height: 3px;
        margin-bottom: 2px;
        pointer-events: none;
      }
      #kz-marks .kz-ch {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 1px;
      }
      #kz-marks .kz-pin,
      #kz-marks .kz-walker,
      #kz-marks .kz-resume {
        position: absolute;
        pointer-events: auto;
        border: 0;
        padding: 0;
        cursor: pointer;
      }
      #kz-marks .kz-resume {
        top: 0;
        bottom: 0;
        width: 2px;
        background: #f0c36a;
        transform: translateX(-50%);
        box-shadow: 0 0 0 1px rgba(20,17,12,0.45);
        z-index: 2;
      }
      #kz-marks .kz-pin {
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #fffaf3;
        box-shadow: 0 0 0 1.5px #c4472d;
        transform: translate(-50%, -50%);
        overflow: hidden;
        z-index: 3;
      }
      #kz-marks .kz-pin.has-note {
        box-shadow: 0 0 0 2.5px #c4472d;
      }
      #kz-marks .kz-walker {
        bottom: 100%;
        top: auto;
        width: 20px;
        height: 20px;
        margin-bottom: 2px;
        border-radius: 50%;
        background: #fffaf3;
        border: 1.5px solid #fffaf3;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        transform: translateX(-50%);
        overflow: hidden;
        z-index: 4;
      }
      #kz-knob {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
        background: transparent;
        border: 0;
        box-shadow: none;
      }
      #kz-marks img,
      #kz-marks svg,
      #kz-knob img,
      #kz-knob svg { width: 100%; height: 100%; display: block; object-fit: cover; pointer-events: none; }
    `;
  }

  const LIVE_FONTS = {
    sans: { css: 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif', label: "无衬线" },
    serif: { css: 'Georgia, "Songti SC", "SimSun", "Noto Serif SC", serif', label: "衬线" },
    round: { css: '"Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', label: "圆体" },
    mono: { css: 'ui-monospace, "Cascadia Mono", "Sarasa Mono SC", "Microsoft YaHei", monospace', label: "等宽" },
  };
  const LIVE_SIZE_MIN = 13;
  const LIVE_SIZE_MAX = 28;

  let liveCcOn = false;
  let liveMode = "bilingual";
  let liveSize = 16;
  let liveFont = "sans";
  let liveVocab = new Set();
  let liveSegments = [];
  let liveTranslations = {};
  let liveSegId = "";
  let livePaintKey = "";
  let liveContentKey = "";
  let liveWordsKey = "";
  let liveWord = "";
  let liveMarks = new Set();
  let liveDefCache = new Map();
  let liveHoldIdx = -1;
  let liveFront = 0;
  let liveGeom = "";
  let liveRaf = 0;
  let liveNewT = 0;
  let liveZhBusy = false;
  let liveFetchedAt = "";
  let liveZhAsked = new Set();
  let liveZhFail = new Set();
  let liveZhFailAt = {};
  let liveZhTries = {};
  let liveTrackAt = 0;
  let livePtrHoldT = 0;
  let liveDragging = false;
  let liveMarkLine = null;
  let liveActAt = 0;
  let liveActKind = "";
  let livePaneFade = 0;

  function paintDock() {
    const loopBtn = document.querySelector("#kz-dock [data-act=loop]");
    if (loopBtn) loopBtn.classList.toggle("on", Boolean(loopRange));
    const ccBtn = document.querySelector("#kz-dock [data-act=cc]");
    if (ccBtn) ccBtn.classList.toggle("on", liveCcOn);
  }

  function pingDock(act) {
    const btn = document.querySelector(`#kz-dock [data-act="${act}"]`);
    if (!btn) return;
    btn.classList.remove("hit");
    void btn.offsetWidth;
    btn.classList.add("hit");
    clearTimeout(btn._hitT);
    btn._hitT = setTimeout(() => btn.classList.remove("hit"), 480);
  }

  function sayAction(action) {
    pingDock(action === "unloop" ? "loop" : action);
    if (action === "quote") toast(t("已记下这句话"));
    else if (action === "note") toast(t("记下这一刻"));
    else if (action === "loop") toast(t("这句会再听一遍"));
    else if (action === "unloop") toast(t("已停循环"));
    else if (action === "open") toast(t("正在打开侧栏"));
  }

  function openSidePanel(extra = {}) {
    if (!extra.quiet) sayAction("open");
    chrome.runtime.sendMessage({ action: "vbOpenPanel", url: location.href, ...currentVideoInfo() }, (res) => {
      void chrome.runtime.lastError;
      if (!res?.ok) toast(t("点右上角 Kaizen 图标打开侧栏"));
    });
  }

  function buildDock() {
    const dock = document.createElement("div");
    dock.id = "kz-dock";
    dock.dataset.rev = String(VB_CONTENT_REV);
    dock.innerHTML = `
      <button type="button" data-act="open" title="${t("打开侧栏")}">K</button>
      <button type="button" data-act="quote" title="${t("记下这句")} R">R</button>
      <button type="button" data-act="loop" title="${t("再听这句")} A">A</button>
      <button type="button" data-act="note" title="${t("记笔记")}">N</button>
      <button type="button" data-act="mark" title="${t("夹在这里")}">B</button>
      <button type="button" data-act="cc" title="${t("片上字幕条")}">C</button>
    `;
    const stopOnBtn = (event) => {
      if (!event.target.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    dock.addEventListener("mousedown", stopOnBtn);
    dock.addEventListener("mouseup", stopOnBtn);
    dock.addEventListener("dblclick", stopOnBtn);
    dock.addEventListener("click", (event) => {
      const act = event.target.closest("button")?.dataset.act;
      if (!act) return;
      stopOnBtn(event);
      if (act === "open") openSidePanel();
      else if (act === "note") openNoteBox();
      else if (act === "loop") {
        if (loopRange) {
          clearLoopWait();
          loopRange = null;
          postHotkey("unloop");
          paintDock();
        } else {
          postHotkey("loop");
          paintDock();
        }
      } else if (act === "quote") postHotkey("quote");
      else if (act === "mark") postHotkey("mark");
      else if (act === "cc") setLiveCc(!liveCcOn);
    });
    return dock;
  }

  let playerMarkState = { marks: [], face: "ribbon", faceData: "", resume: 0, videoId: "", blocks: [] };
  let playerMarkKey = "";
  const BLOCK_COLORS = {
    concept: "#5b8def",
    case: "#3aa06a",
    story: "#9b6bd6",
    action: "#d4922a",
    qa: "#d45b6a",
  };

  function playerClock(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function playerFaceHtml(face, data, size) {
    if (face === "custom" && data) return `<img alt="" src="${data}">`;
    const src = typeof markFaceUrl === "function" ? markFaceUrl(face) : "";
    if (src) return `<img alt="" src="${src}">`;
    const s = size || 16;
    const wrap = (inner) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${inner}</svg>`;
    if (face === "cat") {
      return wrap(
        `<path fill="#3a3228" d="M4.2 9.2 7.6 3.4l2.2 5.2h4.4l2.2-5.2 3.4 5.8c.6 6.2-3.2 10.6-7.8 10.6S3.6 15.4 4.2 9.2z"/><circle fill="#f4e7c8" cx="9" cy="12.2" r="1.35"/><circle fill="#f4e7c8" cx="15" cy="12.2" r="1.35"/>`,
      );
    }
    if (face === "dog") {
      return wrap(
        `<path fill="#8a5a32" d="M5.2 10.2c0-3.2 2.4-5.2 6.8-5.2s6.8 2 6.8 5.2c0 4.4-2.6 7.8-6.8 7.8s-6.8-3.4-6.8-7.8z"/><circle fill="#2a2018" cx="9.5" cy="11.4" r="1"/><circle fill="#2a2018" cx="14.5" cy="11.4" r="1"/>`,
      );
    }
    if (face === "bird") {
      return wrap(
        `<ellipse fill="#4a7ea8" cx="12.4" cy="13.1" rx="6.8" ry="5"/><circle fill="#2d5478" cx="7.4" cy="11.5" r="3.1"/><path fill="#d4922a" d="M3.1 11.7h3.3l-3.3 1.5z"/>`,
      );
    }
    if (face === "enso") {
      return wrap(`<circle cx="12" cy="12" r="7.2" fill="none" stroke="#1a1611" stroke-width="2.1"/>`);
    }
    if (face === "seal") {
      return wrap(
        `<rect x="4" y="4" width="16" height="16" rx="3" fill="#b83c28"/><text x="12" y="16.4" text-anchor="middle" fill="#fffaf4" font-size="11" font-weight="700" font-family="Georgia, serif">K</text>`,
      );
    }
    return wrap(`<path fill="#b83c28" d="M7 2.6h10v18.2l-5-3.4-5 3.4z"/>`);
  }

  function progressHost() {
    return (
      document.querySelector(".ytp-progress-bar") ||
      document.querySelector(".ytp-progress-list") ||
      document.querySelector(".bpx-player-progress") ||
      document.querySelector(".ytp-progress-bar-container") ||
      document.querySelector(".bpx-player-progress-wrap") ||
      null
    );
  }

  function nativeScrubber() {
    return document.querySelector(".ytp-scrubber-button") || document.querySelector(".bpx-player-progress-handle") || null;
  }

  function alignMarksBox(box, track, player) {
    if (!box || !track || !player) return false;
    const pr = player.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    if (tr.width < 8 || tr.height < 1 || pr.width < 8) {
      box.hidden = true;
      return false;
    }
    box.hidden = false;
    const height = Math.min(Math.max(tr.height, 3), 7);
    box.style.left = `${tr.left - pr.left}px`;
    box.style.top = `${tr.top - pr.top}px`;
    box.style.width = `${tr.width}px`;
    box.style.height = `${height}px`;
    return true;
  }

  function loadPlayerMarks() {
    const id = videoIdFromUrl(location.href);
    if (!id) return;
    chrome.storage.local.get(["vb_marks", "vb_settings", "vb_shelf", "vb_watch_resume", `vb_cache_${id}`], (stored) => {
      playerMarkState.videoId = id;
      playerMarkState.marks = (stored.vb_marks || []).filter((m) => m.videoId === id);
      playerMarkState.face = stored.vb_settings?.markFace || "ribbon";
      playerMarkState.faceData = stored.vb_settings?.markFaceData || "";
      playerMarkState.blocks = stored[`vb_cache_${id}`]?.blocks || [];
      const snap = stored.vb_watch_resume;
      if (snap?.videoId === id && Number(snap.seconds) >= 20) {
        playerMarkState.resume = Number(snap.seconds);
      } else {
        const item = (stored.vb_shelf || []).find((s) => s.videoId === id);
        playerMarkState.resume = Number(item?.lastSeconds) >= 20 ? Number(item.lastSeconds) : 0;
      }
      playerMarkKey = "";
      paintPlayerMarks({ force: true });
    });
  }

  function paintNativeKnob() {
    const knob = nativeScrubber();
    if (!knob) {
      document.getElementById("kz-knob")?.remove();
      return false;
    }
    let face = document.getElementById("kz-knob");
    if (!face || face.parentElement !== knob) {
      face?.remove();
      face = document.createElement("div");
      face.id = "kz-knob";
      knob.appendChild(face);
    }
    const token = `${playerMarkState.face}|${playerMarkState.faceData ? "1" : "0"}`;
    if (face.dataset.face !== token) {
      face.dataset.face = token;
      face.innerHTML = playerFaceHtml(playerMarkState.face, playerMarkState.faceData, 18);
    }
    return true;
  }

  function chapterHtml(dur) {
    const blocks = playerMarkState.blocks || [];
    if (!blocks.length || !dur) return "";
    return `<div class="kz-chapters">${blocks
      .map((b) => {
        const start = Math.max(0, Number(b.start) || 0);
        const end = Math.max(start, Number(b.end) || start);
        const left = (start / dur) * 100;
        const width = Math.max(0.4, ((end - start) / dur) * 100);
        const color = BLOCK_COLORS[b.category] || "#b83c28";
        const title = String(b.title || "").replace(/"/g, "");
        return `<i class="kz-ch" style="left:${left}%;width:${width}%;background:${color}" title="${title}"></i>`;
      })
      .join("")}</div>`;
  }

  function paintPlayerMarks(opts = {}) {
    watchProgressDom();
    if (isYouTubeAd()) {
      document.getElementById("kz-marks")?.remove();
      document.getElementById("kz-knob")?.remove();
      return;
    }
    const player = playerHost();
    const track = progressHost();
    const video = pageVideo();
    if (!player || !track || !video) {
      document.getElementById("kz-marks")?.remove();
      return;
    }
    let box = document.getElementById("kz-marks");
    if (!box || box.parentElement !== player) {
      box?.remove();
      box = document.createElement("div");
      box.id = "kz-marks";
      player.appendChild(box);
      box.addEventListener("click", (event) => {
        const pin = event.target.closest("[data-sec], [data-act]");
        if (!pin) return;
        event.preventDefault();
        event.stopPropagation();
        const sec = Number(pin.dataset.sec);
        if (!Number.isFinite(sec) || !pageVideo()) return;
        pageVideo().currentTime = Math.max(0, sec);
        pageVideo().play().catch(() => {});
      });
      box.addEventListener("mousedown", (event) => {
        if (event.target.closest("[data-sec], [data-act]")) event.stopPropagation();
      });
    }
    const dur = Number(video.duration) || 0;
    if (!dur) return;
    const now = Number(video.currentTime) || 0;
    const face = playerFaceHtml(playerMarkState.face, playerMarkState.faceData, 14);
    const walkPct = Math.max(0, Math.min(100, (now / dur) * 100));
    const hasKnob = paintNativeKnob();
    const key = `${playerMarkState.marks.map((m) => `${m.id}:${m.seconds}:${m.label}:${m.note}`).join("|")}|${playerMarkState.face}|${playerMarkState.resume}|${playerMarkState.blocks.length}|${hasKnob ? "k" : "w"}`;
    if (opts.force || key !== playerMarkKey) {
      playerMarkKey = key;
      const resume = playerMarkState.resume;
      const resumeHtml =
        resume >= 20
          ? `<button type="button" class="kz-resume" data-sec="${resume}" title="${t("上次看到")} ${playerClock(resume)}"></button>`
          : "";
      const pins = playerMarkState.marks
        .map((m) => {
          const pct = Math.max(0, Math.min(100, (Number(m.seconds) / dur) * 100));
          const label = String(m.label || "").replace(/"/g, "");
          const note = String(m.note || "").replace(/"/g, "").replace(/\n/g, " ");
          const tip = note ? `${playerClock(m.seconds)} ${label} — ${note}` : `${playerClock(m.seconds)} ${label}`;
          return `<button type="button" class="kz-pin${note ? " has-note" : ""}" data-sec="${Number(m.seconds) || 0}" style="left:${pct}%" title="${tip}">${face}</button>`;
        })
        .join("");
      const walker = hasKnob
        ? ""
        : `<button type="button" class="kz-walker" title="${t("现在这里")}">${face}</button>`;
      box.innerHTML = `${chapterHtml(dur)}${resumeHtml}${walker}${pins}`;
      const resumeEl = box.querySelector(".kz-resume");
      if (resumeEl) resumeEl.style.left = `${Math.max(0, Math.min(100, (resume / dur) * 100))}%`;
    }
    if (opts.force || Date.now() - (paintPlayerMarks._alignAt || 0) > 400) {
      paintPlayerMarks._alignAt = Date.now();
      alignMarksBox(box, track, player);
    }
    const walker = box.querySelector(".kz-walker");
    if (walker) walker.style.left = `${walkPct}%`;
    const resumeEl = box.querySelector(".kz-resume");
    if (resumeEl) resumeEl.hidden = Math.abs(now - playerMarkState.resume) <= 8;
  }
  globalThis.paintPlayerMarks = paintPlayerMarks;

  function watchProgressDom() {
    const player = document.querySelector("#movie_player") || document.querySelector(".bpx-player-container");
    if (player?.__kzObs) {
      try {
        player.__kzObs.disconnect();
      } catch (_e) {}
      player.__kzObs = null;
    }
    if (watchProgressDom._t) return;
    watchProgressDom._t = setInterval(() => {
      if (!contentLive()) return;
      const host = playerHost();
      if (!host) return;
      const box = document.getElementById("kz-marks");
      if (!box || box.parentElement !== host) paintPlayerMarks({ force: true });
      else {
        paintNativeKnob();
        alignMarksBox(box, progressHost(), host);
      }
    }, 480);
  }

  function placeDock(dock, player) {
    if (!dock) return;
    dock.dataset.place = "page";
    const host = player || playerHost();
    if (!host) {
      dock.style.right = "12px";
      dock.style.bottom = "88px";
      return;
    }
    const rect = host.getBoundingClientRect();
    const chrome = host.querySelector(".ytp-chrome-bottom, .bpx-player-control-bottom, .bpx-player-control-wrap");
    const rightCtl = host.querySelector(".ytp-right-controls, .bpx-player-ctrl-btn-group-right");
    const chromeH = chrome ? chrome.getBoundingClientRect().height : 0;
    const gap = Math.max(52, chromeH + 10);
    let right = Math.max(12, window.innerWidth - rect.right + 12);
    if (rightCtl) {
      const rr = rightCtl.getBoundingClientRect();
      if (rr.width > 8) right = Math.max(12, window.innerWidth - rr.left + 10);
    }
    dock.style.right = `${right}px`;
    dock.style.bottom = `${Math.max(12, window.innerHeight - rect.bottom + gap)}px`;
  }

  function ensureDock() {
    injectDockStyle();
    const watching = Boolean(videoIdFromUrl(location.href) && pageVideo());
    const dock = document.getElementById("kz-dock");
    if (!watching) {
      dock?.remove();
      return;
    }
    const host = playerHost();
    if (dock && dock.parentElement === document.body && dock.dataset.rev === String(VB_CONTENT_REV)) {
      placeDock(dock, host);
      paintDock();
      return;
    }
    dock?.remove();
    const next = buildDock();
    next.dataset.place = "page";
    next.dataset.rev = String(VB_CONTENT_REV);
    document.body.appendChild(next);
    placeDock(next, host);
    paintDock();
    loadPlayerMarks();
  }

  function toast(text) {
    document.getElementById("vb-toast")?.remove();
    const el = document.createElement("div");
    el.id = "vb-toast";
    el.textContent = text;
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "72px",
      transform: "translateX(-50%)",
      zIndex: "999999",
      background: "rgba(20,17,12,0.92)",
      color: "#f3ead8",
      padding: "8px 14px",
      borderRadius: "999px",
      font: "13px/1.4 sans-serif",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function showHelp() {
    document.getElementById("vb-keys")?.remove();
    const box = document.createElement("div");
    box.id = "vb-keys";
    box.innerHTML = `<b>Kaizen</b><br>
      ${t("看进度条：夹过的点可以点跳。")}<br>
      ${t("右下 K / R / A / N / B / C")}<br>
      R ${t("记下这句")} · A ${t("再听")} · B ${t("夹书签")} · C ${t("片上字幕条")}<br>
      ${t("点这张卡关掉")}`;
    Object.assign(box.style, {
      position: "fixed",
      right: "16px",
      bottom: "80px",
      zIndex: "999999",
      background: "rgba(20,17,12,0.94)",
      color: "#f3ead8",
      padding: "12px 14px",
      borderRadius: "12px",
      font: "12.5px/1.55 sans-serif",
      maxWidth: "260px",
      cursor: "pointer",
    });
    box.addEventListener("click", () => box.remove());
    document.body.appendChild(box);
  }

  function openNoteBox() {
    sayAction("note");
    document.getElementById("vb-note")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "vb-note";
    wrap.innerHTML = `<div style="font-weight:700;margin-bottom:6px">记下这一刻</div>
      <textarea style="width:260px;height:72px;border-radius:8px;border:0;padding:8px;font:13px sans-serif"></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
        <button type="button" data-k="cancel">取消</button>
        <button type="button" data-k="ok">保存</button>
      </div>`;
    Object.assign(wrap.style, {
      position: "fixed",
      left: "50%",
      bottom: "80px",
      transform: "translateX(-50%)",
      zIndex: "999999",
      background: "#fffdf8",
      color: "#2c2418",
      padding: "12px",
      borderRadius: "14px",
      boxShadow: "0 12px 32px rgba(0,0,0,.25)",
      font: "13px sans-serif",
    });
    document.body.appendChild(wrap);
    const ta = wrap.querySelector("textarea");
    ta.focus();
    wrap.addEventListener("click", (event) => {
      const k = event.target.dataset.k;
      if (k === "cancel") wrap.remove();
      if (k === "ok") {
        const text = ta.value.trim();
        if (!text) {
          toast(t("先写一句再保存。"));
          return;
        }
        postHotkey("note", { text, quiet: true });
        toast(t("已记下"));
        wrap.remove();
      }
    });
  }

  function stopLocalLoop() {
    if (!loopRange) return false;
    clearLoopWait();
    loopRange = null;
    return true;
  }

  function loopNearby() {
    const video = pageVideo();
    if (!video) return false;
    if (loopRange) {
      clearLoopWait();
      loopRange = null;
      return false;
    }
    const t = video.currentTime;
    loopRange = { start: Math.max(0, t - 0.2), end: t + 6 };
    video.currentTime = loopRange.start;
    video.play().catch(() => {});
    return true;
  }

  function postHotkey(action, extra = {}) {
    const info = currentVideoInfo();
    const seconds = Number(extra.seconds);
    const payload = {
      id: Date.now(),
      action,
      videoId: info.videoId || "",
      title: info.title || "",
      seconds: Number.isFinite(seconds) ? seconds : info.currentTime || 0,
      caption: extra.caption || pageCaption(),
      text: extra.text || "",
    };
    if (!extra.quiet) sayAction(action);
    chrome.storage.local.get("vb_inbox_q", (stored) => {
      const q = Array.isArray(stored.vb_inbox_q) ? stored.vb_inbox_q.slice() : [];
      q.push(payload);
      if (q.length > 20) q.splice(0, q.length - 20);
      chrome.storage.local.set({ vb_inbox: payload, vb_inbox_q: q });
    });
    chrome.runtime.sendMessage({ action: "vbHotkey", hotkey: payload }, (res) => {
      void chrome.runtime.lastError;
      const panel = Boolean(res?.ok && res.panel);
      if (action === "mark") {
        const at = playerClock(res?.at ?? payload.seconds);
        if (res?.near) toast(t("刚夹过"));
        else if (res?.pinned || !panel) toast(t("已夹在 {t}", { t: at }));
        return;
      }
      if (action === "loop") {
        if (panel) {
          const started = Date.now();
          setTimeout(() => {
            if (lastPanelLoopAt >= started) return;
            toast(loopNearby() ? t("侧栏没接到视频，先循环附近几秒") : t("循环没发出去"));
          }, 800);
          return;
        }
        toast(loopNearby() ? t("侧栏没开，先循环附近几秒") : t("循环没发出去"));
        return;
      }
      if (action === "quote" && !panel) {
        toast(t("记下了，打开侧栏后会写进金句"));
        return;
      }
      if (action === "note" && !panel) {
        toast(t("侧栏没开，打开后才会写入"));
      }
    });
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!contentLive()) return;
      if (event.repeat) return;
      if (event.code === "Escape") {
        const note = document.getElementById("vb-note");
        if (note) {
          event.preventDefault();
          note.remove();
          return;
        }
        if (typingIn(event.target) || !loopRange) return;
        event.preventDefault();
        event.stopPropagation();
        clearLoopWait();
        loopRange = null;
        postHotkey("unloop");
        paintDock();
        return;
      }
      if (typingIn(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.code === "KeyH") {
        event.preventDefault();
        const existing = document.getElementById("vb-keys");
        if (existing) existing.remove();
        else showHelp();
        return;
      }
      const action = HOTKEYS[event.code];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "note") {
        openNoteBox();
        return;
      }
      if (action === "loop" && loopRange) {
        clearLoopWait();
        loopRange = null;
        postHotkey("unloop");
        paintDock();
        return;
      }
      postHotkey(action);
      if (action === "loop") paintDock();
    },
    true,
  );

  function stripOldCaptionWraps() {
    for (const el of document.querySelectorAll(".ytp-caption-segment, .bpx-player-subtitle-panel-text, .bpx-player-subtitle")) {
      if (!el.querySelector(".kz-cc-w")) continue;
      const plain = el.dataset.kzCc || String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      el.textContent = plain;
      delete el.dataset.kzCc;
    }
  }

  function escLive(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function liveWordsHtml(text) {
    const src = String(text || "");
    const re = /\b[A-Za-z][A-Za-z'-]{1,39}\b/g;
    let last = 0;
    let html = "";
    let m;
    while ((m = re.exec(src))) {
      html += escLive(src.slice(last, m.index));
      const word = m[0];
      const low = word.toLowerCase();
      const cls = ["kz-cc-w"];
      if (liveVocab.has(low)) cls.push("kz-cc-hit");
      if (liveMarks.has(low)) cls.push("kz-cc-mark");
      if (liveWord && liveWord.toLowerCase() === low) cls.push("on");
      html += `<span class="${cls.join(" ")}" data-word="${escLive(word)}" role="button">${escLive(word)}</span>`;
      last = m.index + word.length;
    }
    return html + escLive(src.slice(last));
  }

  function currentLiveSeg(seconds) {
    if (!liveSegments.length) return null;
    const t = Number(seconds) || 0;
    const firstStart = Number(liveSegments[0].start) || 0;
    if (t + 0.05 < firstStart) {
      liveHoldIdx = -1;
      return null;
    }
    let hit = liveSegments[0];
    let idx = 0;
    for (let i = 0; i < liveSegments.length; i++) {
      if (liveSegments[i].start <= t + 0.05) {
        hit = liveSegments[i];
        idx = i;
      } else break;
    }
    if (liveHoldIdx >= 0 && liveHoldIdx < liveSegments.length) {
      const cur = liveSegments[liveHoldIdx];
      const nextStart = liveSegments[liveHoldIdx + 1]?.start;
      const holdEnd = Number(cur.end) || (Number.isFinite(nextStart) && nextStart - cur.start < 8 ? nextStart : cur.start + 4);
      if (t >= cur.start - 0.2 && t < holdEnd + 0.08) {
        return { seg: cur, idx: liveHoldIdx };
      }
    }
    const nextStart = liveSegments[idx + 1]?.start;
    const end = Number(hit.end) || nextStart;
    if (end && t > Number(end) + 0.12) {
      liveHoldIdx = -1;
      return null;
    }
    liveHoldIdx = idx;
    return { seg: hit, idx };
  }

  function liveLineAt(seconds) {
    const hit = currentLiveSeg(seconds);
    return {
      hit,
      text: hit?.seg?.text || (!liveSegments.length ? pageCaption() : "") || "",
      start: Number(hit?.seg?.start) || Number(seconds) || 0,
      zh: hit ? String(liveTranslations[hit.idx] || "").trim() : "",
    };
  }

  function liveMountHost() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) return fs;
    const biliFs = document.querySelector(
      ".bpx-player-container.bpx-state-web-fullscreen, .bpx-player-container.bpx-state-fullscreen",
    );
    if (biliFs) return biliFs;
    return document.body || document.documentElement;
  }

  function mountLiveBar(bar) {
    const host = liveMountHost();
    if (!bar || !host) return host;
    bar.dataset.host = host === document.body || host === document.documentElement ? "page" : "player";
    if (bar.parentElement !== host) {
      host.appendChild(bar);
      liveGeom = "";
    }
    return host;
  }

  function liveOverlayRoot(event) {
    const el = event.target;
    if (!(el instanceof Element)) return null;
    return el.closest("#kz-live, #kz-lex");
  }

  function liveBarBusy(bar) {
    return liveDragging || Date.now() < livePtrHoldT || Boolean(bar?.matches(":active"));
  }

  function sayLiveWord(word = liveWord) {
    try {
      if (!word || !globalThis.speechSynthesis) return;
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
    } catch (_e) {}
  }

  function liveSelectionText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    const text = String(sel).replace(/\s+/g, " ").trim();
    if (text.length < 2) return "";
    const node = sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el?.closest?.("#kz-live .kz-live-en")) return "";
    return text;
  }

  function handleLiveOverlayClick(event) {
    if (event.target.closest("#kz-lex")) {
      const act = event.target.closest("button[data-act]")?.dataset.act;
      if (act === "mark") markLiveWord();
      else if (act === "save") saveLiveWord();
      else if (act === "close") {
        closeLexCard();
        paintLiveWordFlags();
      } else if (act === "say") sayLiveWord();
      else if (act === "retry" && liveWord) {
        liveDefCache.delete(liveWord.toLowerCase());
        openLexCard(liveWord);
      }
      return;
    }
    if (!event.target.closest("#kz-live")) return;
    const act = event.target.closest("button[data-act]")?.dataset.act;
    if (act === "jump") jumpLiveLine();
    else if (act === "loop") loopLiveLine();
    const wordBtn = event.target.closest(".kz-cc-w");
    if (wordBtn) pickLiveWord(wordBtn.dataset.word);
  }

  function bindLivePointerGuard() {
    const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"];
    const prev = globalThis.__kzLiveGuard;
    if (typeof prev === "function") {
      for (const type of types) document.removeEventListener(type, prev, true);
    }
    const endLivePtr = (event) => {
      liveDragging = false;
      livePtrHoldT = Date.now() + 180;
      event.stopImmediatePropagation();
      if (event.target.closest(".kz-live-top button, #kz-lex")) return;
      if (liveActKind === "sel-mark" && Date.now() - liveActAt < 80) return;
      const span = event.target.closest("#kz-live") ? liveSelectionText() : "";
      if (span) {
        liveActKind = "sel-mark";
        liveActAt = Date.now();
        markLiveWord(span);
      }
    };
    const on = (event) => {
      if (!liveOverlayRoot(event)) return;
      if (event.type === "pointerdown" || event.type === "mousedown") {
        liveDragging = true;
        livePtrHoldT = Date.now() + 480;
        liveMarkLine = liveLineAt(pageVideo()?.currentTime || 0);
        event.stopImmediatePropagation();
        return;
      }
      if (event.type === "pointerup" || event.type === "mouseup") {
        endLivePtr(event);
        return;
      }
      event.stopImmediatePropagation();
      if (event.type === "dblclick") return;
      if (event.type === "click") event.preventDefault();
      if (event.target.closest("#kz-lex")) {
        handleLiveOverlayClick(event);
        return;
      }
      if (liveActKind === "sel-mark" && Date.now() - liveActAt < 320) return;
      handleLiveOverlayClick(event);
    };
    globalThis.__kzLiveGuard = on;
    for (const type of types) document.addEventListener(type, on, true);
  }

  function ensureLiveBar() {
    let bar = document.getElementById("kz-live");
    if (bar) {
      mountLiveBar(bar);
      return bar;
    }
    bar = document.createElement("div");
    bar.id = "kz-live";
    bar.hidden = true;
    bar.innerHTML = `
      <div class="kz-live-top">
        <button type="button" data-act="jump">${t("跳这句")}</button>
        <button type="button" data-act="loop">${t("再听")}</button>
      </div>
      <div class="kz-live-stage">
        <div class="kz-live-pane on" data-pane="0">
          <div class="kz-live-en"></div>
          <div class="kz-live-zh"></div>
        </div>
        <div class="kz-live-pane" data-pane="1">
          <div class="kz-live-en"></div>
          <div class="kz-live-zh"></div>
        </div>
      </div>
    `;
    mountLiveBar(bar);
    applyLiveStyle(bar);
    return bar;
  }

  function applyLiveGeom(bar, left, width, bottom) {
    const l = Math.round(left);
    const w = Math.round(width);
    const b = Math.round(bottom);
    if (liveGeom) {
      const [pl, pw, pb] = liveGeom.split("|").map(Number);
      if (Math.abs(pl - l) < 4 && Math.abs(pw - w) < 6 && Math.abs(pb - b) < 4) return;
    }
    liveGeom = `${l}|${w}|${b}`;
    bar.style.left = `${l}px`;
    bar.style.width = `${w}px`;
    bar.style.bottom = `${b}px`;
  }

  function placeLiveBar() {
    const bar = document.getElementById("kz-live");
    if (!bar || bar.hidden) return;
    const host = mountLiveBar(bar);
    const box = (playerHost() || pageVideo())?.getBoundingClientRect();
    if (!box || box.width < 80) {
      applyLiveGeom(bar, 12, Math.max(280, window.innerWidth - 24), 80);
      placeLexCard();
      return;
    }
    const chrome = document.querySelector(".ytp-chrome-bottom, .bpx-player-control-bottom, .bpx-player-control-wrap");
    const chromeTop = chrome?.getBoundingClientRect().top;
    const chromeH = Number.isFinite(chromeTop) ? Math.min(130, Math.max(0, box.bottom - chromeTop)) : 56;
    const lift = Math.max(58, chromeH + 14);
    const width = Math.min(760, Math.max(280, box.width * 0.78));
    const leftView = box.left + (box.width - width) / 2;
    const inPlayer = bar.dataset.host === "player" && host && host !== document.body && host !== document.documentElement;
    if (inPlayer) {
      const hr = host.getBoundingClientRect();
      applyLiveGeom(bar, leftView - hr.left, width, Math.max(12, hr.bottom - box.bottom + lift));
    } else {
      applyLiveGeom(bar, leftView, width, Math.max(12, window.innerHeight - box.bottom + lift));
    }
    placeLexCard();
  }

  function compactDefHtml(def) {
    const sense = (def?.senses || []).find((s) => s.zh || s.en) || {};
    const zh = String(sense.zh || def?.meaning || "").trim();
    const en = String(sense.en || "").trim();
    const ph = String(def?.phonetic || "").trim();
    const ctx = String(def?.inContext || "").trim();
    return `
      ${ph ? `<div class="kz-lex-ph">${escLive(ph)}</div>` : ""}
      ${zh ? `<div class="kz-lex-zh">${escLive(zh)}</div>` : ""}
      ${en ? `<div class="kz-lex-en">${escLive(en)}</div>` : ""}
      ${ctx ? `<div class="kz-lex-ctx">${escLive(ctx)}</div>` : ""}
    `;
  }

  function placeLexCard() {
    const card = document.getElementById("kz-lex");
    const bar = document.getElementById("kz-live");
    if (!card || card.hidden || !bar || bar.hidden) return;
    const host = mountLiveBar(card);
    const br = bar.getBoundingClientRect();
    const inPlayer = card.dataset.host === "player" && host && host !== document.body && host !== document.documentElement;
    if (inPlayer) {
      const hr = host.getBoundingClientRect();
      card.style.left = `${Math.max(8, br.left - hr.left)}px`;
      card.style.bottom = `${Math.max(8, hr.bottom - br.top + 8)}px`;
    } else {
      card.style.left = `${Math.max(12, br.left)}px`;
      card.style.bottom = `${Math.max(12, window.innerHeight - br.top + 8)}px`;
    }
    card.style.width = `${Math.min(360, Math.max(240, br.width))}px`;
  }

  function closeLexCard() {
    liveWord = "";
    const card = document.getElementById("kz-lex");
    if (card) card.hidden = true;
  }

  function ensureLexCard() {
    let card = document.getElementById("kz-lex");
    if (card) return card;
    card = document.createElement("div");
    card.id = "kz-lex";
    card.hidden = true;
    mountLiveBar(card);
    return card;
  }

  function paintLexActions(card) {
    const known = liveVocab.has(liveWord.toLowerCase());
    const marked = liveMarks.has(liveWord.toLowerCase());
    const acts = card.querySelector(".kz-lex-acts");
    if (!acts) return;
    acts.innerHTML = `
      <button type="button" data-act="mark">${marked ? t("已划上") : t("划")}</button>
      <button type="button" data-act="save">${known ? t("已在本") : t("存")}</button>
      <button type="button" data-act="close">×</button>
    `;
  }

  function fillLexBody(card, html) {
    const body = card.querySelector(".kz-lex-body");
    if (body) body.innerHTML = html;
  }

  function sendLiveBg(message) {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        resolve({ ok: false, error: t("扩展刚重载过，刷新这个视频页再试。") });
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (res) => {
          const err = chrome.runtime.lastError?.message || "";
          if (err) {
            resolve({
              ok: false,
              error: /invalidated/i.test(err) ? t("扩展刚重载过，刷新这个视频页再试。") : err,
            });
            return;
          }
          resolve(res || { ok: false, error: t("查词失败") });
        });
      } catch (error) {
        resolve({ ok: false, error: error.message || t("查词失败") });
      }
    });
  }

  function liveAiError(res) {
    const raw = String(res?.error || "").trim();
    if (res?.code === "NO_KEY" || /没有配置|DeepSeek Key|初始设置|NO_KEY|401|invalid api/i.test(raw)) {
      return t("钥匙无效或还没填，去设置里看一下。");
    }
    if (/invalidated|context/i.test(raw)) return t("扩展刚重载过，刷新这个视频页再试。");
    if (/402|insufficient|balance|额度|欠费/i.test(raw)) return t("DeepSeek 额度不够了，去官网看一下余额。");
    if (/429|too many|频繁/i.test(raw)) return t("请求太密了，等几秒再试。");
    if (/超时|timeout|Failed to fetch|network|网络/i.test(raw)) return t("网络卡住了，点重试。");
    if (/JSON|格式乱了|释义为空|无效的词/i.test(raw)) return t("模型这次吐出来的格式乱了，再试一次。");
    if (/[\u4e00-\u9fff]/.test(raw) && raw.length < 48) return raw;
    return raw || t("查词失败");
  }

  function openLexCard(word) {
    const card = ensureLexCard();
    const line = liveLineAt(pageVideo()?.currentTime || 0);
    const cached = liveDefCache.get(word.toLowerCase());
    const bodyHtml = cached ? compactDefHtml(cached) : `<div class="kz-lex-wait">${escLive(t("正在查词典…"))}</div>`;
    card.hidden = false;
    const wordEl = card.querySelector(".kz-lex-word");
    if (wordEl && card.querySelector(".kz-lex-body")) {
      card.dataset.word = word;
      wordEl.textContent = word;
      fillLexBody(card, bodyHtml);
    } else {
      card.dataset.word = word;
      card.innerHTML = `
      <div class="kz-lex-top">
        <button type="button" class="kz-lex-word" data-act="say">${escLive(word)}</button>
        <div class="kz-lex-acts"></div>
      </div>
      <div class="kz-lex-body">${bodyHtml}</div>
    `;
    }
    paintLexActions(card);
    placeLexCard();
    if (cached) return;
    chrome.storage.local.get("vb_vocab", async (stored) => {
      if (liveWord !== word) return;
      const hit = (stored.vb_vocab || []).find(
        (v) => String(v.word || "").toLowerCase() === word.toLowerCase() && v.definition,
      );
      if (hit?.definition) {
        liveDefCache.set(word.toLowerCase(), hit.definition);
        fillLexBody(card, compactDefHtml(hit.definition));
        return;
      }
      const res = await sendLiveBg({
        action: "vbDefine",
        word,
        sentence: line.text,
        videoTitle: currentVideoInfo().title || "",
      });
      if (liveWord !== word || !document.getElementById("kz-lex")) return;
      if (!res?.ok || !res.definition) {
        fillLexBody(
          card,
          `<div class="kz-lex-err">${escLive(liveAiError(res))}<button type="button" data-act="retry">${escLive(t("再试一次"))}</button></div>`,
        );
        return;
      }
      liveDefCache.set(word.toLowerCase(), res.definition);
      fillLexBody(card, compactDefHtml(res.definition));
    });
  }

  function liveModeOf(raw) {
    return raw === "original" || raw === "zh" ? raw : "bilingual";
  }

  function paintLiveMode(bar = document.getElementById("kz-live")) {
    if (!bar) return;
    bar.dataset.mode = liveMode;
  }

  function setLiveMode(mode) {
    const next = liveModeOf(mode);
    if (next === liveMode) return;
    liveMode = next;
    chrome.storage.local.get("vb_settings", (stored) => {
      if (stored.vb_settings?.transcriptMode === liveMode) return;
      chrome.storage.local.set({ vb_settings: { ...(stored.vb_settings || {}), transcriptMode: liveMode } });
    });
    livePaintKey = "";
    liveContentKey = "";
    paintLiveBar();
    if (liveMode !== "original") fillLiveZh();
  }

  function liveFontOf(raw) {
    return LIVE_FONTS[raw] ? raw : "sans";
  }

  function liveSizeOf(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 16;
    return Math.min(LIVE_SIZE_MAX, Math.max(LIVE_SIZE_MIN, Math.round(n)));
  }

  function applyLiveStyle(bar = document.getElementById("kz-live")) {
    if (!bar) return;
    const face = LIVE_FONTS[liveFont] || LIVE_FONTS.sans;
    bar.style.setProperty("--kz-live-size", `${liveSize}px`);
    bar.style.setProperty("--kz-live-font", face.css);
    bar.dataset.size = String(liveSize);
    bar.dataset.font = liveFont;
    const fontBtn = bar.querySelector("[data-act=font]");
    if (fontBtn) {
      fontBtn.textContent = t(face.label);
      fontBtn.title = t("字体");
    }
  }

  function liveZhBlocked(i) {
    if (!Number.isInteger(i) || !liveZhFail.has(i)) return false;
    const at = Number(liveZhFailAt[i]) || 0;
    if (at && Date.now() - at >= 30000) {
      liveZhFail.delete(i);
      delete liveZhFailAt[i];
      delete liveZhTries[i];
      return false;
    }
    return true;
  }

  function markLiveZhFail(i) {
    liveZhFail.add(i);
    liveZhFailAt[i] = Date.now();
  }

  function liveZhAt(i) {
    if (!Number.isInteger(i) || i < 0) return "";
    return String(liveTranslations[i] || liveTranslations[String(i)] || "").trim();
  }

  function enoughLiveZh() {
    if (!liveSegments.length) return false;
    let n = 0;
    const step = Math.max(1, Math.floor(liveSegments.length / 8));
    for (let i = 0; i < liveSegments.length; i += step) {
      if (liveZhAt(i)) n += 1;
    }
    return n >= Math.min(3, liveSegments.length);
  }

  function persistLiveTranslations() {
    const id = videoIdFromUrl(location.href);
    if (!id || !Object.keys(liveTranslations).length) return;
    chrome.storage.local.get(`vb_cache_${id}`, (stored) => {
      const pack = stored[`vb_cache_${id}`];
      if (!pack) return;
      chrome.storage.local.set({
        [`vb_cache_${id}`]: {
          ...pack,
          translations: { ...(pack.translations || {}), ...liveTranslations },
        },
      });
    });
  }

  async function translateLiveAround(idx) {
    if (!Number.isInteger(idx) || liveMode === "original") return;
    const want = [];
    for (let d = 0; d <= 5 && want.length < 8; d++) {
      for (const i of d === 0 ? [idx] : [idx - d, idx + d]) {
        if (i < 0 || i >= liveSegments.length) continue;
        const src = String(liveSegments[i]?.text || "").trim();
        if (!src || liveZhAt(i) || liveZhAsked.has(i) || liveZhBlocked(i)) continue;
        if ((src.match(/[\u4e00-\u9fff]/g) || []).length >= 4) continue;
        want.push(i);
      }
    }
    if (!want.length) return;
    want.forEach((i) => liveZhAsked.add(i));
    try {
      const res = await chrome.runtime.sendMessage({
        action: "vbTranslate",
        lines: want.map((i) => liveSegments[i].text),
      });
      if (!res?.ok) {
        const fatal = /NO_KEY|401|402|钥匙|额度|欠费/i.test(`${res?.code || ""} ${res?.error || ""}`);
        want.forEach((i) => {
          liveZhAsked.delete(i);
          if (fatal) markLiveZhFail(i);
          else {
            liveZhTries[i] = (liveZhTries[i] || 0) + 1;
            if (liveZhTries[i] >= 2) markLiveZhFail(i);
          }
        });
        if (fatal) {
          const zh = document.getElementById("kz-live")?.querySelectorAll(".kz-live-pane")[liveFront]?.querySelector(".kz-live-zh");
          if (zh) {
            zh.textContent = liveAiError(res);
            zh.hidden = false;
          }
        }
        return;
      }
      const list = res.translations || [];
      let wrote = false;
      want.forEach((i, k) => {
        const src = String(liveSegments[i]?.text || "");
        const zh = typeof usableTranslation === "function"
          ? usableTranslation(list[k], src)
          : String(list[k] || "").trim();
        if (zh) {
          liveTranslations[i] = zh;
          liveZhFail.delete(i);
          delete liveZhFailAt[i];
          delete liveZhTries[i];
          wrote = true;
        } else {
          liveZhAsked.delete(i);
          liveZhTries[i] = (liveZhTries[i] || 0) + 1;
          if (liveZhTries[i] >= 3) markLiveZhFail(i);
        }
      });
      if (wrote) persistLiveTranslations();
    } catch (_e) {
      want.forEach((i) => {
        liveZhTries[i] = (liveZhTries[i] || 0) + 1;
        if (liveZhTries[i] >= 2) markLiveZhFail(i);
      });
    } finally {
      want.forEach((i) => liveZhAsked.delete(i));
    }
  }

  function liveStill(id) {
    return Boolean(id) && videoIdFromUrl(location.href) === id;
  }

  async function fillLiveZh() {
    if (liveMode === "original" || liveZhBusy) return;
    const id = videoIdFromUrl(location.href);
    const idx = liveLineAt(pageVideo()?.currentTime || 0).hit?.idx;
    if (Number.isInteger(idx) && liveZhAt(idx)) return;
    liveZhBusy = true;
    try {
      if (id && liveFetchedAt !== id && !enoughLiveZh()) {
        const data = await getTranscript(id);
        if (!liveStill(id)) return;
        liveFetchedAt = id;
        if (data?.translations && Object.keys(data.translations).length) {
          liveTranslations = { ...data.translations, ...liveTranslations };
          persistLiveTranslations();
        }
      }
      if (!liveStill(id)) return;
      if (Number.isInteger(idx) && !liveZhAt(idx)) await translateLiveAround(idx);
    } catch (_e) {
      if (!liveStill(id)) return;
      if (Number.isInteger(idx) && !liveZhAt(idx)) await translateLiveAround(idx);
    } finally {
      liveZhBusy = false;
      if (!liveStill(id) || !Number.isInteger(idx)) return;
      livePaintKey = "";
      paintLiveBar();
    }
  }

  function paintLiveWordFlags(root = document.getElementById("kz-live")) {
    if (!root) return;
    const picked = String(liveWord || "").toLowerCase();
    root.querySelectorAll(".kz-cc-w").forEach((btn) => {
      const low = String(btn.dataset.word || "").toLowerCase();
      btn.classList.toggle("kz-cc-hit", liveVocab.has(low));
      btn.classList.toggle("kz-cc-mark", liveMarks.has(low));
      btn.classList.toggle("on", Boolean(picked) && picked === low);
    });
  }

  function fillLiveEn(en, text, words, emptyHtml = "") {
    if (words) {
      en.innerHTML = text ? liveWordsHtml(text) : emptyHtml;
      return;
    }
    if (text) en.textContent = text;
    else if (emptyHtml) en.innerHTML = emptyHtml;
  }

  function fillLiveZhPane(pane, line) {
    if (!pane) return;
    const zh = pane.querySelector(".kz-live-zh");
    const en = pane.querySelector(".kz-live-en");
    if (!zh) return;
    if (liveMode === "zh" && en) en.style.opacity = line.zh ? "0.62" : "";
    if (liveMode === "original") {
      zh.textContent = "";
      zh.hidden = true;
      return;
    }
    if (line.zh) {
      zh.textContent = line.zh;
      zh.hidden = false;
      return;
    }
    const idx = line.hit?.idx;
    if (Number.isInteger(idx) && liveZhBlocked(idx)) {
      zh.textContent = t("这句没翻出来");
      zh.hidden = false;
      return;
    }
    if (liveZhBusy || (Number.isInteger(idx) && liveZhAsked.has(idx))) {
      zh.textContent = t("正在对照…");
      zh.hidden = false;
      return;
    }
    zh.textContent = "";
    zh.hidden = true;
  }

  function fillLivePane(pane, line, { words = true } = {}) {
    const en = pane.querySelector(".kz-live-en");
    const zh = pane.querySelector(".kz-live-zh");
    const hint = `<span style="font-weight:400;color:#cfc4b0;text-shadow:none">${escLive(t("打开侧栏读出字幕后，这里会跟上这一句。"))}</span>`;
    if (liveMode === "zh") {
      if (line.zh) {
        en.hidden = false;
        en.style.opacity = "0.62";
        fillLiveEn(en, line.text, words, "");
        zh.textContent = line.zh;
        zh.hidden = false;
      } else if (line.text) {
        en.hidden = false;
        en.style.opacity = "";
        fillLiveEn(en, line.text, words, "");
        zh.hidden = true;
      } else {
        en.hidden = false;
        en.style.opacity = "";
        fillLiveEn(en, "", words, hint);
        zh.hidden = true;
      }
      return;
    }
    en.hidden = false;
    en.style.opacity = "";
    fillLiveEn(en, line.text, words, hint);
    if (liveMode === "original") {
      zh.textContent = "";
      zh.hidden = true;
      return;
    }
    if (line.zh) {
      zh.textContent = line.zh;
      zh.hidden = false;
      return;
    }
    const idx = line.hit?.idx;
    if (Number.isInteger(idx) && liveZhBlocked(idx)) {
      zh.textContent = t("这句没翻出来");
      zh.hidden = false;
      return;
    }
    if (liveZhBusy || (Number.isInteger(idx) && liveZhAsked.has(idx))) {
      zh.textContent = t("正在对照…");
      zh.hidden = false;
      return;
    }
    zh.textContent = "";
    zh.hidden = true;
  }

  function stopLiveTick() {
    if (liveRaf) cancelAnimationFrame(liveRaf);
    liveRaf = 0;
    if (stopLiveTick._t) clearTimeout(stopLiveTick._t);
    stopLiveTick._t = 0;
  }

  function bindLiveTimeUpdate() {
    const video = pageVideo();
    if (!video || video === bindLiveTimeUpdate._v) return;
    if (bindLiveTimeUpdate._v && bindLiveTimeUpdate._on) {
      bindLiveTimeUpdate._v.removeEventListener("timeupdate", bindLiveTimeUpdate._on);
    }
    bindLiveTimeUpdate._v = video;
    bindLiveTimeUpdate._on = () => {
      if (liveCcOn && liveCaptionReady()) paintLiveBar();
    };
    video.addEventListener("timeupdate", bindLiveTimeUpdate._on);
  }

  function watchBiliFullscreen() {
    const host = document.querySelector(".bpx-player-container");
    if (!host || host.dataset.kzFs === String(VB_CONTENT_REV)) return;
    host.dataset.kzFs = String(VB_CONTENT_REV);
    if (watchBiliFullscreen._mo) watchBiliFullscreen._mo.disconnect();
    if (host._kzFsMo) try { host._kzFsMo.disconnect(); } catch (_e) {}
    let last = host.className;
    watchBiliFullscreen._mo = new MutationObserver(() => {
      const now = host.className;
      const wasFs = /bpx-state-(web-)?fullscreen/.test(last);
      const nowFs = /bpx-state-(web-)?fullscreen/.test(now);
      last = now;
      if (wasFs === nowFs) return;
      liveGeom = "";
      const bar = document.getElementById("kz-live");
      if (!bar || !liveCcOn) return;
      mountLiveBar(bar);
      placeLiveBar();
    });
    watchBiliFullscreen._mo.observe(host, { attributes: true, attributeFilter: ["class"] });
    host._kzFsMo = watchBiliFullscreen._mo;
  }

  function startLiveTick() {
    if (stopLiveTick._t || liveRaf) return;
    const pulse = () => {
      stopLiveTick._t = 0;
      liveRaf = 0;
      if (!contentLive() || !liveCcOn) return;
      syncLiveVideo();
      bindLiveTimeUpdate();
      watchBiliFullscreen();
      paintLiveBar();
      stopLiveTick._t = setTimeout(pulse, 220);
    };
    pulse();
  }

  function liveCaptionReady() {
    return liveSegments.length > 0;
  }

  function applyLiveSkin(bar) {
    document.documentElement.classList.toggle("kz-live-on", liveCcOn && liveCaptionReady());
    if (bar) {
      bar.classList.toggle("is-pick", Boolean(liveWord));
      if (liveCcOn && Date.now() < liveNewT) bar.classList.add("is-new");
      else bar.classList.remove("is-new");
    }
  }

  function paintLiveBar() {
    if (!liveCcOn) {
      const bar = document.getElementById("kz-live");
      if (bar) bar.hidden = true;
      document.documentElement.classList.remove("kz-live-on");
      closeLexCard();
      stopLiveTick();
      livePaintKey = "";
      liveContentKey = "";
      liveWordsKey = "";
      liveGeom = "";
      return;
    }
    if (!liveCaptionReady()) {
      const bar = document.getElementById("kz-live");
      if (bar) bar.hidden = true;
      applyLiveSkin(bar);
      return;
    }
    const line = liveLineAt(pageVideo()?.currentTime || 0);
    if (liveMode !== "original" && !line.zh) {
      const idx = line.hit?.idx;
      if (Number.isInteger(idx) && !liveZhBlocked(idx) && !liveZhAsked.has(idx) && !liveZhBusy) fillLiveZh();
    }
    const contentKey = `${line.hit?.idx ?? -1}\n${line.text}\n${liveMode}`;
    const wordsKey = `${contentKey}\n${liveVocab.size}\n${[...liveMarks].join(",")}`;
    const zhKey = `${line.zh}\n${liveZhBusy}\n${Number.isInteger(line.hit?.idx) && liveZhBlocked(line.hit.idx)}`;
    const paintKey = `${wordsKey}\n${zhKey}`;
    const existing = document.getElementById("kz-live");
    const geomDirty = !liveGeom;
    const busy = existing ? liveBarBusy(existing) : false;
    if (paintKey === livePaintKey && !geomDirty && (busy || liveWordsKey)) return;
    const bar = ensureLiveBar();
    applyLiveSkin(bar);
    applyLiveStyle(bar);
    paintLiveMode(bar);
    bar.hidden = false;
    if (!busy && (geomDirty || !liveWordsKey)) placeLiveBar();
    if (busy) placeLexCard();
    if (paintKey === livePaintKey && (busy || liveWordsKey)) return;
    const panes = bar.querySelectorAll(".kz-live-pane");
    if (!panes.length) return;
    const rewriteWords = wordsKey !== liveWordsKey;
    if (busy) {
      fillLiveZhPane(panes[liveFront], line);
      livePaintKey = paintKey;
      return;
    }
    if (!liveContentKey) {
      fillLivePane(panes[0], line, { words: true });
      panes[0].classList.add("on");
      panes[1]?.classList.remove("on");
      liveFront = 0;
    } else if (contentKey !== liveContentKey) {
      if (livePaneFade) {
        clearTimeout(livePaneFade);
        livePaneFade = 0;
        panes[liveFront ^ 1]?.classList.remove("on");
      }
      const next = liveFront ^ 1;
      const prev = panes[liveFront];
      fillLivePane(panes[next], line, { words: true });
      panes[next]?.classList.add("on");
      prev?.classList.remove("on");
      liveFront = next;
    } else if (rewriteWords) {
      fillLivePane(panes[liveFront], line, { words: true });
    } else {
      fillLiveZhPane(panes[liveFront], line);
    }
    liveContentKey = contentKey;
    liveWordsKey = wordsKey;
    livePaintKey = paintKey;
  }

  function liveSegFinger(segs) {
    if (!segs?.length) return "";
    const a = segs[0];
    const m = segs[Math.floor(segs.length / 2)];
    const b = segs[segs.length - 1];
    return `${segs.length}|${a?.start}|${String(a?.text || "").slice(0, 16)}|${m?.start}|${String(m?.text || "").slice(0, 16)}|${b?.start}|${String(b?.text || "").slice(0, 16)}`;
  }

  function pickLiveTrack(live, pack) {
    const a = live?.segments?.length ? live.segments : null;
    const b = pack?.segments?.length ? pack.segments : null;
    if (!a) return { segs: b || [], translations: pack?.translations || null, savedAt: Number(pack?.savedAt) || 0 };
    if (!b) return { segs: a, translations: null, savedAt: Number(live?.savedAt) || 0 };
    if (liveSegFinger(a) === liveSegFinger(b)) {
      return {
        segs: a,
        translations: pack?.translations || null,
        savedAt: Math.max(Number(live?.savedAt) || 0, Number(pack?.savedAt) || 0),
      };
    }
    const tLive = Number(live?.savedAt) || 0;
    const tPack = Number(pack?.savedAt) || 0;
    if (tLive !== tPack) {
      return tLive > tPack
        ? { segs: a, translations: null, savedAt: tLive }
        : { segs: b, translations: pack?.translations || null, savedAt: tPack };
    }
    return a.length >= b.length
      ? { segs: a, translations: null, savedAt: tLive }
      : { segs: b, translations: pack?.translations || null, savedAt: tPack };
  }

  function pickLiveSegs(live, pack) {
    return pickLiveTrack(live, pack).segs;
  }

  function bumpLiveSegGen() {
    return (ensureLiveSegments._gen = (ensureLiveSegments._gen || 0) + 1);
  }

  function applyLiveSegs(id, segs, translations) {
    const next = segs || [];
    const same = liveSegId === id && liveSegFinger(liveSegments) === liveSegFinger(next);
    liveSegments = next;
    liveSegId = id;
    liveHoldIdx = -1;
    liveContentKey = "";
    liveWordsKey = "";
    livePaintKey = "";
    if (!same) {
      liveTranslations = translations ? { ...translations } : {};
      liveZhAsked = new Set();
      liveZhFail = new Set();
      liveZhFailAt = {};
      liveZhTries = {};
    } else if (translations) {
      liveTranslations = { ...liveTranslations, ...translations };
    }
  }

  function adoptLiveTrack(id, track) {
    const segs = track?.segs || [];
    if (!id || !liveStill(id) || !segs.length) return false;
    const same = liveSegId === id && liveSegFinger(liveSegments) === liveSegFinger(segs);
    if (same) {
      if (track.translations) liveTranslations = { ...liveTranslations, ...track.translations };
      return false;
    }
    const nextAt = Number(track.savedAt) || 0;
    if (liveSegId === id && liveSegments.length && liveTrackAt && nextAt > 0 && nextAt < liveTrackAt) return false;
    applyLiveSegs(id, segs, track.translations);
    liveTrackAt = nextAt || Date.now();
    bumpLiveSegGen();
    return true;
  }

  async function ensureLiveSegments() {
    const id = videoIdFromUrl(location.href);
    if (!id) return [];
    if (liveSegId === id && liveSegments.length) return liveSegments;
    const gen = bumpLiveSegGen();
    try {
      const cached = await chrome.storage.local.get([`vb_cache_${id}`, "vb_live"]);
      if (gen !== ensureLiveSegments._gen || !liveStill(id)) return liveSegments;
      const pack = cached[`vb_cache_${id}`];
      const live = cached.vb_live?.videoId === id ? cached.vb_live : null;
      const track = pickLiveTrack(live, pack);
      if (liveSegId && liveSegId !== id) {
        liveTranslations = {};
        liveTrackAt = 0;
      }
      if (track.segs.length) {
        adoptLiveTrack(id, track);
        if (liveMode !== "original") fillLiveZh();
        return liveSegments;
      }
    } catch (_e) {}
    try {
      const data = await getTranscript(id);
      if (gen !== ensureLiveSegments._gen || !liveStill(id)) return liveSegments;
      applyLiveSegs(id, data.segments || [], data.translations);
      liveFetchedAt = id;
      liveTrackAt = Date.now();
      if (data.translations && Object.keys(data.translations).length) persistLiveTranslations();
    } catch (_e) {
      if (!liveSegments.length) liveSegments = [];
    }
    if (!liveStill(id)) return liveSegments;
    if (liveMode !== "original") fillLiveZh();
    return liveSegments;
  }

  function peekLiveLine(extra = {}) {
    const line = liveLineAt(Number.isFinite(Number(extra.seconds)) ? extra.seconds : pageVideo()?.currentTime || 0);
    postHotkey("peek", {
      quiet: true,
      seconds: line.start,
      caption: line.text,
    });
  }

  async function jumpLiveLine() {
    const video = pageVideo();
    if (!video) return;
    await ensureLiveSegments();
    const line = liveLineAt(video.currentTime);
    if (!line.hit) {
      toast(t("这页还没有可读字幕"));
      return;
    }
    if (Math.abs(video.currentTime - line.start) > 0.35) video.currentTime = line.start;
    video.play().catch(() => {});
    peekLiveLine({ seconds: line.start });
    toast(t("跳到这句"));
  }

  function loopLiveLine() {
    if (loopRange) {
      clearLoopWait();
      loopRange = null;
      postHotkey("unloop");
      paintDock();
      return;
    }
    const video = pageVideo();
    const line = liveLineAt(video?.currentTime || 0);
    if (line.hit && video) {
      loopRange = { start: line.start, end: Number(line.hit.seg.end) || line.start + 6 };
      video.currentTime = loopRange.start;
      video.play().catch(() => {});
    }
    postHotkey("loop", { seconds: line.start, caption: line.text });
    paintDock();
  }

  function pickLiveWord(word) {
    const next = String(word || "").trim();
    if (next.length < 2) return;
    const card = document.getElementById("kz-lex");
    const failed = Boolean(card?.querySelector(".kz-lex-err"));
    if (liveWord.toLowerCase() === next.toLowerCase() && card && !card.hidden && !failed) {
      closeLexCard();
      paintLiveWordFlags();
      return;
    }
    liveWord = next;
    openLexCard(next);
    paintLiveWordFlags();
  }

  function saveLiveWord() {
    if (!liveWord) return;
    const line = liveLineAt(pageVideo()?.currentTime || 0);
    liveVocab.add(liveWord.toLowerCase());
    postHotkey("vocab", { text: liveWord, quiet: true, seconds: line.start, caption: line.text });
    const card = document.getElementById("kz-lex");
    if (card) paintLexActions(card);
    paintLiveWordFlags();
    toast(t("已存入生词本"));
  }

  function markLiveWord(raw) {
    const next = String(raw || liveWord || "").replace(/\s+/g, " ").trim();
    if (next.length < 2) return;
    if (!liveWord) liveWord = (next.match(/\b[A-Za-z][A-Za-z'-]{1,39}\b/) || [next])[0];
    const line = liveMarkLine?.text ? liveMarkLine : liveLineAt(pageVideo()?.currentTime || 0);
    const info = currentVideoInfo();
    const sentence = String(line.text || "").trim() || next;
    if (!info.videoId) {
      toast(t("先打开一支视频再划。"));
      return;
    }
    chrome.storage.local.get(["vb_highlights", "vb_settings"], (stored) => {
      const list = Array.isArray(stored.vb_highlights) ? stored.vb_highlights.slice() : [];
      const exists = list.some(
        (h) =>
          h.videoId === info.videoId &&
          String(h.text || "").toLowerCase() === next.toLowerCase() &&
          Math.abs(Number(h.seconds) - line.start) < 0.8,
      );
      const words = next.match(/\b[A-Za-z][A-Za-z'-]{1,39}\b/g) || [next];
      words.forEach((w) => liveMarks.add(w.toLowerCase()));
      const card = document.getElementById("kz-lex");
      if (card) paintLexActions(card);
      paintLiveWordFlags();
      if (exists) {
        toast(t("这句已经划过"));
        return;
      }
      const created = {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        videoId: info.videoId,
        videoTitle: info.title || "",
        text: next,
        sentence,
        seconds: line.start,
        spans: [
          {
            text: next,
            sentence,
            seconds: line.start,
            idx: line.hit?.idx ?? -1,
          },
        ],
        color: stored.vb_settings?.hlColor || "def",
        style: stored.vb_settings?.hlStyle || "line",
        createdAt: Date.now(),
      };
      list.unshift(created);
      chrome.storage.local.set({ vb_highlights: list.slice(0, 800) }, () => {
        postHotkey("highlight", { quiet: true, text: next, seconds: line.start, caption: sentence });
        toast(t("已划上"));
      });
    });
    liveMarkLine = null;
  }

  function setLiveCc(on) {
    const next = Boolean(on);
    const changed = next !== liveCcOn;
    liveCcOn = next;
    chrome.storage.local.get("vb_settings", (stored) => {
      if (stored.vb_settings?.liveCc === liveCcOn) return;
      chrome.storage.local.set({ vb_settings: { ...(stored.vb_settings || {}), liveCc: liveCcOn } });
    });
    livePaintKey = "";
    liveContentKey = "";
    liveGeom = "";
    if (!liveCcOn) {
      closeLexCard();
      document.documentElement.classList.remove("kz-live-on");
      stopLiveTick();
    } else {
      liveNewT = Date.now() + 1600;
      startLiveTick();
    }
    paintDock();
    paintLiveBar();
    if (changed) toast(liveCcOn ? t("片上字幕条开了。点词出词卡，可划可存。") : t("已关掉片上字幕条"));
    if (liveCcOn) ensureLiveSegments().then(() => { livePaintKey = ""; liveContentKey = ""; paintLiveBar(); });
  }

  function loadLiveMarks(list, videoId) {
    liveMarks = new Set();
    for (const h of list || []) {
      if (videoId && h.videoId && h.videoId !== videoId) continue;
      const words = String(h.text || "").match(/\b[A-Za-z][A-Za-z'-]{1,39}\b/g) || [];
      for (const w of words) liveMarks.add(w.toLowerCase());
    }
  }

  function loadLiveCcState() {
    chrome.storage.local.get(["vb_settings", "vb_vocab", "vb_highlights"], (stored) => {
      liveCcOn = stored.vb_settings?.liveCc === true;
      liveMode = liveModeOf(stored.vb_settings?.transcriptMode);
      liveSize = liveSizeOf(stored.vb_settings?.liveCcSize);
      liveFont = liveFontOf(stored.vb_settings?.liveCcFont);
      liveVocab = new Set(
        (stored.vb_vocab || [])
          .map((v) => String(v.word || "").toLowerCase())
          .filter((w) => w.length >= 2),
      );
      loadLiveMarks(stored.vb_highlights, videoIdFromUrl(location.href));
      livePaintKey = "";
      liveContentKey = "";
      paintDock();
      paintLiveBar();
      if (liveCcOn) {
        liveNewT = Date.now() + 1600;
        startLiveTick();
        ensureLiveSegments().then(() => { livePaintKey = ""; liveContentKey = ""; paintLiveBar(); });
      } else {
        stopLiveTick();
      }
    });
  }

  function bindLiveCc() {
    if (document.documentElement.dataset.kzCcBound === String(VB_CONTENT_REV)) return;
    document.documentElement.dataset.kzCcBound = String(VB_CONTENT_REV);
    stripOldCaptionWraps();
    bindLivePointerGuard();
    const onGeom = () => {
      if (!contentLive() || !liveCcOn) return;
      liveGeom = "";
      if (onGeom._raf) return;
      onGeom._raf = requestAnimationFrame(() => {
        onGeom._raf = 0;
        placeLiveBar();
      });
    };
    window.addEventListener("resize", onGeom);
    window.addEventListener("scroll", onGeom, { passive: true, capture: true });
    const onFs = () => {
      if (!contentLive() || !liveCcOn) return;
      liveGeom = "";
      const bar = document.getElementById("kz-live");
      if (bar) mountLiveBar(bar);
      const card = document.getElementById("kz-lex");
      if (card) mountLiveBar(card);
      placeLiveBar();
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
  }

  function resetLiveTrack() {
    liveSegId = "";
    liveSegments = [];
    liveTranslations = {};
    liveTrackAt = 0;
    liveFetchedAt = "";
    liveZhAsked = new Set();
    liveZhFail = new Set();
    liveZhFailAt = {};
    liveZhTries = {};
    liveZhBusy = false;
    liveWord = "";
    closeLexCard();
    livePaintKey = "";
    liveContentKey = "";
    liveWordsKey = "";
    liveHoldIdx = -1;
    liveGeom = "";
  }

  function syncLiveVideo() {
    const id = videoIdFromUrl(location.href) || "";
    if (id === syncLiveVideo._id) return false;
    const changed = Boolean(syncLiveVideo._id && id && syncLiveVideo._id !== id);
    syncLiveVideo._id = id;
    if (!changed) return false;
    resetLiveTrack();
    if (liveCcOn) {
      ensureLiveSegments().then(() => {
        livePaintKey = "";
        liveContentKey = "";
        paintLiveBar();
      });
    }
    return true;
  }

  function announceWatch() {
    syncLiveVideo();
    const info = currentVideoInfo();
    chrome.runtime.sendMessage({ action: "vbTick", ...info }, () => void chrome.runtime.lastError);
  }
  function remountDock() {
    if (!chrome.runtime?.id) throw new Error("invalidated");
    if (!contentLive()) throw new Error("stale");
    document.getElementById("kz-dock")?.remove();
    document.getElementById("kz-live")?.remove();
    document.getElementById("kz-lex")?.remove();
    document.documentElement.classList.remove("kz-live-on");
    ensureDock();
    paintDock();
    loadPlayerMarks();
    loadLiveCcState();
  }
  globalThis.__vbRemountDock = remountDock;
  ensureDock();
  loadPlayerMarks();
  bindLiveCc();
  loadLiveCcState();
  announceWatch();
  setInterval(() => {
    if (!contentLive()) return;
    ensureDock();
  }, 2000);
  setInterval(() => {
    if (!contentLive()) return;
    announceWatch();
  }, 8000);
  window.addEventListener("yt-navigate-finish", () => {
    if (!contentLive()) return;
    playerMarkKey = "";
    ensureDock();
    loadPlayerMarks();
    resetLiveTrack();
    syncLiveVideo._id = videoIdFromUrl(location.href) || "";
    loadLiveCcState();
    announceWatch();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!contentLive() || area !== "local") return;
    if (changes.vb_vocab || changes.vb_settings) loadLiveCcState();
    if (changes.vb_highlights) {
      loadLiveMarks(changes.vb_highlights.newValue, videoIdFromUrl(location.href));
      paintLiveWordFlags();
      if (liveCcOn) {
        const line = liveLineAt(pageVideo()?.currentTime || 0);
        const contentKey = `${line.hit?.idx ?? -1}\n${line.text}\n${liveMode}`;
        const wordsKey = `${contentKey}\n${liveVocab.size}\n${[...liveMarks].join(",")}`;
        const zhKey = `${line.zh}\n${liveZhBusy}\n${Number.isInteger(line.hit?.idx) && liveZhBlocked(line.hit.idx)}`;
        liveWordsKey = wordsKey;
        livePaintKey = `${wordsKey}\n${zhKey}`;
      }
    }
    const cacheChanged = Boolean(changes.vb_live) || Object.keys(changes).some((key) => key.startsWith("vb_cache_"));
    if (cacheChanged) {
      const id = videoIdFromUrl(location.href);
      chrome.storage.local.get([id ? `vb_cache_${id}` : "", "vb_live"], (stored) => {
        if (id && !liveStill(id)) return;
        const pack = id ? stored[`vb_cache_${id}`] : null;
        const live = stored.vb_live?.videoId === id ? stored.vb_live : null;
        const track = pickLiveTrack(live, pack);
        if (liveSegId && liveSegId !== id) {
          liveTranslations = {};
          liveTrackAt = 0;
        }
        const same = liveSegId === id && liveSegFinger(liveSegments) === liveSegFinger(track.segs);
        if (adoptLiveTrack(id, track)) {
          if (liveCcOn) paintLiveBar();
        } else if (!track.segs.length && liveSegId === id) {
          resetLiveTrack();
          if (liveCcOn) ensureLiveSegments().then(() => paintLiveBar());
        } else if (same && liveCcOn) {
          fillLiveZhPane(
            document.getElementById("kz-live")?.querySelectorAll(".kz-live-pane")[liveFront],
            liveLineAt(pageVideo()?.currentTime || 0),
          );
        }
      });
    }
    if (
      changes.vb_marks ||
      changes.vb_settings ||
      changes.vb_shelf ||
      changes.vb_watch_resume ||
      cacheChanged
    ) {
      loadPlayerMarks();
    }
  });
}
