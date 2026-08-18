// VideoBricks content script — runs on youtube.com.
// Jobs: report which video is open, pull the video's own caption track
// (no third-party transcript API), and control playback for the panel.
//
// Guard: the panel may inject this file again if the tab was open before
// the extension loaded. A second listener would double-answer messages.
if (globalThis.__vbContentReady) {
  // already installed
} else {
  globalThis.__vbContentReady = true;
  vbInstallContentScript();
}

function vbInstallContentScript() {
//
// Caption fetching is layered because YouTube throttles naive approaches:
//   player response: live page scripts → fetched watch HTML → InnerTube
//   (Android client, the most reliable channel for caption URLs)
//   caption body:   json3 → timedtext XML fallback

// Public web InnerTube key — ships inside every YouTube page, not a secret.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

/** Extracts the watch-page video id from a URL, or null. */
function videoIdFromUrl(href) {
  try {
    const url = new URL(href);
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/")[2] || null;
    }
    return null;
  } catch (_e) {
    return null;
  }
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
    throw new Error("字幕接口返回空内容（YouTube 风控）");
  }
  const segments = mergeRawSegments(rawFromTimedTextXml(xml));
  if (!segments.length) throw new Error("字幕内容解析失败");
  return segments;
}

// ---------- transcript assembly ----------

async function getTranscript(videoId) {
  const attempts = [];
  const sources = [
    ["页面", async () => playerResponseFromDom(videoId)],
    ["网页抓取", () => playerResponseFromWatchHtml(videoId)],
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
      (lastError ? "" : "这支视频可能确实没有字幕轨。") +
      "可以刷新视频页后重试。",
  );
}

// ---------- playback + messaging ----------

let loopRange = null; // { start, end } seconds, or null

function bindVideoLoop(video) {
  if (!video || video.__vbLoopBound) return video;
  video.__vbLoopBound = true;
  video.addEventListener("timeupdate", () => {
    if (!loopRange) return;
    const t = video.currentTime;
    if (t >= loopRange.end - 0.12 || t < loopRange.start - 0.6) {
      video.currentTime = loopRange.start;
      video.play().catch(() => {});
    }
  });
  return video;
}

function pageVideo() {
  return bindVideoLoop(document.querySelector("video"));
}

function currentVideoInfo() {
  const videoId = videoIdFromUrl(location.href);
  const video = pageVideo();
  return {
    videoId,
    title: document.title.replace(/ - YouTube$/, ""),
    currentTime: video ? video.currentTime : 0,
    duration: video ? video.duration || 0 : 0,
    paused: video ? video.paused : true,
    looping: Boolean(loopRange),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      loopRange = { start, end };
      const video = pageVideo();
      if (video && message.seek !== false) {
        video.currentTime = start;
        video.play().catch(() => {});
      }
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return false;
  }

  if (message?.type === "VB_LOOP_CLEAR") {
    loopRange = null;
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

  // 只绑「视频还在走、来不及看侧栏」的三件事。问句、已学会、复制都在侧栏里做。
  const HOTKEYS = {
    Digit1: "quote",
    Digit2: "loop",
    Digit3: "note",
  };

  function pageCaption() {
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
    setTimeout(() => el.remove(), 1800);
  }

  function showHelp() {
    document.getElementById("vb-keys")?.remove();
    const box = document.createElement("div");
    box.id = "vb-keys";
    box.innerHTML = `<b>拆砖 · 三个键</b><br>
      Alt+1 收下这句<br>
      Alt+2 循环这块<br>
      Alt+3 记下自己的话<br>
      再按 Alt+/ 关掉`;
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
    });
    document.body.appendChild(box);
  }

  function openNoteBox() {
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
        postHotkey("note", { text: ta.value.trim() });
        wrap.remove();
      }
    });
  }

  function postHotkey(action, extra = {}) {
    const payload = {
      id: Date.now(),
      action,
      seconds: pageVideo()?.currentTime || 0,
      caption: pageCaption(),
      text: extra.text || "",
    };
    chrome.storage.local.set({ vb_inbox: payload });
    chrome.runtime.sendMessage({ action: "vbHotkey", ...payload }).catch(() => {});
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.altKey || event.repeat || typingIn(event.target)) return;
      if (event.code === "Slash") {
        event.preventDefault();
        const existing = document.getElementById("vb-keys");
        if (existing) existing.remove();
        else showHelp();
        return;
      }
      const action = HOTKEYS[event.code];
      if (!action || action === "help") return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "note") {
        openNoteBox();
        return;
      }
      postHotkey(action);
      toast(action === "quote" ? "已收下这句" : action === "loop" ? "切换循环这块" : "已送到拆砖");
    },
    true,
  );
}
