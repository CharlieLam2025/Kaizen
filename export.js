const CAT = { concept: "讲概念", case: "讲案例", story: "讲故事", action: "给做法", qa: "在问答" };
const PROGRESS = { fresh: "未开始", learning: "进行中", done: "已学会" };

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
  return `拆砖-${String(title || "笔记").replace(/[\\/:*?"<>|]/g, "").slice(0, 42)}`;
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

function listHtml(items, map) {
  const rows = (items || []).map(map).filter(Boolean);
  return rows.length ? `<ul>${rows.join("")}</ul>` : "";
}

function sectionIds(data) {
  const raw = [];
  if (data.essay?.lede || data.essay?.sections?.length) raw.push(["整理后的笔记", "essay"]);
  if (data.notes?.length) raw.push(["我写下的", "notes"]);
  if (data.quotes?.length) raw.push(["金句", "quotes"]);
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
    [data.quotes?.length || 0, "条金句"],
    [data.blocks?.length || 0, "个知识块"],
    [data.vocab?.length || 0, "个生词"],
  ];
  const toc = sectionIds(data)
    .map(([num, title]) => `<li><span>${esc(title)}</span><i>${num}</i></li>`)
    .join("");
  return `<header class="cover">
    <div class="kicker">拆砖 · 笔记</div>
    <h1>${esc(data.title || "未命名视频")}</h1>
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

function renderQuotes(data) {
  if (!data.quotes?.length) return "";
  return `<section class="section" id="quotes">
    ${sectionHead(data, "quotes")}
    ${data.quotes
      .map(
        (q) => `<article class="quote-card">
        <div class="when">${clock(q.seconds)}</div>
        <p>${esc(q.text)}</p>
      </article>`,
      )
      .join("")}
  </section>`;
}

function renderMarks(data) {
  if (!data.highlights?.length) return "";
  return `<section class="section" id="marks">
    ${sectionHead(data, "marks")}
    ${data.highlights
      .map(
        (h) => `<article class="note">
        <div class="when">${clock(h.seconds)}</div>
        <p class="quote">${esc(h.text)}</p>
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
        ${v.sentence ? `<p class="quote">${esc(v.sentence)}</p>` : ""}
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
        <div class="brick-kicker">${CAT[b.category] || ""} · ${clock(b.start)}–${clock(b.end)} · ${PROGRESS[st] || ""}</div>
        <h3>${esc(b.title)}</h3>
        <p class="sum">${esc(b.summary || "")}</p>
      </article>`;
    })
    .join("");
  return `<section class="section" id="bones">
    ${sectionHead(data, "bones")}
    ${recap ? `<div class="kv"><div class="k">三句话复述</div>${recap}</div>` : ""}
    ${kws ? `<div class="kv"><div class="k">关键词</div><ul>${kws}</ul></div>` : ""}
    ${qs ? `<div class="kv"><div class="k">带着问题去找</div>${qs}</div>` : ""}
    ${bricks}
  </section>`;
}

function renderDiveBlock(dive) {
  if (!dive) return "";
  const parts = (dive.parts || [])
    .map(
      (p) =>
        `<li><b>${esc(p.name)}</b> — ${esc(p.role)}${p.ifMissing ? `（缺了：${esc(p.ifMissing)}）` : ""}</li>`,
    )
    .join("");
  const concepts = (dive.concepts || [])
    .map((c) => `<li><b>${esc(c.term)}</b> — ${esc(c.def)}</li>`)
    .join("");
  const block = (label, html) => (html ? `<div class="kv"><div class="k">${label}</div>${html}</div>` : "");
  return [
    dive.essence ? `<p>${esc(dive.essence)}</p>` : "",
    block("组成部分", parts ? `<ul>${parts}</ul>` : ""),
    dive.map ? block("结构", `<p>${esc(dive.map)}</p>`) : "",
    block("怎么记", listHtml(dive.encode, (x) => `<li>${esc(x)}</li>`)),
    block("何时调用", listHtml(dive.retrieve, (x) => `<li>${esc(x)}</li>`)),
    block("和已知挂钩", listHtml(dive.connect, (x) => `<li>${esc(x)}</li>`)),
    dive.gap ? block("视频没补上的", `<p>${esc(dive.gap)}</p>`) : "",
    dive.owned ? block("怎样算内化", `<p>${esc(dive.owned)}</p>`) : "",
    block("核心概念", concepts ? `<ul>${concepts}</ul>` : ""),
    block("原理", listHtml(dive.mechanism, (x) => `<li>${esc(x)}</li>`)),
    block("例子", listHtml(dive.examples, (x) => `<li>${esc(x)}</li>`)),
    block("坑", listHtml(dive.pitfalls, (x) => `<li>${esc(x)}</li>`)),
    block("自测", listHtml(dive.selfTest, (x) => `<li>${esc(x)}</li>`)),
  ].join("");
}

function renderDives(data) {
  const cards = (data.blocks || [])
    .map((b, i) => {
      const dive = diveOf(data, i);
      if (!dive) return "";
      const script = scriptOf(data, i);
      return `<article class="brick">
        <div class="brick-kicker">${CAT[b.category] || ""} · ${esc(b.title)}</div>
        <h3>${esc(b.title)}</h3>
        ${renderDiveBlock(dive)}
        ${
          script
            ? `<div class="kv"><div class="k">口播稿</div>${
                script.take ? `<div class="k">按你的理解</div><p>${esc(script.take)}</p>` : ""
              }<p>${esc(script.hook || "")}</p><p>${esc(script.script || "")}</p><p>${esc(script.cta || "")}</p></div>`
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
      return `<div class="kv"><div class="k">${esc(c.label)}${c.independent ? " · 独立簇" : ""}</div><p>${nodes.join(" · ")}</p></div>`;
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
    renderNotes(data),
    renderQuotes(data),
    renderMarks(data),
    renderVocab(data),
    renderBones(data),
    renderDives(data),
    renderMap(data),
    renderAsk(data),
  ].join("");
  document.title = `${data.title || "拆砖笔记"} · 拆砖`;
}

function toMarkdown(data) {
  const lines = [`# ${data.title || "未命名视频"}`, ""];
  if (data.gist) lines.push(`> ${data.gist}`, "");
  if (data.url) lines.push(`[打开视频](${data.url}) · ${dateText(data.exportedAt)}`, "");
  const essay = data.essay;
  if (essay?.lede || essay?.sections?.length) {
    lines.push(`## ${essay.title || "整理后的笔记"}`, "", essay.lede || "");
    for (const s of essay.sections || []) {
      lines.push("", `### ${s.h || s.heading || ""}`, "", s.body || "");
    }
    if (essay.takeaways?.length) {
      lines.push("", "### 带走", "");
      essay.takeaways.forEach((t) => lines.push(`- ${t}`));
    }
    if (essay.actions?.length) {
      lines.push("", "### 可以去做", "");
      essay.actions.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push("");
  }
  if (data.notes?.length) {
    lines.push("## 我写下的", "");
    data.notes.forEach((n) => {
      lines.push(`### ${clock(n.seconds)}`, "", n.text, "");
      if (n.quote) lines.push(`> ${n.quote}`, "");
    });
  }
  if (data.quotes?.length) {
    lines.push("## 金句", "");
    data.quotes.forEach((q) => lines.push(`- (${clock(q.seconds)}) ${q.text}`));
    lines.push("");
  }
  if (data.highlights?.length) {
    lines.push("## 划线", "");
    data.highlights.forEach((h) => lines.push(`- (${clock(h.seconds)}) ${h.text}`));
    lines.push("");
  }
  if (data.vocab?.length) {
    lines.push("## 生词", "");
    data.vocab.forEach((v) => lines.push(`- **${v.word}**${v.sentence ? ` — ${v.sentence}` : ""}`));
    lines.push("");
  }
  if (data.study || data.blocks?.length) {
    lines.push("## 知识骨架", "");
    (data.study?.recap || []).forEach((x) => lines.push(`- ${x}`));
    (data.blocks || []).forEach((b, i) => {
      lines.push("", `### ${b.title}`, "", `${clock(b.start)}–${clock(b.end)} · ${CAT[b.category] || ""}`, "", b.summary || "");
      const dive = diveOf(data, i);
      if (!dive) return;
      if (dive.essence) lines.push("", dive.essence);
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
  return data.videoId
    ? `[${clock(s)}](https://www.youtube.com/watch?v=${data.videoId}&t=${s}s)`
    : clock(s);
}

function toObsidian(data) {
  const d = new Date(data.exportedAt || Date.now());
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lines = [
    "---",
    `title: "${String(data.title || "未命名视频").replace(/"/g, "'")}"`,
    `source: "${data.url || ""}"`,
    `date: ${iso}`,
    "type: video-note",
    "tags:",
    "  - videobricks",
    "---",
    "",
  ];
  if (data.gist) lines.push("> [!summary] 一句话", `> ${data.gist}`, "");
  const essay = data.essay;
  if (essay?.lede || essay?.sections?.length) {
    lines.push(`## ${essay.title || "整理后的笔记"}`, "", essay.lede || "");
    for (const s of essay.sections || []) lines.push("", `### ${s.h || s.heading || ""}`, "", s.body || "");
    if (essay.takeaways?.length) {
      lines.push("", "### 带走", "");
      essay.takeaways.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push("");
  }
  if (data.notes?.length) {
    lines.push("## 我写下的", "");
    data.notes.forEach((n) => {
      lines.push(`- ${ytStamp(data, n.seconds)} ${n.text}`);
      if (n.quote) lines.push(`    > ${n.quote}`);
    });
    lines.push("");
  }
  if (data.quotes?.length) {
    lines.push("## 金句", "");
    data.quotes.forEach((q) => lines.push(`> ${q.text}`, `> — ${ytStamp(data, q.seconds)}`, ""));
  }
  if (data.highlights?.length) {
    lines.push("## 划线", "");
    data.highlights.forEach((h) => lines.push(`- ${ytStamp(data, h.seconds)} ${h.text}`));
    lines.push("");
  }
  if (data.vocab?.length) {
    lines.push("## 生词", "");
    data.vocab.forEach((v) => lines.push(`- **${v.word}**${v.sentence ? ` — ${v.sentence}` : ""}`));
    lines.push("");
  }
  if (data.study?.recap?.length || data.blocks?.length) {
    lines.push("## 知识骨架", "");
    (data.study?.recap || []).forEach((x) => lines.push(`- ${x}`));
    (data.blocks || []).forEach((b, i) => {
      lines.push("", `### ${b.title}`, "", `${ytStamp(data, b.start)} → ${clock(b.end)} · ${CAT[b.category] || ""}`, "", b.summary || "");
      const dive = diveOf(data, i);
      if (dive?.essence) lines.push("", `> [!note] 拆解`, `> ${dive.essence}`);
    });
    lines.push("");
  }
  if (data.study?.questions?.length) {
    lines.push("## 自测问题", "");
    data.study.questions.forEach((q) => lines.push(`- [ ] ${q.q}${q.at ? `（${q.at}）` : ""}`));
    lines.push("");
  }
  if (data.conceptMap?.propositions?.length && data.conceptMap?.concepts?.length) {
    lines.push("## 命题（概念图）", "");
    const names = new Map(data.conceptMap.concepts.map((n) => [n.id, n.label]));
    data.conceptMap.propositions.forEach((p) => {
      const a = names.get(p.from);
      const b = names.get(p.to);
      if (a && b) lines.push(`- [[${a}]] ${p.link} [[${b}]]`);
    });
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
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

async function boot() {
  const stored = await chrome.storage.local.get("vb_export");
  const data = stored.vb_export;
  if (!data) {
    $("doc").innerHTML = `<p class="empty">没有可导出的内容。回到侧栏，打开一支视频后再点「导出」。</p>`;
    return;
  }
  renderDoc(data);

  $("printBtn").addEventListener("click", () => window.print());
  $("mdBtn").addEventListener("click", () => {
    downloadText(`${fileBase(data.title)}.md`, toMarkdown(data), "text/markdown;charset=utf-8");
  });
  $("obsBtn").addEventListener("click", () => {
    downloadText(`${fileBase(data.title)}.md`, toObsidian(data), "text/markdown;charset=utf-8");
  });
  $("essayBtn").addEventListener("click", async () => {
    const btn = $("essayBtn");
    btn.disabled = true;
    btn.textContent = "正在写成一篇…";
    $("sheetHint").textContent = "用你的笔记当主线，拆解只作骨架。写完会出现在封面后第一页。";
    try {
      const result = await chrome.runtime.sendMessage({ action: "vbExportEssay", payload: data });
      if (!result?.ok) throw new Error(result?.error || "润色失败");
      data.essay = {
        title: result.title,
        lede: result.lede,
        sections: result.sections,
        takeaways: result.takeaways,
        actions: result.actions,
      };
      await chrome.storage.local.set({ vb_export: data });
      renderDoc(data);
      $("sheetHint").textContent = "一篇已经写好。可以打印成 PDF，或再下 Markdown。";
    } catch (error) {
      $("sheetHint").textContent = error.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "请 AI 写成一篇";
    }
  });

  if (new URLSearchParams(location.search).get("dl") === "md") {
    downloadText(`${fileBase(data.title)}.md`, toMarkdown(data), "text/markdown;charset=utf-8");
  }
}

boot();
