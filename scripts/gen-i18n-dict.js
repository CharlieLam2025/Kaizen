/* Build i18n-dict.js from zh-CN keys + extra UI strings. */
const fs = require("fs");
const path = require("path");

const LANGS = ["en", "ja", "ko", "es", "fr", "de", "pt", "ru", "vi", "id", "th", "ar"];

const extraKeys = [
  "界面语言",
  "精进自己",
  "善",
  "看见不够，就动手改。",
  "改完之后，往更好去。",
  "两个字合在一起，叫持续精进：今天比昨天清楚一点，明天再清楚一点。",
  "下面两把钥匙用你自己的账号，不提供额度。填上才能读字幕、拆知识、查生词。",
  "DeepSeek · 拆解和查词",
  "打开 API Keys 页面，没有账号会先让你注册。",
  "点 Create new API key，名字填「Kaizen」即可。",
  "立刻复制完整 Key（一般只显示一次）。",
  "Supadata · 字幕",
  "打开 Supadata 注册页，走完新手引导。",
  "引导里会自动生成 Key，之后可在控制台查找。",
  "DeepSeek 用哪个",
  "不确定就用默认，之后随时能改。Flash 快、便宜；Pro 更稳，适合拆解。",
  "日常默认 · 翻译、提问、做成图",
  "更强 · 拆解和长笔记默认用它",
  "拆解也改成和上面同一个（默认拆解走 Pro）",
  "接口地址",
  "一般不用改",
  "英语大概到哪",
  "用来从字幕里筛你可能还不熟的词。设了之后，打开视频会先给一份生词库，可以先过一遍再看。不是官方考纲，先不设也可以。",
  "四级",
  "六级",
  "雅思",
  "托福",
  "先不设",
  "总分（选填）",
  "保存并开始",
  "Key 只存在这台电脑的浏览器里。",
  "联系作者 · 微信 942966642",
  "跳过",
  "上一步",
  "导出",
  "教程",
  "设置",
  "改善",
  "看视频很容易滑过去。在这里停一下。",
  "打开一支有字幕的 YouTube 或 B 站，就开始。",
  "看视频前，先设英语大概到哪",
  "设了之后，打开视频会先给一份可能生词库，可以先过一遍再看。",
  "重试",
  "先复习到期的卡",
  "阅读",
  "提问",
  "原文",
  "双语",
  "中文",
  "译文",
  "跳",
  "沉浸",
  "全部",
  "本支",
  "全局",
  "论证图",
  "层级图",
  "时间线",
  "点节点可跳转、展开或打开对应知识块。",
  "先问主张、某一句，或你正看到的地方。答案里的时间能点。",
  "发送",
  "生词本",
  "导出笔记",
  "新进",
  "以后",
  "精选",
  "看完",
  "按视频看每支的知识块和金句；按概念看同一件事在不同视频里怎么讲。",
  "查词",
  "存词",
  "问这句",
  "写一句笔记",
  "取消",
  "保存",
  "闭卷复盘",
  "关闭",
  "对照字幕批改",
  "退出沉浸",
  "两个 Key 都要有。改完点保存。不确定模型就用默认。",
  "日常 · 翻译、提问、分块、做成图",
  "拆解和长笔记",
  "已保存",
  "导出全部数据",
  "导入恢复",
  "生词本导出 Anki",
  "大学四级",
  "大学六级",
  "挖空",
  "增量",
  "费曼",
  "词汇",
  "个词",
];

function loadTable(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
}

const T = Object.assign(
  {},
  loadTable("i18n-table-extra.json"),
  loadTable("i18n-table-long.json"),
  loadTable("i18n-table-long2.json"),
  loadTable("i18n-table-mid.json"),
  loadTable("i18n-table-short.json"),
);

const srcKeys = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n-keys.json"), "utf8"));
const keys = [...new Set([...srcKeys, ...extraKeys])];

const missing = keys.filter((k) => !T[k]);
const extra = Object.keys(T).filter((k) => !keys.includes(k));
if (missing.length || extra.length) {
  console.error("missing", missing.length, missing.slice(0, 20));
  console.error("unused", extra.length, extra.slice(0, 20));
  process.exit(1);
}

for (const k of keys) {
  if (!Array.isArray(T[k]) || T[k].length !== LANGS.length) {
    console.error("bad row", k, T[k] && T[k].length);
    process.exit(1);
  }
}

const packs = {};
for (let i = 0; i < LANGS.length; i++) {
  const pack = {};
  for (const k of keys) pack[k] = T[k][i];
  packs[LANGS[i]] = pack;
}

const body = LANGS.map((lang) => {
  const entries = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(packs[lang][k])}`).join(",\n");
  return `  ${JSON.stringify(lang)}: {\n${entries}\n  }`;
}).join(",\n");

const out = `// Kaizen UI language packs. Keys are zh-CN source strings (chrome only).
globalThis.I18N_PACKS = {
${body}
};
`;

fs.writeFileSync(path.join(__dirname, "..", "i18n-dict.js"), out, "utf8");
console.log("wrote i18n-dict.js");
for (const lang of LANGS) console.log(lang, Object.keys(packs[lang]).length);
