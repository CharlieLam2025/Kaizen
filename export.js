const CAT = liveLabels({ concept: "讲概念", case: "讲案例", story: "讲故事", action: "给做法", qa: "在问答" });
const FRAME = liveLabels({
  concept: "SEE-I · 属加种差",
  case: "类比编码 · CER",
  story: "冰山",
  action: "任务分析 · 库伯",
  qa: "Toulmin",
});
const CARD_KIND = liveLabels({ quotes: "金句", vocab: "生词", notes: "笔记" });
const PROGRESS = liveLabels({ fresh: "未开始", learning: "进行中", done: "已学会" });

const $ = (id) => document.getElementById(id);

function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function dateText(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fileBase(title) {
  return `Kaizen-${String(title || "笔记").replace(/[\\/:*?"<>|]/g, "").slice(0, 42)}`;
}

function progressOf(data, i) {
  return data.progress?.[i] || data.progress?.[String(i)] || "fresh";
}

function diveOf(data, i) {
  return data.dives?.[i] || data.dives?.[String(i)] || null;
}

function scriptOf(data, i) {
  return data.scripts?.[i] || data.scripts?.[String(i)] || null;
}

function feynmanText(script) {
  if (!script) return "";
  const solo = { pre: t("还没成形"), uni: "单点", multi: "多点", rel: "关联", ext: t("抽象拓展") };
  const bits = [];
  if (script.take) bits.push(`我的讲法\n${script.take}`);
  if (script.solo) bits.push(`这稿：${solo[script.solo] || script.solo}${script.soloWhy ? ` · ${script.soloWhy}` : ""}`);
  const gaps = (script.gaps || []).map((g) => (typeof g === "string" ? g : g.point)).filter(Boolean);
  if (gaps.length) bits.push(`还没讲清\n- ${gaps.join("\n- ")}`);
  if (script.jargon?.length) {
    bits.push(`还在用的行话\n${script.jargon.map((j) => `- ${j.word} → ${j.plain}`).join("\n")}`);
  }
  if (script.probe) bits.push(`追问\n${script.probe}`);
  if (!script.solo && !script.probe) {
    if (script.clear?.length) bits.push(`讲清楚了\n- ${script.clear.join("\n- ")}`);
    const simpler = script.simpler || [script.hook, script.script, script.cta].filter(Boolean).join("\n\n");
    if (simpler) bits.push(`可以更简单\n${simpler}`);
    if (script.next) bits.push(`下次先补\n${script.next}`);
  }
  return bits.join("\n\n");
}

function listHtml(items, map) {
  const rows = (items || []).map(map).filter(Boolean);
  return rows.length ? `<ul>${rows.join("")}</ul>` : "";
}

function sectionIds(data) {
  const raw = [];
  if (data.essay?.lede || data.essay?.sections?.length) raw.push([t("整理后的笔记"), "essay"]);
  if (data.notes?.length) raw.push(["我写下的", "notes"]);
  if (data.marks?.length) raw.push(["书签", "pins"]);
  if (data.quotes?.length) raw.push(["金句", "quotes"]);
  if (data.segments?.length) raw.push([t("正文"), "script"]);
  if (data.highlights?.length) raw.push(["划线", "marks"]);
  if (data.vocab?.length) raw.push(["生词", "vocab"]);
  if (data.study || data.blocks?.length) raw.push(["知识骨架", "bones"]);
  if (data.blocks?.some((_, i) => diveOf(data, i))) raw.push(["拆解与内化", "dives"]);
  if (data.conceptMap?.propositions?.length || data.conceptMap?.nodes?.length) raw.push(["概念关系", "map"]);
  if (data.chat?.some((m) => m.role === "user")) raw.push(["问答", "ask"]);
  return raw.map(([title, id], i) => [String(i + 1).padStart(2, "0"), title, id]);
}

function sectionHead(data, id) {
  const found = sectionIds(data).find((row) => row[2] === id);
  if (!found) return "";
  return `<div class="section-head"><span class="num">${found[0]}</span><h2>${esc(found[1])}</h2></div>`;
}

function renderCover(data) {
  const stats = [
    [data.notes?.length || 0, "条笔记"],
    [data.marks?.length || 0, "枚书签"],
    [data.quotes?.length || 0, "条金句"],
    [data.blocks?.length || 0, "个知识块"],
    [data.vocab?.length || 0, "个生词"],
  ];
  const toc = sectionIds(data)
    .map(([num, title]) => `<li><span>${esc(title)}</span><i>${num}</i></li>`)
    .join("");
  return `<header class="cover">
    <div class="kicker">Kaizen · 笔记</div>
    <h1>${esc(data.title || t("未命名视频"))}</h1>
    ${data.gist ? `<p class="lede">${esc(data.gist)}</p>` : ""}
    <div class="meta">
      <span>${dateText(data.exportedAt)}</span>
      ${data.url ? `<a href="${esc(data.url)}">${esc(data.url.replace("https://www.", ""))}</a>` : ""}
    </div>
    <div class="stats">${stats
      .map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`)
      .join("")}</div>
    ${toc ? `<ol class="toc">${toc}</ol>` : ""}
  </header>`;
}

function renderEssay(data) {
  const essay = data.essay;
  if (!essay?.lede && !essay?.sections?.length) return "";
  const body = (essay.sections || [])
    .map((s) => `<h3>${esc(s.h || s.heading || "")}</h3><p>${esc(s.body || "")}</p>`)
    .join("");
  const takes = listHtml(essay.takeaways, (t) => `<li>${esc(t)}</li>`);
  const acts = listHtml(essay.actions, (t) => `<li>${esc(t)}</li>`);
  return `<section class="section" id="essay">
    ${sectionHead(data, "essay")}
    <div class="essay">
      ${essay.lede ? `<p>${esc(essay.lede)}</p>` : ""}
      ${body}
      ${takes ? `<div class="takeaways"><div class="k">带走</div>${takes}</div>` : ""}
      ${acts ? `<div class="takeaways" style="margin-top:10px"><div class="k">可以去做</div>${acts}</div>` : ""}
    </div>
  </section>`;
}

function renderNotes(data) {
  if (!data.notes?.length) return "";
  return `<section class="section" id="notes">
    ${sectionHead(data, "notes")}
    ${data.notes
      .map(
        (n) => `<article class="note">
        <div class="when">${clock(n.seconds)}</div>
        <p class="mine">${esc(n.text)}</p>
        ${n.quote ? `<p class="quote">${esc(n.quote)}</p>` : ""}
      </article>`,
      )
      .join("")}
  </section>`;
}

function quotePair(q) {
  const en = q.en || (!/[\u4e00-\u9fff]/.test(q.text || "") ? q.text : "");
  const zh = q.zh || (/[\u4e00-\u9fff]/.test(q.text || "") ? q.text : "");
  return { en, zh, why: q.why || "", take: q.take || "", seconds: q.seconds };
}

function renderQuotes(data) {
  if (!data.quotes?.length) return "";
  return `<section class="section" id="quotes">
    ${sectionHead(data, "quotes")}
    ${data.quotes
      .slice()
      .sort((a, b) => (a.seconds || 0) - (b.seconds || 0))
      .map((q) => {
        const pair = quotePair(q);
        return `<article class="quote-card">
        <div class="when">${clock(q.seconds)}${pair.why ? ` · ${esc(pair.why)}` : ""}</div>
        ${pair.en ? `<p class="q-en">${esc(pair.en)}</p>` : ""}
        ${pair.zh ? `<p class="q-zh">${esc(pair.zh)}</p>` : !pair.en ? `<p>${esc(q.text || "")}</p>` : ""}
        ${pair.take ? `<p class="q-take">${esc(pair.take)}</p>` : ""}
      </article>`;
      })
      .join("")}
  </section>`;
}

function quoteRows(data) {
  return (data.quotes || []).slice().sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
}

function cardKindOf(kind) {
  return CARD_KIND[kind] ? kind : "quotes";
}

function cardRowsOf(data, kind) {
  const k = cardKindOf(kind);
  if (k === "vocab") {
    return (data.vocab || []).map((v, i) => ({
      id: v.id || `v-${i}`,
      kind: "vocab",
      seconds: v.seconds,
      kicker: data.title || "",
      en: v.word || "",
      zh: v.sentence || "",
      take: vocabGloss(v),
      why: "",
      foot: v.videoTitle || data.title || "",
    }));
  }
  if (k === "notes") {
    return (data.notes || []).map((n, i) => ({
      id: n.id || `n-${i}`,
      kind: "notes",
      seconds: n.seconds,
      kicker: data.title || "",
      en: n.text || "",
      zh: n.quote || "",
      take: "",
      why: "",
      foot: data.title || "",
    }));
  }
  return quoteRows(data).map((q) => {
    const pair = quotePair(q);
    return {
      id: q.id,
      kind: "quotes",
      seconds: q.seconds,
      kicker: data.title || "",
      en: pair.en || q.text || "",
      zh: pair.zh || "",
      take: pair.take,
      why: pair.why,
      foot: data.title || "",
    };
  });
}

function cardEmptyHint(kind) {
  if (kind === "vocab") return "这支还没有生词。回到侧栏「笔记 → 生词本」存几个，再导出卡片。";
  if (kind === "notes") return "这支还没有笔记。回到侧栏「笔记」写一句，或看视频时按 N。";
  return "这支还没有金句。回到侧栏「笔记 → 金句」抽出或按 R 记下几句，再导出卡片。";
}

function renderQuoteDeck(data, { tpl = "poster", index = -1, kind = "quotes" } = {}) {
  const rows = cardRowsOf(data, kind);
  if (!rows.length) {
    $("doc").innerHTML = `<p class="empty">${cardEmptyHint(kind)}</p>`;
    document.title = `${CARD_KIND[kind] || "金句"}卡片 · Kaizen`;
    return [];
  }
  const shown = index >= 0 && rows[index] ? [rows[index]] : rows;
  $("doc").className = "doc deck";
  $("doc").innerHTML = shown
    .map((row) => {
      const { svg } = KaizenCard.buildCardSvg(row, data, tpl);
      return `<figure class="qdeck-svg">${svg}</figure>`;
    })
    .join("");
  document.body.dataset.cardTpl = tpl;
  document.body.dataset.cardKind = cardKindOf(kind);
  document.body.classList.toggle("card-one", shown.length === 1);
  const label = CARD_KIND[kind] || "金句";
  document.title = shown.length === 1 ? `${data.title || "Kaizen"} · 一张${label}` : `${data.title || "Kaizen"} · ${label}卡片`;
  return rows;
}

function cardFileStem(data, row, i, kind) {
  const label = CARD_KIND[kind] || "金句";
  const slug = String(row.en || row.zh || label)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  return `${fileBase(data.title)}-${label}-${String(i + 1).padStart(2, "0")}-${slug}`;
}

function svgToPngBlob(svgText, w, h, bg) {
  return KaizenCard.svgToPngBlob(svgText, w, h, bg);
}

async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function downloadCardImages(data, cardState, { all = false, format = "svg" } = {}) {
  const kind = cardKindOf(cardState.kind);
  const rows = cardRowsOf(data, kind);
  if (!rows.length) {
    $("sheetHint").textContent = cardEmptyHint(kind);
    return;
  }
  const pick = !all && cardState.index >= 0 ? [rows[cardState.index]] : all ? rows : [];
  if (!pick.length) {
    $("sheetHint").textContent = "先在「哪一张」里选一张，或用全部下载。";
    return;
  }
  const label = CARD_KIND[kind];
  if (format === "svg") {
    if (pick.length === 1) {
      const i = rows.indexOf(pick[0]);
      const { svg } = KaizenCard.buildCardSvg(pick[0], data, cardState.tpl);
      downloadText(`${cardFileStem(data, pick[0], i, kind)}.svg`, svg, "image/svg+xml;charset=utf-8");
      $("sheetHint").textContent = `已下载 1 张${label} SVG。`;
      return;
    }
    const files = pick.map((row, n) => {
      const i = rows.indexOf(row);
      return { name: `${cardFileStem(data, row, i < 0 ? n : i, kind)}.svg`, data: KaizenCard.buildCardSvg(row, data, cardState.tpl).svg };
    });
    downloadBytes(`Kaizen-${label}-svg.zip`, zipStore(files), "application/zip");
    $("sheetHint").textContent = `已打包 ${pick.length} 张${label} SVG。`;
    return;
  }
  $("sheetHint").textContent = pick.length > 1 ? `正在做成 ${pick.length} 张 PNG…` : "正在做成 PNG…";
  const files = [];
  for (let n = 0; n < pick.length; n += 1) {
    const row = pick[n];
    const i = rows.indexOf(row);
    const { svg, w, h, bg } = KaizenCard.buildCardSvg(row, data, cardState.tpl);
    const blob = await svgToPngBlob(svg, w, h, bg);
    if (pick.length === 1) {
      downloadBytes(`${cardFileStem(data, row, i, kind)}.png`, await blobToBytes(blob), "image/png");
      $("sheetHint").textContent = `已下载 1 张${label} PNG。`;
      return;
    }
    files.push({ name: `${cardFileStem(data, row, i < 0 ? n : i, kind)}.png`, data: await blobToBytes(blob) });
  }
  downloadBytes(`Kaizen-${label}-png.zip`, zipStore(files), "application/zip");
  $("sheetHint").textContent = `已打包 ${pick.length} 张${label} PNG。`;
}

function decorateExportLine(text, marks) {
  const plain = String(text || "");
  const cuts = [];
  for (const h of marks || []) {
    const needle = String(h.text || "").trim();
    if (needle.length < 2) continue;
    const start = plain.indexOf(needle);
    if (start < 0) continue;
    cuts.push({ start, end: start + needle.length, cls: hlClassOf(h) });
  }
  cuts.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
  let html = "";
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start < cursor) continue;
    html += esc(plain.slice(cursor, cut.start));
    html += `<mark class="${cut.cls}">${esc(plain.slice(cut.start, cut.end))}</mark>`;
    cursor = cut.end;
  }
  html += esc(plain.slice(cursor));
  return html;
}

function renderScript(data) {
  if (!data.segments?.length) return "";
  return `<section class="section" id="script">
    ${sectionHead(data, "script")}
    ${data.segments
      .map(
        (s) => `<article class="note">
        <div class="when">${clock(s.start)}</div>
        <p>${decorateExportLine(s.text, data.highlights)}</p>
      </article>`,
      )
      .join("")}
  </section>`;
}

function renderPins(data) {
  if (!data.marks?.length) return "";
  const rows = data.marks
    .slice()
    .sort((a, b) => (a.seconds || 0) - (b.seconds || 0))
    .map(
      (m) => `<article class="note">
        <div class="when">${clock(m.seconds)}</div>
        <p>${esc(m.label || "")}</p>
        ${m.note ? `<p class="quote">${esc(m.note)}</p>` : ""}
      </article>`,
    )
    .join("");
  return `<section class="section" id="pins">
    ${sectionHead(data, "pins")}
    ${rows}
  </section>`;
}

function renderMarks(data) {
  if (!data.highlights?.length) return "";
  return `<section class="section" id="marks">
    ${sectionHead(data, "marks")}
    ${data.highlights
      .map(
        (h) => `<article class="note">
        <div class="when">${clock(h.seconds)} · ${esc(HL_LABEL[h.color] || "划线")} · ${esc(HL_STYLE[h.style] || "横线")}</div>
        <p class="quote"><q class="${hlClassOf(h)}">${esc(h.text)}</q></p>
      </article>`,
      )
      .join("")}
  </section>`;
}

function renderVocab(data) {
  if (!data.vocab?.length) return "";
  return `<section class="section" id="vocab">
    ${sectionHead(data, "vocab")}
    <div class="vocab">${data.vocab
      .map(
        (v) => `<div class="vocab-item">
        <div class="w">${esc(v.word)}</div>
        ${vocabSources(v)
          .map((s) =>
            s.sentence
              ? `<p class="quote">${esc(s.sentence)}</p>${s.videoTitle ? `<p class="src">${esc(s.videoTitle)}</p>` : ""}`
              : s.videoTitle
                ? `<p class="src">${esc(s.videoTitle)}</p>`
                : "",
          )
          .join("") || (v.sentence ? `<p class="quote">${esc(v.sentence)}</p>` : "")}
      </div>`,
      )
      .join("")}</div>
  </section>`;
}

function renderBones(data) {
  if (!data.study && !data.blocks?.length) return "";
  const study = data.study || {};
  const recap = listHtml(study.recap, (line) => `<li>${esc(line)}</li>`);
  const kws = (study.keywords || [])
    .map((k) => `<li><b>${esc(k.word)}</b> — ${esc(k.gloss || "")}</li>`)
    .join("");
  const qs = listHtml(study.questions, (q) => `<li>${esc(q.q || q)}${q.at ? ` <span class="when">${esc(q.at)}</span>` : ""}</li>`);
  const bricks = (data.blocks || [])
    .map((b, i) => {
      const st = progressOf(data, i);
      return `<article class="brick">
        <div class="brick-kicker">${CAT[b.category] || ""}${FRAME[b.category] ? ` · ${FRAME[b.category]}` : ""} · ${clock(b.start)}–${clock(b.end)} · ${PROGRESS[st] || ""}</div>
        <h3>${esc(b.title)}</h3>
        <p class="sum">${esc(b.summary || "")}</p>
      </article>`;
    })
    .join("");
  return `<section class="section" id="bones">
    ${sectionHead(data, "bones")}
    ${study.spine ? `<div class="kv"><div class="k">总纲</div><p>${esc(study.spine)}</p></div>` : ""}
    ${recap ? `<div class="kv"><div class="k">复述提纲</div>${recap}</div>` : ""}
    ${kws ? `<div class="kv"><div class="k">关键词</div><ul>${kws}</ul></div>` : ""}
    ${qs ? `<div class="kv"><div class="k">带着问题去找</div>${qs}</div>` : ""}
    ${bricks}
  </section>`;
}

function diveKindOf(dive, brick) {
  if (["concept", "case", "story", "action", "qa"].includes(dive?.kind)) return dive.kind;
  if (["concept", "case", "story", "action", "qa"].includes(brick?.category)) return brick.category;
  return "";
}

function renderDiveBlock(dive, brick) {
  if (!dive) return "";
  const kind = diveKindOf(dive, brick);
  const parts = (dive.parts || [])
    .map(
      (p) =>
        `<li><b>${esc(p.name)}</b> — ${esc(p.role)}${p.ifMissing ? `（缺了：${esc(p.ifMissing)}）` : ""}</li>`,
    )
    .join("");
  const concepts = (dive.concepts || [])
    .map((c) => `<li><b>${esc(c.term)}</b> — ${esc(c.def)}</li>`)
    .join("");
  const steps = (dive.steps || [])
    .map((s) => `<li><b>${esc(s.name)}</b>${s.judge ? ` — ${esc(s.judge)}` : ""}</li>`)
    .join("");
  const block = (label, html) => (html ? `<div class="kv"><div class="k">${label}</div>${html}</div>` : "");
  const p = (text) => (text ? `<p>${esc(text)}</p>` : "");
  const mech = typeof dive.caseMechanism === "string" ? dive.caseMechanism : typeof dive.mechanism === "string" ? dive.mechanism : "";
  const typed =
    kind === "concept"
      ? [p(dive.essence), block("边界", p(dive.elaborate)), block("正例", p(dive.example)), block("反例", p(dive.counter)), block("类比", p(dive.analogy))]
      : kind === "case"
        ? [p(dive.claim), block("机制", p(mech)), block("换场景", p(dive.transfer)), block(t("没说的前提"), p(dive.hidden))]
        : kind === "story"
          ? [block("事件", p(dive.event)), block("模式", p(dive.pattern)), block("结构", p(dive.structure)), block(t("想让你信"), p(dive.belief))]
          : kind === "action"
            ? [p(dive.goal), block("前提", listHtml(dive.prereq, (x) => `<li>${esc(x)}</li>`)), block("步骤", steps ? `<ul>${steps}</ul>` : ""), block("最容易失败", p(dive.fail)), block("小实验", p(dive.experiment))]
            : kind === "qa"
              ? [p(dive.question), block("主张", p(dive.claim)), block("依据", p(dive.warrant)), block("何时不适用", p(dive.qualifier))]
              : [
                  dive.essence ? `<p>${esc(dive.essence)}</p>` : "",
                  block("组成部分", parts ? `<ul>${parts}</ul>` : ""),
                  dive.map ? block("结构", `<p>${esc(dive.map)}</p>`) : "",
                  dive.owned ? block("怎样算内化", `<p>${esc(dive.owned)}</p>`) : "",
                  block("核心概念", concepts ? `<ul>${concepts}</ul>` : ""),
                  block("原理", listHtml(Array.isArray(dive.mechanism) ? dive.mechanism : [], (x) => `<li>${esc(x)}</li>`)),
                  block("例子", listHtml(dive.examples, (x) => `<li>${esc(x)}</li>`)),
                  block("坑", listHtml(dive.pitfalls, (x) => `<li>${esc(x)}</li>`)),
                  block("自测", listHtml(dive.selfTest, (x) => `<li>${esc(x)}</li>`)),
                ];
  return [
    ...typed,
    block("怎么记", listHtml(dive.encode, (x) => `<li>${esc(x)}</li>`)),
    block("何时调用", listHtml(dive.retrieve, (x) => `<li>${esc(x)}</li>`)),
    block("和已知挂钩", listHtml(dive.connect, (x) => `<li>${esc(x)}</li>`)),
    dive.gap ? block("视频没补上的", `<p>${esc(dive.gap)}</p>`) : "",
  ].join("");
}

function renderDives(data) {
  const cards = (data.blocks || [])
    .map((b, i) => {
      const dive = diveOf(data, i);
      if (!dive) return "";
      const script = scriptOf(data, i);
      return `<article class="brick">
        <div class="brick-kicker">${CAT[b.category] || ""}${FRAME[b.category] ? ` · ${FRAME[b.category]}` : ""} · ${esc(b.title)}</div>
        <h3>${esc(b.title)}</h3>
        ${renderDiveBlock(dive, b)}
        ${
          feynmanText(script)
            ? `<div class="kv"><div class="k">费曼</div><p>${esc(feynmanText(script)).replace(/\n/g, "<br>")}</p></div>`
            : ""
        }
      </article>`;
    })
    .join("");
  if (!cards) return "";
  return `<section class="section" id="dives">
    ${sectionHead(data, "dives")}
    ${cards}
  </section>`;
}

function renderMap(data) {
  const map = data.conceptMap;
  if (map?.propositions?.length && map?.concepts?.length) {
    const names = new Map(map.concepts.map((n) => [n.id, n.label]));
    const rows = map.propositions
      .map((p) => {
        const a = names.get(p.from);
        const b = names.get(p.to);
        if (!a || !b) return "";
        return `<div class="edge"><b>${esc(a)}</b><em>${esc(p.link)}</em><b>${esc(b)}</b></div>`;
      })
      .join("");
    return `<section class="section" id="map">
      ${sectionHead(data, "map")}
      ${map.focusQuestion ? `<div class="kv"><div class="k">焦点问题</div><p>${esc(map.focusQuestion)}</p></div>` : ""}
      ${rows ? `<div class="kv"><div class="k">命题</div>${rows}</div>` : ""}
    </section>`;
  }
  if (!map?.nodes?.length) return "";
  const names = new Map(map.nodes.map((n) => [n.id, n.label]));
  const clusters = (map.clusters || [])
    .map((c) => {
      const nodes = map.nodes.filter((n) => n.cluster === c.id).map((n) => esc(n.label));
      return `<div class="kv"><div class="k">${esc(c.label)}${c.independent ? t(" · 独立簇") : ""}</div><p>${nodes.join(" · ")}</p></div>`;
    })
    .join("");
  const edges = (map.edges || [])
    .map((e) => {
      const a = names.get(e.from);
      const b = names.get(e.to);
      if (!a || !b) return "";
      return `<div class="edge"><b>${esc(a)}</b><em>${esc(e.rel || "关联")}</em><b>${esc(b)}</b></div>`;
    })
    .join("");
  return `<section class="section" id="map">
    ${sectionHead(data, "map")}
    ${clusters}
    ${edges ? `<div class="kv"><div class="k">箭头</div>${edges}</div>` : ""}
  </section>`;
}

function renderAsk(data) {
  const rows = [];
  const chat = data.chat || [];
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (msg.role !== "user") continue;
    const next = chat[i + 1];
    const answer = next?.role === "assistant" && !String(next.content).startsWith("⚠") ? next.content : "";
    rows.push(`<article class="chat"><div class="q">问：${esc(msg.content)}</div>${answer ? `<div class="a">${esc(answer)}</div>` : ""}</article>`);
  }
  if (!rows.length) return "";
  return `<section class="section" id="ask">
    ${sectionHead(data, "ask")}
    ${rows.join("")}
  </section>`;
}

function renderDoc(data) {
  $("doc").innerHTML = [
    renderCover(data),
    renderEssay(data),
    renderScript(data),
    renderNotes(data),
    renderPins(data),
    renderQuotes(data),
    renderMarks(data),
    renderVocab(data),
    renderBones(data),
    renderDives(data),
    renderMap(data),
    renderAsk(data),
  ].join("");
  document.title = `${data.title || t("Kaizen 笔记")} · Kaizen`;
}

function toMarkdown(data) {
  const lines = [`# ${data.title || t("未命名视频")}`, ""];
  if (data.gist) lines.push(`> ${data.gist}`, "");
  if (data.url) lines.push(`[打开视频](${data.url}) · ${dateText(data.exportedAt)}`, "");
  if (data.segments?.length) {
    lines.push(t("## 正文"), "");
    data.segments.forEach((s) => lines.push(`- (${clock(s.start)}) ${s.text}`));
    lines.push("");
  }
  const essay = data.essay;
  if (essay?.lede || essay?.sections?.length) {
    lines.push(`## ${essay.title || t("整理后的笔记")}`, "", essay.lede || "");
    for (const s of essay.sections || []) {
      lines.push("", `### ${s.h || s.heading || ""}`, "", s.body || "");
    }
    if (essay.takeaways?.length) {
      lines.push("", t("### 带走"), "");
      essay.takeaways.forEach((t) => lines.push(`- ${t}`));
    }
    if (essay.actions?.length) {
      lines.push("", t("### 可以去做"), "");
      essay.actions.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push("");
  }
  if (data.notes?.length) {
    lines.push(t("## 我写下的"), "");
    data.notes.forEach((n) => {
      lines.push(`### ${clock(n.seconds)}`, "", n.text, "");
      if (n.quote) lines.push(`> ${n.quote}`, "");
    });
  }
  if (data.marks?.length) {
    lines.push(t("## 书签"), "");
    data.marks
      .slice()
      .sort((a, b) => (a.seconds || 0) - (b.seconds || 0))
      .forEach((m) => {
        lines.push(`- (${clock(m.seconds)}) ${m.label || ""}`);
        if (m.note) lines.push(`  ${m.note}`);
      });
    lines.push("");
  }
  if (data.quotes?.length) {
    lines.push(t("## 金句"), "");
    data.quotes.forEach((q) => {
      const pair = quotePair(q);
      if (pair.en) lines.push(`- (${clock(q.seconds)}) ${pair.en}`);
      if (pair.zh) lines.push(pair.en ? `  ${pair.zh}` : `- (${clock(q.seconds)}) ${pair.zh}`);
      if (pair.take) lines.push(`  理解：${pair.take}`);
    });
    lines.push("");
  }
  if (data.highlights?.length) {
    lines.push(t("## 划线"), "");
    data.highlights.forEach((h) => lines.push(`- (${clock(h.seconds)}) ${h.text}`));
    lines.push("");
  }
  if (data.vocab?.length) {
    lines.push(t("## 生词"), "");
    data.vocab.forEach((v) => lines.push(`- **${v.word}**${v.sentence ? ` — ${v.sentence}` : ""}`));
    lines.push("");
  }
  if (data.study || data.blocks?.length) {
    lines.push(t("## 知识骨架"), "");
    if (data.study?.spine) lines.push(`**${data.study.spine}**`, "");
    (data.study?.recap || []).forEach((x) => lines.push(`- ${x}`));
    (data.blocks || []).forEach((b, i) => {
      lines.push("", `### ${b.title}`, "", `${clock(b.start)}–${clock(b.end)} · ${CAT[b.category] || ""}${FRAME[b.category] ? ` · ${FRAME[b.category]}` : ""}`, "", b.summary || "");
      const dive = diveOf(data, i);
      if (!dive) return;
      const head = dive.essence || dive.claim || dive.goal || dive.question || dive.event || "";
      if (head) lines.push("", head);
      const kind = diveKindOf(dive, b);
      if (kind === "concept") {
        if (dive.elaborate) lines.push(`- 边界：${dive.elaborate}`);
        if (dive.example) lines.push(`- 正例：${dive.example}`);
        if (dive.counter) lines.push(`- 反例：${dive.counter}`);
        if (dive.analogy) lines.push(`- 类比：${dive.analogy}`);
      } else if (kind === "case") {
        const mech = typeof dive.caseMechanism === "string" ? dive.caseMechanism : dive.mechanism;
        if (mech) lines.push(`- 机制：${mech}`);
        if (dive.transfer) lines.push(`- 换场景：${dive.transfer}`);
        if (dive.hidden) lines.push(`- 没说的前提：${dive.hidden}`);
      } else if (kind === "story") {
        if (dive.event) lines.push(`- 事件：${dive.event}`);
        if (dive.pattern) lines.push(`- 模式：${dive.pattern}`);
        if (dive.structure) lines.push(`- 结构：${dive.structure}`);
        if (dive.belief) lines.push(`- 想让你信：${dive.belief}`);
      } else if (kind === "action") {
        if (dive.fail) lines.push(`- 最容易失败：${dive.fail}`);
        if (dive.experiment) lines.push(`- 小实验：${dive.experiment}`);
        (dive.steps || []).forEach((s) => lines.push(`- ${s.name}${s.judge ? `：${s.judge}` : ""}`));
      } else if (kind === "qa") {
        if (dive.warrant) lines.push(`- 依据：${dive.warrant}`);
        if (dive.qualifier) lines.push(`- 何时不适用：${dive.qualifier}`);
      }
      (dive.parts || []).forEach((p) => lines.push(`- ${p.name}：${p.role}`));
    });
    lines.push("");
  }
  if (data.conceptMap?.propositions?.length && data.conceptMap?.concepts?.length) {
    lines.push("## 概念关系", "");
    if (data.conceptMap.focusQuestion) lines.push(`焦点问题：${data.conceptMap.focusQuestion}`, "");
    const names = new Map(data.conceptMap.concepts.map((n) => [n.id, n.label]));
    data.conceptMap.propositions.forEach((p) => {
      const a = names.get(p.from);
      const b = names.get(p.to);
      if (a && b) lines.push(`- ${a} —${p.link}→ ${b}`);
    });
    lines.push("");
  } else if (data.conceptMap?.edges?.length) {
    lines.push("## 概念关系", "");
    const names = new Map((data.conceptMap.nodes || []).map((n) => [n.id, n.label]));
    data.conceptMap.edges.forEach((e) => {
      lines.push(`- ${names.get(e.from) || e.from} —${e.rel || "关联"}→ ${names.get(e.to) || e.to}`);
    });
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function ytStamp(data, seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return data.videoId ? `[${clock(s)}](${watchUrl(data.videoId, s)})` : clock(s);
}

function yamlQuote(text) {
  return `"${String(text || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function wikiName(text, fallback = "未命名") {
  const name = String(text || fallback)
    .replace(/[\\/:*?"<>|#^[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return name || fallback;
}

function vocabSources(v) {
  if (Array.isArray(v?.sources) && v.sources.length) {
    return v.sources.filter((s) => s && (s.videoId || s.sentence));
  }
  if (v?.videoId || v?.sentence) {
    return [{ videoId: v.videoId, videoTitle: v.videoTitle, sentence: v.sentence, seconds: v.seconds }];
  }
  return [];
}

function vocabOnVideo(v, videoId) {
  if (!videoId) return true;
  return v.videoId === videoId || vocabSources(v).some((s) => s.videoId === videoId);
}

function vocabForVideo(v, videoId) {
  const src = vocabSources(v).find((s) => s.videoId === videoId);
  if (!src) return v;
  return {
    ...v,
    videoId: src.videoId || v.videoId,
    videoTitle: src.videoTitle || v.videoTitle,
    sentence: src.sentence || v.sentence,
    seconds: src.seconds,
  };
}

function vocabGloss(v) {
  const def = v.definition;
  if (!def) return "";
  if (def.meaning) return String(def.meaning);
  const sense = (def.senses || [])[0];
  if (!sense) return "";
  return [sense.zh, sense.en].filter(Boolean).join(" / ");
}

function pushList(lines, title, items) {
  if (!items?.length) return;
  lines.push(`### ${title}`, "");
  items.forEach((item) => {
    if (typeof item === "string") lines.push(`- ${item}`);
    else if (item?.name) lines.push(`- **${item.name}**：${item.role || item.judge || ""}${item.ifMissing ? `（缺了：${item.ifMissing}）` : ""}`);
    else if (item?.term) lines.push(`- **${item.term}**：${item.def || ""}`);
    else if (item) lines.push(`- ${item}`);
  });
  lines.push("");
}

function writeDive(lines, dive) {
  if (!dive) return;
  const head = dive.essence || dive.claim || dive.goal || dive.question || dive.event || dive.summary;
  if (head) lines.push(t("> [!note] 拆解"), `> ${head}`, "");
  if (dive.kind === "concept") {
    if (dive.elaborate) lines.push(`边界：${dive.elaborate}`, "");
    if (dive.example) lines.push(`正例：${dive.example}`, "");
    if (dive.counter) lines.push(`反例：${dive.counter}`, "");
    if (dive.analogy) lines.push(`类比：${dive.analogy}`, "");
  } else if (dive.kind === "case") {
    const mech = dive.caseMechanism || (typeof dive.mechanism === "string" ? dive.mechanism : "");
    if (mech) lines.push(`机制：${mech}`, "");
    if (dive.transfer) lines.push(`换场景：${dive.transfer}`, "");
    if (dive.hidden) lines.push(`没说的前提：${dive.hidden}`, "");
  } else if (dive.kind === "story") {
    if (dive.event) lines.push(`事件：${dive.event}`, "");
    if (dive.pattern) lines.push(`模式：${dive.pattern}`, "");
    if (dive.structure) lines.push(`结构：${dive.structure}`, "");
    if (dive.belief) lines.push(`想让你信：${dive.belief}`, "");
  } else if (dive.kind === "action") {
    if (dive.goal) lines.push(`目标：${dive.goal}`, "");
    pushList(lines, "前提", dive.prereq);
    pushList(lines, "步骤", dive.steps);
    if (dive.fail) lines.push(`最容易失败：${dive.fail}`, "");
    if (dive.experiment) lines.push(`小实验：${dive.experiment}`, "");
  } else if (dive.kind === "qa") {
    if (dive.question) lines.push(`问题：${dive.question}`, "");
    if (dive.claim) lines.push(`主张：${dive.claim}`, "");
    if (dive.warrant) lines.push(`依据：${dive.warrant}`, "");
    if (dive.qualifier) lines.push(`何时不适用：${dive.qualifier}`, "");
  } else {
    if (dive.map) lines.push(dive.map, "");
    pushList(lines, "结构", dive.parts);
    pushList(lines, "概念", dive.concepts);
    pushList(lines, "前置", dive.prereq);
    pushList(lines, "原理", Array.isArray(dive.mechanism) ? dive.mechanism : []);
    pushList(lines, "例子", dive.examples);
    pushList(lines, "坑", dive.pitfalls);
    pushList(lines, "自测", dive.selfTest);
    if (dive.owned) lines.push(`算内化：${dive.owned}`, "");
  }
  pushList(lines, "怎么记", dive.encode);
  pushList(lines, "何时用", dive.retrieve);
  pushList(lines, "挂钩", dive.connect);
  if (dive.gap) lines.push(`缺口：${dive.gap}`, "");
}

function toObsidian(data) {
  const d = new Date(data.exportedAt || Date.now());
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const title = data.title || t("未命名视频");
  const lines = [
    "---",
    `title: ${yamlQuote(title)}`,
    `source: ${yamlQuote(data.url || "")}`,
    `video_id: ${yamlQuote(data.videoId || "")}`,
    `date: ${iso}`,
    "type: kaizen-note",
    "tags:",
    "  - Kaizen",
    "---",
    "",
    `# ${title}`,
    "",
  ];
  if (data.url) lines.push(data.url, "");
  if (data.gist) lines.push(t("> [!summary] 一句话"), `> ${data.gist}`, "");

  const essay = data.essay;
  if (essay?.lede || essay?.sections?.length) {
    lines.push(`## ${essay.title || t("整理后的笔记")}`, "", essay.lede || "");
    for (const s of essay.sections || []) lines.push("", `### ${s.h || s.heading || ""}`, "", s.body || "");
    if (essay.takeaways?.length) {
      lines.push("", t("### 带走"), "");
      essay.takeaways.forEach((t) => lines.push(`- ${t}`));
    }
    if (essay.actions?.length) {
      lines.push("", t("### 可以去做"), "");
      essay.actions.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push("");
  }

  if (data.notes?.length) {
    lines.push(t("## 我写下的"), "");
    data.notes.forEach((n) => {
      lines.push(`### ${ytStamp(data, n.seconds)}`, "", n.text || "", "");
      if (n.quote) lines.push(`> ${n.quote}`, "");
    });
  }

  if (data.marks?.length) {
    lines.push(t("## 书签"), "");
    data.marks
      .slice()
      .sort((a, b) => (a.seconds || 0) - (b.seconds || 0))
      .forEach((m) => {
        lines.push(`- ${ytStamp(data, m.seconds)} ${m.label || ""}`);
        if (m.note) lines.push(`  ${m.note}`);
      });
    lines.push("");
  }

  if (data.quotes?.length) {
    lines.push(t("## 金句"), "");
    data.quotes.forEach((q) => {
      const pair = quotePair(q);
      if (pair.en) lines.push(`> ${pair.en}`);
      if (pair.zh) lines.push(`> ${pair.zh}`);
      if (!pair.en && !pair.zh && q.text) lines.push(`> ${q.text}`);
      if (pair.take) lines.push(`理解：${pair.take}`);
      lines.push(`> — ${ytStamp(data, q.seconds)}${pair.why ? ` · ${pair.why}` : ""}${q.source === "hand" ? " · 记下" : ""}`, "");
    });
  }

  if (data.highlights?.length) {
    lines.push(t("## 划线"), "");
    data.highlights.forEach((h) => {
      const kind = HL_LABEL[h.color] || "划线";
      const look = HL_STYLE[h.style] || "横线";
      lines.push(`- ${ytStamp(data, h.seconds)}（${kind} · ${look}） ${h.text}`);
      if (h.sentence && h.sentence !== h.text) lines.push(`    > ${h.sentence}`);
    });
    lines.push("");
  }

  if (data.vocab?.length) {
    lines.push(t("## 生词"), "");
    data.vocab.forEach((v) => {
      const gloss = vocabGloss(v);
      const ph = v.definition?.phonetic ? ` ${v.definition.phonetic}` : "";
      lines.push(`- **${v.word}**${ph}${gloss ? `：${gloss}` : ""}${v.sentence ? ` — ${v.sentence}` : ""}`);
    });
    lines.push("");
  }

  const chat = (data.chat || []).filter((m) => m?.content && !String(m.content).startsWith("⚠"));
  if (chat.length) {
    lines.push(t("## 问答"), "");
    chat.forEach((m) => {
      if (m.role === "user") {
        lines.push(`### 问`, "", m.content, "");
        if (m.quote) lines.push(`> ${m.quote}`, "");
      } else {
        lines.push(`### 答`, "", m.content, "");
      }
    });
  }

  if (data.study?.recap?.length || data.study?.keywords?.length || data.blocks?.length) {
    lines.push(t("## 知识骨架"), "");
    if (data.study?.spine) lines.push(`**${data.study.spine}**`, "");
    (data.study?.recap || []).forEach((x) => lines.push(`- ${x}`));
    if (data.study?.keywords?.length) {
      lines.push("", t("关键词：") + data.study.keywords.map((k) => `[[${wikiName(k)}]]`).join(" · "), "");
    }
    (data.blocks || []).forEach((b, i) => {
      lines.push("", `### ${b.title || `块 ${i + 1}`}`, "");
      lines.push(`${ytStamp(data, b.start)} → ${clock(b.end)} · ${CAT[b.category] || ""} · ${PROGRESS[progressOf(data, i)] || ""}`, "");
      if (b.summary) lines.push(b.summary, "");
      writeDive(lines, diveOf(data, i));
      const spoken = feynmanText(scriptOf(data, i));
      if (spoken) {
        lines.push(t("> [!example] 费曼"), `> ${String(spoken).replace(/\n/g, "\n> ")}`, "");
      }
    });
  }

  if (data.study?.questions?.length) {
    lines.push(t("## 自测问题"), "");
    data.study.questions.forEach((q) => lines.push(`- [ ] ${q.q || q}${q.at ? `（${q.at}）` : ""}`));
    lines.push("");
  }

  if (data.conceptMap?.propositions?.length && data.conceptMap?.concepts?.length) {
    lines.push(t("## 命题"), "");
    const names = new Map(data.conceptMap.concepts.map((n) => [n.id, n.label]));
    data.conceptMap.propositions.forEach((p) => {
      const a = names.get(p.from);
      const b = names.get(p.to);
      if (a && b) lines.push(`- [[${wikiName(a)}]] ${p.link} [[${wikiName(b)}]]`);
    });
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const HL_LABEL = { def: "定义", ex: "例子", contra: "反驳", act: "行动", key: "重点", doubt: "疑问" };
const HL_STYLE = { line: "横线", wave: "波浪", dash: "虚线", box: "方框", circle: "圆圈", marker: "荧光笔" };

function hlClassOf(h) {
  const color = { def: "hl-def", ex: "hl-ex", contra: "hl-contra", act: "hl-act", key: "hl-key", doubt: "hl-doubt" }[h?.color] || "hl-def";
  const style = { line: "hl-s-line", wave: "hl-s-wave", dash: "hl-s-dash", box: "hl-s-box", circle: "hl-s-circle", marker: "hl-s-marker" }[h?.style] || "hl-s-line";
  return `${color} ${style}`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concatBytes(parts) {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const utf8 = new TextEncoder();
  for (const file of files) {
    const name = utf8.encode(String(file.name).replace(/\\/g, "/"));
    const data = typeof file.data === "string" ? utf8.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    locals.push(local);
    centrals.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const localBlob = concatBytes(locals);
  const centralBlob = concatBytes(centrals);
  return concatBytes([
    localBlob,
    centralBlob,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBlob.length),
    u32(localBlob.length),
    u16(0),
  ]);
}

function payloadFromCache(videoId, title, cache, lists) {
  const url = watchUrl(videoId);
  return {
    exportedAt: Date.now(),
    videoId,
    title: title || cache?.title || videoId || t("未命名视频"),
    url,
    gist: cache?.gist || "",
    blocks: cache?.blocks || [],
    progress: cache?.progress || {},
    dives: cache?.dives || {},
    scripts: cache?.scripts || {},
    study: cache?.study || null,
    conceptMap: cache?.conceptMap || null,
    chat: (cache?.chat || []).slice(-24),
    notes: (lists.notes || []).filter((n) => n.videoId === videoId),
    quotes: (lists.quotes || []).filter((q) => q.videoId === videoId),
    highlights: (lists.highlights || []).filter((h) => h.videoId === videoId),
    vocab: (lists.vocab || []).filter((v) => vocabOnVideo(v, videoId)).map((v) => vocabForVideo(v, videoId)),
  };
}

function hasNoteBody(data) {
  return Boolean(
    data.notes?.length ||
      data.quotes?.length ||
      data.highlights?.length ||
      data.vocab?.length ||
      data.chat?.length ||
      data.blocks?.length ||
      data.gist ||
      data.essay,
  );
}

async function collectVault() {
  const stored = await chrome.storage.local.get([
    "vb_highlights",
    "vb_notes",
    "vb_vocab",
    "vb_quotes",
    "vb_shelf",
    "vb_lib",
    "vb_atlas",
    "vb_cache_index",
    "vb_export",
  ]);
  const lists = {
    notes: stored.vb_notes || [],
    quotes: stored.vb_quotes || [],
    highlights: stored.vb_highlights || [],
    vocab: stored.vb_vocab || [],
  };
  const index = stored.vb_cache_index || [];
  const caches = await chrome.storage.local.get(index.map((id) => `vb_cache_${id}`));
  const lib = stored.vb_lib || {};
  const shelf = stored.vb_shelf || [];
  const seen = new Set();
  const videos = [];

  const take = (id, title, cache) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const data = payloadFromCache(id, title || lib[id]?.title || cache?.title, cache || {}, lists);
    if (!data.gist && lib[id]?.gist) data.gist = lib[id].gist;
    if (!data.blocks?.length && lib[id]?.bricks?.length) {
      data.blocks = lib[id].bricks.map((b) => ({
        title: b.title,
        summary: b.summary,
        category: b.category,
        start: b.start,
        end: b.start,
      }));
    }
    if (hasNoteBody(data)) videos.push(data);
  };

  for (const item of shelf) take(item.videoId, item.title, caches[`vb_cache_${item.videoId}`]);
  for (const id of index) take(id, caches[`vb_cache_${id}`]?.title, caches[`vb_cache_${id}`]);
  if (stored.vb_export?.videoId) take(stored.vb_export.videoId, stored.vb_export.title, stored.vb_export);

  const leftover = new Set(
    [...lists.notes, ...lists.quotes, ...lists.highlights, ...lists.vocab]
      .map((row) => row.videoId)
      .filter((id) => id && !seen.has(id)),
  );
  leftover.forEach((id) => {
    const title =
      lists.notes.find((n) => n.videoId === id)?.videoTitle ||
      lists.quotes.find((q) => q.videoId === id)?.videoTitle ||
      id;
    take(id, title, {});
  });

  const current = stored.vb_export;
  if (current?.videoId && current.essay) {
    const hit = videos.find((v) => v.videoId === current.videoId);
    if (hit) hit.essay = current.essay;
  }

  return {
    videos,
    vocab: lists.vocab,
    atlas: stored.vb_atlas || { concepts: [], propositions: [] },
    exportedAt: Date.now(),
  };
}

function toVocabNote(vocab) {
  const lines = ["---", t("title: 生词"), "tags:", "  - Kaizen", t("  - 生词"), "---", "", t("# 生词"), ""];
  vocab.forEach((v) => {
    const gloss = vocabGloss(v);
    const ph = v.definition?.phonetic ? ` ${v.definition.phonetic}` : "";
    lines.push(`## ${v.word}`, "");
    if (ph || gloss) lines.push(`${ph}${gloss ? ` ${gloss}` : ""}`.trim(), "");
    const sources = vocabSources(v);
    if (sources.length) {
      sources.forEach((s) => {
        if (s.sentence) lines.push(`> ${s.sentence}`, "");
        if (s.videoTitle) lines.push(`来自 [[${wikiName(s.videoTitle)}]]`, "");
      });
    } else {
      if (v.sentence) lines.push(`> ${v.sentence}`, "");
      if (v.videoTitle) lines.push(`来自 [[${wikiName(v.videoTitle)}]]`, "");
    }
  });
  return lines.join("\n").trim() + "\n";
}

function toConceptNote(concept, atlas) {
  const others = (concept.sources || []).filter((s) => s.videoId);
  const lines = ["---", `title: ${yamlQuote(concept.label)}`, "tags:", "  - Kaizen", t("  - 概念"), "---", "", `# ${concept.label}`, ""];
  if (atlas.focusQuestion) lines.push(`> [!question] ${atlas.focusQuestion}`, "");
  others.forEach((src) => {
    const title = src.title || src.videoId;
    lines.push(`- [[${wikiName(title)}]]${Number.isFinite(Number(src.seconds)) ? ` · ${clock(src.seconds)}` : ""}`);
  });
  const props = (atlas.propositions || []).filter(
    (p) => p.from === concept.id || p.to === concept.id || p.from === concept.label || p.to === concept.label,
  );
  if (props.length) {
    lines.push("", t("## 命题"), "");
    const names = new Map((atlas.concepts || []).map((c) => [c.id, c.label]));
    props.forEach((p) => {
      const a = names.get(p.from) || p.from;
      const b = names.get(p.to) || p.to;
      lines.push(`- [[${wikiName(a)}]] ${p.link} [[${wikiName(b)}]]`);
    });
  }
  return lines.join("\n").trim() + "\n";
}

function buildVaultFiles(vault) {
  const used = new Set();
  const files = [];
  const uniqueName = (base) => {
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base} ${n}`;
      n += 1;
    }
    used.add(name.toLowerCase());
    return name;
  };

  const index = [
    "---",
    "title: Kaizen",
    "tags:",
    "  - Kaizen",
    "  - moc",
    "---",
    "",
    "# Kaizen",
    "",
    `导出于 ${dateText(vault.exportedAt)}。把这个文件夹放进 Obsidian 库即可。`,
    "",
    t("## 视频"),
    "",
  ];

  vault.videos.forEach((data) => {
    const name = uniqueName(wikiName(data.title, data.videoId || "未命名"));
    files.push({ name: `Kaizen/视频/${name}.md`, data: toObsidian(data) });
    const bits = [
      data.notes?.length ? `${data.notes.length} 笔记` : "",
      data.quotes?.length ? `${data.quotes.length} 金句` : "",
      data.highlights?.length ? `${data.highlights.length} 划线` : "",
    ].filter(Boolean);
    index.push(`- [[${name}]]${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
  });

  if (vault.vocab?.length) {
    files.push({ name: t("Kaizen/生词.md"), data: toVocabNote(vault.vocab) });
    index.push("", t("## 生词"), "", `[[生词]] · ${vault.vocab.length} 个`, "");
  }

  const concepts = (vault.atlas?.concepts || []).filter((c) => c.label);
  if (concepts.length) {
    index.push("", t("## 概念"), "");
    concepts.forEach((c) => {
      const name = uniqueName(wikiName(c.label));
      files.push({ name: `Kaizen/概念/${name}.md`, data: toConceptNote(c, vault.atlas) });
      index.push(`- [[${name}]]`);
    });
  }

  files.unshift({ name: "Kaizen/Kaizen.md", data: index.join("\n").trim() + "\n" });
  return files;
}

function downloadBytes(name, bytes, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showExport(data, mode, cardState) {
  const dock = $("cardDock");
  if (mode === "cards") {
    document.body.classList.add("cards-mode");
    $("cardsBtn")?.classList.add("on");
    $("docBtn")?.classList.remove("on");
    if (dock) dock.hidden = false;
    const rows = renderQuoteDeck(data, cardState);
    syncCardDock(rows, cardState);
    const one = cardState?.index >= 0;
    const label = CARD_KIND[cardKindOf(cardState?.kind)] || "金句";
    if (!rows.length) {
      $("sheetHint").textContent = cardEmptyHint(cardState?.kind);
      return;
    }
    $("sheetHint").textContent = one
      ? `现在只出这一张${label}。可下 SVG / PNG，或换模板。打印时选「另存为 PDF」，并勾选「背景图形」。`
      : `每张${label}一页。可下 SVG / PNG，或用「哪一张」只出单张。打印时选「另存为 PDF」，并勾选「背景图形」。`;
    return;
  }
  document.body.classList.remove("cards-mode", "card-one");
  document.body.removeAttribute("data-card-tpl");
  document.body.removeAttribute("data-card-kind");
  if (dock) dock.hidden = true;
  $("doc").className = "doc";
  $("cardsBtn")?.classList.remove("on");
  $("docBtn")?.classList.add("on");
  $("sheetHint").textContent = t("预览确认后点「打印 / 存成 PDF」。打印机选「另存为 PDF」，并勾选「背景图形」。要做海报，点上面的「导出卡片」。");
  renderDoc(data);
}

function fillTplDock() {
  const row = $("cardTplRow");
  if (!row || row.dataset.ready) return;
  row.dataset.ready = "1";
  row.innerHTML =
    `<span>${t("模板")}</span>` +
    KaizenCard.TEMPLATES.map((tpl) => `<button type="button" data-tpl="${tpl.id}">${t(tpl.label)}</button>`).join("");
}

function syncCardDock(rows, cardState) {
  const pick = $("cardPick");
  if (!pick) return;
  const index = cardState?.index ?? -1;
  const n = rows.length;
  pick.innerHTML =
    `<option value="-1">全部 ${n} 张</option>` +
    rows
      .map((row, i) => {
        const label = `${i + 1}. ${clock(row.seconds)} ${(row.en || row.zh || "").replace(/\s+/g, " ").slice(0, 28)}`;
        return `<option value="${i}"${i === index ? " selected" : ""}>${esc(label)}</option>`;
      })
      .join("");
  document.querySelectorAll("#cardDock button, #cardPick").forEach((el) => {
    if (el.dataset.kind) {
      el.disabled = false;
      return;
    }
    el.disabled = !n;
  });
  document.querySelectorAll("#cardDock [data-tpl]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.tpl === (cardState?.tpl || "paper"));
  });
  document.querySelectorAll("#cardDock [data-kind]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.kind === cardKindOf(cardState?.kind));
  });
}

async function boot() {
  const prefs = await chrome.storage.local.get("vb_settings");
  setUiLang(prefs.vb_settings?.uiLang || detectLang());
  applyDomI18n(document);
  const stored = await chrome.storage.local.get("vb_export");
  const data = stored.vb_export;
  if (!data) {
    $("doc").innerHTML = `<p class="empty">没有可导出的内容。回到侧栏，打开一支视频后再点「导出」。</p>`;
    const dead = () => {
      $("sheetHint").textContent = t("这边还没有笔记。回到 Kaizen 侧栏，打开视频后再点导出。");
    };
    $("printBtn")?.addEventListener("click", dead);
    $("cardsBtn")?.addEventListener("click", dead);
    $("docBtn")?.addEventListener("click", dead);
    $("mdBtn")?.addEventListener("click", dead);
    $("obsBtn")?.addEventListener("click", dead);
    $("obsAllBtn")?.addEventListener("click", dead);
    $("essayBtn")?.addEventListener("click", dead);
    $("cardPrev")?.addEventListener("click", dead);
    $("cardNext")?.addEventListener("click", dead);
    $("cardAll")?.addEventListener("click", dead);
    $("cardPick")?.addEventListener("change", dead);
    $("cardSvgBtn")?.addEventListener("click", dead);
    $("cardPngBtn")?.addEventListener("click", dead);
    $("cardAllSvgBtn")?.addEventListener("click", dead);
    $("cardAllPngBtn")?.addEventListener("click", dead);
    document.querySelectorAll("#cardDock [data-tpl], #cardDock [data-kind]").forEach((btn) => btn.addEventListener("click", dead));
    return;
  }
  fillTplDock();
  const params = new URLSearchParams(location.search);
  let mode = params.get("view") === "cards" || data.exportMode === "cards" ? "cards" : "doc";
  const startKind = cardKindOf(params.get("kind") || data.exportCardKind);
  const rows0 = cardRowsOf(data, startKind);
  const startId = params.get("id") || data.exportCardId || "";
  const startTpl = KaizenCard.isTpl(params.get("tpl") || data.exportCardTpl)
    ? params.get("tpl") || data.exportCardTpl
    : "poster";
  const startIndex = startId ? rows0.findIndex((row) => row.id === startId) : Number.parseInt(params.get("i") || "-1", 10);
  const cardState = {
    kind: startKind,
    tpl: startTpl,
    index: Number.isFinite(startIndex) ? startIndex : -1,
  };
  showExport(data, mode, cardState);

  const paintCards = () => showExport(data, "cards", cardState);
  const currentRows = () => cardRowsOf(data, cardState.kind);

  $("printBtn").addEventListener("click", () => window.print());
  $("docBtn")?.addEventListener("click", () => {
    mode = "doc";
    showExport(data, mode, cardState);
  });
  $("cardsBtn").addEventListener("click", () => {
    mode = "cards";
    paintCards();
  });
  document.querySelectorAll("#cardDock [data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cardState.kind = cardKindOf(btn.dataset.kind);
      cardState.index = -1;
      mode = "cards";
      paintCards();
    });
  });
  document.querySelectorAll("#cardDock [data-tpl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cardState.tpl = btn.dataset.tpl;
      if (cardState.tpl === "poster" && cardState.index < 0 && currentRows().length) cardState.index = 0;
      mode = "cards";
      paintCards();
    });
  });
  $("cardPick")?.addEventListener("change", () => {
    cardState.index = Number($("cardPick").value);
    mode = "cards";
    paintCards();
  });
  $("cardPrev")?.addEventListener("click", () => {
    const n = currentRows().length;
    if (!n) {
      $("sheetHint").textContent = cardEmptyHint(cardState.kind);
      return;
    }
    cardState.index = cardState.index < 0 ? n - 1 : (cardState.index + n - 1) % n;
    mode = "cards";
    paintCards();
  });
  $("cardNext")?.addEventListener("click", () => {
    const n = currentRows().length;
    if (!n) {
      $("sheetHint").textContent = cardEmptyHint(cardState.kind);
      return;
    }
    cardState.index = cardState.index < 0 ? 0 : (cardState.index + 1) % n;
    mode = "cards";
    paintCards();
  });
  $("cardSvgBtn")?.addEventListener("click", () => downloadCardImages(data, cardState, { format: "svg" }));
  $("cardPngBtn")?.addEventListener("click", () => {
    downloadCardImages(data, cardState, { format: "png" }).catch((error) => {
      $("sheetHint").textContent = error.message || t("PNG 没做成");
    });
  });
  $("cardAllSvgBtn")?.addEventListener("click", () => downloadCardImages(data, cardState, { all: true, format: "svg" }));
  $("cardAllPngBtn")?.addEventListener("click", () => {
    downloadCardImages(data, cardState, { all: true, format: "png" }).catch((error) => {
      $("sheetHint").textContent = error.message || t("PNG 没做成");
    });
  });
  $("cardAll")?.addEventListener("click", () => {
    cardState.index = -1;
    mode = "cards";
    paintCards();
  });
  $("mdBtn").addEventListener("click", () => {
    if (!hasNoteBody(data)) {
      $("sheetHint").textContent = t("这支还没有能下的笔记。先划线、记下金句或写一句。");
      return;
    }
    downloadText(`${fileBase(data.title)}.md`, toMarkdown(data), "text/markdown;charset=utf-8");
  });
  $("obsBtn").addEventListener("click", () => {
    if (!hasNoteBody(data)) {
      $("sheetHint").textContent = t("这支还没有能下的笔记。先划线、记下金句或写一句。");
      return;
    }
    downloadText(`${fileBase(data.title)}.md`, toObsidian(data), "text/markdown;charset=utf-8");
    $("sheetHint").textContent = t("已下载这一支的 Obsidian 笔记。丢进库里即可，时间戳能点回 YouTube。");
  });
  $("obsAllBtn")?.addEventListener("click", async () => {
    const btn = $("obsAllBtn");
    btn.disabled = true;
    $("sheetHint").textContent = t("正在收齐全部笔记…");
    try {
      const vault = await collectVault();
      if (!vault.videos.length && !vault.vocab.length) {
        $("sheetHint").textContent = t("还没有能导出的笔记。先划线、记下金句或写一句。");
        return;
      }
      const bytes = zipStore(buildVaultFiles(vault));
      downloadBytes(`Kaizen-obsidian.zip`, bytes, "application/zip");
      $("sheetHint").textContent = `已打包 ${vault.videos.length} 支视频。解压后把「Kaizen」文件夹放进 Obsidian 库。`;
    } catch (error) {
      $("sheetHint").textContent = error.message || t("打包失败");
    } finally {
      btn.disabled = false;
    }
  });
  $("essayBtn").addEventListener("click", async () => {
    if (!hasNoteBody(data)) {
      $("sheetHint").textContent = t("这篇几乎是空的。先划线、记下金句或写一句，再请 AI 写成一篇。");
      return;
    }
    const btn = $("essayBtn");
    btn.disabled = true;
    btn.textContent = t("正在写成一篇…");
    $("sheetHint").textContent = t("用你的笔记当主线，拆解只作骨架。写完会出现在封面后第一页。");
    try {
      const result = await chrome.runtime.sendMessage({ action: "vbExportEssay", payload: data });
      if (!result?.ok) throw new Error(result?.error || t("润色失败"));
      if (!result.lede && !result.sections?.length) throw new Error(t("这篇没写出来，再试一次。"));
      data.essay = {
        title: result.title,
        lede: result.lede,
        sections: result.sections,
        takeaways: result.takeaways,
        actions: result.actions,
      };
      await chrome.storage.local.set({ vb_export: data });
      mode = "doc";
      showExport(data, mode);
      $("sheetHint").textContent = t("一篇已经写好。可以打印成 PDF，或再下 Markdown。");
    } catch (error) {
      $("sheetHint").textContent = error.message;
    } finally {
      btn.disabled = false;
      btn.textContent = t("请 AI 写成一篇");
    }
  });

  if (new URLSearchParams(location.search).get("dl") === "md") {
    downloadText(`${fileBase(data.title)}.md`, toMarkdown(data), "text/markdown;charset=utf-8");
  }
}

boot();
