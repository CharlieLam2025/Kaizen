// 词汇量档位：用常见考试档和成绩估一个区间，再从字幕里反筛可能超纲的词。
// 不是官方词表，也不声称覆盖四级/雅思考纲。

const CORE_TEXT = `
a about above across after again against ago air all almost along already also always
am among an and animal another answer any anyone anything appear are area around as
ask at away back bad be because become been before begin behind being believe below
best better between big both boy bring but by call came can cannot car care carry
case catch change child children city close come company could country course cut
day did different do does done down during each early earth easy eat end enough even
ever every everyone everything example eye face fact far fast father feel few find
first follow food for form found four from full get girl give go going gone good
got great group grow had half hand happen hard has have he head hear heard help her
here high him his hold home hope hour house how however i if important in into is
it its itself just keep kind kind know known large last late later learn leave left
less let life light like line little live long look lot love made make man many
may me mean men might mind more most mother move much must my name near need never
new next no not now number of off often old on once one only open or other our out
over own part people person place play point put question rather real really right
room run said same say school see seem seen she should show side since small so some
someone something sometimes soon start still stop such take tell than that the their
them then there these they thing think this those though thought three through time
to today together told too took toward turn two under until up us use used very
want was water way we week well went were what when where which while who why will
with without woman word work world would year yes yet you young your
able accept action actually add address age agree allow almost already although among
amount appear apply argue around arrive art ask attack attempt attention available
average avoid base basic beautiful become begin behavior behind believe belong best
better beyond birth bit black blood blue body book both box boy break bring brother
build building business buy call campaign capital car care carry case catch cause
center certain certainly chance change character charge cheap check child choice
choose church city class clear clearly close cold college color come common community
company compare complete concern condition consider continue control cost could
country couple course create crime cultural current cut dark data daughter day dead
deal death decide decision deep degree describe design develop development die
difference different difficult direction director discover discuss discussion
disease do doctor dog door down draw dream drive drop drug early east easy eat
economic education effect effort eight either election else employee end energy
enjoy enough enter entire environment especially establish even evening event ever
every evidence exactly example exist expect experience explain eye face fact factor
fail fall family far fast father fear federal feel field fight figure fill film
final finally financial find fine finger finish fire firm first fish five floor
fly focus follow food foot force foreign forget form former forward four free
friend from front full fund future game garden general generation get girl give
glass go gold good government great green ground group grow growth guess gun guy
hair half hand hang happen happy hard have he head health hear heart heat heavy
help her here herself high him himself his history hit hold home hope hospital
hot hotel hour house how however huge human hundred husband idea identify if
image imagine impact important improve in include including increase indeed
indicate individual industry information inside instead interest international
interview into involve issue it item its itself job join just keep key kid kill
kind kitchen know knowledge land language large last late later laugh law lawyer
lay lead leader learn least leave left leg legal less let letter level lie life
light like likely line list listen little live local long look lose loss lot
love low machine main major make man manage manager many market marriage material
matter may maybe me mean measure media medical meet meeting member memory mention
message method middle might military million mind minute miss mission model moment
money month more morning most mother mouth move movement movie much music must my
myself name nation national natural nature near nearly necessary need network never
new news next nice night no none nor north not note nothing notice now number occur
of off offer office officer official often oh oil ok old on once one only onto open
operation opportunity or order organization other others our out outside over own
owner page pain paper parent part particular particularly party pass past patient
pay peace people per perform perhaps period person personal phone physical pick
picture piece place plan plant play player point police policy political poor
popular population position possible power practice prepare present president
press pressure pretty prevent price private probably problem process produce
product production professional professor program project property protect prove
provide public pull purpose push put quality question quickly quite race radio
raise range rate rather reach read ready real reality realize really reason receive
recent recently recognize record red reduce reflect region relate relationship
religion remain remember remove report represent republican require research
resource respond response responsibility rest result return reveal rich right
rise risk road rock role room rule run safe same save say scene school science
scientist score sea season seat second section security see seek seem sell send
senior sense series serious serve service set seven several sex sexual shake
share she shoot short shot should shoulder show side sign significant similar
simple simply since sing single sister sit site situation six size skill skin
small smile so social society soldier some someone something sometimes son song
soon sort sound source south space speak special specific speech spend sport
spring staff stage stand standard star start state statement station stay step
still stock stop store story strategy street strong student study stuff style
subject success successful such suddenly suffer suggest summer support sure
surface system table take talk tax teach teacher team technology television tell
ten tend term test than thank that the their them themselves then theory there
these they thing think third this those though thought thousand threat three
through throughout throw thus time to today together tonight too top total toward
town trade traditional training travel treat treatment tree trial trip trouble
true truth try turn tv two type under understand unit until up upon us use usually
value various very victim view violence visit voice vote wait walk wall want war
watch water way we weapon wear week weight well west western what whatever when
where whether which while white who whole whom whose why wide wife will win wind
window wish with within without woman wonder word work worker working world worry
would write writer wrong yard yeah year yes yet you young your yourself
`;

const CORE = new Set(
  CORE_TEXT.split(/\s+/).map((w) => w.toLowerCase()).filter(Boolean),
);

const BANDS = {
  off: { id: "off", label: "先不设", known: 0, prompt: "" },
  cet4: {
    id: "cet4",
    label: "大学四级",
    known: 4500,
    prompt: "大学英语四级，大约掌握 4500 常用词。中学词和四级词都算会，不要标出来。",
  },
  cet6: {
    id: "cet6",
    label: "大学六级",
    known: 6000,
    prompt: "大学英语六级，大约掌握 6000 词。四级及以下的词都算会。",
  },
  kaoyan: {
    id: "kaoyan",
    label: "考研英语",
    known: 6500,
    prompt: "考研英语普通备考水平，大约 5500–7500 词。四级、六级常用词都算会。",
  },
  tem4: {
    id: "tem4",
    label: "英语专四",
    known: 7000,
    prompt: "英语专业四级，大约掌握 7000 词。校园和文学常用词都算会。",
  },
  tem8: {
    id: "tem8",
    label: "英语专八",
    known: 10000,
    prompt: "英语专业八级，大约掌握 10000 词。较难的学术词和书面词也算会。",
  },
  ielts: {
    id: "ielts",
    label: "雅思",
    known: 6000,
    prompt: "雅思普通备考水平，大约 5500–7000 词。日常和学术入门词都算会。",
  },
  toefl: {
    id: "toefl",
    label: "托福",
    known: 7000,
    prompt: "托福普通备考水平，大约 6000–8000 词。校园和学术常用词都算会。",
  },
  sat: {
    id: "sat",
    label: "SAT",
    known: 8000,
    prompt: "SAT 阅读普通备考水平，大约 7000–9000 词。书面和学术常用词都算会。",
  },
  gre: {
    id: "gre",
    label: "GRE",
    known: 12000,
    prompt: "GRE 语文普通备考水平，大约 10000–14000 词。难词和书面词也算会。",
  },
  custom: {
    id: "custom",
    label: "自填词量",
    known: 6000,
    prompt: "按你填写或测出的词汇量筛。这个数量及以下的常用词都算会。",
  },
};

function ieltsKnown(score) {
  if (score >= 8.5) return 10000;
  if (score >= 8) return 9000;
  if (score >= 7.5) return 8000;
  if (score >= 7) return 7500;
  if (score >= 6.5) return 6500;
  if (score >= 6) return 5500;
  if (score >= 5.5) return 5000;
  if (score >= 5) return 4000;
  return 3500;
}

function toeflKnown(score) {
  if (score >= 110) return 10000;
  if (score >= 100) return 8000;
  if (score >= 90) return 7000;
  if (score >= 80) return 6000;
  if (score >= 60) return 4000;
  return 3500;
}

function cetKnown(score, is6) {
  const base = is6 ? 5000 : 3800;
  if (score >= 650) return base + 2800;
  if (score >= 600) return base + 2200;
  if (score >= 550) return base + 1600;
  if (score >= 500) return base + 1000;
  if (score >= 425) return base + 400;
  return base;
}

function kaoyanKnown(score) {
  if (score >= 80) return 9000;
  if (score >= 70) return 7500;
  if (score >= 60) return 6000;
  if (score >= 50) return 5000;
  return 4000;
}

function temKnown(score, is8) {
  const base = is8 ? 8000 : 5500;
  if (score >= 80) return base + 3000;
  if (score >= 70) return base + 1800;
  if (score >= 60) return base + 800;
  return base;
}

function greKnown(score) {
  if (score >= 165) return 16000;
  if (score >= 160) return 14000;
  if (score >= 155) return 12000;
  if (score >= 150) return 10000;
  return 8000;
}

function satKnown(score) {
  if (score >= 750) return 12000;
  if (score >= 700) return 10000;
  if (score >= 650) return 8500;
  if (score >= 600) return 7000;
  if (score >= 500) return 5500;
  return 4000;
}

function parseScore(raw, band) {
  const n = Number(String(raw || "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  if (band === "ielts") return Math.min(9, Math.max(1, Math.round(n * 2) / 2));
  if (band === "toefl") return Math.min(120, Math.max(0, Math.round(n)));
  if (band === "cet4" || band === "cet6") return Math.min(710, Math.max(200, Math.round(n)));
  if (band === "kaoyan" || band === "tem4" || band === "tem8") return Math.min(100, Math.max(0, Math.round(n)));
  if (band === "gre") return Math.min(170, Math.max(130, Math.round(n)));
  if (band === "sat") return Math.min(800, Math.max(200, Math.round(n)));
  if (band === "custom") return Math.min(20000, Math.max(200, Math.round(n)));
  return "";
}

function scoreMeta(band) {
  return (
    {
      ielts: { label: "雅思总分（选填）", ph: "例如 6.5" },
      toefl: { label: "托福总分（选填）", ph: "例如 90" },
      cet4: { label: "四级分数（选填）", ph: "例如 550" },
      cet6: { label: "六级分数（选填）", ph: "例如 520" },
      kaoyan: { label: "考研分数（选填）", ph: "例如 70" },
      tem4: { label: "专四分数（选填）", ph: "例如 70" },
      tem8: { label: "专八分数（选填）", ph: "例如 70" },
      gre: { label: "GRE 语文（选填）", ph: "例如 155" },
      sat: { label: "SAT 阅读（选填）", ph: "例如 650" },
      custom: { label: "大约会多少词", ph: "例如 6000" },
    }[band] || null
  );
}

function resolve(settings) {
  const band = BANDS[settings?.vocabBand] ? settings.vocabBand : "off";
  const base = BANDS[band];
  const score = parseScore(settings?.vocabScore, band);
  if (band === "off") {
    return { id: "off", key: "off", label: "未设置", known: 0, prompt: "", score: "" };
  }
  let known = base.known;
  let label = base.label;
  let prompt = base.prompt;
  if (band === "ielts" && score !== "") {
    known = ieltsKnown(score);
    label = `雅思 ${score}`;
    prompt = `雅思总分约 ${score}，大约掌握 ${known} 词。这个分数及以下的常用词、课堂词都算会。`;
  } else if (band === "toefl" && score !== "") {
    known = toeflKnown(score);
    label = `托福 ${score}`;
    prompt = `托福总分约 ${score}，大约掌握 ${known} 词。这个分数及以下的校园词、学术常用词都算会。`;
  } else if (band === "cet4" && score !== "") {
    known = cetKnown(score, false);
    label = `四级 ${score}`;
    prompt = `大学英语四级约 ${score} 分，大约掌握 ${known} 词。这个分数及以下的常用词都算会。`;
  } else if (band === "cet6" && score !== "") {
    known = cetKnown(score, true);
    label = `六级 ${score}`;
    prompt = `大学英语六级约 ${score} 分，大约掌握 ${known} 词。这个分数及以下的常用词都算会。`;
  } else if (band === "kaoyan" && score !== "") {
    known = kaoyanKnown(score);
    label = `考研 ${score}`;
    prompt = `考研英语约 ${score} 分，大约掌握 ${known} 词。这个分数及以下的常用词都算会。`;
  } else if (band === "tem4" && score !== "") {
    known = temKnown(score, false);
    label = `专四 ${score}`;
    prompt = `英语专四约 ${score} 分，大约掌握 ${known} 词。这个分数及以下的词都算会。`;
  } else if (band === "tem8" && score !== "") {
    known = temKnown(score, true);
    label = `专八 ${score}`;
    prompt = `英语专八约 ${score} 分，大约掌握 ${known} 词。这个分数及以下的书面词都算会。`;
  } else if (band === "gre" && score !== "") {
    known = greKnown(score);
    label = `GRE ${score}`;
    prompt = `GRE 语文约 ${score}，大约掌握 ${known} 词。这个分数及以下的难词也算会。`;
  } else if (band === "sat" && score !== "") {
    known = satKnown(score);
    label = `SAT ${score}`;
    prompt = `SAT 阅读约 ${score}，大约掌握 ${known} 词。这个分数及以下的书面词都算会。`;
  } else if (band === "custom" && score !== "") {
    known = score;
    label = `约 ${known} 词`;
    prompt = `按大约 ${known} 词的词汇量筛。这个数量及以下的常用词都算会。`;
  }
  return { id: band, key: `${band}:${score || ""}:${known}`, label, known, prompt, score };
}

const TEST_BANK = [
  { word: "because", rank: 1 },
  { word: "important", rank: 1 },
  { word: "different", rank: 1 },
  { word: "problem", rank: 1 },
  { word: "together", rank: 1 },
  { word: "example", rank: 1 },
  { word: "change", rank: 1 },
  { word: "people", rank: 1 },
  { word: "achieve", rank: 2 },
  { word: "evidence", rank: 2 },
  { word: "maintain", rank: 2 },
  { word: "approach", rank: 2 },
  { word: "significant", rank: 2 },
  { word: "available", rank: 2 },
  { word: "require", rank: 2 },
  { word: "develop", rank: 2 },
  { word: "subsequent", rank: 3 },
  { word: "implicit", rank: 3 },
  { word: "allocate", rank: 3 },
  { word: "coherent", rank: 3 },
  { word: "constitute", rank: 3 },
  { word: "inevitable", rank: 3 },
  { word: "paradigm", rank: 3 },
  { word: "discrepancy", rank: 3 },
  { word: "ubiquitous", rank: 4 },
  { word: "pragmatic", rank: 4 },
  { word: "exacerbate", rank: 4 },
  { word: "salient", rank: 4 },
  { word: "ambiguous", rank: 4 },
  { word: "juxtapose", rank: 4 },
  { word: "corollary", rank: 4 },
  { word: "dichotomy", rank: 4 },
  { word: "ephemeral", rank: 5 },
  { word: "inchoate", rank: 5 },
  { word: "recondite", rank: 5 },
  { word: "abstruse", rank: 5 },
  { word: "evanescent", rank: 5 },
  { word: "liminal", rank: 5 },
  { word: "perspicacious", rank: 5 },
  { word: "ineluctable", rank: 5 },
];

function shuffle(list) {
  const rows = list.slice();
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

function pickTest(n = 20) {
  const by = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const row of TEST_BANK) by[row.rank]?.push(row);
  const per = Math.max(1, Math.round(n / 5));
  const out = [];
  for (let r = 1; r <= 5; r += 1) out.push(...shuffle(by[r]).slice(0, per));
  return shuffle(out).slice(0, n);
}

function estimateKnown(answers) {
  const by = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const a of answers || []) by[a.rank]?.push(Boolean(a.yes));
  const inc = [2000, 2000, 2000, 2000, 3000];
  let known = 800;
  for (let r = 1; r <= 5; r += 1) {
    const arr = by[r];
    if (!arr.length) continue;
    known += (arr.filter(Boolean).length / arr.length) * inc[r - 1];
  }
  return Math.max(800, Math.min(18000, Math.round(known / 100) * 100));
}

function candidates(segments, { known } = {}) {
  const skip = known instanceof Set ? known : new Set(known || []);
  const map = new Map();
  for (const seg of segments || []) {
    const text = String(seg.text || "");
    const re = /\b[A-Za-z][A-Za-z'-]{2,39}\b/g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0];
      const word = raw.toLowerCase();
      if (CORE.has(word)) continue;
      if (skip.has(word)) continue;
      if (/^[A-Z]{2,5}$/.test(raw)) continue;
      if (word.includes("'") && word.length <= 4) continue;
      let row = map.get(word);
      if (!row) {
        row = { word, count: 0, sentence: text, seconds: Number(seg.start) || 0 };
        map.set(word, row);
      }
      row.count += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 80);
}

const PACK_IDS = ["cet4", "cet6", "kaoyan", "ielts", "toefl", "sat", "gre"];

function knownFromFreq(freq, n) {
  const set = new Set(CORE);
  const list = Array.isArray(freq) ? freq : [];
  const cap = Math.max(0, Math.min(Math.round(Number(n) || 0), list.length));
  for (let i = 0; i < cap; i += 1) {
    const w = String(list[i] || "").toLowerCase();
    if (w) set.add(w);
  }
  return set;
}

function scanLocal(segments, { packWords, userKnown, limit = 24 } = {}) {
  const skip = new Set(CORE);
  if (packWords instanceof Set) packWords.forEach((w) => skip.add(String(w).toLowerCase()));
  else for (const w of packWords || []) skip.add(String(w).toLowerCase());
  for (const w of userKnown || []) skip.add(String(w).toLowerCase());
  const map = new Map();
  for (const seg of segments || []) {
    const text = String(seg.text || "");
    const re = /\b[A-Za-z][A-Za-z'-]{2,39}\b/g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0];
      const word = raw.toLowerCase();
      if (skip.has(word)) continue;
      if (/^[A-Z]{2,5}$/.test(raw)) continue;
      if (word.includes("'") && word.length <= 4) continue;
      let row = map.get(word);
      if (!row) {
        row = { word, count: 0, cap: 0, sentence: text, seconds: Number(seg.start) || 0 };
        map.set(word, row);
      }
      row.count += 1;
      if (/^[A-Z]/.test(raw)) row.cap += 1;
    }
  }
  return [...map.values()]
    .filter((row) => row.cap < row.count)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, Math.max(1, Number(limit) || 24))
    .map((row) => ({
      word: row.word,
      why: "",
      sentence: row.sentence,
      seconds: row.seconds,
      local: true,
    }));
}

globalThis.WordLevel = {
  BANDS,
  CORE,
  PACK_IDS,
  parseScore,
  scoreMeta,
  resolve,
  candidates,
  scanLocal,
  knownFromFreq,
  pickTest,
  estimateKnown,
};
