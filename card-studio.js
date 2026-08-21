// Shared quote / vocab / note posters. Used by the side panel overlay and export.html.

const CARD_TEMPLATES = [
  { id: "poster", label: "暖报", shape: "port" },
  { id: "ink", label: "朱墨", shape: "port" },
  { id: "night", label: "夜读", shape: "port" },
  { id: "folio", label: "书页", shape: "port" },
  { id: "moss", label: "苔色", shape: "port" },
  { id: "margin", label: "批注", shape: "port" },
  { id: "plain", label: "素笺", shape: "port" },
  { id: "paper", label: "纸页", shape: "land" },
  { id: "slate", label: "黑板", shape: "land" },
  { id: "split", label: "对照", shape: "land" },
];

const CARD_FONT = "Source Han Serif SC, Noto Serif SC, Songti SC, STSong, SimSun, Georgia, serif";
const CARD_SANS = "PingFang SC, Hiragino Sans GB, Microsoft YaHei, Segoe UI, sans-serif";

function cardTr(zh) {
  return typeof t === "function" ? t(zh) : zh;
}

function cardEsc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardClock(seconds) {
  if (typeof clock === "function") return clock(seconds);
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function isCardTpl(id) {
  return CARD_TEMPLATES.some((item) => item.id === id);
}

function cardSpec(tpl) {
  const row = CARD_TEMPLATES.find((item) => item.id === tpl) || CARD_TEMPLATES[0];
  const port = row.shape === "port";
  return {
    id: row.id,
    port,
    w: port ? 900 : 1200,
    minH: port ? 1125 : 800,
    maxH: port ? 2400 : 1800,
    pad: port ? 72 : 80,
    padL: tpl === "margin" ? 96 : port ? 72 : 80,
  };
}

function cardTheme(tpl) {
  if (tpl === "slate") return { bg: "#1c1814", ink: "#f3ead8", muted: "#c4b8a6", accent: "#d4a27a", line: "#3a3228" };
  if (tpl === "night") return { bg: "#141820", ink: "#efe6d4", muted: "#9aa3b2", accent: "#d4b483", line: "#2a3140" };
  if (tpl === "ink") return { bg: "#fbf8f1", ink: "#1a1612", muted: "#5c5348", accent: "#b42318", line: "#d8cfc0" };
  if (tpl === "folio") return { bg: "#f3ead8", ink: "#2a2218", muted: "#6a5d4c", accent: "#8b3a2a", line: "#cfc3ad" };
  if (tpl === "moss") return { bg: "#eef3e4", ink: "#1c2418", muted: "#5a6450", accent: "#4a7c4a", line: "#c5ceb8" };
  if (tpl === "margin") return { bg: "#f7f1e6", ink: "#241c14", muted: "#6b5e4e", accent: "#c4472d", line: "#e0d4c2" };
  if (tpl === "plain") return { bg: "#fffdf8", ink: "#2c2418", muted: "#6b5e4e", accent: "#8a7a66", line: "#eee6d8" };
  if (tpl === "poster") return { bg: "#f6efe3", ink: "#2c2418", muted: "#6b5e4e", accent: "#c4472d", line: "#e0d4c2" };
  return { bg: "#fffdf8", ink: "#2c2418", muted: "#6b5e4e", accent: "#c4472d", line: "#e6dece" };
}

function wrapCardLines(text, maxUnits, maxLines = 40) {
  const chars = Array.from(String(text || "").replace(/\s+/g, " ").trim());
  const widthOf = (ch) => (ch.charCodeAt(0) > 127 ? 2 : 1);
  const lines = [];
  let line = "";
  let units = 0;
  for (const ch of chars) {
    const w = widthOf(ch);
    if (units + w > maxUnits && line) {
      lines.push(line);
      line = ch === " " ? "" : ch;
      units = line ? widthOf(line) : 0;
    } else {
      line += ch;
      units += w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1].replace(/[….]$/, "")}…`;
    return { lines: cut, clipped: true };
  }
  return { lines, clipped: false };
}

function svgTspans(lines, x) {
  return lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : 1.35}em">${cardEsc(line)}</tspan>`).join("");
}

function cardKindLabel(kind) {
  if (kind === "vocab") return cardTr("生词");
  if (kind === "notes") return cardTr("笔记");
  return cardTr("金句");
}

function takeLabelOf(kind) {
  return kind === "vocab" ? cardTr("释义") : cardTr("我的理解");
}

function measureCard(row, spec, tpl, sizes) {
  const enWrap = wrapCardLines(row.en, sizes.enMax, 16);
  const zhWrap = wrapCardLines(row.zh, sizes.zhMax, 12);
  const takeWrap = wrapCardLines(row.take, sizes.takeMax, 28);
  let y = spec.pad + 10;
  y += 28;
  y += spec.port ? 58 : 50;
  if (enWrap.lines.length) y += enWrap.lines.length * sizes.enSize * 1.35 + 18;
  if (tpl === "split" && zhWrap.lines.length) y += 36;
  if (zhWrap.lines.length) y += zhWrap.lines.length * sizes.zhSize * 1.4 + 16;
  if (takeWrap.lines.length) y += 12 + 24 + 22 + takeWrap.lines.length * sizes.takeSize * 1.45 + 8;
  y += tpl === "ink" ? 140 : tpl === "plain" || tpl === "margin" || tpl === "folio" ? 88 : 130;
  return { y, enWrap, zhWrap, takeWrap };
}

function decoBehind(spec, h, theme, tpl) {
  if (tpl === "plain") return "";
  if (tpl === "ink") {
    return `<line x1="${spec.pad}" y1="${spec.pad - 16}" x2="${spec.w - spec.pad}" y2="${spec.pad - 16}" stroke="${theme.accent}" stroke-width="2.2"/>`;
  }
  if (tpl === "night") {
    return `<rect x="26" y="26" width="${spec.w - 52}" height="${h - 52}" fill="none" stroke="${theme.line}" stroke-width="1"/>
    <circle cx="${spec.w - spec.pad + 6}" cy="${spec.pad - 6}" r="11" fill="none" stroke="${theme.accent}" stroke-width="1.2"/>
    <circle cx="${spec.w - spec.pad + 11}" cy="${spec.pad - 10}" r="11" fill="${theme.bg}"/>`;
  }
  if (tpl === "folio") {
    return `<rect x="0" y="0" width="18" height="${h}" fill="${theme.line}" opacity="0.35"/>
    <line x1="${spec.pad}" y1="${spec.pad + 46}" x2="${spec.w - spec.pad}" y2="${spec.pad + 46}" stroke="${theme.line}" stroke-width="1"/>`;
  }
  if (tpl === "moss") {
    return `<rect x="0" y="0" width="14" height="${h}" fill="${theme.accent}" opacity="0.28"/>
    <line x1="${spec.pad}" y1="${spec.pad + 40}" x2="${spec.w - spec.pad}" y2="${spec.pad + 40}" stroke="${theme.line}" stroke-width="1"/>`;
  }
  if (tpl === "margin") {
    return `<rect x="40" y="${spec.pad}" width="7" height="${h - spec.pad * 2}" fill="${theme.accent}"/>`;
  }
  return `<rect x="28" y="28" width="${spec.w - 56}" height="${h - 56}" fill="none" stroke="${theme.line}" stroke-width="1"/>
  <rect x="34" y="34" width="${spec.w - 68}" height="${h - 68}" fill="none" stroke="${theme.line}" stroke-width="0.6" opacity="0.7"/>`;
}

function decoFront(spec, h, theme, tpl) {
  if (tpl === "plain" || tpl === "margin") return "";
  if (tpl === "ink") {
    const x = spec.w - spec.pad - 52;
    const y = h - spec.pad - 52;
    return `<rect x="${x}" y="${y}" width="52" height="52" fill="${theme.accent}"/>
    <text x="${x + 26}" y="${y + 35}" text-anchor="middle" font-family="${CARD_FONT}" font-size="26" fill="${theme.bg}">K</text>`;
  }
  if (tpl === "folio") {
    return `<text x="${spec.w / 2}" y="${h - 40}" text-anchor="middle" font-family="${CARD_SANS}" font-size="13" fill="${theme.muted}">· K ·</text>`;
  }
  const showMark = tpl !== "night";
  const mark = showMark
    ? `<text x="${spec.w - spec.pad + 8}" y="${spec.pad + 28}" text-anchor="end" font-family="${CARD_FONT}" font-size="88" fill="${theme.accent}" opacity="0.12">“</text>`
    : "";
  return `${mark}
  <circle cx="${spec.w - spec.pad - 18}" cy="${h - 118}" r="22" fill="none" stroke="${theme.accent}" stroke-width="1.4" opacity="0.7"/>
  <text x="${spec.w - spec.pad - 18}" y="${h - 112}" text-anchor="middle" font-family="${CARD_FONT}" font-size="16" fill="${theme.accent}">K</text>`;
}

function brandText(tpl) {
  if (tpl === "folio") return cardTr("KAIZEN · 读书笔记");
  if (tpl === "ink") return "KAIZEN";
  if (tpl === "plain") return "Kaizen";
  return "KAIZEN";
}

function buildCardSvg(row, data, tpl) {
  const id = isCardTpl(tpl) ? tpl : "poster";
  const spec = cardSpec(id);
  const theme = cardTheme(id);
  const x = spec.padL;
  const inner = spec.w - spec.padL - spec.pad;
  const sizes = {
    enSize: row.kind === "vocab" ? (spec.port ? 56 : 52) : spec.port ? 40 : 36,
    zhSize: id === "split" ? 26 : 20,
    takeSize: 18,
    enMax: Math.max(16, Math.floor(inner / (spec.port ? 21 : 18))),
    zhMax: Math.max(20, Math.floor(inner / (spec.port ? 16 : 14))),
    takeMax: Math.max(22, Math.floor(inner / (spec.port ? 15 : 13))),
  };

  let laid = measureCard(row, spec, id, sizes);
  let guard = 0;
  while (laid.y > spec.maxH && guard < 7) {
    sizes.enSize = Math.max(24, sizes.enSize - 3);
    sizes.zhSize = Math.max(14, sizes.zhSize - 1);
    sizes.takeSize = Math.max(14, sizes.takeSize - 1);
    sizes.enMax += 2;
    sizes.zhMax += 2;
    sizes.takeMax += 3;
    laid = measureCard(row, spec, id, sizes);
    guard += 1;
  }

  const clipped = Boolean(laid.enWrap.clipped || laid.zhWrap.clipped || laid.takeWrap.clipped);
  const h = Math.min(spec.maxH, Math.max(spec.minH, Math.ceil(laid.y)));
  const kind = cardKindLabel(row.kind);
  const takeName = takeLabelOf(row.kind);
  const foot = `${cardClock(row.seconds)}${row.why ? ` · ${row.why}` : ""}`;
  const takeFill = id === "margin" ? theme.accent : theme.ink;
  const chunks = [];
  let y = spec.pad + 8;

  chunks.push(
    `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${id === "plain" ? 15 : 17}" font-weight="700" fill="${theme.accent}" letter-spacing="${id === "plain" ? 2 : 5}">${cardEsc(brandText(id))}</text>`,
  );
  y += 30;
  chunks.push(
    `<text x="${x}" y="${y}" font-family="${CARD_SANS}" font-size="14" fill="${theme.muted}">${cardEsc(String(row.kicker || data?.title || "").slice(0, 48))} · ${cardEsc(kind)}</text>`,
  );
  y += spec.port ? 58 : 50;
  if (id === "folio") y += 8;

  if (laid.enWrap.lines.length) {
    chunks.push(
      `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${sizes.enSize}" fill="${theme.ink}" font-weight="${row.kind === "vocab" ? 700 : 500}">${svgTspans(laid.enWrap.lines, x)}</text>`,
    );
    y += laid.enWrap.lines.length * sizes.enSize * 1.35 + 18;
  }
  if (id === "split" && laid.zhWrap.lines.length) {
    chunks.push(`<line x1="${x}" y1="${y}" x2="${spec.w - spec.pad}" y2="${y}" stroke="${theme.line}" stroke-width="1"/>`);
    y += 36;
  }
  if (laid.zhWrap.lines.length) {
    chunks.push(
      `<text x="${x}" y="${y}" font-family="${CARD_SANS}" font-size="${sizes.zhSize}" fill="${id === "split" ? theme.ink : theme.muted}">${svgTspans(laid.zhWrap.lines, x)}</text>`,
    );
    y += laid.zhWrap.lines.length * sizes.zhSize * 1.4 + 16;
  }
  if (laid.takeWrap.lines.length) {
    y += 10;
    chunks.push(
      `<line x1="${x}" y1="${y}" x2="${spec.w - spec.pad}" y2="${y}" stroke="${theme.line}" stroke-width="1" stroke-dasharray="${id === "margin" ? "0" : "4 6"}"/>`,
    );
    y += 26;
    chunks.push(
      `<text x="${x}" y="${y}" font-family="${CARD_SANS}" font-size="12" fill="${theme.muted}" letter-spacing="2">${cardEsc(takeName)}</text>`,
    );
    y += 24;
    chunks.push(
      `<text x="${x}" y="${y}" font-family="${CARD_SANS}" font-size="${sizes.takeSize}" fill="${takeFill}">${svgTspans(laid.takeWrap.lines, x)}</text>`,
    );
  }

  const footY = h - 42;
  chunks.push(`<line x1="${x}" y1="${h - 70}" x2="${spec.w - spec.pad}" y2="${h - 70}" stroke="${theme.line}" stroke-width="1"/>`);
  chunks.push(`<text x="${x}" y="${footY}" font-family="${CARD_SANS}" font-size="14" fill="${theme.muted}">${cardEsc(foot)}</text>`);
  if (id !== "folio") {
    chunks.push(
      `<text x="${spec.w - spec.pad}" y="${footY}" text-anchor="end" font-family="${CARD_SANS}" font-size="14" fill="${theme.muted}">${cardEsc(row.foot || "Kaizen")}</text>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.w}" height="${h}" viewBox="0 0 ${spec.w} ${h}">
  <rect width="${spec.w}" height="${h}" fill="${theme.bg}"/>
  ${decoBehind(spec, h, theme, id)}
  ${chunks.join("\n  ")}
  ${decoFront(spec, h, theme, id)}
</svg>`;
  return { svg, w: spec.w, h, bg: theme.bg, clipped };
}

function cardFileStem(title, row, i, kind) {
  const label = cardKindLabel(kind || row.kind);
  const slug = String(row.en || row.zh || label)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  const base = `Kaizen-${String(title || cardTr("笔记")).replace(/[\\/:*?"<>|]/g, "").slice(0, 36)}`;
  return `${base}-${label}-${String(i + 1).padStart(2, "0")}-${slug}`;
}

function svgToPngBlob(svgText, w, h, bg = "#fffdf8") {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => (out ? resolve(out) : reject(new Error(cardTr("PNG 没做成")))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(cardTr("SVG 画不出来")));
    };
    img.src = url;
  });
}

function downloadCardFile(filename, blobOrText, type) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

globalThis.KaizenCard = {
  TEMPLATES: CARD_TEMPLATES,
  isTpl: isCardTpl,
  theme: cardTheme,
  spec: cardSpec,
  buildCardSvg,
  svgToPngBlob,
  cardFileStem,
  downloadCardFile,
  kindLabel: cardKindLabel,
};
