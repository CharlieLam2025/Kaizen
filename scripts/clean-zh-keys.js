const fs = require("fs");
const rows = fs
  .readFileSync("scripts/zh-strings.txt", "utf8")
  .split(/\r?\n/)
  .map((line) => line.split("\t").slice(1).join("\t"))
  .filter(Boolean);
const bad = /block\(|\\n|: ""|listHtml|parts \?/;
const keys = [...new Set(rows.filter((s) => s.length >= 1 && s.length <= 160 && !bad.test(s)))];
keys.sort((a, b) => b.length - a.length || a.localeCompare(b, "zh"));
fs.writeFileSync("scripts/i18n-keys.json", JSON.stringify(keys, null, 2), "utf8");
console.log(keys.length);
