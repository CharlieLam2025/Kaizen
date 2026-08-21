const fs = require("fs");
const files = ["panel.js", "panel.html", "export.js", "export.html", "content.js"];
const zh = /[\u4e00-\u9fff]/;
const out = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const s = m[2].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    if (zh.test(s) && s.length <= 200 && !s.includes("${") && !s.includes("<") && s.split("\n").length <= 4) {
      out.set(s, (out.get(s) || 0) + 1);
    }
  }
}
const rows = [...out.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"));
fs.writeFileSync("scripts/zh-strings.txt", rows.map(([s, n]) => `${n}\t${s.replace(/\n/g, "\\n")}`).join("\n"), "utf8");
console.log("unique", rows.length);
