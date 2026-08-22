// Kaizen 成就：按已经留下的痕迹算，不另做一套假进度。
// 每天改一点，攒下来就是质的变化。

const ACHIEVE_GROUPS = [
  { id: "start", label: "起步" },
  { id: "pile", label: "积累" },
  { id: "habit", label: "习惯" },
];

const ACHIEVE_DEFS = [
  { id: "first_watch", group: "start", title: "打开第一支", blurb: "从滑过去，变成停下来读。", test: (s) => s.videos >= 1 },
  { id: "first_word", group: "start", title: "收下第一个词", blurb: "这个词从字幕里站起来了。", test: (s) => s.words >= 1 },
  { id: "first_line", group: "start", title: "第一次划线", blurb: "看见一句值得留下来的话。", test: (s) => s.highlights >= 1 },
  { id: "first_note", group: "start", title: "写下自己的话", blurb: "不是摘抄，是你自己的一句。", test: (s) => s.notes >= 1 },
  { id: "first_pin", group: "start", title: "夹上第一枚", blurb: "这一秒以后还能回来。", test: (s) => s.marks >= 1 },
  { id: "first_split", group: "start", title: "第一次拆页", blurb: "长视频被你拆成能咬动的块。", test: (s) => s.chapters >= 1 },
  { id: "first_pack", group: "start", title: "装上词汇包", blurb: "筛生词开始走本机，少花一次额度。", test: (s) => s.packs >= 1 },
  { id: "first_review", group: "start", title: "复习第一张", blurb: "存下来，还要再看见。", test: (s) => s.reviews >= 1 },
  { id: "first_done", group: "start", title: "学会一块", blurb: "这一块你能讲给别人听。", test: (s) => s.doneChapters >= 1 },

  { id: "words_10", group: "pile", title: "十个生词", blurb: "口袋里开始有自己的词。", need: 10, have: (s) => s.words, test: (s) => s.words >= 10 },
  { id: "words_30", group: "pile", title: "三十个生词", blurb: "一篇一篇攒，比一次背完更稳。", need: 30, have: (s) => s.words, test: (s) => s.words >= 30 },
  { id: "words_100", group: "pile", title: "一百个生词", blurb: "这已经是一本薄薄的自己的词典。", need: 100, have: (s) => s.words, test: (s) => s.words >= 100 },
  { id: "videos_5", group: "pile", title: "五支视频", blurb: "不是收藏夹，是真的读过。", need: 5, have: (s) => s.videos, test: (s) => s.videos >= 5 },
  { id: "videos_20", group: "pile", title: "二十支视频", blurb: "库里开始有你的脚印。", need: 20, have: (s) => s.videos, test: (s) => s.videos >= 20 },
  { id: "chapters_5", group: "pile", title: "五块知识", blurb: "拆开的比囫囵吞下的记得住。", need: 5, have: (s) => s.chapters, test: (s) => s.chapters >= 5 },
  { id: "chapters_20", group: "pile", title: "二十块知识", blurb: "长内容在你手里变成目录。", need: 20, have: (s) => s.chapters, test: (s) => s.chapters >= 20 },
  { id: "done_10", group: "pile", title: "学会十块", blurb: "会了，就标上。这是对自己诚实。", need: 10, have: (s) => s.doneChapters, test: (s) => s.doneChapters >= 10 },
  { id: "reviews_20", group: "pile", title: "复习二十次", blurb: "改善靠重复，不靠一次热血。", need: 20, have: (s) => s.reviews, test: (s) => s.reviews >= 20 },

  { id: "day_3", group: "habit", title: "连着三天", blurb: "今天也来改一点。", need: 3, have: (s) => s.streak, test: (s) => s.streak >= 3 },
  { id: "day_7", group: "habit", title: "连着一周", blurb: "七天，已经不是心血来潮。", need: 7, have: (s) => s.streak, test: (s) => s.streak >= 7 },
  { id: "both_sites", group: "habit", title: "两边都读过", blurb: "YouTube 和 B 站，墙这边那边都算。", test: (s) => s.youtube >= 1 && s.bili >= 1 },
  { id: "live_cc", group: "habit", title: "片上跟一句", blurb: "眼睛还在画面上，手也能点词。", test: (s) => s.live },
  { id: "loop_line", group: "habit", title: "再听一遍", blurb: "听不清就再听。这不是笨，是认真。", test: (s) => s.loop },
  { id: "shadow", group: "habit", title: "开口跟读", blurb: "耳朵会了，嘴也要过一遍。", test: (s) => s.shadow },
  { id: "ask_once", group: "habit", title: "问过一次", blurb: "卡住的地方，值得问清楚。", test: (s) => s.asks >= 1 },
  { id: "map_once", group: "habit", title: "画出关系", blurb: "词和块之间，开始有线。", test: (s) => s.maps },
  { id: "quote_once", group: "habit", title: "留下金句", blurb: "这句话够沉，配单独放。", test: (s) => s.quotes >= 1 },
  { id: "export_once", group: "habit", title: "带出去", blurb: "学过的东西，离开插件也还在。", test: (s) => s.exported },
];

function achieveDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function achieveStreak(days, today) {
  const set = new Set(days || []);
  if (!set.has(today)) return 0;
  let n = 0;
  const d = new Date(`${today}T12:00:00`);
  while (set.has(achieveDayKey(d.getTime()))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function touchAchieveDays(days, now = Date.now()) {
  const today = achieveDayKey(now);
  const next = [...new Set([...(days || []), today])].sort().slice(-60);
  return { days: next, today, streak: achieveStreak(next, today) };
}

function emptyAchieveStore() {
  return { unlocked: {}, seen: {}, flags: {}, days: [], doneKeys: {}, doneChapters: 0 };
}

function evaluateAchievements(stats, store) {
  const prev = store?.unlocked && typeof store.unlocked === "object" ? store.unlocked : {};
  const unlocked = { ...prev };
  const fresh = [];
  for (const def of ACHIEVE_DEFS) {
    if (unlocked[def.id]) continue;
    let ok = false;
    try {
      ok = Boolean(def.test(stats || {}));
    } catch (_e) {
      ok = false;
    }
    if (!ok) continue;
    unlocked[def.id] = Date.now();
    fresh.push(def.id);
  }
  return { unlocked, fresh };
}

function achieveById(id) {
  return ACHIEVE_DEFS.find((d) => d.id === id) || null;
}

function unseenAchieveCount(store) {
  const unlocked = store?.unlocked || {};
  const seen = store?.seen || {};
  return Object.keys(unlocked).filter((id) => !seen[id]).length;
}

globalThis.Achieve = {
  GROUPS: ACHIEVE_GROUPS,
  DEFS: ACHIEVE_DEFS,
  dayKey: achieveDayKey,
  streak: achieveStreak,
  touchDays: touchAchieveDays,
  emptyStore: emptyAchieveStore,
  evaluate: evaluateAchievements,
  byId: achieveById,
  unseen: unseenAchieveCount,
};
