// Kaizen UI language. Source strings are zh-CN; other packs live in i18n-dict.js.

const I18N_LANGS = [
  { id: "zh-CN", native: "简体中文" },
  { id: "zh-TW", native: "繁體中文" },
  { id: "en", native: "English" },
  { id: "ja", native: "日本語" },
  { id: "ko", native: "한국어" },
  { id: "es", native: "Español" },
  { id: "fr", native: "Français" },
  { id: "de", native: "Deutsch" },
  { id: "pt", native: "Português" },
  { id: "ru", native: "Русский" },
  { id: "vi", native: "Tiếng Việt" },
  { id: "id", native: "Bahasa Indonesia" },
  { id: "th", native: "ไทย" },
  { id: "ar", native: "العربية" },
];

const I18N_META = {
  "zh-CN": { html: "zh-CN", dir: "ltr", ai: "简体中文" },
  "zh-TW": { html: "zh-Hant", dir: "ltr", ai: "繁體中文" },
  en: { html: "en", dir: "ltr", ai: "English" },
  ja: { html: "ja", dir: "ltr", ai: "日本語" },
  ko: { html: "ko", dir: "ltr", ai: "한국어" },
  es: { html: "es", dir: "ltr", ai: "español" },
  fr: { html: "fr", dir: "ltr", ai: "français" },
  de: { html: "de", dir: "ltr", ai: "Deutsch" },
  pt: { html: "pt", dir: "ltr", ai: "português" },
  ru: { html: "ru", dir: "ltr", ai: "русский" },
  vi: { html: "vi", dir: "ltr", ai: "tiếng Việt" },
  id: { html: "id", dir: "ltr", ai: "Bahasa Indonesia" },
  th: { html: "th", dir: "ltr", ai: "ภาษาไทย" },
  ar: { html: "ar", dir: "rtl", ai: "العربية" },
};

const I18N_TERM_TW = [
  ["视频", "影片"],
  ["默认", "預設"],
  ["信息", "資訊"],
  ["文件", "檔案"],
  ["设置", "設定"],
  ["软件", "軟體"],
  ["网络", "網路"],
  ["登录", "登入"],
  ["缓存", "快取"],
  ["数据", "資料"],
  ["用户", "使用者"],
  ["界面", "介面"],
  ["质量", "品質"],
  ["应用", "應用"],
  ["存储", "儲存"],
  ["复盘", "複盤"],
  ["导出", "匯出"],
  ["导入", "匯入"],
  ["恢复", "還原"],
  ["打印", "列印"],
  ["划线", "劃線"],
  ["词卡", "詞卡"],
  ["生词", "生詞"],
  ["笔记", "筆記"],
  ["钥匙", "鑰匙"],
];

const S2T_PAIRS =
  "万萬与與专业專業东東丝絲丢丟两兩严嚴丧喪个個丰豐临臨为為丽麗举舉么麼义義乐樂习習乡鄉书書买買乱亂争爭于於亏虧云雲亚亞产產亲親亿億仅僅从從仓倉仪儀们們价價众眾优優会會伞傘伟偉传傳伤傷伦倫伪偽体體余餘侠俠侦偵侧側侨僑债債倾傾偿償储儲儿兒兑兌党黨兰蘭关關兴興养養兽獸内內冈岡册冊写寫军軍农農冲衝决決况況冻凍净淨准準凉涼减減凑湊几幾凤鳳凭憑凯凱击擊凿鑿刍芻划劃刘劉则則刚剛创創删刪别別剂劑剑劍剥剝剧劇劝勸办辦务務动動励勵劲勁劳勞势勢勋勳匀勻区區医醫华華协協单單卖賣卢盧卤鹵卧臥卫衛却卻卷捲厂廠厅廳历曆厉厲压壓厌厭厕廁厢廂厦廈县縣参參双雙发發变變叙敘叠疊叶葉号號叹嘆后後吓嚇吗嗎听聽启啟吴吳员員呜嗚咏詠响響哑啞哗嘩哟喲唤喚喷噴团團园園围圍国國图圖圆圓圣聖场場坏壞块塊坚堅坛壇坟墳坠墜垄壟垒壘垦墾垫墊墙牆壮壯声聲壳殼壶壺处處备備复復够夠头頭夸誇夹夾夺奪奋奮奖獎奥奧妇婦妈媽娇嬌娱娛婴嬰婶嬸孙孫学學宁寧宝寶实實宠寵审審宪憲宫宮宽寬宾賓对對寻尋导導寿壽将將尔爾尘塵尝嘗尴尷尸屍尽盡层層屉屜届屆属屬屡屢屿嶼岁歲岂豈岖嶇岗崗岛島峡峽峦巒崭嶄币幣帅帥师師帐帳帘簾帜幟带帶帮幫并並广廣庄莊庆慶庐廬库庫应應庙廟庞龐废廢开開异異弃棄张張弯彎弹彈强強归歸当當录錄彻徹径徑忆憶忧憂怀懷态態怜憐总總恋戀恒恆恳懇恶惡恼惱悦悅悬懸悯憫惊驚惧懼惨慘惩懲惫憊惭慚惯慣愤憤愿願懒懶戏戲战戰户戶扎紮扑撲执執扩擴扫掃扬揚扰擾抚撫抢搶护護报報拣揀拥擁拦攔拨撥择擇挂掛挣掙挤擠挥揮捞撈损損捡撿换換捣搗揽攬搅攪携攜摄攝摆擺摇搖摊攤撑撐攒攢敌敵敛斂数數斗鬥斩斬断斷无無旧舊时時显顯晒曬晓曉晕暈暂暫术術机機杀殺杂雜权權条條来來杨楊杰傑极極构構枪槍枫楓柜櫃柠檸标標栈棧栋棟栏欄树樹栖棲样樣桥橋桦樺梦夢检檢椭橢楼樓横橫樱櫻橱櫥欢歡欧歐残殘毙斃汇匯汉漢污汙汤湯沟溝没沒沪滬泪淚泻瀉泼潑泽澤洁潔洒灑浅淺浆漿浇澆浊濁测測济濟浑渾浓濃涂塗涌湧涛濤润潤涨漲涩澀渊淵渍漬渐漸渔漁渗滲温溫湾灣湿濕溃潰溅濺滚滾滞滯满滿滤濾滥濫滨濱滩灘潜潛灭滅灯燈灵靈灾災灿燦炉爐点點炼煉烁爍烂爛烛燭烟煙烦煩烧燒烫燙热熱爱愛牵牽牺犧状狀独獨狭狹狮獅狱獄猎獵猪豬猫貓献獻环環现現琼瓊电電画畫畅暢疗療疮瘡疯瘋痒癢皱皺盐鹽监監盖蓋盗盜盘盤睁睜着著矫矯矿礦码碼砖磚础礎硕碩确確碍礙碱鹼礼禮祷禱祸禍离離种種积積称稱秽穢税稅稳穩穷窮窃竊窍竅窝窩竖豎竞競笔筆笼籠筑築筛篩筹籌签簽简簡篮籃类類粮糧紧緊纠糾红紅纤纖约約级級纪紀纬緯纯純纱紗纲綱纳納纵縱纷紛纸紙纹紋纺紡线線练練组組细細织織终終绊絆绍紹经經绑綁结結绕繞绘繪给給络絡绝絕统統绢絹绣繡继繼绩績绪緒续續绳繩维維绵綿绿綠缆纜缓緩缕縷编編缘緣缝縫缠纏缩縮网網罗羅罚罰罢罷翘翹耸聳耻恥聂聶聋聾职職联聯聪聰肃肅肠腸肤膚肾腎肿腫胀脹胁脅胆膽胶膠脉脈脑腦脚腳脱脫脸臉腻膩舰艦舱艙艰艱艳豔艺藝节節苏蘇茎莖茧繭荐薦荣榮药藥获獲营營萧蕭萨薩蓝藍蕴蘊虏虜虑慮虚虛虫蟲虽雖蚀蝕蚁蟻蛮蠻蜡蠟衔銜补補衬襯袜襪袭襲装裝裤褲见見观觀规規视視览覽觉覺计計订訂认認讨討让讓训訓议議讯訊记記讲講许許论論讼訟讽諷设設访訪证證评評识識诈詐诉訴诊診词詞译譯试試诗詩诚誠话話诞誕询詢该該详詳语語误誤说說请請诸諸诺諾读讀课課谁誰调調谅諒谈談谊誼谋謀谎謊谜謎谢謝谨謹贝貝贞貞负負贡貢财財责責贤賢败敗账賬货貨质質贩販贪貪贫貧购購贯貫贱賤贴貼贵貴贷貸贸貿费費贺賀贾賈资資赋賦赌賭赏賞赔賠赚賺赛賽赞贊赠贈赢贏赶趕趋趨跃躍践踐踪蹤车車轨軌转轉轮輪软軟轴軸轻輕载載轿轎较較辅輔辆輛辈輩辑輯输輸辖轄辞辭边邊达達迁遷过過迈邁运運还還这這进進远遠违違连連迟遲迹跡适適选選逊遜递遞逻邏遗遺邮郵邻鄰郑鄭酿釀采採释釋里裏鉴鑒针針钟鍾钢鋼钥鑰钦欽钩鉤钮鈕钱錢钻鑽铁鐵铃鈴铅鉛铜銅铝鋁银銀铸鑄铺鋪链鏈销銷锁鎖锅鍋锈鏽锋鋒错錯锡錫锣鑼锤錘键鍵锁鎖长長门門闪閃闭閉问問闲閑间間闷悶闸閘闹鬧闻聞阀閥阁閣阅閱队隊阳陽阴陰阵陣阶階际際陆陸陈陳险險随隨隐隱难難雾霧静靜页頁顶頂项項顺順须須顾顧顿頓预預领領颇頗颈頸频頻颗顆题題颜顏额額风風飘飄飞飛饥饑饭飯饮飲饰飾饱飽饼餅马馬驭馭驾駕验驗骑騎骗騙骤驟鱼魚鲜鮮鸟鳥鸡雞鸣鳴鸭鴨鸿鴻麦麥黄黃齐齊齿齒龙龍龟龜";

const S2T_MAP = (() => {
  const map = new Map();
  for (let i = 0; i + 1 < S2T_PAIRS.length; i += 2) map.set(S2T_PAIRS[i], S2T_PAIRS[i + 1]);
  return map;
})();

let i18nLang = "zh-CN";
let i18nPhrases = new Map();

const I18N_EXTRA_EN = {
  "模型这次吐出来的格式乱了，再试一次。": "The model returned a broken answer. Try again.",
  "提纲没做成，点重做再试。": "The outline didn’t come through. Tap Redo.",
  "对照没做成，再试一次。": "The check didn’t come through. Try again.",
  书签: "Bookmark",
  换书签样子: "Change the bookmark face",
  夹在这里: "Pin here",
  "看视频时用播放条和右下那一排钮。键盘可选用，输入框里不会触发。":
    "On the video, use the progress bar and the buttons at the bottom right. Keys are optional and don’t fire in text fields.",
  "钮 / 键": "Button / key",
  作用: "Does",
  打开侧栏: "Open the side panel",
  收下正在说的这句: "Keep this line",
  记下正在说的这句: "Note down this line",
  记下这句: "Note this line",
  已记下这句话: "Noted this line",
  "这一秒对不上字幕，没记上。": "This second doesn’t match the captions, so it wasn’t saved.",
  "记下了，打开侧栏后会写进金句": "Noted. It will go into quotes when you open the side panel.",
  去侧栏写这枚书签: "Write this bookmark in the side panel",
  "已夹在 {t}": "Pinned at {t}",
  刚夹过: "Just pinned",
  写一句: "Add a line",
  现在这里: "Playhead",
  "还没有书签。点「夹在这里」或视频右下的 B，会钉在进度条上。事后可写一句。":
    "No bookmarks yet. Tap Pin here or press B at the bottom right. They sit on the progress bar. You can write a line later.",
  "先打开一支视频，或至少留下一条笔记、金句、划线、书签或生词。":
    "Open a video first, or leave a note, quote, highlight, bookmark, or word.",
  记下这一刻: "Note this moment",
  这句会再听一遍: "This line will play again",
  正在打开侧栏: "Opening the side panel",
  侧栏刚才没打开: "The side panel didn’t open.",
  "点重试。如果还不行，刷新视频页，再点右上角 Kaizen。":
    "Tap Retry. If it still won’t open, refresh the video page and click the Kaizen icon.",
  "先抽出金句，或按 R 记下几句。": "Pull quotes first, or press R to note a line.",
  "再听这句或划过的几句。再按一次，或按 Esc 停": "Hear this line again. Press once more, or Esc, to stop.",
  在这一刻写下自己的话: "Write a note at this second",
  夹一枚书签: "Drop a bookmark",
  "夹在这一秒，事后可写一句": "Pin this second. Write a line later if you want.",
  "书签会钉在视频自己的进度条上。事后可补一句。N 只在侧栏里按，避免抢掉 YouTube 的下一集。":
    "Bookmarks sit on the video’s own progress bar. You can add a line later. N only works in the side panel, so it doesn’t steal YouTube’s next-video key.",
  "## 书签": "## Bookmarks",
  枚书签: "bookmarks",
  "书签会钉在视频自己的进度条上。N 只在侧栏里按，避免抢掉 YouTube 的下一集。":
    "Bookmarks sit on the video’s own progress bar. N only works in the side panel, so it doesn’t steal YouTube’s next-video key.",
  夹书签: "Bookmark",
  这儿已经有了: "Already pinned here",
  已夹在这里: "Pinned here",
  已夹书签: "Bookmark dropped",
  "记下了，打开侧栏后会夹上书签": "Noted. It will pin when you open the side panel.",
  "侧栏里写下这枚书签": "Write this bookmark in the side panel.",
  "记下了，打开侧栏后写下这枚书签": "Noted. Open the side panel to title it and write a thought.",
  "还没有书签。点「夹在这里」写个标题和感想，或视频右下的 B。进度条上也会出现。":
    "No bookmarks yet. Tap Pin here to add a title and a thought, or press B at the bottom right. They also show on the progress bar.",
  改这枚书签: "Edit this bookmark",
  书签标题: "Bookmark title",
  此刻的感想: "Thought at this second",
  "这一刻在讲什么…": "What’s happening here…",
  "这一刻为什么要停一下…": "Why pause here…",
  夹上: "Pin",
  改一下: "Edit",
  已记下: "Saved",
  撤销: "Undo",
  已划上: "Highlighted",
  已撤回划线: "Highlight undone",
  已去掉这条划线: "Highlight removed",
  已去掉这些划线: "Highlights removed",
  已划回去: "Highlight restored",
  "这段还没有划线。": "Nothing highlighted here.",
  去掉划线: "Unhighlight",
  去掉词: "Remove word",
  从本里去掉: "Remove from list",
  已从生词本去掉: "Removed from the word list",
  已放回生词本: "Put back on the list",
  已撤回存词: "Word save undone",
  "这个词不在生词本里。": "This word isn’t on the list.",
  已拿掉书签: "Bookmark removed",
  书签已夹回去: "Bookmark put back",
  横线: "Underline",
  波浪: "Wavy",
  虚线: "Dashed",
  方框: "Box",
  圆圈: "Circle",
  荧光笔: "Highlighter",
  "默认双语。点左边时间跳秒。在字幕上划过几个字，先选横线、波浪或框，再点定义、例子。夹书签时可写标题和感想。点词是查词。做成卡之后，去顶栏「复习」。":
    "Dual captions by default. Click the time on the left to jump. Select a few words, pick underline / wave / box, then a meaning like definition. Bookmarks can take a title and a thought. Tap a word to look it up. After you make a card, go to Review.",
  上次看到: "Last seen",
  "还没有书签。点「夹在这里」，或看视频时按 B。播放条上也会出现。":
    "No bookmarks yet. Tap Pin here, or press B on the video. They also show on the player bar.",
  "还没有书签。点「夹在这里」，或视频右下的 B。进度条上也会出现。":
    "No bookmarks yet. Tap Pin here, or B at the bottom right. They also show on the progress bar.",
  "看进度条：夹过的点可以点跳。": "On the bar: tap a pin to jump.",
  "右下 K / R / A / N / B": "Bottom right: K / R / A / N / B",
  "视频右下 K / R / A / N / B。书签在进度条上。": "Bottom right: K / R / A / N / B. Bookmarks sit on the bar.",
  再听: "Again",
  夹书签: "Bookmark",
  点这张卡关掉: "Tap this card to close",
  跳到: "Jump to",
  跳到这: "Jump here",
  下一枚: "Next pin",
  去掉: "Remove",
  "选一个跟着走的样子。也可以上传猫狗照片。":
    "Pick a face that walks with you. You can also upload a cat or dog photo.",
  丝带: "Ribbon",
  金渐层: "Golden shaded",
  萨摩耶: "Samoyed",
  这块: "this bit",
  "用一句话，跟没看过视频的人说清「{t}」是什么。":
    "In one sentence, tell someone who hasn’t seen the video what “{t}” is.",
  "它为什么成立？中间靠什么推过来？": "Why does it hold? What connects the steps?",
  "举视频里的一个例子。": "Give an example from the video.",
  "什么情况下这话不成立，或别人容易听岔？":
    "When does this not hold, or where do people usually mishear it?",
  "这件事里，主张是什么？": "What’s the claim in this case?",
  "证据或机制是什么？": "What’s the evidence or the mechanism?",
  "换一个场景，还能不能这么说？": "If you change the scene, does this still hold?",
  "它藏着什么限制？": "What limits are hiding here?",
  "故事里发生了什么？": "What happened in the story?",
  "底下重复出现的模式是什么？": "What pattern keeps showing up underneath?",
  "讲的人想让你信什么？": "What does the speaker want you to believe?",
  "你自己会怎么复述给别人？": "How would you retell this to someone else?",
  "要做成这件事，目标是什么？": "To get this done, what’s the goal?",
  "先要具备什么？": "What has to be in place first?",
  "步骤怎么走？卡在哪会失败？": "What are the steps? Where does it usually fail?",
  "你下一步会试哪一步？": "Which step will you try next?",
  "问题本身在问什么？": "What is the question actually asking?",
  "他的主张是什么？凭据是什么？": "What’s the claim, and what’s the warrant?",
  "这个主张的边界在哪？": "Where’s the boundary of this claim?",
  "你同意哪一句，卡住哪一句？": "Which line do you buy, and which one are you stuck on?",
  "「{t}」是什么，它在这块里起什么作用？": "What is “{t}”, and what does it do in this bit?",
  "对着这问讲。说不出来就写最糊的一句。": "Speak to this question. If you can’t, write the muddiest line.",
  "按这些问题把「{t}」讲出来。卡住的就是还没懂。":
    "Use these questions to explain “{t}”. Where you get stuck, you don’t know it yet.",
  "可以用 Typeless、豆包输入法或微信输入法的语音转文字，对着某一问说就行。":
    "You can answer with voice-to-text: Typeless, Doubao IME, or WeChat input. Just speak to one question.",
  "先拆出知识块，再对这个点做费曼。": "Break the video into blocks first, then Feynman this point.",
  "先按上面的问题讲。写不出来就写最糊的那一句。":
    "Answer the questions above first. If you can’t, write the muddiest line.",
  费曼这个概念: "Feynman this concept",
  "按几个问题讲出来，对照材料。": "Explain it through a few questions, then check against the material.",
  "用白话讲：「{t}」": "Explain in plain words: “{t}”",
  "拆解已收起。": "The breakdown is put away.",
  只写最糊的那一句: "Just the muddiest line",
  "正在对照…": "Checking…",
  再对照一次: "Check again",
  对照材料: "Check against the material",
  去费曼检验: "Go to Feynman",
  怎样才算会了: "How you know you got it",
  跳到这块: "Jump to this block",
  猫: "Cat",
  狗: "Dog",
  鸟: "Bird",
  圆: "Circle",
  印: "Seal",
  上传照片: "Upload a photo",
  已换成你的照片: "Now using your photo",
  这张图读不出来: "Couldn’t read that image",
  "先打开一支视频。": "Open a video first.",
  "导入会覆盖这台电脑上现有的笔记、生词、书签、复习卡和设置。确定？":
    "Import will replace notes, words, bookmarks, cards, and settings on this computer. Continue?",
  整份笔记: "Full notes",
  导出卡片: "Export cards",
  "打印 / 存成 PDF": "Print / Save PDF",
  "下载 Markdown": "Download Markdown",
  内容: "Content",
  模板: "Template",
  哪一张: "Which card",
  下载: "Download",
  "这张 SVG": "This SVG",
  "这张 PNG": "This PNG",
  "全部 SVG": "All SVG",
  "全部 PNG": "All PNG",
  纸页: "Paper",
  海报: "Poster",
  暖报: "Warm",
  暖纸: "Warm paper",
  "DeepSeek 用来拆解和查词。字幕优先用视频自己的；YouTube 没有原生字幕时再填 Supadata。":
    "DeepSeek is for splitting and looking up words. Captions come from the video first; add a Supadata key only if YouTube has no native CC.",
  "先填 DeepSeek Key。字幕优先用视频自己的。": "Add a DeepSeek key first. Captions come from the video when they can.",
  "先填 DeepSeek Key 并保存，再来复习。": "Save a DeepSeek key first, then come back to review.",
  测一下词汇量: "Estimate vocabulary",
  "认识这个词吗？": "Do you know this word?",
  认识: "I know it",
  不认识: "I don’t",
  大约的词汇量: "Rough vocabulary size",
  "按这个量筛字幕里可能还不熟的词。不是考试分数，随时能改。":
    "We’ll use this to flag words you may not know. It isn’t an exam score. You can change it later.",
  "不用写意思。认识就点认识，估一个大概的量。": "No need to define it. Tap if you know it. This estimates a range.",
  再测一次: "Try again",
  用这个水平: "Use this level",
  关掉: "Close",
  "已按测出的量设好词汇水平。": "Vocabulary level set from the test.",
  "词汇量测试还没准备好。": "The vocabulary test isn’t ready.",
  "划过的字会标在原文上。点时间跳到视频。": "Highlights sit on the original lines. Tap a time to jump.",
  处划线标在原文上: "highlights on the text",
  句: "lines",
  正文: "Text",
  "这篇 Obsidian": "This note → Obsidian",
  全部打包: "All notes zip",
  去阅读: "Go read",
  "先打开一支视频。": "Open a video first.",
  夜间: "Night",
  苔色: "Moss",
  外观: "Look",
  设置: "Settings",
  返回: "Back",
  "侧栏和卡片都跟着这套外观。": "The side panel and cards follow this look.",
  "侧栏和卡片都跟着这套外观。点一张就能看见。": "The side panel and cards follow this look. Tap a card to see it.",
  朱墨: "Ink",
  夜读: "Night",
  书页: "Folio",
  批注: "Margin",
  素笺: "Plain",
  黑板: "Slate",
  对照: "Split",
  做海报: "Make a poster",
  收起: "Close",
  "下载 PNG": "Download PNG",
  "下载 SVG": "Download SVG",
  已下载这张海报: "Poster downloaded",
  "换样子、写下理解，都在这张上。高度跟着文字长。":
    "Change the look and write your take on this card. Height grows with the text.",
  "这段特别长，字号已经缩小。还可再删一点。":
    "This is long, so the type shrank. You can still cut a little.",
  "这句对你来说是什么意思…会写进这张海报":
    "What does this line mean to you? It goes on the poster.",
  "KAIZEN · 读书笔记": "KAIZEN · reading note",
  "先生词，再导出卡片。": "Save a word first, then export a card.",
  "先写一句笔记。": "Write a note first.",
  "先抽出金句，或按 R 收下几句。": "Pull quotes first, or press R to keep a line.",
  上一张: "Previous",
  下一张: "Next",
  支撑: "Support",
  限制: "Limit",
  复原位置: "Reset layout",
  支撑: "Support",
  限制: "Limit",
  "拖开节点 · 点一下打开": "Drag nodes · tap to open",
  "可拖开节点。点一下打开，悬停看相连的边。": "Drag nodes apart. Tap to open, hover to see linked edges.",
  "可拖开节点。点中间走进下一层，字只出现在当前这一圈。": "Drag nodes apart. Tap the center to go one level in. Labels stay on this ring.",
  "论证图：上面是主张，左边支撑，右边限制。点卡片跳到对应知识块。":
    "Argument map: claim on top, support left, limits right. Tap a card to jump to its block.",
  跟读: "Shadow",
  停跟读: "Stop shadow",
  播放倍速: "Playback speed",
  正在跟读这一句: "Shadowing this line",
  正在跟读这一块: "Shadowing this block",
  "正在跟读第 {from}–{to} 句": "Shadowing lines {from}–{to}",
  "正在循环第 {from}–{to} 句": "Looping lines {from}–{to}",
  "听完空一拍，你再跟": "A beat of silence, then you say it",
  "这段在循环，没有空拍": "Looping this clip with no pause",
  空拍: "Gap",
  不停: "No gap",
  已停跟读: "Shadowing stopped",
  "先在字幕里划一段，或等这句对上字幕。": "Select a caption span first, or wait until this line maps.",
  "听完空一拍，你再跟。停了会回到原来的速度。": "A beat of silence, then you say it. Stopping restores the old speed.",
  "划一段再跟读。会自动降速，听完空一拍。": "Select a span, then shadow. Speed drops; a beat of silence follows.",
  "再按一次或 Esc 停": "Press again or Esc to stop",
  "划一段，跟读": "Select, then shadow",
  "影子跟读不用去视频页拧倍速。在字幕里划一段，点「跟读」：这段会循环，速度自动降下来，听完空一拍你再开口。上面也能随时改 0.5× 到 2×。":
    "Shadowing doesn’t need the video page’s speed menu. Select a caption span, tap Shadow: it loops, slows down, and leaves a beat for you to speak. You can also set 0.5×–2× up top anytime.",
  "正在循环。再按 A 或 Esc 停。": "Looping. Press A or Esc again to stop.",
  概念卡片: "Concept card",
  跳到字幕: "Jump to captions",
  看这块: "Open this block",
  循环这块: "Loop this block",
  关键词: "Keyword",
  条目: "Item",
  节点: "Node",
  中心: "Center",
  步骤: "Step",
  标题: "Title",
  点色块看概念卡片: "Tap a block to open its card",
  根: "Root",
  微信: "WeChat",
  点击复制微信号: "Tap to copy WeChat ID",
  作者的话: "A note from the author",
  "Kaizen 的意思是改善。改是看见自己的不足，就动手改。善是改完之后，往更好的方向去。":
    "Kaizen means improvement. 改 is seeing what you lack, then changing it. 善 is, after the change, moving toward better.",
  "念作 kai-zen。这个词本来是工厂和公司里的说法：不指望一次巨大的颠覆，而是每个人每天在手边的事上改一点，攒下来就是质的变化。":
    "Say it kai-zen. The word comes from factories and companies: don't wait for one huge overhaul. Everyone improves the work at hand a little, every day, until it adds up to a change in kind.",
  "我们看了太多内容，更多是在囤积，很少真正内化成自己的东西。":
    "We watch too much. Most of it is stockpiling, not making it our own.",
  "我们看了太多内容，更多是在囤积，很少真正变成自己的。Kaizen 把一部片子拆短，好让你真的吃进去。":
    "We watch too much. Most of it is stockpiling, not making it ours. Kaizen cuts a video short so you can actually take it in.",
  "做这个插件，是希望自己能打破语言的墙，也把一些深的、偏长的内容，拆成更容易懂的短块。":
    "I made this plugin to get past the language wall, and to cut deep, mid-to-long pieces into shorter ones that are easier to take in.",
  "希望大家不断地精进自己、改善自己。这个工具有什么好的建议，可以留言，也可以微信找我。":
    "I hope we keep refining ourselves. If you have a good suggestion for this tool, leave a note, or find me on WeChat.",
  留言: "Leave a note",
  查看留言: "See notes",
  "发到 GitHub": "Post to GitHub",
  复制去微信: "Copy for WeChat",
  复制全文: "Copy all",
  已复制全部字幕: "Copied all captions",
  "还没有字幕。": "No captions yet.",
  "写好后可以发到 GitHub，我在仓库 Issues 里看。不想公开就复制去微信。":
    "Send it to GitHub and I’ll see it in the repo Issues. If you’d rather keep it private, copy it to WeChat.",
  "哪里不好用，或想加什么…": "What’s awkward, or what you’d add…",
  "先写一句。": "Write a line first.",
  "已打开 GitHub。登录后点 Create，我就能在 Issues 里看到。":
    "GitHub is open. Sign in and hit Create, and I’ll see it in Issues.",
  "已复制。打开微信发给 942966642 即可。": "Copied. Send it on WeChat to 942966642.",
  搭子: "Buddy",
  我叫: "I go by",
  正在学什么: "What I’m learning",
  "比如一起看完这门课": "e.g. finish this course together",
  "导出给我的搭子": "Export for my buddy",
  "导入搭子进度": "Import buddy progress",
  "已导出给搭子。发给对方导入即可。": "Exported. Send the file so they can import it.",
  "这不是搭子进度文件。": "This is not a buddy progress file.",
  "已记下搭子的进度。": "Buddy progress saved.",
  "去掉这个搭子": "Remove this buddy",
  "还没有搭子。导出一份进度发给朋友，或导入对方的文件。":
    "No buddy yet. Export your progress for a friend, or import theirs.",
  "这版只能跟已经认识的人换进度，不能在网上匹配陌生人。匹配要另做服务器，笔记就会离开这台电脑。":
    "This version only swaps progress with people you already know. Matching strangers needs a server, and notes would leave this computer.",
  "文件里只有称呼、任务和进度，没有 Key，也没有笔记。":
    "The file has a name, a task, and watch progress—no keys, no notes.",
  "跟已经认识的人换一份进度。匹配陌生人要另做服务器，这版先不做。":
    "Swap a progress file with someone you know. Matching strangers needs a server; not in this version.",
  我这侧: "My side",
  支视频: "videos",
  支重叠: "in common",
  一起在看: "Watching together",
  "对方看过、你还没有": "They watched; you haven’t",
  看到: "at",
  "已记下。": "Saved.",
  "这份进度读不出来。": "Couldn’t read this progress file.",
  "发给认识的人，看对方看过哪些。": "Send it to people you know. See what they’ve watched.",
  邀请搭子: "Invite a buddy",
  再复制给朋友: "Copy for a friend again",
  离开: "Leave",
  去掉: "Remove",
  "怎么称呼你": "What should we call you",
  "整段贴在这里": "Paste the whole thing here",
  "朋友发来的口令": "A friend’s code",
  "还没有搭子。点邀请，发给微信。": "No buddy yet. Tap Invite, send it on WeChat.",
  "把口令发给朋友。对方贴上就能看到你看过哪些。":
    "Send the code to a friend. They paste it to see what you’ve watched.",
  "已复制，发给微信即可。": "Copied. Send it on WeChat.",
  "先把朋友发来的口令贴进来。": "Paste the code your friend sent.",
  "已加入。可以看到对方看过哪些。": "Joined. You can see what they’ve watched.",
  "这段口令读不出来。让对方再点一次邀请。": "Couldn’t read that code. Ask them to tap Invite again.",
  "已离开。": "Left.",
  "我的 Kaizen 口令": "My Kaizen code",
  "用 Kaizen 打开「库 → 搭子」，把口令贴上，就能看到我看过哪些。":
    "Open Kaizen → Library → Buddy, paste the code, and you’ll see what I’ve watched.",
  "用 Kaizen 打开「库 → 搭子」，把下面整段贴进去。":
    "Open Kaizen → Library → Buddy, and paste everything below.",
  "小组同步（选填，大众不用管）": "Group sync (optional, ignore this)",
  "提纲不够？重做": "Outline too thin? Redo",
  打开侧栏: "Open the side panel",
  收下这句: "Keep this line",
  记下: "Noted",
  "这支还没有能下的笔记。先划线、记下金句或写一句。":
    "This video has nothing to export yet. Highlight, note a line, or write a sentence first.",
  "还没有能导出的笔记。先划线、记下金句或写一句。":
    "Nothing to export yet. Highlight, note a line, or write a sentence first.",
  "这篇几乎是空的。先划线、记下金句或写一句，再请 AI 写成一篇。":
    "This page is almost empty. Highlight, note a line, or write a sentence first, then ask AI to write it up.",
  再听这句: "Hear this line again",
  记笔记: "Write a note",
  "点右上角 Kaizen 图标打开侧栏": "Open the side panel from the Kaizen icon at the top",
  "Kaizen 口令": "Kaizen code",
  复制口令: "Copy code",
  离开小组: "Leave group",
  创建口令: "Create a code",
  加入: "Join",
  "朋友给的口令": "A friend’s code",
  同步地址: "Sync URL",
  "同步地址（部署一次）": "Sync URL (deploy once)",
  "发给认识的人。对方加入后，这里能看到他看过哪些。":
    "Send it to people you know. After they join, you’ll see what they’ve watched.",
  "组里还没有别人。把口令发给朋友，对方加入后就能看到他看过哪些。":
    "Nobody else is in the group yet. Send the code; after they join you’ll see what they’ve watched.",
  "还没有小组。创建口令发给朋友，或加入他的口令。":
    "No group yet. Create a code for a friend, or join theirs.",
  "没有同步时，仍可复制进度": "No sync? You can still copy progress",
  支看过: "watched",
  你也看过: "you watched this too",
  "还没有看过的视频。": "No videos watched yet.",
  "先填同步地址。": "Add the sync URL first.",
  "口令没做成。": "Couldn’t create a code.",
  "已创建并复制口令。发给朋友即可。": "Code created and copied. Send it to a friend.",
  "已创建口令。": "Code created.",
  "口令不对。应是 Kaizen- 加四位。": "That code is off. It should be Kaizen- plus four characters.",
  "已加入。": "Joined.",
  "加不进去。": "Couldn’t join.",
  "已复制口令。": "Code copied.",
  "已离开小组。": "Left the group.",
  "还读不到小组。": "Couldn’t read the group.",
  "小组同步失败。": "Group sync failed.",
  导出生词: "Export vocab",
  全部生词: "All vocab",
  "生词本导出 Markdown": "Vocab as Markdown",
  重载扩展: "Reload extension",
  已导出生词: "Vocab exported",
  "已导出生词 Markdown。": "Vocab Markdown downloaded.",
  已导出金句: "Quotes exported",
  已导出笔记: "Notes exported",
  导出金句: "Export quotes",
  导出笔记: "Export notes",
  个生词: "words",
  条金句: "quotes",
  条笔记: "notes",
  "这篇还没有金句": "No quotes in this video yet",
  "这篇还没有笔记": "No notes in this video yet",
  "先打开一支视频，或至少留下一条笔记、金句、划线或生词。":
    "Open a video, or leave at least one note, quote, highlight, or word.",
  "Novak 层级图：上边一般、下边具体。点框看概念卡片，再跳到视频。":
    "Novak map: general on top, specific below. Tap a box for its card, then jump to the video.",
  "论证图：上面是主张，左边支撑，右边限制。点卡片看概念，再跳到视频。":
    "Argument map: claim on top, support left, limits right. Tap a card, then jump to the video.",
  "知识块和金句按时间排。点节点看卡片，再跳到视频。":
    "Blocks and quotes on a timeline. Tap a node for its card, then jump to the video.",
  "从中心散开。点知识块展开，再点卡片跳到视频。":
    "Branches from the center. Tap a block to expand, then use the card to jump.",
  "顶栏「导出」会打开当前视频的排版页。生词可以单独下 Markdown 或 Anki。下面是整机备份：笔记、生词、复习卡、知识库和设置（含 Key）。换电脑或重装前先导出。":
    "Top-bar Export opens this video’s layout page. Vocab can be downloaded on its own as Markdown or Anki. Below is a full backup: notes, vocab, cards, library, and settings (including keys). Export before switching computers.",
  本篇: "This video",
  这篇: "Here",
  打开这篇: "Open this video",
  去掉: "Drop",
  "搜词、例句、视频标题": "Search words, sentences, titles",
  "一本总生词本。点出处就能跳回那一支。": "One notebook for every video. Tap a source to jump back.",
  "只看这篇。同一词在别的视频出现过，点出处也能打开。":
    "Only this video. If the word showed up elsewhere, tap that source to open it.",
  "找不到这个词的出处。": "Can’t find where this word was saved.",
  "已记下这篇也出现过。": "Noted that it also appears here.",
  "已给 {n} 个词补上这篇出处": "Added this video to {n} words",
  "已存入 {n} 个词": "Saved {n} words",
  "已存入 {n} 个词，另有 {m} 个补了这篇出处": "Saved {n} words, and added this video to {m} more",
  "把 {n} 个生词做成复习卡": "Make {n} review cards",
  "没有对上的词。": "Nothing matches.",
  "这篇还没有生词。上面可以筛这篇，或看全部。":
    "No words saved from this video yet. Scan above, or switch to All.",
  "选中单词，点「存词」或「查词」。筛出来的也可以一键存入。":
    "Select a word, then Save or Look up. You can also save the scanned list in one tap.",
  今日: "Today",
  检验: "Check",
  去检验: "Go check",
  检验这些词: "Check these words",
  检验这个: "Check this",
  牌组: "Deck",
  去牌组: "Open deck",
  背这个: "Study this",
  "导出给 Anki": "Export for Anki",
  "生词本就是牌组。存进去的词会按间隔再见到，像 Anki。":
    "Vocab is the deck. Saved words come back on an interval, like Anki.",
  "一本总牌组。点出处就能跳回那一支。": "One deck for every video. Tap a source to jump back.",
  "选中单词，点「存词」或「查词」。筛出来的也可以一键存入。存进去就会按间隔再见到。":
    "Select a word, then Save or Look up. Scanned words can go in at once. Saved words come back on an interval.",
  "牌组还是空的。在阅读里点词存入，或到「牌组」筛这篇。":
    "The deck is empty. Save a word while reading, or scan this video in Deck.",
  "今天的生词背完了。牌组里共 {n} 个词，最近一张约 {d} 天后到期。":
    "Today’s words are done. {n} in the deck; the next card is due in about {d} days.",
  "在「笔记」里给金句、划线点「做成卡」。生词在「生词」里背。":
    "In Notes, turn quotes and highlights into cards. Words are studied in Vocab.",
  "在「笔记」里给金句、划线点「做成卡」。生词本已经是牌组，去「生词」背。":
    "In Notes, turn quotes and highlights into cards. Vocab is already a deck — study it in Vocab.",
  "今天的卡复习完了。共 {n} 张，最近的一张约 {d} 天后到期。":
    "Today’s cards are done. {n} cards; the next is due in about {d} days.",
  "做成的卡都在「全部」里。生词去「生词」。": "Made cards live in All. Words are in Vocab.",
  "金句和划线做成的卡在这里。生词去「生词」背。":
    "Quote and highlight cards live here. Study words in Vocab.",
  忘了: "Again",
  想起来了: "Good",
  太简单: "Easy",
  "10 分钟后再来": "back in 10 min",
  天后: "days",
  显示答案: "Show answer",
  跳到出处: "Jump to source",
  打开出处: "Open source",
  "先自己写，再对答案。对了按间隔往后排，错了十分钟后再来。":
    "Write first, then check. Right answers wait longer; misses come back in ten minutes.",
  "到期的词在「今日」翻卡。想现在验会不会，去「检验」自己写。":
    "Due words flip in Today. To see if you know them now, go to Check and write them yourself.",
  "选范围和题型。先自己写，再对答案。": "Pick a set and a question type. Write first, then check.",
  到期: "Due",
  两种都来: "Both kinds",
  看词写意思: "Word → meaning",
  看句子填空: "Sentence cloze",
  开始检验: "Start check",
  "现在没有到期的词。可以改用本篇或全部。": "Nothing is due. Try This video or All.",
  "这些词还缺释义或原句，先去查词再检验。": "These words still need a gloss or sentence. Look them up first.",
  "先写一点再对。": "Write something first.",
  写出挖空的词: "Type the missing word",
  写出这个词的意思: "Type what this word means",
  对了: "Right",
  还不会: "Not yet",
  你写的: "You wrote",
  对答案: "Check",
  不会: "Don’t know",
  换一套: "Change set",
  看结果: "See results",
  下一题: "Next",
  "{n} 个里对了 {m} 个。": "{m} of {n} right.",
  "这轮都会了。": "You knew this round.",
  再练错过的: "Retry misses",
  再来一轮: "Another round",
  可在顶栏补总分: "add a score up top",
  "按你的水平筛字幕里可能还不熟的词": "Scan captions for words above your level",
  "点顶栏「设词汇水平」，或在阅读页直接选四级、六级、雅思或托福。雅思/托福也可以填总分。":
    "Set your level in the top bar, or pick CET-4 / CET-6 / IELTS / TOEFL on the reader. IELTS and TOEFL can take a score.",
  "这篇的生词没筛出来。": "Couldn’t scan words in this video.",
  "按这个水平，这篇里没有明显超纲词。": "At this level, this video has no clear stretch words.",
  "正在筛…": "Scanning…",
  再筛一版: "Scan again",
  "筛这篇的生词": "Scan this video",
  全部存入生词本: "Save all to Vocab",
  存入: "Save",
  "打开一支有字幕的 YouTube 或 B 站，就开始。": "Open a YouTube or Bilibili video with captions to start.",
  "如果已经打开了视频，点一下那一页，或把链接贴在下面。":
    "If a video is already open, tap that page, or paste the link below.",
  "这边看见这些页，点一个就开始。": "These pages are open. Tap one to start.",
  "还没看到视频页。点一下 YouTube 或 B 站窗口，或把链接贴在下面。":
    "No video page yet. Click the YouTube or Bilibili window, or paste a link below.",
  或粘贴视频链接: "Or paste a video link",
  打开这支: "Open this",
  再找一次: "Look again",
  还没认出这支: "video not recognized yet",
  "这页还没认出正在播的视频。点一下播放，或把链接贴在下面。":
    "This page hasn’t shown which video is playing. Tap play, or paste the link below.",
  "这页还没认出视频。点一下播放，或把链接贴在下面。":
    "This page hasn’t shown the video yet. Tap play, or paste the link below.",
  "先贴一条 YouTube 或 B 站链接。": "Paste a YouTube or Bilibili link first.",
  "这不是一支能认的 YouTube 或 B 站链接。": "That doesn’t look like a YouTube or Bilibili video link.",
  "打不开这支。检查一下链接。": "Couldn’t open that. Check the link.",
  "已认出这支，正在打开字幕。": "This video is recognized. Opening captions.",
};

const I18N_EXTRA = {
  ja: {
    跟读: "シャドーイング",
    停跟读: "シャドーイング停止",
    播放倍速: "再生速度",
    空拍: "間",
    不停: "連続",
    已停跟读: "シャドーイングを止めました",
  },
  ko: {
    跟读: "쉐도잉",
    停跟读: "쉐도잉 중지",
    播放倍速: "재생 속도",
    空拍: "쉼",
    不停: "연속",
    已停跟读: "쉐도잉을 멈췄습니다",
  },
  es: {
    跟读: "Sombra",
    停跟读: "Parar sombra",
    播放倍速: "Velocidad",
    空拍: "Pausa",
    不停: "Sin pausa",
  },
  fr: {
    跟读: "Ombre",
    停跟读: "Arrêter l’ombre",
    播放倍速: "Vitesse",
    空拍: "Pause",
    不停: "Sans pause",
  },
  de: {
    跟读: "Shadowing",
    停跟读: "Shadowing stoppen",
    播放倍速: "Tempo",
    空拍: "Pause",
    不停: "Ohne Pause",
  },
};

function i18nPacks() {
  return globalThis.I18N_PACKS || {};
}

function normalizeLang(id) {
  const raw = String(id || "").trim();
  if (I18N_META[raw]) return raw;
  const lower = raw.toLowerCase().replace("_", "-");
  if (lower.startsWith("zh")) {
    if (/tw|hk|hant|mo/.test(lower)) return "zh-TW";
    return "zh-CN";
  }
  const short = lower.slice(0, 2);
  return I18N_META[short] ? short : "";
}

function detectLang() {
  const fromChrome = typeof chrome !== "undefined" ? chrome.i18n?.getUILanguage?.() : "";
  return normalizeLang(fromChrome || (typeof navigator !== "undefined" ? navigator.language : "") || "zh-CN") || "zh-CN";
}

function toTrad(text) {
  let out = String(text ?? "");
  for (const [s, tw] of I18N_TERM_TW) out = out.split(s).join(tw);
  return [...out].map((ch) => S2T_MAP.get(ch) || ch).join("");
}

function rebuildPhrases(lang) {
  const pack = i18nPacks()[lang] || {};
  const rows = Object.keys(pack)
    .filter((k) => k.length >= 2 && !/^[一二三四五六七八九十]$/.test(k))
    .sort((a, b) => b.length - a.length);
  i18nPhrases = new Map(rows.map((k) => [k, pack[k]]));
}

function phraseReplace(text, lang) {
  let out = String(text ?? "");
  if (!out || lang === "zh-CN") return out;
  if (!i18nPhrases.size) rebuildPhrases(lang);
  for (const [src, dst] of i18nPhrases) {
    if (out.includes(src)) out = out.split(src).join(dst);
  }
  return out;
}

function lookup(zh) {
  const src = String(zh ?? "");
  if (!src) return "";
  if (i18nLang === "zh-CN") return src;
  const packs = i18nPacks();
  if (packs[i18nLang]?.[src]) return packs[i18nLang][src];
  if (I18N_EXTRA[i18nLang]?.[src]) return I18N_EXTRA[i18nLang][src];
  if (i18nLang === "zh-TW") return toTrad(src);
  if (I18N_EXTRA_EN[src] && i18nLang === "en") return I18N_EXTRA_EN[src];
  if (packs.en?.[src]) return packs.en[src];
  if (I18N_EXTRA_EN[src]) return I18N_EXTRA_EN[src];
  const mixed = phraseReplace(src, packs[i18nLang] ? i18nLang : "en");
  if (mixed !== src) return mixed;
  return src;
}

function t(zh, vars) {
  let out = lookup(zh);
  if (vars && typeof vars === "object") {
    out = out.replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? "" : String(vars[key])));
  }
  return out;
}

function liveLabels(src) {
  return new Proxy(src, {
    get(obj, key) {
      if (typeof key === "symbol") return obj[key];
      const val = obj[key];
      return typeof val === "string" ? t(val) : val;
    },
  });
}

function currentLang() {
  return i18nLang;
}

function langMeta(id = i18nLang) {
  return I18N_META[id] || I18N_META["zh-CN"];
}

function applyDocLang(root) {
  const doc = root?.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc?.documentElement) return;
  const meta = langMeta();
  doc.documentElement.lang = meta.html;
  doc.documentElement.dir = meta.dir;
  doc.documentElement.dataset.uiLang = i18nLang;
}

function applyDomI18n(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope?.querySelectorAll) return;
  applyDocLang(scope);
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (el.hasAttribute("data-i18n-html")) el.innerHTML = t(key);
    else el.textContent = t(key);
  });
  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}

function fillLangPicker(host, lang = i18nLang) {
  if (!host || host === document.documentElement || host === document.body) return;
  const current = normalizeLang(lang) || i18nLang || "zh-CN";
  const meta = I18N_LANGS.find((item) => item.id === current) || I18N_LANGS[0];
  const chips = host.classList.contains("lang-picker-chips");
  const open = host.dataset.open === "1";
  host.classList.add("lang-picker");
  host.dataset.value = current;
  if (chips) {
    host.innerHTML = I18N_LANGS.map(
      (item) =>
        `<button type="button" class="lang-pick-opt${item.id === current ? " on" : ""}" data-lang-id="${item.id}">${item.native}</button>`,
    ).join("");
    return;
  }
  host.innerHTML = `<button type="button" class="lang-pick-btn" aria-haspopup="listbox" aria-expanded="${open}">${meta.native}</button>
    <div class="lang-pick-menu" role="listbox" ${open ? "" : "hidden"}>
      ${I18N_LANGS.map(
        (item) =>
          `<button type="button" class="lang-pick-opt${item.id === current ? " on" : ""}" role="option" data-lang-id="${item.id}">${item.native}</button>`,
      ).join("")}
    </div>`;
}

function setUiLang(lang) {
  i18nLang = normalizeLang(lang) || "zh-CN";
  rebuildPhrases(i18nLang === "zh-TW" ? "en" : i18nLang);
  applyDocLang();
  return i18nLang;
}

function aiLangLine(lang) {
  const name = langMeta(normalizeLang(lang) || "zh-CN").ai;
  return `\n\n对读者可见的文字用${name}写。JSON 字段名保持英文。专有名词可保留原文。`;
}

globalThis.I18N_LANGS = I18N_LANGS;
globalThis.t = t;
globalThis.liveLabels = liveLabels;
globalThis.currentLang = currentLang;
globalThis.langMeta = langMeta;
globalThis.detectLang = detectLang;
globalThis.normalizeLang = normalizeLang;
globalThis.setUiLang = setUiLang;
globalThis.applyDomI18n = applyDomI18n;
globalThis.fillLangPicker = fillLangPicker;
globalThis.aiLangLine = aiLangLine;
globalThis.toTrad = toTrad;
