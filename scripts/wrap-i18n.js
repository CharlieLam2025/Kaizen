const fs = require("fs");
const keys = require("./i18n-keys.json").filter((k) => k.length >= 4);
keys.sort((a, b) => b.length - a.length);

function wrapFile(path, skip) {
  let text = fs.readFileSync(path, "utf8");
  const lines = text.split("\n");
  const skipLine = (i) => skip && i >= skip[0] && i < skip[1];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!t\\()(["'])${escaped}\\1`, "g");
    let lineStart = 0;
    text = text
      .split("\n")
      .map((line, i) => {
        if (skipLine(i)) return line;
        if (line.includes("liveLabels(") || line.includes("data-i18n")) return line;
        return line.replace(re, `t($1${key}$1)`);
      })
      .join("\n");
  }
  fs.writeFileSync(path, text);
  console.log("wrapped", path);
}

wrapFile("panel.js", [0, 95]);
wrapFile("export.js");
wrapFile("content.js");
