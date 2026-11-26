"use strict";
/* キャラクター・技能・ステータス・立ち絵・能力カテゴリのデータ
   数値や画像を直すときは、このファイルだけを書き換える */

/* ===== データ ===== */
const D = [
 {ho:1, en:"Actor", kana:"アクター", mean:"俳優", pc:"Albert", pcKana:"アルバート", pl:"あらか", cn:"ポピーレッド", hex:"#ea5550", sex:"男", age:17, h:"177", weapon:"杖", range:["タッチ"], trait:"夜に弱い",
  notes:["面倒見はいい","かなりの自信家","何事にも堂々と","口調は芝居がかった大仰な感じ","APP10"]},
 {ho:2, en:"Bash", kana:"バッシュ", mean:"大騒ぎ", pc:"Bacchus", pcKana:"バッカス", pl:"威流", cn:"濡羽色", hex:"#222222", sex:"男", age:6, h:"120", weapon:"カットラス", range:["タッチ"], trait:"大切なもの",
  notes:["シャチモチーフ","自認キング"]},
 {ho:3, en:"Crescendo", kana:"クレッシェンド", mean:"次第に強く", pc:"Charlotte", pcKana:"シャルロッテ", pl:"あけり", cn:"サンシャインイエロー", hex:"#ffedab", sex:"女", age:14, h:"160", weapon:"戦輪", range:["3マス"], trait:"大切なもの",
  notes:["上から金→水色のロングツインテ","髪に花の装飾+カチューシャorリボン","好きな食べ物はチーズとケーキ。チーズケーキありがとう。"], song:{a:"田中琴葉 (CV.種田梨沙)", t:"朝焼けのクレッシェンド", u:"https://www.youtube.com/watch?v=2NSPm0IQwF4&list=RD2NSPm0IQwF4&start_radio=1"}},
 {ho:4, en:"Dedicate", kana:"デディケート", mean:"献身する", pc:"Diamond", pcKana:"ダイヤモンド", pl:"塩めかぶ", cn:"", hex:"#FF6438", sex:"男", age:17, h:"180", weapon:"弓", range:["5マス"], trait:"夜に弱い",
  notes:["背の高い女性口調の男。ファビュラス！"]},
 {ho:5, en:"Eye", kana:"アイ", mean:"目", pc:"Effy", pcKana:"エフィー", pl:"まにょ", cn:"", hex:"#b97583", sex:"女", age:6, h:"107", weapon:"クロスボウ", range:["5マス"], trait:"眼鏡をかけている",
  notes:["全力で末っ子仕草をやりたい所存。ｴﾌｨｰは愛称です。フルネーム「Euphemia(ユーフェミア)」"]},
 {ho:6, en:"Fool", kana:"フール", mean:"愚か者", pc:"Felici", pcKana:"フェリチ", pl:"風味鹿", cn:"オレンジか黄緑系統", hex:"#ffce94", sex:"女", age:14, h:"ちょっと小さめ", weapon:"弓", range:["5マス"], trait:"異性が苦手",
  notes:["あんまり喋らない→これ嘘になるかも、人見知りするし、けど人間観察は好き","モチーフはクリオネなんです信じてください"]},
 {ho:7, en:"Gravity", kana:"グラビティ", mean:"重力", pc:"Greg", pcKana:"グレッグ", pl:"ほのたま", cn:"", hex:"#162052", sex:"男", age:6, h:"110", weapon:"投擲(瓶・缶)", range:["3マス"], trait:"眼鏡をかけている",
  notes:["ずっと夜遅くまで本を読みふけっているぼんやりタイプ。自分の好きなことには高速早口になるし、一瞬で元気になるオタクタイプです。お兄ちゃんお姉ちゃんたちには喜んでついていきます"]},
 {ho:8, en:"Hero", kana:"ヒーロー", mean:"英雄", pc:"Harold", pcKana:"ハロルド", pl:"ねべに", cn:"クリムゾン", hex:"#dc143c", sex:"男", age:17, h:"205", weapon:"安全靴", range:["タッチ"], trait:"夜に弱い",
  notes:["でっけー身体でっけー声たっけーテンション。顔面や身体に傷跡がある。"]},
 {ho:9, en:"Invictus", kana:"インヴィクタス", mean:"負けざる者", pc:"Ira", pcKana:"アイラ", pl:"城原", cn:"ピーコックブルー", hex:"#1766AB", sex:"男", age:17, h:"151", weapon:"刺激物が入った瓶", range:["3マス"], trait:"寄せ餌",
  notes:["嘘つき◎","協調性×","腕っぷし×","船医","APP8"], song:{a:"TeddyLoid&Giga", t:"デスぺレート feat. LOLUET", u:"https://youtu.be/fItPD2iW5I0?si=gcFAUTS397M-1M_V"}},
 {ho:10, en:"Joker", kana:"ジョーカー", mean:"切り札", pc:"Jade", pcKana:"ジェイド", pl:"らの", cn:"ミントグリーン", hex:"#8DE5B4", sex:"男", age:15, h:"165", weapon:"投擲(投げナイフ)", range:["3マス"], trait:"大切なもの",
  notes:["瞳…翡翠色(ですが糸目にしたら見えなくなりました)","賭け事大好き","自由人","かっこつけたがり"]},
 {ho:11, en:"Knife", kana:"ナイフ", mean:"刃物", pc:"Kay", pcKana:"ケイ", pl:"天満", cn:"ラベンダー", hex:"#6a5acd", sex:"男", age:14, h:"190", weapon:"ナイフ", range:["タッチ"], trait:"動物に嫌われる",
  notes:["青髪(グラデにするかも)","黒かグレー目","APP5(仮)","厨二病(普通に話すこともできる)","右目右腕に包帯を巻いている"], song:{a:"JO1", t:"ANIMAL", u:"https://youtu.be/6KT1qP2OREo?si=edJGi6IThXHWyM91"}},
 {ho:12, en:"Love", kana:"ラヴ", mean:"愛", pc:"Lucette", pcKana:"リュセット", pl:"かつき", cn:"ルビー", hex:"#c70067", sex:"女", age:10, h:"146", weapon:"安全靴", range:["タッチ"], trait:"不思議ちゃん", notes:[]},
 {ho:13, en:"Mad", kana:"マッド", mean:"気が狂った", pc:"Merlin", pcKana:"マーリン", pl:"神崎春瀬", cn:"ラピスラズリ", hex:"#426AB3", sex:"男", age:16, h:"170", weapon:"スレッジハンマー", range:["タッチ"], trait:"不思議ちゃん",
  notes:["髪:白銀","眼:赤紫","肌:色白","自由奔放","黙ってさえいれば容姿端麗","APP18"], song:{a:"初星学園(倉本千奈・篠澤広・月村手毬)", t:"仮装狂騒曲", u:"https://youtu.be/VXB6ZBsrhPc?si=2AkzDgOSxOIX7Nxn"}},
 {ho:14, en:"Null", kana:"ヌル", mean:"何もない", pc:"Noreen", pcKana:"ノーリーン", pl:"カリン", cn:"バイオレット", hex:"#ee82ee", sex:"女", age:15, h:"", weapon:"弓", range:[], trait:"夜に弱い", notes:[]},
 {ho:15, en:"Ominous", kana:"オミナス", mean:"不吉な", pc:"O'Bannon", pcKana:"オバノン", pl:"リク", cn:"紫系", hex:"#af6ef1", sex:"女", age:14, h:"158", weapon:"", range:[], trait:"", notes:[]},
 {ho:16, en:"Period", kana:"ピリオド", mean:"終止符", pc:"Peridot", pcKana:"ペリドット", pl:"藍", cn:"ペリドット", hex:"#A9C52A", sex:"男", age:12, h:"162", weapon:"レイピア", range:["タッチ"], trait:"眼鏡をかけている",
  notes:["髪と瞳が黄緑(ペリドット)","大きな丸眼鏡をかけている","前髪が長め","自信なさげで","歴史書をよく読んでいる"]},
 {ho:17, en:"Quit", kana:"クィット", mean:"中止する", pc:"Quince", pcKana:"クインス", pl:"光龍", cn:"赤紫", hex:"#6b2b59", sex:"男", age:15, h:"152", weapon:"旗(投げ槍)", range:["3マス"], trait:"目つきが悪い", notes:[]},
 {ho:18, en:"Rally", kana:"ラリー", mean:"集会", pc:"Reef", pcKana:"リーフ", pl:"クロイル", cn:"水色", hex:"#D8E7F3", sex:"男", age:15, h:"153", weapon:"弓", range:["5マス"], trait:"動物に嫌われる",
  notes:["珊瑚礁モチーフ","感情表現が希薄","静か・おとなしめなタイプ","無表情寄り","APP10"]},
 {ho:19, en:"Stardust", kana:"スターダスト", mean:"星屑", pc:"Stella", pcKana:"ステラ", pl:"スオミ", cn:"黄色", hex:"#FCF16E", sex:"男", age:13, h:"163", weapon:"サーベル", range:["タッチ"], trait:"方向音痴",
  notes:["何事も前向き","負けず嫌い","喜怒哀楽がはっきりしている","APP12"]},
 {ho:20, en:"Treasure", kana:"トレジャー", mean:"宝物", pc:"Tiffany", pcKana:"ティファニー", pl:"れい", cn:"ティファニーブルー", hex:"#81CAC4", sex:"女", age:9, h:"135", weapon:"弓", range:["5マス"], trait:"大切なもの",
  notes:["イメカラ色のクラゲ髪型+サンタモチーフの頭飾り","お姉さんぶってるロリ","なのです口調","目指せ海のサンタさん"], song:{a:"花譜", t:"BLUE SIGNAL", u:"https://www.youtube.com/watch?v=YeQ-9dFrXI4"}},
 {ho:21, en:"Unbalance", kana:"アンバランス", mean:"不安定な", pc:"Unim", pcKana:"ウニム", pl:"カガリ", cn:"シーグリーン", hex:"#8AC75A", sex:"女", age:9, h:"119", weapon:"投擲(石)", range:["3マス"], trait:"眼鏡をかけている",
  notes:["頭に双葉🌱","眼鏡","語尾が〜だよ 〜なんだよ","髪:黄緑、目:赤と緑のオッドアイ"]},
 {ho:22, en:"Vortex", kana:"ヴォルテックス", mean:"旋風", pc:"Vivian", pcKana:"ヴィヴィアン", pl:"かつおみそ", cn:"青緑系", hex:"#26a69a", sex:"女", age:17, h:"", weapon:"", range:[], trait:"", notes:[]},
 {ho:23, en:"Wyrm", kana:"ウィルム", mean:"龍", pc:"Wawa", pcKana:"ワワ", pl:"光龍", cn:"茶色", hex:"#b57a6e", sex:"女", age:13, h:"145", weapon:"シャベル / 弓", range:["タッチ","5マス"], trait:"寄せ餌",
  notes:["お団子三つ編み","勝気(※死なば諸共含む)","精神の医務室常連","APP10"], song:{a:"和田たけあき", t:"オールイン・ワン", u:"https://youtu.be/erMpHZQVcF8?list=PLiFNg5fXiX32G3fNBC7U02t19zVkHAmdD"}},
 {ho:24, en:"Xerography", kana:"ゼログラフィー", mean:"複写技術", pc:"Xenon", pcKana:"ゼノン", pl:"しろ", cn:"カクタス", hex:"#387d39", sex:"女", age:16, h:"164", weapon:"大鎌", range:["タッチ"], trait:"不思議ちゃん",
  notes:["鴉モチーフ","口数は少なくマイペース","気になったものには黙々と没頭するタイプ","意外と好奇心旺盛","APP8"], song:{a:"結束バンド", t:"月並みに輝け", u:"https://youtu.be/anCp-VnUQtM?si=_OJ3e-Yi2LzhnmGO"}},
 {ho:25, en:"Yoke", kana:"ヨーク", mean:"束縛", pc:"Yunon", pcKana:"ユノン", pl:"びゃっか", cn:"多分赤系統", hex:"#f38181", sex:"男", age:10, h:"134", weapon:"鞭", range:["タッチ"], trait:"大切なもの",
  notes:["イカモチーフ"]},
 {ho:26, en:"Zombi", kana:"ゾンビ", mean:"死者蘇生", pc:"Zimelia", pcKana:"ジメリア", pl:"ぶーこ", cn:"ビビットピンク", hex:"#ff00ff", sex:"女", age:17, h:"173", weapon:"ギザ歯", range:["タッチ"], trait:"不思議ちゃん",
  notes:["白髪にインクをぶちまけてカラフル","緊張しいで人目恐怖症","叫び声がデカい","いつも腹を空かせている"], song:{a:"かいりきベア feat.初音ミク", t:"ルマ", u:"https://youtu.be/XfUao0_54yM?si=mSGTK6Bpm32ZnI3w"}}
];

/* 技能データ(戦闘,回避,医学,応急,目星,聞き耳,図書館,精神,水泳,機械,重機械,ナビ / "-"は未取得 / 空欄は記載なし) */
const SKL = ["戦闘","回避","医学","応急","精神","目星","聞き耳","図書館","水泳","機械","重機械","ナビ"]; // 表示順
const SKP = ["戦闘","回避","医学","応急","目星","聞き耳","図書館","精神","水泳","機械","重機械","ナビ"]; // 上のskの並び(データ取り込み用・変更不可)
const SKD = {
 1:{sk:"70,70,-,45,,,,65,60,-,-,61", hv:75, hn:"芸術(演劇)", m:"器用貧乏です…"},
 2:{sk:"70,78,-,-,,,,,75,-,-,70", hv:79, hn:"動物言語", m:"前線に出ても後衛に出ても大丈夫です！動物さんで矛と盾になります！！"},
 3:{sk:"60,77,-,-,,,,-,75,51,-,75", hv:79, hn:"芸術(歌唱)", m:"攻撃は砲、回復は才能でゴリ押し予定。Cは精神分析やってる暇はきっとないだろうの気持ち。"},
 4:{sk:"70,70,-,60,,,,71,70,-,-,78", hv:78, hn:"ナビゲート", m:"「庇う」＋反撃中心。"},
 5:{sk:"65,74,-,66,,,,-,70,50,-,60", hv:79, hn:"目星", m:"始めは後ろの方から、全開示出来たら長距離武器で後ろから支援かな…！と思ってます。"},
 6:{sk:"79,73,-,-,,,,79,75,70,71,-", hv:79, hn:"心理学", m:""},
 7:{sk:"66,76,-,-,,,,-,70,70,65,-", hv:79, hn:"物理学", m:"ナビを重機械に変更しました！ただちょっと弱いかもです…！"},
 8:{sk:"79,79,-,79,,,,-,77,-,-,-", hv:79, hn:"肉体戦闘技能", m:"ヒーラーも兼ねれるアタッカーにしました💪"},
 9:{sk:"79,79,79,79,,,,79,79,79,4,-", hv:79, hn:"医学", m:"死なないで医学しろってHOが言ってそうだったのでヒーラー極振りにしました"},
 10:{sk:"79,79,-,70,,,,61,79,-,-,70", hv:79, hn:"芸術(イカサマ)", m:"選択された能力次第で動きが変わるので、前線、サポートどちらにも回れるようにしています。"},
 11:{sk:"79,79,-,-,,,,-,79,79,75,-", hv:79, hn:"ナイフ", m:"能力で回復系が多かったので応急医学切ってます！"},
 12:{sk:"70,72,-,60,,,,36,75,30,-,70", hv:79, hn:"芸術(ダンス)", m:"精神分析持っていった方がいいのか…？"},
 13:{sk:"70,71,-,-,,,,61,75,60,-,70", hv:79, hn:"オカルト", m:"自己完結型"},
 14:{sk:"70,79,-,60,,,,71,65,60,-,75", ex:70, hv:79, hn:"夢見", m:"後方支援の予定です"},
 15:{sk:"70,79,-,79,,,,-,79,70,-,79", hv:79, hn:"隠す", m:"前衛後衛どっちでもいけます 保険は随時適用"},
 16:{sk:"65,66,-,75,,,,77,60,-,-,65", hv:79, hn:"歴史", m:"一定条件で歴史を攻撃として使用可能なため攻撃技能は低めです"},
 17:{sk:"", hn:"言いくるめ", m:""},
 18:{sk:"79,79,60,60,,,,-,70,-,-,45", hv:79, hn:"隠れる", m:"サポーターです"},
 19:{sk:"70,67,-,40,,,,-,70,58,60,1", hv:79, hn:"天文学", m:""},
 20:{sk:"70,79,-,70,45,40,25,36,75,-,71,-", hv:79, hn:"信用", m:"全体の技能振りのバランス見つつ応急/精神分析/重機械/機械修理どれかに偏らせたりできます"},
 21:{sk:"75,75,-,50,,,,-,75,-,-,70", hv:76, hn:"生物学", m:""},
 22:{sk:"", hn:"旋風", m:""},
 23:{sk:",,-,-,,,,,,,-,", hv:79, hn:"逆鱗", m:""},
 24:{sk:"70,79,-,-,70,40,60,78,79,30,11,70", hv:79, hn:"変装", m:"戦闘と医学応急は任せました･･･ヒーラー足りんかったら能力で技能値量産します"},
 25:{sk:"79,79,5,30,,,,79,79,79,,79", hv:70, hn:"錯糸", m:""},
 26:{sk:"79,75,,,,,,,55,70,,", hv:79, hn:"噛みつき", m:""}
};
D.forEach(d => {
  const x = SKD[d.ho] || {}, a = (x.sk || "").split(",");
  d.sk = SKP.map((l,i) => ({ l, v:(a[i] || "").trim() }));
  d.sk.sort((p,q) => SKL.indexOf(p.l) - SKL.indexOf(q.l)); // 表示順に並べ替え
  d.ex = x.ex ?? null; d.hv = x.hv ?? null; d.hn = x.hn || ""; d.sm = x.m || "";
});

/* 交渉技能(技能名と値。入力のあるHOのみ) */
const NEGO = {
  20:{n:"信用", v:79}, 1:{n:"説得", v:60}, 4:{n:"値切り", v:50}, 18:{n:"説得", v:49}, 11:{n:"値切り", v:45}, 24:{n:"説得", v:40},
  14:{n:"値切り", v:38}, 13:{n:"説得", v:35}, 12:{n:"説得", v:31}, 16:{n:"説得", v:30}, 19:{n:"説得", v:30}, 5:{n:"説得", v:25}
};
D.forEach(d => { d.nego = NEGO[d.ho] || null; });

/* ステータス(INI,STR,CON,POW,DEX,APP,SIZ,INT,EDU / INIは同じDEXの時の順番用) */
const STK = ["INI","STR","CON","POW","DEX","APP","SIZ","INT","EDU"];
const STD = {
 1:"13.95,10,9,15,13,10,15,17,11",
 2:"14.23,16,10,16,14,14,9,15,6",
 3:"11.78,11,13,16,11,15,11,15,8",
 4:"5.9,7,19,17,5,13,16,12,11",
 5:"17.38,12,14,19,17,14,8,10,6",
 6:"10.24,10,14,18,10,13,10,17,8",
 7:"18.75,11,10,17,18,12,8,18,6",
 8:"8.02,16,12,15,8,5,19,14,11",
 9:"12.92,9,18,19,12,8,9,14,11",
 10:"14.11,12,8,19,14,12,13,13,9",
 11:"16.95,15,15,15,16,5,18,8,8",
 12:"16.94,15,11,16,16,11,10,15,6",
 13:"10.49,13,10,17,10,18,12,10,10",
 14:"16.63,7,13,19,16,10,10,16,9",
 15:"14.31,13,14,15,14,9,12,15,8",
 16:"13.12,11,13,15,13,14,11,17,6",
 17:"11.84,13,12,15,11,17,12,10,9",
 18:"18.83,8,17,14,18,10,10,14,9",
 19:"11.47,13,14,17,11,12,12,14,7",
 20:"19.35,10,13,14,19,13,12,13,6",
 21:"15.66,9,12,18,15,14,9,17,6",
 22:"11.02,3,17,18,11,9,12,19,11",
 23:"3.05,16,19,12,3,10,18,15,7",
 24:"19.41,12,9,15,19,8,14,13,10",
 25:"19.02,15,13,15,19,5,10,17,6",
 26:"14.83,19,13,12,14,11,14,8,9"
};
D.forEach(d => {
  const a = (STD[d.ho] || "").split(",");
  d.st = {}; STK.forEach((k,i) => { const v = parseFloat(a[i]); d.st[k] = isNaN(v) ? null : v; });
});

/* ===== 立ち絵(カードの薄背景) =====
   u:画像URL / x:横位置(%) / z:拡大率。追加したいHOはここに足す。画像は外部リンクのまま読み込む */
const PORTRAITS = {
  1:{ u:"https://h.turbo.ccfolia-cdn.net/users/A0twnaw0g1XBMw98tuuB8iw3oov1/files/ab2ccef25faee35e91c63fe596e7ffdf36759ffc35f10741ea8c26ac8d39f380?t=1792909593421"  },
  2:{ u:"https://h.turbo.ccfolia-cdn.net/users/8bN61K4scHU3fcd6CjlkXIAtUif1/files/ddf3e893d384c5e31cb59cf0658a54441c707d492953c919eafe16e233f370e6?t=1793114435787"  },
  3:{ u:"https://h.turbo.ccfolia-cdn.net/users/ylhvK441icQhzaH043oNGYjeVaz2/files/3881c199052d5aeeae82eba549dabe2c8566d83abe1d469caaa29016c86d7c47?t=1793496307038"  },
  4:{ u:"https://h.turbo.ccfolia-cdn.net/users/XHuJau5RsfgqB1pzrUKM5MY8Zmh1/files/77dc748c75a5942b8b1b50e93448b78adf99cee8de1e722d84699bcfb758f476?t=1793431258567"  },
  5:{ u:"https://h.turbo.ccfolia-cdn.net/users/bOkBurjIeChK0ePkrtzDsxcsstc2/files/c308f5fc9ae7885fda8c0eaafff44ecf87663fe47119f425d43bc48631825c1b?t=1793366206319"  },
  6:{ u:"https://h.turbo.ccfolia-cdn.net/users/c2efTdZP72SU5flHbwRWHxdCBpE2/files/ea6d261a805d29a857fa19d5d916d03c445ae71fb6da1427a31e3bae06a8d06a?t=1792899222735"  },
  7:{ u:"https://h.turbo.ccfolia-cdn.net/users/a3KkC5k3ZEXngLOoAAxK4gJi8Kv2/files/4c32ab434f9bc4fba777a39c95e572f41a623453bbe30f50d3b3587d04b86501?t=1793494011369"  },
  9:{ u:"https://h.turbo.ccfolia-cdn.net/users/vpMB0tN9VMSCXJumeqKhyQLV9D83/files/97c9d3ccf3259aa1fcc0531b8da35e78209051cb80baa273154e028079d44a64?t=1793548268093" },
  10:{ u:"https://h.turbo.ccfolia-cdn.net/users/1ILkVlVG8aT1jss6FNBPqrRBFxa2/files/c9483f0661f4fa2dfe8977d2f9528b571bfb8a0f73851f2e51ced972f6bd13ad?t=1793472163229" },
  14:{ u:"https://h.turbo.ccfolia-cdn.net/users/GFtC9QilaLcMV5nffWeJgGUAr8N2/files/9a883c1adde255852b6e83500a07bc65ac1624e7d3c79114e482314b35101726?t=1793464537191" },
  15:{ u:"https://h.turbo.ccfolia-cdn.net/users/SVIDpHEbVJT2vPtEwJVNE5MYsTC3/files/b2f0a7407ba498c161d144213615a8c9c9513743ffdfd6387eede94267b3eeba?t=1790084306355" },
  16:{ u:"https://h.turbo.ccfolia-cdn.net/users/qFOcGcJ7cEaJx8bcj6Xjwf5YDAi1/files/8b60a1bb366d9c2d13da545b79679caa01c7d529c4ef876647420445010b0f42?t=1793441865672" },
  17:{ u:"https://h.turbo.ccfolia-cdn.net/users/SSPkIEvJHEYpXQ2t0KjnrvRkcvm1/files/d62a2dd5a788a57fa4a6ca0ada5c0ae4c553260c3819ccc0ffb4e4339e3bed44?t=1793004415477" },
  18:{ u:"https://h.turbo.ccfolia-cdn.net/users/ZHlNhXYwtjbOdHn5dYCltLehcJt1/files/740494a9848be513dbb023daeb072f5e2fc6f27e2b3620cd20a296ad3538cfa7?t=1792945126827" },
  20:{ u:"https://h.turbo.ccfolia-cdn.net/users/SCmPzbYIdsRdK88sWN3ZGY90jNH3/files/0a9524179d14942cff501b6a558a45a6ebc2377fdabcf2c328daf2702349cd58?t=1793453778737" },
  21:{ u:"https://h.turbo.ccfolia-cdn.net/users/y9ujUNkgQkOo97SEqVZq5B2P2C82/files/15f398eb76628319dba9c7cb6e57a879266ac8e3ee70acf0d2d66da403a04bbc?t=1793494643404" },
  23:{ u:"https://h.turbo.ccfolia-cdn.net/users/SSPkIEvJHEYpXQ2t0KjnrvRkcvm1/files/125967188f603fc8991551a51f13c16c70d3b9fb1a4a1d67177c4a7a6e6af6df?t=1792998488025" },
  24:{ u:"https://h.turbo.ccfolia-cdn.net/users/EN6FyRUYoOWXmHeVDNepBoZflBP2/files/144a79339ee1844090b3c25c55fb3db01e23aabfacc5417ae8cc522685bb67d7?t=1792900733960" },
  25:{ u:"https://h.turbo.ccfolia-cdn.net/users/nSQCdNYcdIN7qKeV598DSkb3F0O2/files/6d34c7adb69c99c2a5632196027af8e5a9929223865436527ea952878ba0e193?t=1793454040812" },
  26:{ u:"https://h.turbo.ccfolia-cdn.net/users/2JFJBlBqHRPoy9AVCJIHGjuHu983/files/b8ddd0139e5cfae3b20f4beda5a4b8f370b9d7c01d4de8ef36076cd53a8f6e25?t=1793493599065" }
};
D.forEach(d => { d.img = PORTRAITS[d.ho] || null; });


/* ===== 能力カテゴリ ===== */
const CATS = [
  {k:"atk", n:"アタッカー", e:"🔴", c:"#e5534b", ho:[2,8,11,22,23]},
  {k:"heal",n:"ヒーラー",   e:"🟢", c:"#3fb868", ho:[3,8,12,21,24]},
  {k:"buff",n:"バフ",       e:"🟡", c:"#f0c53a", ho:[6,7,13,15,18,19,20,24,26]},
  {k:"debf",n:"デバフ",     e:"🟣", c:"#a569e0", ho:[5,7,11,14,17,25]},
  {k:"tank",n:"タンク",     e:"🔵", c:"#4a8df0", ho:[2,4,9,23]},
  {k:"sp",  n:"特殊",       e:"⚫", c:"#111111", ho:[1,10,16]}
];
D.forEach(d => { d.cat = CATS.filter(c => c.ho.includes(d.ho)); });

/* 技能の初期値(技能値を振っていないときの値) */
const SKDEF = {"医学":5,"応急":30,"精神":1,"水泳":25,"機械":20,"重機械":1,"ナビ":10};
