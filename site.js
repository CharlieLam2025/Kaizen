function isBiliId(id) {
  return /^(BV[\w]+)(:p\d+)?$/i.test(String(id || "")) || /^av\d+(:p\d+)?$/i.test(String(id || ""));
}

function parseBiliId(videoId) {
  const m = String(videoId || "").match(/^(BV[\w]+|av\d+)(?::p(\d+))?$/i);
  if (!m) return null;
  return { id: m[1], page: Math.max(1, Number(m[2] || 1)) };
}

function tabHref(tab) {
  return String(tab?.url || tab?.pendingUrl || "");
}

function isWatchHost(href) {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith(".youtu.be")) return true;
    if (host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) return true;
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      return host !== "studio.youtube.com" && host !== "accounts.youtube.com" && host !== "consent.youtube.com";
    }
    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
      return !/^(passport|account|message)\.bilibili\.com$/.test(host);
    }
    return false;
  } catch (_e) {
    return false;
  }
}

function biliIdFromSearch(url) {
  const bvid = url.searchParams.get("bvid");
  if (bvid && /^BV[\w]+$/i.test(bvid)) return bvid;
  const aid = url.searchParams.get("aid") || url.searchParams.get("oid");
  if (aid && /^\d+$/.test(String(aid))) return `av${aid}`;
  const fromPath = url.pathname.match(/\/video\/(BV[\w]+|av\d+)/i);
  if (fromPath) return fromPath[1];
  const hash = decodeURIComponent(url.hash || "");
  const fromHash = hash.match(/\b(BV[\w]+|av\d+)\b/i);
  return fromHash ? fromHash[1] : null;
}

function youtubeIdFromHref(url) {
  const v = url.searchParams.get("v");
  if (v) return v;
  const parts = url.pathname.split("/").filter(Boolean);
  const head = String(parts[0] || "").toLowerCase();
  if (["shorts", "live", "embed", "v", "e", "watch"].includes(head)) return parts[1] || null;
  const host = String(url.hostname || "").toLowerCase();
  if (host === "youtu.be" || host.endsWith(".youtu.be")) return parts[0] || null;
  if (host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    return ["embed", "live", "shorts", "watch"].includes(head) ? parts[1] || null : parts[0] || null;
  }
  return null;
}

function videoIdFromHref(href) {
  try {
    const url = new URL(href);
    const host = url.hostname;
    if (host.includes("bilibili.com")) {
      const id = biliIdFromSearch(url);
      if (!id) return null;
      const p = Number(url.searchParams.get("p") || 1);
      return p > 1 ? `${id}:p${p}` : id;
    }
    if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("youtube-nocookie.com")) {
      return youtubeIdFromHref(url);
    }
    return null;
  } catch (_e) {
    return null;
  }
}

function summarizeWatchTab(tab) {
  const url = tabHref(tab);
  return {
    id: tab.id,
    url,
    title: tab.title || "",
    active: Boolean(tab.active),
    lastAccessed: tab.lastAccessed || 0,
    videoId: videoIdFromHref(url),
  };
}

function sortWatchTabs(a, b) {
  const idA = a.videoId ? 1 : 0;
  const idB = b.videoId ? 1 : 0;
  return idB - idA || Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0);
}

function pickPollVideoId(hrefId, info) {
  if (info?.ad) return "";
  if (info?.videoId) return String(info.videoId);
  return String(hrefId || "");
}

function shouldWriteWatch(prev, snap) {
  if (!snap?.tabId) return false;
  const url = String(snap.url || "");
  if (url && !isWatchHost(url)) return false;
  if (prev?.videoId && !snap.videoId && Number(prev.tabId) !== Number(snap.tabId)) return false;
  if (
    prev &&
    Number(prev.tabId) === Number(snap.tabId) &&
    String(prev.videoId || "") === String(snap.videoId || "") &&
    String(prev.url || "") === String(snap.url || "")
  ) {
    return false;
  }
  return true;
}

function shouldAdoptOpenWatch(prev, now = Date.now()) {
  return !(prev?.videoId && now - Number(prev.at || 0) < 90000);
}

function markFaceUrl(id) {
  if (id !== "cat" && id !== "dog") return "";
  const file = id === "cat" ? "icons/mark-cat-golden.png" : "icons/mark-dog-samoyed.png";
  try {
    return chrome.runtime.getURL(file);
  } catch (_e) {
    return file;
  }
}

function watchAdoptDecision(info, ctx) {
  if (info?.unavailable || info?.unreadable) return "clear";
  const videoId = String(info?.videoId || "");
  if (!videoId) return info?.watchPage ? "clear" : "skip-empty";
  if (info?.ad) return "skip-ad";
  if (ctx?.loadingVideoId && videoId === String(ctx.loadingVideoId)) return "skip-loading";
  const opened = Boolean(ctx?.videoId && Number(ctx.segments) > 0);
  if (opened && videoId === String(ctx.videoId)) return "keep";
  const force = Boolean(info?.force || info?.source === "user");
  if (force) return "open";
  if (opened) {
    if (info.tabId && ctx.tabId && Number(info.tabId) === Number(ctx.tabId)) return "open";
    if (info.activeWatch) return "open";
    return "skip-opened";
  }
  return "open";
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseClockInput(raw) {
  const text = String(raw || "").trim().replace(/：/g, ":");
  if (!text) return null;
  const parts = text.match(/^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (parts) {
    if (parts[3] != null) return Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
    return Number(parts[1]) * 60 + Number(parts[2]);
  }
  const sec = Number(text);
  return Number.isFinite(sec) && sec >= 0 ? sec : null;
}

function sameAsSource(zh, en) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  const a = norm(zh);
  const b = norm(en);
  return Boolean(a && b && a === b);
}

function watchUrl(videoId, seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const bili = parseBiliId(videoId);
  if (bili) {
    const path = `https://www.bilibili.com/video/${bili.id}/`;
    const q = new URLSearchParams();
    if (bili.page > 1) q.set("p", String(bili.page));
    if (s) q.set("t", String(s));
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
  }
  if (!videoId) return "";
  return `https://www.youtube.com/watch?v=${videoId}${s ? `&t=${s}s` : ""}`;
}

function pickBiliTrack(tracks) {
  const rank = (t) => {
    const lan = String(t.lan || t.lan_doc || "").toLowerCase();
    if (/ai-en|^en$|en-us|en-gb/.test(lan)) return 0;
    if (/en/.test(lan)) return 1;
    if (/ai-zh|zh-cn|zh-hans|^zh$/.test(lan)) return 3;
    if (/zh/.test(lan)) return 4;
    return 2;
  };
  return [...(tracks || [])].sort((a, b) => rank(a) - rank(b))[0] || null;
}

function pickBiliZhTrack(tracks, source) {
  const srcUrl = source?.subtitle_url || source?.subtitleUrl || source?.url || "";
  const rank = (t) => {
    const lan = String(t.lan || t.lan_doc || "").toLowerCase();
    const url = t?.subtitle_url || t?.subtitleUrl || t?.url || "";
    if (t === source || (srcUrl && url === srcUrl)) return 99;
    if (/ai-zh|zh-cn|zh-hans|^zh$/.test(lan)) return 0;
    if (/zh/.test(lan)) return 1;
    return 99;
  };
  const hit = [...(tracks || [])].sort((a, b) => rank(a) - rank(b))[0];
  return hit && rank(hit) < 99 ? hit : null;
}

function captionTlang(lang) {
  const raw = String(
    lang || (typeof currentLang === "function" ? currentLang() : "") || "",
  ).toLowerCase();
  if (raw.startsWith("zh-tw") || raw.startsWith("zh-hk") || raw.includes("hant")) return "zh-Hant";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("vi")) return "vi";
  if (raw.startsWith("th")) return "th";
  if (raw.startsWith("id")) return "id";
  if (raw.startsWith("ar")) return "ar";
  return "zh-Hans";
}

function isZhCaptionLang(code) {
  return /^zh\b/.test(String(code || "").toLowerCase());
}

function alignCaptionTranslations(srcSegs, zhSegs) {
  const out = {};
  if (!srcSegs?.length || !zhSegs?.length) return out;
  let j = 0;
  for (let i = 0; i < srcSegs.length; i++) {
    const seg = srcSegs[i];
    const start = Number(seg.start) || 0;
    const end = Number(seg.end) || start + 2;
    const mid = (start + end) / 2;
    while (j + 1 < zhSegs.length && Number(zhSegs[j + 1].start) <= mid) j += 1;
    let best = zhSegs[j];
    let bestDist = Math.abs((Number(best.start) + Number(best.end || best.start + 2)) / 2 - mid);
    for (let k = Math.max(0, j - 2); k < Math.min(zhSegs.length, j + 3); k++) {
      const z = zhSegs[k];
      const zMid = (Number(z.start) + Number(z.end || z.start + 2)) / 2;
      const dist = Math.abs(zMid - mid);
      if (dist < bestDist) {
        best = z;
        bestDist = dist;
      }
    }
    const overlap = Math.min(end, Number(best.end || best.start + 2)) - Math.max(start, Number(best.start));
    const text = String(best.text || "").trim();
    if (text && (overlap > 0.12 || bestDist < 1.4)) out[i] = text;
  }
  return out;
}

function collectBiliTracks(...groups) {
  const out = [];
  const seen = new Set();
  for (const group of groups) {
    for (const t of group || []) {
      const url = t?.subtitle_url || t?.subtitleUrl || t?.url || "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(t);
    }
  }
  return out;
}

function md5hex(src) {
  const s = unescape(encodeURIComponent(String(src)));
  const add32 = (a, b) => (a + b) & 0xffffffff;
  const cmn = (q, a, b, x, n, t) => {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << n) | (a >>> (32 - n)), b);
  };
  const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
  const blk = (str) => {
    const w = [];
    for (let i = 0; i < 64; i += 4) {
      w[i >> 2] =
        str.charCodeAt(i) +
        (str.charCodeAt(i + 1) << 8) +
        (str.charCodeAt(i + 2) << 16) +
        (str.charCodeAt(i + 3) << 24);
    }
    return w;
  };
  const cycle = (x, k) => {
    let a = x[0];
    let b = x[1];
    let c = x[2];
    let d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  };
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i = 64;
  for (; i <= s.length; i += 64) cycle(state, blk(s.slice(i - 64, i)));
  let tail = s.slice(i - 64);
  const last = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < tail.length; i += 1) last[i >> 2] |= tail.charCodeAt(i) << ((i % 4) << 3);
  last[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    cycle(state, last);
    for (i = 0; i < 16; i += 1) last[i] = 0;
  }
  last[14] = s.length * 8;
  cycle(state, last);
  const hex = "0123456789abcdef";
  return state
    .map((n) => {
      let out = "";
      for (let j = 0; j < 4; j += 1) out += hex[(n >> (j * 8 + 4)) & 15] + hex[(n >> (j * 8)) & 15];
      return out;
    })
    .join("");
}

var WBI_MIXIN = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41,
  13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34,
  44, 52,
];

var wbiKey = { mixin: "", at: 0 };

async function biliJson(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { Referer: "https://www.bilibili.com/" },
  });
  if (res.status === 412) throw new Error("B 站拒绝了这次访问，稍后重试");
  if (!res.ok) throw new Error(`读页面失败（${res.status}）`);
  return res.json();
}

async function getWbiMixin() {
  if (wbiKey.mixin && Date.now() - wbiKey.at < 50 * 60 * 1000) return wbiKey.mixin;
  const nav = await biliJson("https://api.bilibili.com/x/web-interface/nav");
  const img = String(nav.data?.wbi_img?.img_url || "").split("/").pop().split(".")[0] || "";
  const sub = String(nav.data?.wbi_img?.sub_url || "").split("/").pop().split(".")[0] || "";
  const raw = img + sub;
  wbiKey = {
    mixin: WBI_MIXIN.map((i) => raw[i] || "").join("").slice(0, 32),
    at: Date.now(),
  };
  return wbiKey.mixin;
}

async function biliWbiUrl(path, params) {
  const mixin = await getWbiMixin();
  const query = { ...params, wts: Math.floor(Date.now() / 1000) };
  const cleaned = {};
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === "") continue;
    cleaned[k] = String(v).replace(/[!'()*]/g, "");
  }
  const qs = Object.keys(cleaned)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(cleaned[k])}`)
    .join("&");
  return `${path}?${qs}&w_rid=${md5hex(qs + mixin)}`;
}

async function biliTrackSegments(track) {
  let subUrl = track?.subtitle_url || track?.subtitleUrl || track?.url || "";
  if (subUrl.startsWith("//")) subUrl = `https:${subUrl}`;
  if (!subUrl) return [];
  const body = await biliJson(subUrl);
  const rows = body.body || body.data?.body || [];
  return rows
    .map((row) => ({
      start: Number(row.from) || 0,
      end: Number(row.to) || 0,
      text: String(row.content || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((row) => row.text);
}

async function finishBiliTracks(tracks, title) {
  const track = pickBiliTrack(tracks);
  let subUrl = track?.subtitle_url || track?.subtitleUrl || track?.url || "";
  if (subUrl.startsWith("//")) subUrl = `https:${subUrl}`;
  if (!subUrl) throw new Error("B 站字幕要先登录。打开这支视频确认能出字幕，再点重试。");
  const segments = await biliTrackSegments(track);
  if (!segments.length) throw new Error("字幕是空的");
  let translations = {};
  const zhTrack = pickBiliZhTrack(tracks, track);
  if (zhTrack) {
    try {
      const zhSegs = await biliTrackSegments(zhTrack);
      translations = alignCaptionTranslations(segments, zhSegs);
    } catch (_e) {}
  }
  return { segments, translations, language: track.lan || "", trackKind: "bili", title: title || "" };
}

async function fetchBiliTranscript(videoId) {
  const p = parseBiliId(videoId);
  if (!p) throw new Error("打不开这支视频");
  const viewUrl = /^av/i.test(p.id)
    ? `https://api.bilibili.com/x/web-interface/view?aid=${p.id.replace(/^av/i, "")}`
    : `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(p.id)}`;
  const view = await biliJson(viewUrl);
  if (view.code !== 0) throw new Error(view.message || "打不开这支视频");
  const data = view.data || {};
  const pages = data.pages || [];
  const page = pages[p.page - 1] || pages[0] || {};
  const cid = page.cid || data.cid;
  const aid = data.aid;
  const bvid = data.bvid || p.id;
  const title = [data.title, pages.length > 1 ? page.part : ""].filter(Boolean).join(" · ");

  let tracks = collectBiliTracks(data.subtitle?.list, data.subtitle?.subtitles);
  if (!tracks.length && aid && cid) {
    try {
      const signed = await biliWbiUrl("https://api.bilibili.com/x/player/wbi/v2", { aid, cid, bvid });
      const player = await biliJson(signed);
      tracks = collectBiliTracks(player.data?.subtitle?.subtitles, player.data?.subtitle?.list);
    } catch (_e) {
      /* try unsigned */
    }
  }
  if (!tracks.length && aid && cid) {
    const player = await biliJson(`https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}&bvid=${encodeURIComponent(bvid)}`);
    tracks = collectBiliTracks(player.data?.subtitle?.subtitles, player.data?.subtitle?.list);
  }
  if (!tracks.length) {
    throw new Error("B 站字幕要先登录。打开这支视频确认能出字幕，再点重试。");
  }
  return finishBiliTracks(tracks, title);
}

if (!globalThis.__KAIZEN_CS__) globalThis.__KAIZEN_CS__ = {};
globalThis.__KAIZEN_CS__.site = 1;
