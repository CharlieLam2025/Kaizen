// VideoBricks content script — runs on youtube.com and bilibili.com.
// Jobs: report which video is open, pull the video's own caption track
// (no third-party transcript API), and control playback for the panel.
//
// Guard: the panel may inject this file again if the tab was open before
// the extension loaded. A second listener would double-answer messages.
// After chrome.runtime.reload(), the old world stays on the page; bump
// the rev and remount the dock so K works without a full tab refresh.
const VB_CONTENT_REV = 9;

(function bootKaizenContent() {
  document.getElementById("kz-dock")?.remove();
  if (typeof globalThis.__vbRemountDock === "function") {
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

/** Prefers an author-uploaded track over auto-generated (asr) captions. */
function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  return tracks.find((t) => t.kind !== "asr") || tracks[0];
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
      return {
        segments,
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
  if (!video || video.__vbHeadBound) return video;
  video.__vbHeadBound = true;
  let last = -1;
  let lastAt = 0;
  const send = () => {
    const info = currentVideoInfo();
    if (info.ad) return;
    if (!info.videoId && !Number.isFinite(info.currentTime)) return;
    if (Number.isFinite(info.currentTime) && Math.abs(info.currentTime - last) < 0.08 && Date.now() - lastAt < 360) return;
    if (Number.isFinite(info.currentTime)) last = info.currentTime;
    lastAt = Date.now();
    chrome.runtime.sendMessage({ action: "vbTick", ...info }, () => void chrome.runtime.lastError);
    if (typeof paintPlayerMarks === "function") paintPlayerMarks();
  };
  video.addEventListener("timeupdate", send);
  video.addEventListener("seeked", send);
  video.addEventListener("ratechange", send);
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
    if (!style) {
      style = document.createElement("style");
      style.id = "kz-dock-css";
      document.documentElement.appendChild(style);
    }
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

  function paintDock() {
    const btn = document.querySelector("#kz-dock [data-act=loop]");
    if (btn) btn.classList.toggle("on", Boolean(loopRange));
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

  function openSidePanel() {
    sayAction("open");
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
    alignMarksBox(box, track, player);
    const walker = box.querySelector(".kz-walker");
    if (walker) walker.style.left = `${walkPct}%`;
    const resumeEl = box.querySelector(".kz-resume");
    if (resumeEl) resumeEl.hidden = Math.abs(now - playerMarkState.resume) <= 8;
  }
  globalThis.paintPlayerMarks = paintPlayerMarks;

  function watchProgressDom() {
    const player = document.querySelector("#movie_player") || document.querySelector(".bpx-player-container");
    if (!player || player.__kzObs) return;
    let obsTimer = 0;
    player.__kzObs = new MutationObserver(() => {
      clearTimeout(obsTimer);
      obsTimer = setTimeout(() => {
        const box = document.getElementById("kz-marks");
        if (!box || box.parentElement !== player) {
          playerMarkKey = "";
          paintPlayerMarks({ force: true });
        } else {
          paintNativeKnob();
          alignMarksBox(box, progressHost(), player);
        }
      }, 80);
    });
    player.__kzObs.observe(player, { childList: true, subtree: true });
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
      paintPlayerMarks();
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
      ${t("右下 K / R / A / N / B")}<br>
      R ${t("记下这句")} · A ${t("再听")} · B ${t("夹书签")}<br>
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
    const payload = {
      id: Date.now(),
      action,
      videoId: info.videoId || "",
      title: info.title || "",
      seconds: info.currentTime || 0,
      caption: pageCaption(),
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

  function announceWatch() {
    const info = currentVideoInfo();
    chrome.runtime.sendMessage({ action: "vbTick", ...info }, () => void chrome.runtime.lastError);
  }
  function remountDock() {
    if (!chrome.runtime?.id) throw new Error("invalidated");
    if (!contentLive()) throw new Error("stale");
    document.getElementById("kz-dock")?.remove();
    ensureDock();
    paintDock();
    loadPlayerMarks();
  }
  globalThis.__vbRemountDock = remountDock;
  ensureDock();
  loadPlayerMarks();
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
    announceWatch();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!contentLive() || area !== "local") return;
    if (
      changes.vb_marks ||
      changes.vb_settings ||
      changes.vb_shelf ||
      changes.vb_watch_resume ||
      Object.keys(changes).some((key) => key.startsWith("vb_cache_"))
    ) {
      loadPlayerMarks();
    }
  });
}
