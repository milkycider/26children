"use strict";
/* ポータルの動作。データは data.js、文章は content.js にある */
/* ===== 可変データ(SAN・不定の開始SAN・発狂中) =====
   FIREBASE_CONFIG を入れるとFirestoreで全員に同期。nullの間はこの端末のブラウザにだけ保存(動作確認用)。
   保存先: characters/HO<番号> = { san, base, insane, updatedAt } (san/baseは0〜99の整数かnull) */
// Firebaseの設定は firebase-config.js に書く(このHTMLを差し替えても設定は消えない)
const FB_VER = "10.14.1";
const live = {};                       // { ho: { san, base, insane } }
let liveMode = "local";                // "local" | "connecting" | "firestore" | "error"
let fbSave = null, fbCtx = null, fbAuth = null, myUser = null, rpError = false, bdError = false, authError = false, myUid = null;
const LIVE_KEY = "roado-live-v1";
const liveOf = ho => live[ho] || (live[ho] = { san:null, base:null, insane:false, hp:null, hpMax:null, mp:null, mpMax:null });
const LIVE_MAX = { san:99, base:99, hp:999, hpMax:999, mp:999, mpMax:999 };   // 各項目の上限(0〜上限の整数)
const indOf = base => (base === null || base === undefined) ? null : base - Math.ceil(base / 5);   // 不定ライン = 開始時SAN − その1/5(端数切り上げ)。SANがこの値以下になると不定
const toVal = (v, max = 99) => { if(v === "" || v === null || v === undefined) return null; const n = Math.round(Number(v)); return isNaN(n) ? null : Math.max(0, Math.min(max, n)); };
try { const o = JSON.parse(localStorage.getItem(LIVE_KEY) || "{}"); Object.keys(o).forEach(k => Object.assign(liveOf(+k), o[k])); } catch(e){}
function persistLocal(){ try { localStorage.setItem(LIVE_KEY, JSON.stringify(live)); } catch(e){} }
/* HP・MPの現在値に応じた表示: 空欄=通常 / 最大より減っている=現在値が青字 / 最大の1/2以下=黄 / 1/4以下=赤 / 0=灰。最大が空欄のときは初期値(HP=(CON+SIZ)/2切り上げ, MP=POW)で判定 */
function hmInfo(d, kind){
  const L = liveOf(d.ho), cur = kind === "hp" ? L.hp : L.mp;
  const max = (kind === "hp" ? L.hpMax : L.mpMax) ?? (kind === "hp" ? Math.ceil(((d.st.CON ?? 0) + (d.st.SIZ ?? 0)) / 2) : (d.st.POW ?? 0));
  return { cur, max };
}
function hmLevel(d, kind){
  const { cur, max } = hmInfo(d, kind);
  if(cur === null || !(max > 0)) return "";
  if(cur <= 0) return "z";
  const r = cur / max;
  return r <= 0.25 ? "c" : r <= 0.5 ? "w" : "";
}
const hmDec = (d, kind) => { const { cur, max } = hmInfo(d, kind); return cur !== null && max > 0 && cur < max; };
const anyHurt = () => state.hurtHp || state.hurtMp;
const isHurt = d => (state.hurtHp && hmDec(d, "hp")) || (state.hurtMp && hmDec(d, "mp"));   // 両方ONなら「どちらかが減っている」
const pairCls = (d, kind) => "pair" + (hmLevel(d, kind) ? " lvl-" + hmLevel(d, kind) : "") + (hmDec(d, kind) ? " dec" : "");
/* 「減っている人のみ」: 行は全員ぶん描画しておき、減っていない行だけ隠す(編集モード中は行が消えないよう更新しない) */
function syncHurt(force){
  if(!anyHurt() || state.page !== "skills" || (state.edit && !force)) return;
  let n = 0;
  document.querySelectorAll("tbody tr[data-ho]").forEach(tr => {
    const d = D.find(x => x.ho === +tr.dataset.ho), h = !!d && isHurt(d);
    tr.hidden = !h; if(h) n++;
  });
  const c = document.getElementById("count"); if(c) c.textContent = n;
}
function applyLive(ho){
  const L = liveOf(ho);
  document.querySelectorAll(`[data-lv][data-ho="${ho}"]`).forEach(el => {
    const k = el.dataset.lv;
    if(k === "insane") el.checked = !!L.insane;
    else if(document.activeElement !== el){
      if(k === "base"){ const t = indOf(L.base); el.value = t === null ? "" : t; }   // 不定欄は計算後の閾値を表示
      else el.value = L[k] === null ? "" : L[k];
    }
  });
  const d0 = D.find(x => x.ho === ho);
  if(d0) document.querySelectorAll(`.pair[data-ho="${ho}"]`).forEach(el => { el.className = pairCls(d0, el.dataset.kind); });
  const tr = document.querySelector(`tr[data-ho="${ho}"]`); if(tr) tr.classList.toggle("insane", !!L.insane);
}
function setLive(ho, patch, remote){
  Object.assign(liveOf(ho), patch);
  applyLive(ho);
  syncHurt();
  if(remote) return;
  if(liveMode === "firestore" && fbSave) fbSave(ho, patch); else persistLocal();
}
function liveStatusHtml(){
  const t = { local:"DB未接続", connecting:"DB接続中…", firestore:"DB同期中", error:"DB接続エラー" }[liveMode];
  const tip = { local:"DBに接続していないため、入力した値はこの端末だけに保存されます", connecting:"DBに接続しています", firestore:"入力した値は全員に反映されます", error:"DBに接続できませんでした。入力した値はこの端末だけに保存されます" }[liveMode];
  return `<span class="lvstat ${liveMode}" id="lvstat" title="${tip}">${t}</span>`;
}
function setLiveMode(m){ liveMode = m; if(typeof drawLogin === "function") drawLogin(); const el = document.getElementById("lvstat"); if(el){ el.outerHTML = liveStatusHtml(); } }
async function initFirebase(){
  let cfg = null;
  try { cfg = (typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG) || (typeof firebaseConfig !== "undefined" && firebaseConfig) || null; } catch(e){}
  if(!cfg) return;
  setLiveMode("connecting");
  try {
    const base = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
    const [{ initializeApp }, fs, au] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js")]);
    const app = initializeApp(cfg), db = fs.getFirestore(app);
    fbCtx = { fs, db };
    const auth = au.getAuth(app);                         // 匿名認証: 端末ごとに見えないIDが振られる(掲示板の「自分の投稿」の判定に使う)
    fbAuth = { au, auth };
    au.onAuthStateChanged(auth, u => {
      myUid = u ? u.uid : null;
      const pd = u && u.providerData && u.providerData[0];
      myUser = u && !u.isAnonymous ? { email:u.email || (pd && pd.email) || "", name:u.displayName || (pd && pd.displayName) || "" } : null;   // Googleでログイン中
      if(!u) au.signInAnonymously(auth).then(() => { authError = false; }).catch(() => { authError = true; drawBoard(); });   // 初回・匿名アカウントの自動削除後・ログアウト後は匿名で入り直す
      drawLogin(); drawBoard(); drawReports();
    });
    fbSave = (ho, patch) => fs.setDoc(fs.doc(db, "characters", "HO" + ho), { ...patch, updatedAt:fs.serverTimestamp() }, { merge:true })
      .catch(() => setLiveMode("error"));
    fs.onSnapshot(fs.collection(db, "characters"), snap => {
      setLiveMode("firestore");
      snap.docChanges().forEach(ch => {
        const ho = parseInt(ch.doc.id.replace("HO", ""), 10); if(!ho) return;
        const x = ch.doc.data();
        setLive(ho, { san:toVal(x.san), base:toVal(x.base), insane:!!x.insane, hp:toVal(x.hp, 999), hpMax:toVal(x.hpMax, 999), mp:toVal(x.mp, 999), mpMax:toVal(x.mpMax, 999) }, true);
      });
    }, () => setLiveMode("error"));
    fs.onSnapshot(fs.collection(db, "reports"), snap => {
      rpError = false;
      reports = snap.docs.map(q => { const x = q.data({ serverTimestamps:"estimate" }), ms = t => (t && t.toMillis) ? t.toMillis() : null;
        return { id:q.id, ho:x.ho | 0, cat:x.cat || "", text:x.text || "", name:x.name || "", done:!!x.done, at:ms(x.createdAt) ?? Date.now(), doneAt:ms(x.doneAt) }; });
      drawReports();
    }, () => { rpError = true; drawReports(); });
    fs.onSnapshot(fs.collection(db, "posts"), snap => {
      bdError = false;
      const ms = t => (t && t.toMillis) ? t.toMillis() : null;
      posts = snap.docs.map(q => { const x = q.data({ serverTimestamps:"estimate" });
        return { id:q.id, parent:x.parent || null, cat:x.cat || "", title:x.title || "", url:x.url || "", text:x.text || "", name:x.name || "", hos:normHos(x), uid:x.uid || "", deleted:!!x.deleted, spoiler:!!x.spoiler, at:ms(x.createdAt) ?? Date.now(), editedAt:ms(x.editedAt) }; });
      drawBoard();
    }, () => { bdError = true; drawBoard(); });
  } catch(e){ setLiveMode("error"); }
}
document.addEventListener("input", e => {      // 数字以外は入れさせない(全角数字は半角に)
  const el = e.target; if(!el.dataset || !el.dataset.lv || el.type !== "text") return;
  const v = el.value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\D/g, "");
  if(v !== el.value) el.value = v;
});
/* 不定欄: 表示は閾値。クリックで「開始時SAN」に切り替わり、確定すると新しい閾値に戻る */
document.addEventListener("focusin", e => {
  const el = e.target; if(!el.dataset || el.dataset.lv !== "base" || el.disabled) return;
  const L = liveOf(+el.dataset.ho); el.value = L.base === null ? "" : L.base; el.classList.add("raw"); el.select();
});
document.addEventListener("focusout", e => {
  const el = e.target; if(!el.dataset || el.dataset.lv !== "base") return;
  const t = indOf(liveOf(+el.dataset.ho).base); el.value = t === null ? "" : t; el.classList.remove("raw");
});
document.addEventListener("change", e => {
  const el = e.target; if(!el.dataset || !el.dataset.lv) return;
  const ho = parseInt(el.dataset.ho, 10), k = el.dataset.lv;
  if(k === "insane") setLive(ho, { insane:el.checked });
  else {
    const v = toVal(el.value, LIVE_MAX[k]); setLive(ho, { [k]:v });
    if(k === "base"){ const t = indOf(v); el.value = t === null ? "" : t; } else el.value = v === null ? "" : v;
  }
});
document.addEventListener("keydown", e => { if(e.key === "Enter" && e.target.dataset && e.target.dataset.lv && e.target.type === "text") e.target.blur(); });

/* ===== 不具合報告 =====
   保存先: reports/<自動ID> = { ho(0=全体), cat, text, name, done, createdAt, doneAt }
   「修正済み」は一方通行(未対応→修正済みのみ)。戻すときはFirebaseコンソールで done を false に直す */
const RP_KEY = "roado-reports-v1", RP_NAME = "roado-rpname-v1";
const ADMIN_LIST = (() => { try { return typeof ADMIN_UIDS !== "undefined" && Array.isArray(ADMIN_UIDS) ? ADMIN_UIDS : []; } catch(e){ return []; } })();   // 管理者ID(firebase-config.js の ADMIN_UIDS)
const useFs = () => liveMode === "firestore" && !!fbCtx;
const isAdmin = () => !useFs() || ADMIN_LIST.includes(myUid);
const getName = () => { try { return localStorage.getItem(RP_NAME) || ""; } catch(e){ return ""; } };
const setName = n => { try { localStorage.setItem(RP_NAME, n); } catch(e){} };
let reports = [];
try { reports = JSON.parse(localStorage.getItem(RP_KEY) || "[]"); } catch(e){}
const persistReports = () => { try { localStorage.setItem(RP_KEY, JSON.stringify(reports)); } catch(e){} };
async function addReport(r){
  if(liveMode === "firestore" && fbCtx){
    await fbCtx.fs.addDoc(fbCtx.fs.collection(fbCtx.db, "reports"), { ho:r.ho, cat:r.cat, text:r.text, name:r.name, done:false, createdAt:fbCtx.fs.serverTimestamp() });
  } else {
    reports.unshift({ id:"L" + Date.now(), ...r, done:false, at:Date.now(), doneAt:null });
    persistReports(); drawReports();
  }
}
async function markReportDone(id){
  if(liveMode === "firestore" && fbCtx){
    await fbCtx.fs.updateDoc(fbCtx.fs.doc(fbCtx.db, "reports", id), { done:true, doneAt:fbCtx.fs.serverTimestamp() });
  } else {
    const x = reports.find(y => y.id === id);
    if(x){ x.done = true; x.doneAt = Date.now(); persistReports(); drawReports(); }
  }
}
const fmtTime = ms => { if(!ms) return ""; const t = new Date(ms), z = n => String(n).padStart(2, "0"); return (t.getMonth() + 1) + "/" + t.getDate() + " " + z(t.getHours()) + ":" + z(t.getMinutes()); };
function reportCard(r, done){
  const d = D.find(x => x.ho === r.ho);
  const who = d ? "HO" + d.ho + " " + d.pc : "全体";
  const col = d ? accent(d) : "#7aa5b8";
  return `<article class="rp${done ? " done" : ""}" style="--c:${esc(col)}">
    <div class="rp-head"><span class="rp-ho">${esc(who)}</span><span class="rp-cat">${esc(r.cat)}</span><span class="rp-meta">${esc(r.name || "名無し")} ・ ${fmtTime(r.at)}</span></div>
    <p class="rp-text">${esc(r.text)}</p>
    ${done ? `<div class="rp-ok">✓ 修正済み ${fmtTime(r.doneAt)}</div>` : isAdmin() ? `<button class="btn rp-btn" data-rdone="${esc(r.id)}">修正済みにする</button>` : ""}
  </article>`;
}
function drawReports(){
  const open = reports.filter(r => !r.done).sort((a, b) => b.at - a.at);
  const done = reports.filter(r => r.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const b = document.getElementById("rbadge"); if(b){ b.textContent = open.length; b.hidden = !open.length; }
  const o = document.getElementById("rp-open"); if(!o) return;
  o.innerHTML = open.length ? open.map(r => reportCard(r, false)).join("") : '<div class="rp-empty">未対応の報告はありません</div>';
  document.getElementById("rp-done").innerHTML = done.length ? done.map(r => reportCard(r, true)).join("") : '<div class="rp-empty">まだありません</div>';
  document.getElementById("rp-n-open").textContent = open.length;
  document.getElementById("rp-n-done").textContent = done.length;
  const er = document.getElementById("rp-err"); if(er) er.hidden = !rpError;
  const idl = document.getElementById("rp-uid");
  if(idl){
    if(!useFs() || !fbAuth) idl.innerHTML = "";
    else if(myUser) idl.innerHTML = `ログイン中のID: ${esc(myUid || "")}${isAdmin() ? " (管理者)" : ""}`;
    else idl.innerHTML = "";
  }
}
const rpPh = c => c === "掲示板の削除依頼"
  ? "例: 掲示板の「○○」というタイトルの投稿(11/25ごろ・お名前○○で投稿)を削除してください。返信の場合は、どのスレッドへの返信かも書いてください"
  : "例: ステータスの○○が、正しくは△△です / スマホで○○を押すと表示が崩れます";
document.addEventListener("change", e => { if(e.target.id === "rp-cat"){ state.rpCat = e.target.value; const t = document.getElementById("rp-text"); if(t) t.placeholder = rpPh(state.rpCat); } });
function reportsHtml(){
  const nm = getName();
  const sel = state.rpHo ?? 0;
  const hos = `<option value="0">全体・その他</option>` + D.map(d => `<option value="${d.ho}"${d.ho === sel ? " selected" : ""}>HO${d.ho} ${esc(d.pc)}</option>`).join("");
  const cats = RP_CATS.map(c => `<option${state.rpCat === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  return `<div class="hcard rp-form">
    <h2>不具合報告</h2>
    <p class="hdesc">データの間違いや、表示・動作のおかしいところに気づいたら、ここから知らせてください。データなら正しい値、表示・動作なら使っている端末(スマホ/PC)と操作を書いてもらえると助かります。</p>
    <div class="rp-row">
      <label>対象<select id="rp-ho">${hos}</select></label>
      <label>項目<select id="rp-cat">${cats}</select></label>
      <label>お名前(任意)<input id="rp-name" maxlength="20" value="${esc(nm)}" autocomplete="off"></label>
    </div>
    <textarea id="rp-text" maxlength="500" rows="4" placeholder="${rpPh(state.rpCat)}"></textarea>
    <div class="rp-act"><button class="btn rp-send" id="rp-send">送信</button><span id="rp-msg" role="status"></span>${liveStatusHtml()}</div>
    <div class="rp-err" id="rp-err" hidden>報告の読み込みに失敗しました(Firestoreのルールに reports が入っているか確認してください)。</div>
  </div>
  <div class="hcard rp-list"><h3>未対応 <b id="rp-n-open">0</b></h3><div id="rp-open"></div></div>
  <div class="hcard rp-list rp-donebox"><h3>修正済み <b id="rp-n-done">0</b></h3><div id="rp-done"></div></div>
  <p class="rp-uid" id="rp-uid"></p>`;
}
document.addEventListener("click", async e => {
  const t = e.target;
  if(t.closest && t.closest("#rp-send")){
    const btn = t.closest("#rp-send"), msg = document.getElementById("rp-msg");
    const text = document.getElementById("rp-text").value.trim();
    const name = document.getElementById("rp-name").value.trim().slice(0, 20);
    const say = (m, bad) => { msg.textContent = m; msg.className = bad ? "bad" : "ok"; };
    if(!text){ say("内容を入力してください", true); return; }
    btn.disabled = true;
    try {
      await addReport({ ho:parseInt(document.getElementById("rp-ho").value, 10) || 0, cat:document.getElementById("rp-cat").value, text:text.slice(0, 500), name });
      setName(name);
      document.getElementById("rp-text").value = "";
      say("送信しました。ありがとうございます", false);
    } catch(err){ say("送信に失敗しました。時間をおいてもう一度試してください", true); }
    btn.disabled = false;
    setTimeout(() => { const m = document.getElementById("rp-msg"); if(m) m.textContent = ""; }, 5000);
    return;
  }
  const dn = t.closest && t.closest("[data-rdone]");
  if(dn){
    if(!dn.dataset.armed){                          // 1回目: 確認表示(誤タップ防止) / 2回目: 確定
      dn.dataset.armed = "1"; dn.textContent = "もう一度押すと修正済みになります"; dn.classList.add("armed");
      setTimeout(() => { if(dn.isConnected){ delete dn.dataset.armed; dn.textContent = "修正済みにする"; dn.classList.remove("armed"); } }, 4000);
      return;
    }
    dn.disabled = true;
    try { await markReportDone(dn.dataset.rdone); } catch(err){ dn.disabled = false; dn.textContent = "失敗しました(もう一度)"; delete dn.dataset.armed; }
  }
});

/* ===== 掲示板(PL向け) =====
   保存先: posts/<自動ID> = { parent(null=スレッド/文字列=返信先), cat, title, url, text, name, ho, uid, deleted, createdAt }
   削除は「中身を空にして deleted:true にする」方式(返信が付いたスレッドも壊れない)。自分の投稿だけ消せる */
const BD_KEY = "roado-board-v1";
let posts = [];
try { posts = JSON.parse(localStorage.getItem(BD_KEY) || "[]"); } catch(e){}
/* 関連HO: hos = HO番号の一覧(1〜26) / 27 = その他 / 空 = なし。古い形式(ho:1つ)も読めるようにしておく */
const BD_OTHER = 27;
const normHos = x => Array.isArray(x.hos) ? [...new Set(x.hos.map(n => n | 0).filter(n => n >= 1 && n <= BD_OTHER))].sort((a, b) => a - b) : (x.ho ? [x.ho | 0] : []);
posts = posts.map(p => ({ ...p, hos:normHos(p) }));
const hoLabel = n => { if(n === BD_OTHER) return "その他"; const d = D.find(x => x.ho === n); return d ? "HO" + d.ho + " " + d.pc : ""; };
const hoTag = n => { const d = D.find(x => x.ho === n); return `<span class="bd-ho"${d ? ` style="--c:${esc(accent(d))}"` : ""}>${esc(hoLabel(n))}</span>`; };
const persistPosts = () => { try { localStorage.setItem(BD_KEY, JSON.stringify(posts)); } catch(e){} };
const localUid = (() => { try { let u = localStorage.getItem("roado-uid"); if(!u){ u = "L" + Math.random().toString(36).slice(2, 12); localStorage.setItem("roado-uid", u); } return u; } catch(e){ return "L-temp"; } })();
const curUid = () => useFs() ? myUid : localUid;
const bdDrafts = {};
const safeUrl = u => { try { const x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : ""; } catch(e){ return ""; } };
const SITES = [[/(^|\.)fusetter\.com$/, "ふせったー"], [/(^|\.)pixiv\.net$/, "pixiv"], [/(^|\.)(x|twitter)\.com$/, "X"], [/(^|\.)privatter\.net$/, "Privatter"],
  [/(^|\.)poipiku\.com$/, "ポイピク"], [/(^|\.)bsky\.app$/, "Bluesky"], [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"], [/(^|\.)booth\.pm$/, "BOOTH"]];
const siteOf = u => { try { const h = new URL(u).hostname.replace(/^www\./, ""); const m = SITES.find(x => x[0].test(h)); return m ? m[1] : h; } catch(e){ return ""; } };
async function addPost(p){
  if(useFs()){
    if(!myUid) throw new Error("noauth");
    await fbCtx.fs.addDoc(fbCtx.fs.collection(fbCtx.db, "posts"), { ...p, uid:myUid, deleted:false, createdAt:fbCtx.fs.serverTimestamp() });
  } else {
    posts.push({ id:"L" + Date.now() + Math.random().toString(36).slice(2, 6), ...p, uid:localUid, deleted:false, at:Date.now() });
    persistPosts(); drawBoard();
  }
}
async function editPost(id, patch){
  if(useFs()) await fbCtx.fs.updateDoc(fbCtx.fs.doc(fbCtx.db, "posts", id), { ...patch, editedAt:fbCtx.fs.serverTimestamp() });
  else { const x = posts.find(y => y.id === id); if(x){ Object.assign(x, patch, { editedAt:Date.now() }); persistPosts(); drawBoard(); } }
}
let bdEdit = null;   // 編集中の下書き { id, reply, cat, title, url, text, hos }
async function delPost(id){
  const blank = { deleted:true, title:"", text:"", url:"" };
  if(useFs()) await fbCtx.fs.updateDoc(fbCtx.fs.doc(fbCtx.db, "posts", id), blank);
  else { const x = posts.find(y => y.id === id); if(x){ Object.assign(x, blank); persistPosts(); drawBoard(); } }
}
function postMeta(p){
  const mine = p.uid && p.uid === curUid() && !p.deleted;
  const ed = p.editedAt && !p.deleted ? ` <span class="bd-edited" title="${esc(fmtTime(p.editedAt))}に編集">(編集済み)</span>` : "";
  return `<span class="rp-meta">${esc(p.name || "名無し")} ・ ${fmtTime(p.at)}${ed}${mine && state.editId !== p.id ? `<button class="bd-del" data-bdedit="${esc(p.id)}">編集</button><button class="bd-del" data-bddel="${esc(p.id)}">削除</button>` : ""}</span>`;
}
/* 長い本文は折りたたむ(140文字超 または 6行超)。開いた投稿は再描画しても開いたまま */
const FOLD_CHARS = 140, FOLD_LINES = 6;
const bdOpen = new Set();
function bodyHtml(p){
  const t = p.text || ""; if(!t) return "";
  const lines = t.split("\n"), long = t.length > FOLD_CHARS || lines.length > FOLD_LINES;
  if(!long) return `<p class="rp-text">${esc(t)}</p>`;
  if(bdOpen.has(p.id)) return `<p class="rp-text">${esc(t)}</p><button class="lnk bd-fold" data-bdfold="${esc(p.id)}">折りたたむ ▴</button>`;
  const short = lines.slice(0, FOLD_LINES).join("\n").slice(0, FOLD_CHARS).replace(/\s+$/, "");
  return `<p class="rp-text">${esc(short)}…</p><button class="lnk bd-fold" data-bdfold="${esc(p.id)}">続きを読む ▾</button>`;
}
function editFormHtml(p){
  const e = bdEdit;
  const act = `<div class="rp-act"><button class="btn rp-send" data-bdesave="${esc(p.id)}">保存する</button><button class="btn" data-bdecancel="1">やめる</button><span id="bd-emsg"></span></div>`;
  if(e.reply) return `<div class="bd-eform"><input data-bde="title" maxlength="80" placeholder="タイトル(任意)" autocomplete="off" value="${esc(e.title)}" class="bd-rurl"><input data-bde="url" type="url" maxlength="500" placeholder="URL(任意)" autocomplete="off" value="${esc(e.url)}" class="bd-rurl"><textarea data-bde="text" maxlength="1000" rows="3" placeholder="返信(URLだけでもOK)">${esc(e.text)}</textarea><label class="bd-rspl"><input type="checkbox" data-bde="spoiler"${e.spoiler ? " checked" : ""}> ネタバレを含む</label>${act}</div>`;
  const cats = BD_CATS.map(c => `<option${e.cat === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  const chips = [0, ...D.map(d => d.ho), BD_OTHER].map(n => {
    const d = D.find(x => x.ho === n), on = n === 0 ? !e.hos.length : e.hos.includes(n);
    return `<button type="button" class="chip bd-hoc" data-bdeho="${n}"${d ? ` style="--c:${esc(accent(d))}"` : ""} aria-pressed="${on}">${n === 0 ? "なし" : esc(hoLabel(n))}</button>`;
  }).join("");
  const p0 = posts.find(x => x.id === e.id) || {};
  return `<div class="bd-eform bd-eroot">
    <div class="rp-row">
      <label>種類<select data-bde="cat">${cats}</select></label>
      <label class="bd-spl"><span>&nbsp;</span><span><input type="checkbox" data-bde="spoiler"${e.spoiler ? " checked" : ""}> ネタバレを含む</span></label>
      <label>お名前<input value="${esc(p0.name || "")}" disabled title="名前は編集では変えられません"></label>
    </div>
    <div class="bd-hobox">
      <div class="bd-hohead"><span class="bd-lbl">関連するHO</span><span class="bd-hosel" id="bd-ehosel">${e.hos.length ? e.hos.map(hoTag).join("") : '<span class="bd-none">なし</span>'}</span><button type="button" class="btn bd-hotg" data-bdehotg="1" aria-expanded="${!!e.hoOpen}">${e.hoOpen ? "閉じる ▴" : "選ぶ ▾"}</button></div>
      <div class="bd-hogrid"${e.hoOpen ? "" : " hidden"}>${chips}</div>
    </div>
    <div class="rp-row bd-wide">
      <label>タイトル<input data-bde="title" maxlength="80" autocomplete="off" value="${esc(e.title)}"></label>
      <label>URL(任意)<input data-bde="url" type="url" maxlength="500" autocomplete="off" placeholder="https://" value="${esc(e.url)}"></label>
    </div>
    <textarea data-bde="text" class="bd-text" maxlength="1000" rows="3" placeholder="ひとこと・本文(任意)">${esc(e.text)}</textarea>
    ${act}</div>`;
}
/* URLはタイトルと分けて、リンクのボタンとして出す(返信にも付けられる) */
function linkHtml(url){
  const u = safeUrl(url); if(!u) return "";
  let short = u.replace(/^https?:\/\/(www\.)?/, "");
  if(short.length > 48) short = short.slice(0, 46) + "…";
  return `<a class="bd-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(siteOf(u))}</b><span>${esc(short)}</span><i>↗︎</i></a>`;
}
const bdShow = new Set();
const REP_SHOW = 0, bdRepOpen = new Set();   // 最初から見せておく返信の件数(0 = すべてしまう)。残りは「返信を表示」で開く   // ネタバレ投稿のうち「表示する」を押したもの
function threadHtml({ r, rs }){
  const open = state.replyTo === r.id, dr = bdDrafts[r.id] || {};
  const u = safeUrl(r.url);
  const spl = r.spoiler && !r.deleted ? `<span class="bd-splb">ネタバレ注意</span>` : "";
  if(r.spoiler && !r.deleted && !bdShow.has(r.id) && state.editId !== r.id){
    return `<article class="rp bd bd-hidden">
      <div class="rp-head"><span class="rp-cat">${esc(r.cat)}</span>${spl}${postMeta(r)}</div>
      <div class="bd-title">${esc(r.title)}</div>
      <button class="btn bd-reveal" data-bdshow="${esc(r.id)}">ネタバレを含む投稿です。押すと表示します${rs.length ? `(返信${rs.length}件)` : ""}</button>
    </article>`;
  }
  const head = r.deleted ? `<div class="bd-gone">この投稿は削除されました</div>` : state.editId === r.id ? `<div class="rp-head"><span class="bd-editing">✎ 編集中</span>${postMeta(r)}</div>${editFormHtml(r)}` : `
    <div class="rp-head"><span class="rp-cat">${esc(r.cat)}</span>${spl}${r.spoiler ? `<button class="lnk bd-rehide" data-bdhide="${esc(r.id)}">▴ 隠す</button>` : ""}${postMeta(r)}</div>
    <div class="bd-title">${esc(r.title)}</div>
    ${linkHtml(r.url)}
    ${(r.hos || []).length ? `<div class="bd-tags">${r.hos.map(hoTag).join("")}</div>` : ""}
    ${bodyHtml(r)}`;
  const many = rs.length > REP_SHOW && !bdRepOpen.has(r.id) && !state.bdQ && !rs.some(x => x.id === state.editId);
  const shown = many ? (REP_SHOW ? rs.slice(-REP_SHOW) : []) : rs;   // しまっているときは新しい方の REP_SHOW 件だけ
  const more = rs.length > REP_SHOW ? (many
    ? `<button class="lnk bd-more" data-bdmore="${esc(r.id)}">▾ ${REP_SHOW ? `古い返信をあと${rs.length - REP_SHOW}件表示` : "返信を表示"}</button>`
    : `<button class="lnk bd-more" data-bdmore="${esc(r.id)}">▴ ${REP_SHOW ? "古い返信をしまう" : "返信をしまう"}</button>`) : "";
  const repBody = x => {
    if(state.editId === x.id) return editFormHtml(x);
    const ttl = x.title ? `<div class="bd-rtitle">${esc(x.title)}</div>` : "";
    if(x.spoiler && !bdShow.has(x.id)) return ttl + `<button class="btn bd-reveal" data-bdshow="${esc(x.id)}">ネタバレを含む返信です。押すと表示します</button>`;
    return ttl + linkHtml(x.url) + bodyHtml(x);
  };
  const repTag = x => x.spoiler ? `<span class="bd-splb">ネタバレ注意</span>${bdShow.has(x.id) && state.editId !== x.id ? `<button class="lnk bd-rehide" data-bdhide="${esc(x.id)}">▴ 隠す</button>` : ""}` : "";
  const reps = shown.map(x => `<div class="bd-rep"><div class="rp-head">${repTag(x)}${postMeta(x)}</div>${repBody(x)}</div>`).join("");
  const form = open ? `<div class="bd-rform">
      <input data-bdr="${esc(r.id)}" data-f="name" maxlength="20" placeholder="お名前(任意)" autocomplete="off" value="${esc(dr.name ?? getName())}">
      <input data-bdr="${esc(r.id)}" data-f="title" maxlength="80" placeholder="タイトル(任意・ネタバレを伏せたときも表示されます)" autocomplete="off" value="${esc(dr.title || "")}" class="bd-rurl">
      <input data-bdr="${esc(r.id)}" data-f="url" type="url" maxlength="500" placeholder="URL(任意)" autocomplete="off" value="${esc(dr.url || "")}" class="bd-rurl">
      <textarea data-bdr="${esc(r.id)}" data-f="text" maxlength="1000" rows="2" placeholder="返信を書く(URLだけでもOK)">${esc(dr.text || "")}</textarea>
      <label class="bd-rspl"><input type="checkbox" data-bdr="${esc(r.id)}" data-f="spoiler"${dr.spoiler ? " checked" : ""}> ネタバレを含む</label>
      <div class="rp-act"><button class="btn rp-send" data-bdsend="${esc(r.id)}">返信する</button><button class="btn" data-bdreply="">閉じる</button><span class="bd-rmsg" id="bd-rmsg"></span></div>
    </div>` : ((r.deleted || state.editId === r.id) ? "" : `<button class="btn bd-rbtn" data-bdreply="${esc(r.id)}">返信する</button>`);
  const repHead = rs.length ? `<div class="bd-rcount">返信 ${rs.length}件 ${more}</div>` : "";
  return `<article class="rp bd${state.editId === r.id ? " bd-isedit" : ""}">${head}${rs.length ? `<div class="bd-reps">${repHead}${reps}</div>` : ""}${form}</article>`;
}
function drawBoard(){
  const box = document.getElementById("bd-list"); if(!box) return;
  const ae = document.activeElement, fid = ae && ae.dataset && ae.dataset.bdr, fk = fid ? ae.dataset.f : null, fe = ae && ae.dataset && ae.dataset.bde;
  const sel = (fid || fe) && typeof ae.selectionStart === "number" ? [ae.selectionStart, ae.selectionEnd] : null;
  const kids = {};
  posts.filter(p => p.parent).forEach(p => { (kids[p.parent] = kids[p.parent] || []).push(p); });
  const all = posts.filter(p => !p.parent).map(r => {
    const rs = (kids[r.id] || []).filter(x => !x.deleted).sort((a, b) => a.at - b.at);
    return { r, rs, last:Math.max(r.at, ...rs.map(x => x.at)) };
  }).filter(t => !(t.r.deleted && !t.rs.length));
  const hf = state.bdHo, hoOk = t => hf === "all" || (hf === "0" ? !(t.r.hos || []).length : (t.r.hos || []).includes(+hf));
  const q = state.bdQ;
  const hay = p => [p.title, p.text, p.url, p.name, p.cat, ...(p.hos || []).map(hoLabel)].join(" ").normalize("NFKC").toLowerCase();
  const qOk = t => !q || hay(t.r).includes(q) || t.rs.some(x => hay(x).includes(q));   // 返信の中身も検索対象
  const byHo = all.filter(t => hoOk(t) && qOk(t));
  document.querySelectorAll("[data-bdcat]").forEach(b => {
    const c = b.dataset.bdcat, n = c === "all" ? byHo.length : byHo.filter(t => t.r.cat === c).length;
    b.setAttribute("aria-pressed", String(state.bdCat === c)); b.querySelector("b").textContent = n;
  });
  const th = byHo.filter(t => state.bdCat === "all" || t.r.cat === state.bdCat).sort((a, b) => b.last - a.last);
  box.innerHTML = th.length ? th.map(threadHtml).join("") : `<div class="rp-empty">${all.length ? "条件に合う投稿はありません" : "まだ投稿はありません"}</div>`;
  if(fid || fe){ const el = fid ? box.querySelector(`[data-bdr="${CSS.escape(fid)}"][data-f="${fk}"]`) : box.querySelector(`[data-bde="${fe}"]`); if(el){ el.focus(); if(sel) try { el.setSelectionRange(sel[0], sel[1]); } catch(e){} } }
  const er = document.getElementById("bd-err");
  if(er){
    er.hidden = !(bdError || (useFs() && authError));
    er.textContent = authError ? "投稿の準備に失敗しました(Firebaseで匿名認証が有効になっているか確認してください)。" : "掲示板の読み込みに失敗しました(Firestoreのルールに posts が入っているか確認してください)。";
  }
}
function boardHtml(){
  const hoChips = [0, ...D.map(d => d.ho), BD_OTHER].map(n => {
    const d = D.find(x => x.ho === n);
    return `<button type="button" class="chip bd-hoc" data-bdho="${n}"${d ? ` style="--c:${esc(accent(d))}"` : ""} aria-pressed="false">${n === 0 ? "なし" : esc(hoLabel(n))}</button>`;
  }).join("");
  const hof = `<option value="all">すべて</option><option value="0">なし</option>` + D.map(d => `<option value="${d.ho}"${state.bdHo === String(d.ho) ? " selected" : ""}>HO${d.ho} ${esc(d.pc)}</option>`).join("") + `<option value="${BD_OTHER}">その他</option>`;
  const cats = BD_CATS.map(c => `<option>${esc(c)}</option>`).join("");
  const chips = ["all", ...BD_CATS].map(c => `<button class="chip" data-bdcat="${esc(c)}" aria-pressed="${state.bdCat === c}">${c === "all" ? "すべて" : esc(c)} <b>0</b></button>`).join("");
  return `<div class="hcard rp-form">
    <div class="bd-top">
      <div>
        <h2>掲示板 <button class="lq bd-help" data-info="board" aria-label="掲示板の使い方" title="掲示板の使い方">?</button></h2>
        <p class="hdesc">ふせったーや二次創作のURLを共有したり、ひとこと残したりする場所です。</p>
      </div>
      <button class="btn rp-send bd-ftg" id="bd-ftg" aria-expanded="${state.bdForm}" aria-controls="bd-formbody">${state.bdForm ? "閉じる ▴" : "＋ 投稿する"}</button>
    </div>
    <div id="bd-formbody" class="bd-formbody"${state.bdForm ? "" : " hidden"}>
    <div class="rp-row">
      <label>種類<select id="bd-cat">${cats}</select></label>
      <label class="bd-spl"><span>&nbsp;</span><span><input type="checkbox" id="bd-spoiler"> ネタバレを含む</span></label>
      <label>お名前(任意)<input id="bd-name" maxlength="20" value="${esc(getName())}" autocomplete="off"></label>
    </div>
    <div class="bd-hobox">
      <div class="bd-hohead"><span class="bd-lbl">関連するHO</span><span id="bd-hosel" class="bd-hosel"></span><button type="button" class="btn bd-hotg" id="bd-hotg" aria-expanded="false" aria-controls="bd-hogrid">選ぶ ▾</button></div>
      <div class="bd-hogrid" id="bd-hogrid" hidden>${hoChips}</div>
    </div>
    <div class="rp-row bd-wide">
      <label>タイトル<input id="bd-title" maxlength="80" autocomplete="off" placeholder="例: 後日談の小話"></label>
      <label>URL(任意)<input id="bd-url" type="url" maxlength="500" autocomplete="off" placeholder="https://"></label>
    </div>
    <textarea id="bd-text" class="bd-text" maxlength="1000" rows="3" placeholder="ひとこと・本文(任意)"></textarea>
    <div class="rp-act"><button class="btn rp-send" id="bd-send">投稿</button><span id="bd-msg" role="status"></span>${liveStatusHtml()}</div>
    </div>
    <div class="rp-err" id="bd-err" hidden></div>
  </div>
  <div class="hcard rp-list"><div class="bd-filter">${chips}<input id="bd-q" class="bd-q" type="search" placeholder="掲示板を検索" aria-label="掲示板を検索" value="${esc(state.bdQRaw || "")}" autocomplete="off"><label class="bd-hof">関連HO<select id="bd-hof">${hof}</select></label></div><div id="bd-list"></div></div>`;
}
function syncHoSel(){
  const sel = state.bdHos;
  document.querySelectorAll("[data-bdho]").forEach(b => { const n = +b.dataset.bdho; b.setAttribute("aria-pressed", String(n === 0 ? !sel.length : sel.includes(n))); });
  const el = document.getElementById("bd-hosel");
  if(el) el.innerHTML = sel.length ? sel.map(hoTag).join("") : '<span class="bd-none">なし</span>';
}
let bdQTimer;
document.addEventListener("input", e => {
  if(e.target.id !== "bd-q") return;
  state.bdQRaw = e.target.value;
  clearTimeout(bdQTimer);
  bdQTimer = setTimeout(() => { state.bdQ = state.bdQRaw.trim().normalize("NFKC").toLowerCase(); drawBoard(); }, 150);
});
document.addEventListener("change", e => { if(e.target.id === "bd-hof"){ state.bdHo = e.target.value; drawBoard(); } });
document.addEventListener("input", e => { const el = e.target; if(bdEdit && el.dataset && el.dataset.bde) bdEdit[el.dataset.bde] = el.value; });
document.addEventListener("change", e => { const el = e.target; if(bdEdit && el.dataset && el.dataset.bde) bdEdit[el.dataset.bde] = el.type === "checkbox" ? el.checked : el.value; });
document.addEventListener("input", e => {
  const el = e.target; if(!el.dataset || !el.dataset.bdr) return;
  (bdDrafts[el.dataset.bdr] = bdDrafts[el.dataset.bdr] || {})[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value;
});
document.addEventListener("click", async e => {
  const t = e.target; if(!t.closest) return;
  const say = (id, m, bad) => { const el = document.getElementById(id); if(el){ el.textContent = m; el.className = bad ? "bad" : "ok"; } };
  const eb = t.closest("[data-bdedit]");
  if(eb){
    const p = posts.find(x => x.id === eb.dataset.bdedit); if(!p) return;
    bdEdit = { id:p.id, reply:!!p.parent, cat:p.cat, title:p.title, url:p.url, text:p.text, hos:[...(p.hos || [])], spoiler:!!p.spoiler };
    state.editId = p.id; drawBoard();
    const f = document.querySelector(p.parent ? '[data-bde="text"]' : '[data-bde="title"]'); if(f) f.focus();
    return;
  }
  if(t.closest("[data-bdecancel]")){ bdEdit = null; state.editId = null; drawBoard(); return; }
  if(t.closest("[data-bdehotg]") && bdEdit){
    bdEdit.hoOpen = !bdEdit.hoOpen;
    const b = t.closest("[data-bdehotg]"), g = b.closest(".bd-hobox").querySelector(".bd-hogrid");
    g.hidden = !bdEdit.hoOpen; b.setAttribute("aria-expanded", String(bdEdit.hoOpen)); b.textContent = bdEdit.hoOpen ? "閉じる ▴" : "選ぶ ▾";
    return;
  }
  const eh = t.closest("[data-bdeho]");
  if(eh && bdEdit){
    const n = +eh.dataset.bdeho;
    bdEdit.hos = n === 0 ? [] : bdEdit.hos.includes(n) ? bdEdit.hos.filter(x => x !== n) : [...bdEdit.hos, n].sort((a, b) => a - b);
    document.querySelectorAll("[data-bdeho]").forEach(b => { const k = +b.dataset.bdeho; b.setAttribute("aria-pressed", String(k === 0 ? !bdEdit.hos.length : bdEdit.hos.includes(k))); });
    const tg = document.getElementById("bd-ehosel"); if(tg) tg.innerHTML = bdEdit.hos.length ? bdEdit.hos.map(hoTag).join("") : '<span class="bd-none">なし</span>';
    return;
  }
  const es = t.closest("[data-bdesave]");
  if(es && bdEdit){
    const ed = bdEdit, text = (ed.text || "").trim();
    let patch;
    if(ed.reply){
      const rawUrl = (ed.url || "").trim(), url = rawUrl ? safeUrl(rawUrl) : "";
      if(rawUrl && !url){ say("bd-emsg", "URLは https:// から始まる形で入れてください", true); return; }
      if(!text && !url){ say("bd-emsg", "返信かURLを入力してください", true); return; }
      patch = { title:(ed.title || "").trim().slice(0, 80), text:text.slice(0, 1000), url, spoiler:!!ed.spoiler };
    } else {
      const title = (ed.title || "").trim(), rawUrl = (ed.url || "").trim(), url = rawUrl ? safeUrl(rawUrl) : "";
      if(!title){ say("bd-emsg", "タイトルを入力してください", true); return; }
      if(rawUrl && !url){ say("bd-emsg", "URLは https:// から始まる形で入れてください", true); return; }
      patch = { cat:ed.cat, title:title.slice(0, 80), url, text:text.slice(0, 1000), hos:[...ed.hos], spoiler:!!ed.spoiler };
    }
    es.disabled = true;
    try { await editPost(ed.id, patch); bdEdit = null; state.editId = null; drawBoard(); }
    catch(err){ es.disabled = false; say("bd-emsg", "保存に失敗しました", true); }
    return;
  }
  const mo = t.closest("[data-bdmore]");
  if(mo){ const id = mo.dataset.bdmore; if(bdRepOpen.has(id)) bdRepOpen.delete(id); else bdRepOpen.add(id); drawBoard(); return; }
  const hd = t.closest("[data-bdhide]");
  if(hd){ bdShow.delete(hd.dataset.bdhide); drawBoard(); return; }
  const sh = t.closest("[data-bdshow]");
  if(sh){ bdShow.add(sh.dataset.bdshow); drawBoard(); return; }
  const fd = t.closest("[data-bdfold]");
  if(fd){ const id = fd.dataset.bdfold; if(bdOpen.has(id)) bdOpen.delete(id); else bdOpen.add(id); drawBoard(); return; }
  const cat = t.closest("[data-bdcat]");
  if(cat){ state.bdCat = cat.dataset.bdcat; drawBoard(); return; }
  if(t.closest("#bd-ftg")){
    state.bdForm = !state.bdForm;
    const f = document.getElementById("bd-formbody"), b = t.closest("#bd-ftg");
    f.hidden = !state.bdForm; b.setAttribute("aria-expanded", String(state.bdForm)); b.textContent = state.bdForm ? "閉じる ▴" : "＋ 投稿する";
    if(state.bdForm) document.getElementById("bd-title").focus();
    return;
  }
  if(t.closest("#bd-hotg")){
    const g = document.getElementById("bd-hogrid"), b = t.closest("#bd-hotg"), open = g.hidden;
    g.hidden = !open; b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "閉じる ▴" : "選ぶ ▾";
    return;
  }
  const hc = t.closest("[data-bdho]");
  if(hc){
    const n = +hc.dataset.bdho;
    if(n === 0) state.bdHos = [];                                            // 「なし」は他の選択をすべて外す
    else state.bdHos = state.bdHos.includes(n) ? state.bdHos.filter(x => x !== n) : [...state.bdHos, n].sort((a, b) => a - b);
    syncHoSel(); return;
  }
  if(t.closest(".bd-req")){ e.preventDefault(); if(typeof closeInfo === "function") closeInfo(); state.rpCat = "掲示板の削除依頼"; state.rpHo = 0; setPage("reports"); return; }
  const rb = t.closest("[data-bdreply]");
  if(rb){
    state.replyTo = rb.dataset.bdreply || null; drawBoard();
    if(state.replyTo){ const ta = document.querySelector(`textarea[data-bdr="${CSS.escape(state.replyTo)}"]`); if(ta) ta.focus(); }
    return;
  }
  if(t.closest("#bd-send")){
    const btn = t.closest("#bd-send"), v = id => document.getElementById(id).value.trim();
    const title = v("bd-title"), rawUrl = v("bd-url"), url = rawUrl ? safeUrl(rawUrl) : "";
    if(!title){ say("bd-msg", "タイトルを入力してください", true); return; }
    if(rawUrl && !url){ say("bd-msg", "URLは https:// から始まる形で入れてください", true); return; }
    const name = v("bd-name").slice(0, 20);
    btn.disabled = true;
    try {
      await addPost({ parent:null, cat:v("bd-cat"), title:title.slice(0, 80), url, text:v("bd-text").slice(0, 1000), name, hos:[...state.bdHos], spoiler:document.getElementById("bd-spoiler").checked });
      setName(name);
      state.bdHos = []; syncHoSel();
      ["bd-title", "bd-url", "bd-text"].forEach(id => { document.getElementById(id).value = ""; });
      document.getElementById("bd-spoiler").checked = false;
      say("bd-msg", "投稿しました", false);
    } catch(err){ say("bd-msg", "投稿に失敗しました。時間をおいてもう一度試してください", true); }
    btn.disabled = false;
    setTimeout(() => say("bd-msg", "", false), 5000);
    return;
  }
  const sd = t.closest("[data-bdsend]");
  if(sd){
    const id = sd.dataset.bdsend, dr = bdDrafts[id] || {};
    const text = (dr.text || "").trim(), name = (dr.name ?? getName()).trim().slice(0, 20);
    const rawUrl = (dr.url || "").trim(), url = rawUrl ? safeUrl(rawUrl) : "";
    if(rawUrl && !url){ say("bd-rmsg", "URLは https:// から始まる形で入れてください", true); return; }
    if(!text && !url){ say("bd-rmsg", "返信かURLを入力してください", true); return; }
    sd.disabled = true;
    try {
      await addPost({ parent:id, cat:"", title:(dr.title || "").trim().slice(0, 80), url, text:text.slice(0, 1000), name, hos:[], spoiler:!!dr.spoiler });
      setName(name); delete bdDrafts[id]; state.replyTo = null; bdRepOpen.add(id); drawBoard();
    } catch(err){ sd.disabled = false; say("bd-rmsg", "送信に失敗しました", true); }
    return;
  }
  const dl = t.closest("[data-bddel]");
  if(dl){
    if(!dl.dataset.armed){
      dl.dataset.armed = "1"; dl.textContent = "本当に削除"; dl.classList.add("armed");
      setTimeout(() => { if(dl.isConnected){ delete dl.dataset.armed; dl.textContent = "削除"; dl.classList.remove("armed"); } }, 4000);
      return;
    }
    dl.disabled = true;
    try { await delPost(dl.dataset.bddel); } catch(err){ dl.disabled = false; dl.textContent = "失敗(もう一度)"; delete dl.dataset.armed; }
  }
});

/* ===== Googleログイン(任意) =====
   匿名のままでも使える。ログインすると、匿名アカウントを「同じIDのまま」Googleにつなぐので、それまでの投稿も自分のものとして残る */
let loginMsg = "";
function drawLogin(){
  const el = document.getElementById("login"); if(!el) return;
  el.hidden = !(useFs() && fbAuth);
  if(el.hidden) return;
  const help = `<button class="lq" id="lhelp-open" aria-label="ログインについて" title="ログインについて">?</button>`;
  el.innerHTML = myUser
    ? `<span class="lme" title="${esc(myUser.email)}">ログイン中: ${esc(myUser.name || myUser.email)}</span><button class="lnk" id="logout">ログアウト</button>${help}`
    : `<button class="newsbtn" id="glogin">Googleでログイン</button>${help}`;
  if(loginMsg) el.insertAdjacentHTML("beforeend", `<span class="lerr">${esc(loginMsg)}</span>`);
}
async function googleLogin(){
  const { au, auth } = fbAuth, provider = new au.GoogleAuthProvider();
  loginMsg = "";
  try {
    if(auth.currentUser && auth.currentUser.isAnonymous){
      try { await au.linkWithPopup(auth.currentUser, provider); }          // 匿名 → 同じIDのままGoogleに
      catch(err){
        if(err.code === "auth/credential-already-in-use"){                 // そのGoogleアカウントは別の端末で使用済み → そちらのIDで入る
          const cred = au.GoogleAuthProvider.credentialFromError(err);
          if(!cred) throw err;
          await au.signInWithCredential(auth, cred);
        } else throw err;
      }
      await auth.currentUser.reload();
      const u = auth.currentUser, pd = u.providerData && u.providerData[0];
      myUid = u.uid; myUser = { email:u.email || (pd && pd.email) || "", name:u.displayName || (pd && pd.displayName) || "" };
    } else {
      await au.signInWithPopup(auth, provider);
    }
  } catch(err){
    if(err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
    loginMsg = { "auth/popup-blocked":"ポップアップがブロックされました。ブラウザで許可してください", "auth/unauthorized-domain":"このサイトがFirebaseに登録されていません", "auth/operation-not-allowed":"Googleログインが有効になっていません" }[err.code] || "ログインに失敗しました";
  }
  drawLogin(); drawBoard(); drawReports();
}
function toggleHelp(show){
  const h = document.getElementById("lhelp"); h.hidden = !show;
  if(show) document.getElementById("lhelp-close").focus();
}
document.addEventListener("click", e => {
  const t = e.target; if(!t.closest) return;
  if(t.closest("#glogin")){ googleLogin(); return; }
  if(t.closest("#logout")){ fbAuth.au.signOut(fbAuth.auth); return; }
  if(t.closest("#lhelp-open")){ toggleHelp(document.getElementById("lhelp").hidden); return; }
  if(t.closest("#lhelp-close") || (!t.closest("#lhelp") && !document.getElementById("lhelp").hidden)) toggleHelp(false);
});
document.addEventListener("keydown", e => { if(e.key === "Escape" && !document.getElementById("lhelp").hidden) toggleHelp(false); });

const extLink = (label, url) => { const u = safeUrl(url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label); };
const contactHtml = () => {
  const u = safeUrl(SITE.contactUrl);
  const ext = u ? `、または <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(SITE.contactLabel || u)}</a>` : "";
  return `本サイトの<a href="#reports" data-infogo="reports">不具合報告</a>ページ${ext}`;
};
function openInfo(key){
  const f = DOCS[key]; if(!f) return;
  document.getElementById("info-body").innerHTML = f() + '<div style="height:22px"></div>';
  document.getElementById("info-ov").classList.add("open");
  document.documentElement.classList.add("modal-open");
  document.getElementById("info-body").scrollTop = 0;
  document.getElementById("info-close").focus();
}
function closeInfo(){
  document.getElementById("info-ov").classList.remove("open");
  if(!document.getElementById("overlay").classList.contains("open") && !document.getElementById("news-ov").classList.contains("open")) document.documentElement.classList.remove("modal-open");
}
function drawFooter(){
  document.getElementById("sitefoot").innerHTML = `
    <nav class="flinks" aria-label="サイト情報">
      <button class="lnk" data-info="terms">利用規約</button><span>|</span>
      <button class="lnk" data-info="privacy">プライバシーポリシー</button><span>|</span>
      <button class="lnk" data-info="credits">権利表記</button>
    </nav>
    <p class="fenv">推奨環境: PC・スマートフォンの最新版の Chrome / Safari / Edge / Firefox</p>
    <p class="fcoc">${esc(COC_NOTE)}</p>
    <p>シナリオ「${esc(SITE.scenario)}」 製作: ${extLink(SITE.scenarioAuthor, SITE.scenarioAuthorUrl)}(${extLink(SITE.circle, SITE.circleUrl)}) ・ KP: ${extLink(SITE.kp, SITE.kpUrl)}</p>
    <p class="fcopy">© ${SITE.since} ${esc(SITE.name)} ${esc(SITE.team)} ・ サイト運営: ${extLink(SITE.owner, SITE.ownerUrl)} ・ 最終更新: ${esc(SITE.updated.replace(/-/g, "/"))}</p>`;
}
document.addEventListener("click", e => {
  const t = e.target; if(!t.closest) return;
  const b = t.closest("[data-info]");
  if(b){ openInfo(b.dataset.info); return; }
  const g = t.closest("[data-infogo]");
  if(g){ e.preventDefault(); closeInfo(); setPage(g.dataset.infogo); window.scrollTo(0, 0); return; }
});
document.getElementById("info-ov").addEventListener("click", e => { if(e.target.id === "info-ov" || e.target.id === "info-close") closeInfo(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && document.getElementById("info-ov").classList.contains("open")) closeInfo(); });

const NEWS_KEY = "roado-news-seen";
const newsSeen = () => { try { return parseInt(localStorage.getItem(NEWS_KEY) || "0", 10) || 0; } catch(e){ return 0; } };
function drawNewsBadge(){
  const n = NEWS.filter(x => x.id > newsSeen()).length, b = document.getElementById("nbadge");
  if(b){ b.textContent = n; b.hidden = !n; }
}
function openNews(){
  const seen = newsSeen();
  document.getElementById("news-list").innerHTML = NEWS.length ? NEWS.map(x => `<div class="nw${x.id > seen ? " new" : ""}">
      <div class="nw-head"><span class="nw-d">${esc(x.d.replace(/-/g, "/"))}</span><span class="nw-k ${x.k === "更新" ? "up" : "info"}">${esc(x.k)}</span>${x.id > seen ? '<span class="nw-new">NEW</span>' : ""}</div>
      <p>${esc(x.t)}</p></div>`).join("") : '<div class="rp-empty">お知らせはありません</div>';
  document.getElementById("news-ov").classList.add("open");
  document.documentElement.classList.add("modal-open");
  try { localStorage.setItem(NEWS_KEY, String(Math.max(0, ...NEWS.map(x => x.id)))); } catch(e){}
  drawNewsBadge();
  document.getElementById("news-close").focus();
}
function closeNews(){
  document.getElementById("news-ov").classList.remove("open");
  if(!document.getElementById("overlay").classList.contains("open")) document.documentElement.classList.remove("modal-open");
}
document.getElementById("newsbtn").addEventListener("click", openNews);
document.getElementById("news-ov").addEventListener("click", e => { if(e.target.id === "news-ov" || e.target.id === "news-close") closeNews(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && document.getElementById("news-ov").classList.contains("open")) closeNews(); });

/* 拡大率は画像の縦横比から自動計算(全身=縦長は上半身が映る大きさ、顔・胸上=正方形に近いほど縮小して人物の大きさを揃える)。
   個別に直したい場合は上の項目に z:拡大率(1=カード右側の幅いっぱい)を足すと自動計算より優先される */
const PORTRAIT_K = 1.7 * (3000 / 1400); // 基準: 縦横比3000:1400の全身絵を1.7倍で表示
function fitPortrait(img){
  const r = img.naturalHeight / img.naturalWidth;
  if(!isFinite(r) || !r) return;
  const x = parseFloat(img.dataset.x || 50);
  const s = r >= 2 ? 1 : r <= 1 ? 0.25 : 0.25 + 0.75 * (r - 1); // 絵に映っている身体の割合の推定
  let z = img.dataset.z ? parseFloat(img.dataset.z) : s * PORTRAIT_K / r;
  z = Math.max(0.35, Math.min(z, 3));
  const lo = Math.min(0, 100 * (1 - z)), hi = Math.max(0, 100 * (1 - z));
  const left = Math.max(lo, Math.min(hi, 50 - z * x));
  img.style.width = (z * 100) + "%";
  img.style.left = left + "%";
}
/* ===== ユーティリティ ===== */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hoName = d => `<ruby class="hn">${esc(d.en)}<rt data-rt="${esc(d.kana)}"></rt></ruby>`;
const hoLine = (d, lg) => `<div class="holine${lg?" lg":""}"><span>HO${d.ho}</span>${hoName(d)}<span class="mean">${esc(d.mean)}</span></div>`;
const skNum = v => /^\d+$/.test(v) ? parseInt(v,10) : null;
/* 技能の初期値(未入力・「-」のときに薄いグレーで表示)
   ※目星(25)・聞き耳(25)・図書館(25)は入力漏れが多いため、現状は初期値を出さず空欄にしている。戻す場合は下に "目星":25,"聞き耳":25,"図書館":25 を足す */
const skShow = v => v === "-" ? "—" : v;
const skOf = (d, l) => (d.sk.find(s => s.l === l) || {}).v || "";
function skEff(d, l){
  const raw = skOf(d, l), n = skNum(raw);
  if(n !== null) return { n, def:false, raw };
  if(l in SKDEF) return { n:SKDEF[l], def:true, raw };
  return { n:null, def:false, raw };
}
const skCell = (d, l) => { const e = skEff(d, l); return e.n === null ? esc(skShow(e.raw)) : (e.def ? `<span class="def" title="初期値">${e.n}</span>` : String(e.n)); };
const catHtml = d => d.cat.length ? `<div class="cats">${d.cat.map(c => `<span class="cat" style="--cc:${c.c}" title="${esc(c.n)}"><i></i><span class="cn">${esc(c.n)}</span></span>`).join("")}</div>` : "";
const songLabel = s => (s.a || "") + "「" + s.t + "」";
const portraitHtml = d => d.img
  ? `<div class="portrait"><img src="${esc(d.img.u)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-x="${d.img.x ?? 50}"${d.img.z ? ` data-z="${d.img.z}"` : ""} onload="fitPortrait(this)" onerror="this.parentNode.remove()"></div>` : "";
const letter = d => d.en.charAt(0).toUpperCase();
const hNum = d => /^\d+$/.test(d.h) ? parseInt(d.h,10) : null;
const hText = d => d.h ? (hNum(d) !== null ? d.h + "cm" : d.h) : "—";
function lum(hex){
  const m = /^#([0-9a-f]{6})$/i.exec(hex || ""); if(!m) return 0.5;
  const v = [0,2,4].map(i => parseInt(m[1].substr(i,2),16)/255)
    .map(c => c <= .03928 ? c/12.92 : Math.pow((c+.055)/1.055, 2.4));
  return .2126*v[0] + .7152*v[1] + .0722*v[2];
}
/* 暗い背景で見えない色(黒など)はアクセント表示のみ明るく補正 */
/* 明るい背景で薄すぎる色(黄・水色など)は同じ色味のまま少し濃くして、カードの帯が見えるようにする */
function darken(hex, f){ const m = /^#([0-9a-f]{6})$/i.exec(hex); if(!m) return hex; return "#" + [0,2,4].map(i => Math.round(parseInt(m[1].substr(i,2),16)*f).toString(16).padStart(2,"0")).join(""); }
const accent = d => !d.hex ? "#9db6c2" : (lum(d.hex) > 0.6 ? darken(d.hex, 0.78) : d.hex);

/* ===== 状態 ===== */
const PAGE_HASH = { chars:"", skills:"#data", height:"#height", board:"#board", reports:"#reports" };
const state = { page:"chars", view:"card", q:"", sex:"all", range:"all", cat:"all", trait:"all", sort:"ho", cols:"auto", skSort:{key:"ho", dir:1}, hSort:"ho", hAge:true, hSel:null, showSt:true, showSk:true, showIni:true, showSan:true, showHm:true, edit:false, hurtHp:false, hurtMp:false, bdCat:"all", replyTo:null, rpCat:"ステータス", bdHos:[], bdHo:"all", editId:null, bdQ:"", bdQRaw:"", bdForm:false };
let current = []; // 現在表示中の配列
let openHo = null;

/* ===== フィルタUI生成 ===== */
function makeChips(el, key, items){
  items.forEach(([val,label]) => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = label; b.dataset.val = val;
    b.setAttribute("aria-pressed", String(state[key] === val));
    b.addEventListener("click", () => { state[key] = val; syncChips(el, key); render(); });
    el.appendChild(b);
  });
}
function syncChips(el, key){
  el.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.val === state[key])));
}
makeChips($("#g-sex"), "sex", [["all","すべて"],["男","男"],["女","女"]]);
makeChips($("#g-cat"), "cat", [["all","すべて"], ...CATS.map(c => [c.k, c.e + " " + c.n])]);
makeChips($("#g-range"), "range", [["all","すべて"],["タッチ","タッチ"],["3マス","3マス"],["5マス","5マス"],["none","未設定"]]);

(function buildTraitSelect(){
  const traits = [...new Set(D.map(d => d.trait).filter(Boolean))];
  const sel = $("#trait");
  sel.innerHTML = '<option value="all">すべて</option>' +
    traits.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("") +
    '<option value="none">未設定</option>';
  sel.addEventListener("change", e => { state.trait = e.target.value; render(); });
})();

$("#q").addEventListener("input", e => { state.q = e.target.value.trim().normalize("NFKC").toLowerCase(); render(); });
try{ const c = localStorage.getItem("roadCols"); if(c && [...$("#cols").options].some(o => o.value === c)) state.cols = c; }catch(e){}
$("#cols").value = state.cols;
$("#cols").addEventListener("change", e => {
  state.cols = e.target.value;
  try{ localStorage.setItem("roadCols", state.cols); }catch(err){}
  render();
});
$("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
$("#g-view").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
  state.view = b.dataset.v;
  $("#g-view").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  render();
}));
$("#ftoggle").addEventListener("click", () => {
  const p = $("#fpanel"); p.hidden = !p.hidden;
  $("#ftoggle").setAttribute("aria-expanded", String(!p.hidden));
});
$("#reset").addEventListener("click", () => {
  Object.assign(state, { q:"", sex:"all", range:"all", cat:"all", trait:"all", sort:"ho", skSort:{key:"ho", dir:1}, hurtHp:false, hurtMp:false });
  $("#q").value = ""; $("#trait").value = "all"; $("#sort").value = "ho";
  syncChips($("#g-sex"), "sex"); syncChips($("#g-range"), "range"); syncChips($("#g-cat"), "cat");
  render();
});
function setPage(p){
  state.page = p;
  history.replaceState(null, "", location.pathname + location.search + PAGE_HASH[p]);
  render();
}
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setPage(b.dataset.p)));
initFirebase();

/* ===== 絞り込み・並び替え ===== */
function haystack(d){
  return [d.ho, "HO"+d.ho, d.en, d.kana, d.mean, d.pc, d.pcKana, d.pl, d.cn, d.hex, d.sex, d.weapon,
          d.range.join(" "), d.trait, d.notes.join(" "), d.song ? songLabel(d.song) : "", d.hn, d.sm, d.nego ? d.nego.n : "", d.cat.map(c => c.n).join(" ")].join(" ").normalize("NFKC").toLowerCase();
}
function skKeyVal(d, key){
  if(key === "ho") return d.ho;
  if(key === "pc") return d.pc.toLowerCase();
  if(key === "hv") return d.hv;
  if(key === "nego") return d.nego ? d.nego.v : null;
  if(key === "SAN") return liveOf(d.ho).san;
  if(key === "IND") return indOf(liveOf(d.ho).base);
  if(key === "INS") return liveOf(d.ho).insane ? 1 : 0;
  if(key === "HP") return liveOf(d.ho).hp;
  if(key === "HPM") return liveOf(d.ho).hpMax;
  if(key === "MP") return liveOf(d.ho).mp;
  if(key === "MPM") return liveOf(d.ho).mpMax;
  if(STK.includes(key)) return d.st[key];
  return skEff(d, key).n;
}
function skCmp(a, b){
  const {key, dir} = state.skSort;
  const va = skKeyVal(a, key), vb = skKeyVal(b, key);
  const na = va === null || va === undefined, nb = vb === null || vb === undefined;
  if(na && nb) return a.ho - b.ho;
  if(na) return 1;            // 値なしは常に末尾
  if(nb) return -1;
  const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
  return c * dir || a.ho - b.ho;
}
function getList(){
  const chars = state.page === "chars";
  const list = D.filter(d => {
    if(state.q && !haystack(d).includes(state.q)) return false;
    if(state.cat !== "all" && !d.cat.some(c => c.k === state.cat)) return false;
    if(state.sex !== "all" && d.sex !== state.sex) return false;
    if(chars){
      if(state.range === "none"){ if(d.range.length) return false; }
      else if(state.range !== "all" && !d.range.includes(state.range)) return false;
      if(state.trait === "none"){ if(d.trait) return false; }
      else if(state.trait !== "all" && d.trait !== state.trait) return false;
    }
    return true;
  });
  if(state.page === "height") return list;
  if(!chars) return list.sort(skCmp);
  const cmp = {
    ho:  (a,b) => a.ho - b.ho,
    ageA:(a,b) => a.age - b.age || a.ho - b.ho,
    ageD:(a,b) => b.age - a.age || a.ho - b.ho,
    hA:  (a,b) => (hNum(a) ?? Infinity) - (hNum(b) ?? Infinity) || a.ho - b.ho,
    hD:  (a,b) => (hNum(b) ?? -1) - (hNum(a) ?? -1) || a.ho - b.ho
  }[state.sort];
  return list.sort(cmp);
}

/* ===== 描画 ===== */
function sexPill(d){ return `<span class="pill ${d.sex==="男"?"m":"f"}">${d.sex==="男"?"♂ 男":"♀ 女"}</span>`; }
function swatch(d){
  return d.hex
    ? `<span class="swatch" style="--c:${esc(d.hex)}"><i></i><span class="hexcode">${esc(d.hex)}</span></span>`
    : `<span class="swatch"><i class="none"></i>未設定</span>`;
}
function skLine(d){
  const f = SKL.filter(l => !["目星","聞き耳","図書館"].includes(l)).map(l => ({l, e:skEff(d, l)})).filter(x => x.e.n !== null || x.e.raw !== "");
  if(!f.length && !d.nego) return "";
  return `<div class="skl">${f.map(x => `<span>${x.l}<b${x.e.def ? ' class="def"' : ""}>${skCell(d, x.l)}</b></span>`).join("")}${d.nego ? `<span>${esc(d.nego.n)}<b>${d.nego.v}</b></span>` : ""}</div>`;
}
function cardHtml(d){
  const ranges = d.range.map(r => `<span class="pill range">${esc(r)}</span>`).join("");
  return `<button class="card" data-ho="${d.ho}" data-letter="${esc(letter(d))}" style="--c:${esc(accent(d))}">
    ${portraitHtml(d)}
    ${hoLine(d)}
    <div class="pc">${esc(d.pc)}</div>
    <div class="kana">${esc(d.pcKana || "　")} ・ PL: ${esc(d.pl)}</div>
    <div class="meta">${sexPill(d)}<span class="pill">${d.age}歳</span><span class="pill">${esc(hText(d))}</span></div>
    ${catHtml(d)}
    <div class="weapon"><span class="k">武器</span>${esc(d.weapon || "—")} ${ranges}</div>
    ${skLine(d)}
    <div class="foot">${swatch(d)}${d.trait ? `<span class="trait">${esc(d.trait)}</span>` : ""}</div>
  </button>`;
}
const CHAR_SORT = { ho:["ho"], age:["ageA","ageD"], h:["hA","hD"] };
function charTableHtml(list){
  const info = col => { const i = CHAR_SORT[col].indexOf(state.sort); return { on:i >= 0, dir:i === 1 ? -1 : 1 }; };
  const sc = col => info(col).on ? " sorted" : "";
  const th = (col, label) => {
    const f = info(col);
    return `<th class="sortable${sc(col)}" data-cs="${col}" aria-sort="${f.on ? (f.dir > 0 ? "ascending" : "descending") : "none"}">${label}<span class="ind">${f.on ? (f.dir > 0 ? "▲" : "▼") : ""}</span></th>`;
  };
  const rows = list.map(d => `<tr data-ho="${d.ho}">
    <td class="nw${sc("ho")}">HO${d.ho}</td>
    <td>${hoName(d)}<div class="sm">${esc(d.mean)}</div></td>
    <td class="pcn">${esc(d.pc)}<div class="sm">${esc(d.pcKana)}</div></td>
    <td>${esc(d.pl)}</td>
    <td>${catHtml(d)}</td>
    <td class="nw">${esc(d.sex)}</td>
    <td class="nw${sc("age")}">${d.age}歳</td>
    <td class="nw${sc("h")}">${esc(hText(d))}</td>
    <td>${esc(d.weapon || "—")}</td>
    <td class="nw">${esc(d.range.join(" / ") || "—")}</td>
    <td>${esc(d.trait || "—")}</td>
    <td class="nw">${swatch(d)}</td></tr>`).join("");
  return `<div class="tablewrap"><table><thead><tr>
    ${th("ho","HO")}<th>HO名</th><th>PC名</th><th>PL名</th><th>能力</th><th>性別</th>${th("age","年齢")}${th("h","身長")}<th>武器</th><th>射程</th><th>特徴表</th><th>文字色</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function liveCells(d, cl){
  const L = liveOf(d.ho), ind = indOf(L.base), v = x => x === null ? "" : x, dis = state.edit ? "" : " disabled";
  return `<td class="num lvc gb${cl("SAN")}"><input type="text" class="lv" data-lv="san" data-ho="${d.ho}" maxlength="2" autocomplete="off" inputmode="numeric" placeholder="${(d.st.POW ?? 0) * 5}" value="${v(L.san)}" aria-label="HO${d.ho} 現在SAN"${dis}></td>`
    + `<td class="num lvc${cl("IND")}"><input type="text" class="lv ind" data-lv="base" data-ho="${d.ho}" inputmode="numeric" autocomplete="off" value="${ind === null ? "" : ind}" title="不定ライン(SANがこの値以下で不定)。編集モードONでクリック → その日の開始時SANを入力" aria-label="HO${d.ho} 不定ライン(入力は開始時SAN)"${dis}></td>`
    + `<td class="num lvc${cl("INS")}"><input type="checkbox" class="lvchk" data-lv="insane" data-ho="${d.ho}"${L.insane ? " checked" : ""} aria-label="HO${d.ho} 発狂"${dis}></td>`;
}
const hpDef = d => Math.ceil(((d.st.CON ?? 0) + (d.st.SIZ ?? 0)) / 2), mpDef = d => d.st.POW ?? 0;   // 欄が空のとき薄く出す初期値(HP=(CON+SIZ)/2切り上げ, MP=POW)
function hmCells(d, key){
  const L = liveOf(d.ho), dis = state.edit ? "" : " disabled", v = x => x === null ? "" : x;
  const one = (k, def, lab) => `<input type="text" class="lv sm" data-lv="${k}" data-ho="${d.ho}" maxlength="3" autocomplete="off" inputmode="numeric" placeholder="${def}" value="${v(L[k])}" aria-label="HO${d.ho} ${lab}"${dis}>`;
  const cell = (id, cur, max, def, nm, first) => `<td class="num wide lvc${first ? " gb" : ""}${key === id || key === id + "M" ? " sorted" : ""}"><span class="${pairCls(d, cur)}" data-ho="${d.ho}" data-kind="${cur}">${one(cur, def, "現在" + nm)}<i>/</i>${one(max, def, "最大" + nm)}</span></td>`;
  return cell("HP", "hp", "hpMax", hpDef(d), "HP", true) + cell("MP", "mp", "mpMax", mpDef(d), "MP", false);
}
function tableHtml(list){
  const {key, dir} = state.skSort;
  const cl = k => key === k ? " sorted" : "";
  const th = (k, label, extra="", attr="") => {
    const on = key === k;
    return `<th${attr} class="sortable${extra}${cl(k)}" data-sk="${esc(k)}" aria-sort="${on ? (dir > 0 ? "ascending" : "descending") : "none"}">${esc(label)}<span class="ind">${on ? (dir > 0 ? "▲" : "▼") : ""}</span></th>`;
  };
  const stOn = state.showSt, skOn = state.showSk, iniOn = state.showIni, sanOn = state.showSan, hmOn = state.showHm;
  const hmTh = (id, label, first) => {
    const part = (k, t) => { const on = key === k; return `<span class="hs${on ? " on" : ""}" data-sk="${k}" title="${label}の${t === "現" ? "現在値" : "最大値"}で並べ替え">${t}${on ? (dir > 0 ? "▲" : "▼") : ""}</span>`; };
    return `<th class="num wide hm2${first ? " gb" : ""}"><div class="hml">${label}</div><div class="hsr">${part(id, "現")}/${part(id + "M", "最")}</div></th>`;
  };
  const STX = STK.slice(1);   // INIはHOの横に別枠で表示
  const skN = SKL.length + 2;
  const grp = (id, label, on, n) => on
    ? `<th class="grp ${id} gb" colspan="${n}" data-grp="${id}" title="クリックで非表示(再表示は表の上のボタン)">▼ ${label}</th>`
    : "";                                                   // 折りたたんだグループは表から完全に消す(再表示は表の上のボタン)
  const head1 = `<tr>${th("ho","HO","",' rowspan="2"')}${iniOn ? th("INI","INI"," num",' rowspan="2"') : ""}<th rowspan="2">HO名</th>${th("pc","PC名","",' rowspan="2"')}<th rowspan="2">能力</th>`
    + grp("san","SAN",sanOn,3) + grp("hm","HP・MP",hmOn,2) + grp("st","ステータス",stOn,STX.length) + grp("sk","技能",skOn,skN) + `</tr>`;
  const head2 = `<tr>${sanOn ? th("SAN","SAN"," num gb") + th("IND","不定"," num") + th("INS","発狂"," num") : ""}${hmOn ? hmTh("HP","HP",true) + hmTh("MP","MP",false) : ""}${stOn ? STX.map((k,i) => th(k, k, " num" + (i === 0 ? " gb" : ""))).join("") : ""}`
    + (skOn ? SKL.map((l,i) => th(l, l, " num" + (i === 0 ? " gb" : ""))).join("") + th("nego","交渉技能") + th("hv","HO推奨技能") : "") + `</tr>`;
  const rows = list.map(d => `<tr data-ho="${d.ho}"${liveOf(d.ho).insane ? ' class="insane"' : ""}${anyHurt() && !isHurt(d) ? " hidden" : ""}>
    <td class="nw${cl("ho")}">HO${d.ho}</td>
    ${iniOn ? `<td class="num${cl("INI")}">${d.st.INI === null ? "" : d.st.INI}</td>` : ""}
    <td>${hoName(d)}<div class="sm">${esc(d.mean)}</div></td>
    <td class="pcn${cl("pc")}">${esc(d.pc)}<div class="sm">${esc(d.pcKana)}</div></td>
    <td>${catHtml(d)}</td>
    ${sanOn ? liveCells(d, cl) : ''}
    ${hmOn ? hmCells(d, key) : ''}
    ${stOn ? STX.map((k,i) => `<td class="num${cl(k)}${i === 0 ? " gb" : ""}">${d.st[k] === null ? "" : d.st[k]}</td>`).join("") : ''}
    ${skOn ? SKL.map((l,i) => `<td class="num${cl(l)}${i === 0 ? " gb" : ""}">${skCell(d, l)}</td>`).join("")
      + `<td class="nw2 ${cl("nego").trim()}">${d.nego ? esc(d.nego.n) + " <b>" + d.nego.v + "</b>" : ""}</td>`
      + `<td class="nw2 ${cl("hv").trim()}">${esc(d.hn)}${d.hv !== null ? " <b>" + d.hv + "</b>" : ""}</td>` : ''}
    </tr>`).join("");
  const tools = `<div class="coltools"><button class="chip edit" data-grpt="edit" aria-pressed="${state.edit}">${state.edit ? "✎ 編集モード ON" : "✎ 編集モード OFF"}</button>
    <span class="vsep"></span>
    <button class="chip" data-grpt="ini" aria-pressed="${iniOn}">INI</button>
    <button class="chip" data-grpt="san" aria-pressed="${sanOn}">SAN</button>
    <button class="chip" data-grpt="hm" aria-pressed="${hmOn}">HP・MP</button>
    <button class="chip" data-grpt="st" aria-pressed="${stOn}">ステータス</button>
    <button class="chip" data-grpt="sk" aria-pressed="${skOn}">技能</button>
    <span class="vsep"></span>
    <button class="chip" data-grpt="hurtHp" aria-pressed="${state.hurtHp}" title="HPが最大値より減っているHOだけ表示(MP減少と両方ONなら、どちらかが減っているHO)">HP減少</button>
    <button class="chip" data-grpt="hurtMp" aria-pressed="${state.hurtMp}" title="MPが最大値より減っているHOだけ表示(HP減少と両方ONなら、どちらかが減っているHO)">MP減少</button>
    ${liveStatusHtml()}</div>`;
  return `${tools}<div class="tablewrap dragscroll"><table><thead>${head1}${head2}</thead><tbody>${rows}</tbody></table></div>`;
}
/* ===== 身長くらべ ===== */
function heightHtml(){
  const n = D.filter(d => hNum(d) !== null).length;
  return `<div class="hcard">
    <h2>身長くらべ</h2>
    <p class="hdesc">身長が入っているHOの人型を同じ縮尺で並べています(全${D.length}名のうち、身長が数値で入っているのは${n}名)。人型をクリックすると詳細が出ます。</p>
    <div class="htools">
      <div class="group"><button class="chip" data-hsort="ho" aria-pressed="${state.hSort === "ho"}">HO順</button><button class="chip" data-hsort="h" aria-pressed="${state.hSort === "h"}">身長順</button><button class="chip" data-hsort="age" aria-pressed="${state.hSort === "age"}">年齢順</button><button class="chip" data-hsort="siz" aria-pressed="${state.hSort === "siz"}">SIZ順</button></div>
      <label><input type="checkbox" id="h-age"${state.hAge ? " checked" : ""}> 年齢を重ねる</label>
    </div>
    <div class="hlegend"><span><i style="background:#3b8ee8"></i>男</span><span><i style="background:#e0592b"></i>女</span><span>人型の中の数字 = 年齢</span></div>
    <div id="hchart"></div>
    <div class="hpanel" id="hpanel"></div>
    <p class="hnote" id="hnote"></p>
  </div>`;
}
function drawHeight(){
  const box = $("#hchart"); if(!box) return;
  const list = [...current];
  if(state.hSort === "h") list.sort((a,b) => {
    const x = hNum(a), y = hNum(b);
    if(x === null && y === null) return a.ho - b.ho;
    if(x === null) return 1; if(y === null) return -1;
    return x - y || a.ho - b.ho;
  });
  else if(state.hSort === "siz") list.sort((a,b) => {
    const x = a.st.SIZ, y = b.st.SIZ;
    if(x === null && y === null) return a.ho - b.ho;
    if(x === null) return 1; if(y === null) return -1;
    return x - y || (hNum(a) ?? Infinity) - (hNum(b) ?? Infinity) || a.ho - b.ho;   // SIZが低い順、同値は身長→HO順
  });
  else if(state.hSort === "age") list.sort((a,b) => {
    if(a.age !== b.age) return a.age - b.age;                       // 年齢が低い順、同じ年齢は身長が低い順→HO順
    const x = hNum(a), y = hNum(b);
    if(x !== null && y !== null && x !== y) return x - y;
    if(x === null && y !== null) return 1; if(y === null && x !== null) return -1;
    return a.ho - b.ho;
  });
  else list.sort((a,b) => a.ho - b.ho);

  const W = box.clientWidth || 900, LEFT = 6, RIGHT = 54, SLOT_MIN = 42;
  const avail = W - LEFT - RIGHT;
  const maxPer = Math.max(1, Math.floor(avail / SLOT_MIN));          // 入るなら横一列
  const rows = Math.ceil(list.length / maxPer), per = Math.ceil(list.length / rows);
  const slotW = avail / per;
  const MAXH = Math.max(205, ...list.map(d => hNum(d) || 0));
  const s = Math.min(1.25, 0.85 * slotW / (0.31 * MAXH));            // px / cm
  const lab = d => "HO" + d.ho + " " + d.pc + (state.hSort === "siz" ? " ・SIZ" + d.st.SIZ : "");
  const labelH = Math.max(...list.map(d => lab(d).length)) * 6.4 + 14;
  const top = 26, yB = top + 210 * s, rowH = yB + labelH + 8;
  const MALE = "#3b8ee8", FEMALE = "#e0592b";

  const fig = (d, cx) => {
    const h = hNum(d);
    const sel = state.hSel === d.ho;
    let g = `<g class="hfig" data-hsel="${d.ho}" tabindex="0" role="button" aria-label="${esc("HO" + d.ho + " " + d.pc + " " + d.sex + " " + d.age + "歳 " + hText(d))}">`;
    g += `<rect class="hbg" x="${cx - slotW / 2 + 1}" y="2" width="${slotW - 2}" height="${rowH - 4}" rx="6" fill="${sel ? "rgba(31,162,211,.14)" : "rgba(0,0,0,0)"}" stroke="${sel ? "#1fa2d3" : "none"}" style="pointer-events:all"/>`;
    if(h !== null){
      const hp = h * s, col = d.sex === "男" ? MALE : FEMALE, r = 0.065 * hp;
      const tw = 0.20 * hp, tTop = yB - hp + 0.145 * hp, tBot = yB - 0.50 * hp, aw = 0.045 * hp;
      g += `<circle cx="${cx}" cy="${yB - hp + r}" r="${r}" fill="${col}"/>`;
      g += `<rect x="${cx - tw / 2}" y="${tTop}" width="${tw}" height="${tBot - tTop}" rx="${0.04 * hp}" fill="${col}"/>`;
      g += `<rect x="${cx - tw / 2 - 0.055 * hp}" y="${tTop + 0.005 * hp}" width="${aw}" height="${(tBot - tTop) * 0.9}" rx="${aw / 2}" fill="${col}"/>`;
      g += `<rect x="${cx + tw / 2 + 0.01 * hp}" y="${tTop + 0.005 * hp}" width="${aw}" height="${(tBot - tTop) * 0.9}" rx="${aw / 2}" fill="${col}"/>`;
      g += `<rect x="${cx - 0.09 * hp}" y="${tBot - 0.02 * hp}" width="${0.085 * hp}" height="${yB - tBot + 0.02 * hp}" rx="${0.03 * hp}" fill="${col}"/>`;
      g += `<rect x="${cx + 0.005 * hp}" y="${tBot - 0.02 * hp}" width="${0.085 * hp}" height="${yB - tBot + 0.02 * hp}" rx="${0.03 * hp}" fill="${col}"/>`;
      g += `<text x="${cx}" y="${yB - hp - 6}" text-anchor="middle" font-size="10.5" fill="#2c5568">${h}</text>`;
      if(state.hAge){
        const fs = Math.max(8, Math.min(14, hp * 0.10));
        g += `<text x="${cx}" y="${(tTop + tBot) / 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" stroke="#0d3550" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">${d.age}</text>`;
      }
    } else {
      g += `<text x="${cx}" y="${yB - 8}" text-anchor="middle" font-size="11" fill="#9db6c2">—</text>`;
    }
    g += `<text transform="translate(${cx - 4},${yB + 8}) rotate(90)" font-size="11" fill="${sel ? "#0a2e41" : "#5f8798"}" font-weight="${sel ? 700 : 400}">${esc(lab(d))}</text></g>`;
    return g;
  };

  let html = "";
  for(let r = 0; r < rows; r++){
    const part = list.slice(r * per, (r + 1) * per);
    const x2 = LEFT + per * slotW;
    let svg = `<svg viewBox="0 0 ${W} ${rowH}" role="img" aria-label="身長くらべ">`;
    [100, 150, 200].forEach(cm => {
      const y = yB - cm * s;
      svg += `<line x1="${LEFT}" x2="${x2}" y1="${y}" y2="${y}" stroke="#b5d5e1" stroke-dasharray="4 4"/><text x="${x2 + 6}" y="${y + 3.5}" font-size="10" fill="#6a93a5">${cm}cm</text>`;
    });
    svg += `<line x1="${LEFT}" x2="${x2}" y1="${yB}" y2="${yB}" stroke="#6d94a6" stroke-width="1.5"/>`;
    part.forEach((d, i) => { svg += fig(d, LEFT + (i + 0.5) * slotW); });
    html += svg + "</svg>";
  }
  box.innerHTML = html;

  const sel = D.find(d => d.ho === state.hSel);
  $("#hpanel").innerHTML = sel
    ? `<b>HO${sel.ho} ${esc(sel.pc)}</b><span>${esc(sel.sex)} ／ ${sel.age}歳 ／ ${esc(hText(sel))} ／ SIZ ${sel.st.SIZ}</span>${catHtml(sel)}<button class="chip" id="h-open">詳細を開く</button>`
    : '<span style="color:var(--muted)">人型をクリックすると、そのHOの性別・年齢・身長が出ます。</span>';
  const miss = D.filter(d => hNum(d) === null);
  $("#hnote").textContent = miss.length
    ? "身長が数値で入っていない" + miss.length + "名(" + miss.map(d => "HO" + d.ho + (d.h ? "「" + d.h + "」" : "")).join("・") + ")は空欄にしています。入力されたら人型が出ます。"
    : "";
}
$("#main").addEventListener("change", e => { if(e.target.id === "h-age"){ state.hAge = e.target.checked; drawHeight(); } });
let hResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(hResizeTimer);
  hResizeTimer = setTimeout(() => { if(state.page === "height" && $("#hchart")) drawHeight(); }, 120);
});
document.addEventListener("keydown", e => {
  const f = e.target.closest && e.target.closest("[data-hsel]");
  if(f && openHo === null && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); state.hSel = parseInt(f.dataset.hsel, 10); drawHeight(); }
});
function render(){
  current = getList();
  const chars = state.page === "chars";
  document.body.dataset.page = state.page;
  document.body.dataset.view = chars ? state.view : "";
  $("#sort").value = state.sort;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.p === state.page)));
  const n = [state.sex, state.cat, ...(chars ? [state.range, state.trait] : [])].filter(v => v !== "all").length;
  $("#ftoggle").textContent = "絞り込み" + (n ? " (" + n + ")" : "") + " ▾";
  $("#count").textContent = current.length;
  $("#total").textContent = D.length;
  const main = $("#main");
  if(state.page === "reports"){ main.innerHTML = reportsHtml(); drawReports(); return; }
  if(state.page === "board"){ main.innerHTML = boardHtml(); syncHoSel(); drawBoard(); return; }
  if(!current.length){ main.innerHTML = '<div class="empty">条件に合うキャラクターがいません</div>'; return; }
  main.innerHTML = state.page === "height" ? heightHtml()
    : !chars ? tableHtml(current)
    : state.view === "table" ? charTableHtml(current)
    : `<div class="grid${state.cols !== "auto" ? " fixed" : ""}"${state.cols !== "auto" ? ` style="--cols:${state.cols}"` : ""}>${current.map(cardHtml).join("")}</div>`;
  if(state.page === "height") drawHeight();
  syncHurt(true);
}
$("#main").addEventListener("click", e => {
  if(e.target.closest(".lvc")) return;                      // 入力欄の操作ではモーダルを開かない
  const hs = e.target.closest("[data-hsort]");
  if(hs){ state.hSort = hs.dataset.hsort; render(); return; }
  const hf = e.target.closest("[data-hsel]");
  if(hf){ state.hSel = parseInt(hf.dataset.hsel, 10); drawHeight(); return; }
  if(e.target.closest("#h-open")){ if(state.hSel !== null) openModal(state.hSel); return; }
  const gt = e.target.closest("[data-grpt], th[data-grp]");
  if(gt){
    const g = gt.dataset.grpt || gt.dataset.grp;
    if(g === "edit") state.edit = !state.edit; else if(g === "hurtHp") state.hurtHp = !state.hurtHp; else if(g === "hurtMp") state.hurtMp = !state.hurtMp; else if(g === "ini") state.showIni = !state.showIni; else if(g === "san") state.showSan = !state.showSan; else if(g === "hm") state.showHm = !state.showHm; else if(g === "st") state.showSt = !state.showSt; else state.showSk = !state.showSk;
    render(); return;
  }
  const ch = e.target.closest("th[data-cs]");
  if(ch){
    const m = CHAR_SORT[ch.dataset.cs], i = m.indexOf(state.sort);
    state.sort = m[(i + 1) % m.length];
    render(); return;
  }
  const h = e.target.closest("[data-sk]");
  if(h){
    const k = h.dataset.sk;
    state.skSort = state.skSort.key === k
      ? { key:k, dir:-state.skSort.dir }
      : { key:k, dir:(k === "ho" || k === "pc") ? 1 : -1 };
    render(); return;
  }
  const el = e.target.closest("[data-ho]");
  if(el) openModal(parseInt(el.dataset.ho, 10));
});

/* ===== 表のドラッグスクロール(マウス用。タッチは標準スクロール) =====
   #main に一度だけ委譲するので、再描画で表が作り直されても効く。移動が4px未満ならクリック扱い */
(function(){
  let wrap = null, sx = 0, sy = 0, sl = 0, st = 0, moved = false, suppress = false;
  function stop(){
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("mouseup", onUp, true);
    window.removeEventListener("blur", onUp);
    if(wrap) wrap.classList.remove("dragging");
    if(moved){ suppress = true; setTimeout(() => { suppress = false; }, 0); }
    wrap = null; moved = false;
  }
  function onMove(e){
    if(!wrap) return;
    if(e.buttons === 0){ stop(); return; }                 // ボタンを離したのを取りこぼした場合
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if(!moved){
      if(Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      moved = true; wrap.classList.add("dragging");
      const sel = window.getSelection && window.getSelection(); if(sel) sel.removeAllRanges();
    }
    wrap.scrollLeft = sl - dx;
    if(wrap.scrollHeight > wrap.clientHeight) wrap.scrollTop = st - dy;
    e.preventDefault();
  }
  function onUp(){ stop(); }
  document.addEventListener("mousedown", e => {
    if(e.button !== 0 || !e.target.closest) return;
    if(e.target.closest("input, select, textarea, button, label")) return;   // 入力欄は普通に操作できるように
    const w = e.target.closest(".dragscroll");
    if(!w || w.scrollWidth <= w.clientWidth) return;
    const r = w.getBoundingClientRect();
    if(e.clientX - r.left - w.clientLeft > w.clientWidth || e.clientY - r.top - w.clientTop > w.clientHeight) return; // 標準スクロールバー上は触らない
    wrap = w; sx = e.clientX; sy = e.clientY; sl = w.scrollLeft; st = w.scrollTop; moved = false;
    e.preventDefault();                                      // 文字選択・ネイティブドラッグの開始を止める
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("blur", onUp);
  });
  window.addEventListener("click", e => { if(suppress){ e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
})();

/* ===== 詳細モーダル ===== */
function skillHtml(d){
  const rows = [];
  if(d.ex !== null) rows.push({l:"列名なし", n:d.ex, def:false, raw:String(d.ex)});
  SKL.forEach(l => { const e = skEff(d, l); if(e.n !== null || e.raw !== "") rows.push({l, ...e}); });
  if(d.nego) rows.push({l:"交渉・" + d.nego.n, n:d.nego.v, def:false, raw:String(d.nego.v)});
  const grid = rows.map(r => `<div class="skrow${r.def ? " def" : (r.n === null ? " off" : "")}"><span class="skn">${esc(r.l)}</span><span class="bar"><i style="width:${Math.min(r.n ?? 0,100)}%"></i></span><span class="skv">${r.n === null ? esc(skShow(r.raw)) : r.n}</span></div>`).join("");
  const ho = d.hn ? `<dl style="margin:12px 0 0"><dt>HO推奨技能</dt><dd>${esc(d.hn)}${d.hv !== null ? ` <b>${d.hv}</b>` : ""}</dd></dl>` : "";
  const memo = d.sm ? `<div class="skmemo">${esc(d.sm)}</div>` : "";
  const L = liveOf(d.ho), ind = indOf(L.base);
  const lvm = `<div class="lvm">現在SAN <b>${L.san === null ? "—" : L.san}</b> ／ 不定ライン <b>${ind === null ? "—" : ind}</b>${L.insane ? ' ／ <b class="bad">発狂中</b>' : ""}</div><div class="lvm">HP <b>${L.hp === null ? "—" : L.hp}/${L.hpMax === null ? "—" : L.hpMax}</b> ／ MP <b>${L.mp === null ? "—" : L.mp}/${L.mpMax === null ? "—" : L.mpMax}</b></div>`;
  return `<div class="sec">ステータス</div>${lvm}<div class="stg">${STK.map(k => `<div><i>${k}</i><b>${d.st[k] === null ? "—" : d.st[k]}</b></div>`).join("")}</div><div class="sec">技能 <span class="def" style="letter-spacing:0">(薄いグレー=初期値)</span></div><div class="skgrid">${grid}</div>${ho}${memo}`;
}
function modalHtml(d){
  const ranges = d.range.length ? d.range.map(esc).join(" / ") : "—";
  const song = d.song
    ? (safeUrl(d.song.u)
        ? `<a href="${esc(safeUrl(d.song.u))}" target="_blank" rel="noopener noreferrer">${esc(songLabel(d.song))}</a>`
        : esc(songLabel(d.song)))
    : "—";
  const notes = d.notes.length
    ? `<ul class="notes">${d.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : '<span style="color:var(--muted)">未記入</span>';
  return `${portraitHtml(d)}<button class="btn close" id="m-close" aria-label="閉じる">✕</button>
    <div class="mscroll">
    ${hoLine(d, true)}
    <h2 id="m-title">${esc(d.pc)}</h2>
    <div class="sub">${esc(d.pcKana || "")}${d.pcKana ? " ・ " : ""}PL: ${esc(d.pl)}</div>
    <div class="meta">${sexPill(d)}<span class="pill">${d.age}歳</span><span class="pill">${esc(hText(d))}</span></div>
    <dl>
      <dt>能力カテゴリ</dt><dd>${catHtml(d) || "—"}</dd>
      <dt>武器</dt><dd>${esc(d.weapon || "—")}</dd>
      <dt>射程</dt><dd>${ranges}</dd>
      <dt>特徴表</dt><dd>${esc(d.trait || "—")}</dd>
      <dt>文字色</dt><dd>${swatch(d)}</dd>
      <dt>イメソン</dt><dd>${song}</dd>
    </dl>
    <div class="sec">見た目・性格 etc.</div>
    ${notes}
    ${skillHtml(d)}
    <div class="nav">
      <button class="btn" id="m-prev">← 前へ</button>
      <button class="btn" id="m-report" title="このHOのデータの間違いを報告する">報告する</button>
      <button class="btn" id="m-next">次へ →</button>
    </div>
    </div>`;
}
function setOverlay(open){
  $("#overlay").classList.toggle("open", open);
  document.documentElement.classList.toggle("modal-open", open);
}
function openModal(ho){
  const d = D.find(x => x.ho === ho); if(!d) return;
  openHo = ho;
  const m = $("#modal");
  m.style.setProperty("--c", accent(d));
  m.innerHTML = modalHtml(d);
  setOverlay(true);
  history.replaceState(null, "", "#HO" + ho);
  $("#m-close").focus();
}
function closeModal(){
  setOverlay(false);
  openHo = null;
  history.replaceState(null, "", location.pathname + location.search + PAGE_HASH[state.page]);
}
function step(dir){
  const list = current.length ? current : D;
  const i = list.findIndex(x => x.ho === openHo);
  const n = list[(i + dir + list.length) % list.length];
  if(n) openModal(n.ho);
}
$("#overlay").addEventListener("click", e => {
  if(e.target.id === "overlay" || e.target.id === "m-close") closeModal();
  else if(e.target.id === "m-report"){ const ho = openHo; closeModal(); state.rpHo = ho; setPage("reports"); }
  else if(e.target.id === "m-prev") step(-1);
  else if(e.target.id === "m-next") step(1);
});
/* スマホ: モーダル上で左右にスワイプすると前後のキャラへ */
let swipe = null;
$("#modal").addEventListener("touchstart", e => { const t = e.touches[0]; swipe = { x:t.clientX, y:t.clientY }; }, { passive:true });
$("#modal").addEventListener("touchend", e => {
  if(!swipe) return;
  const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  swipe = null;
  if(Math.abs(dx) > 70 && Math.abs(dy) < 45) step(dx < 0 ? 1 : -1);
}, { passive:true });
document.addEventListener("keydown", e => {
  if(openHo === null) return;
  if(e.key === "Escape") closeModal();
  else if(e.key === "ArrowLeft") step(-1);
  else if(e.key === "ArrowRight") step(1);
});
window.addEventListener("hashchange", () => {
  const m = /^#HO(\d+)$/.exec(location.hash);
  if(m) openModal(parseInt(m[1], 10));
  else {
    const p = (location.hash === "#data" || location.hash === "#skills") ? "skills" : location.hash === "#height" ? "height" : location.hash === "#reports" ? "reports" : location.hash === "#board" ? "board" : "chars";
    if(openHo !== null) { setOverlay(false); openHo = null; }
    if(p !== state.page){ state.page = p; render(); }
  }
});

/* ===== 初期化 ===== */
if(location.hash === "#data" || location.hash === "#skills") state.page = "skills";   // #skills は旧URL(ブックマーク用に残す)
else if(location.hash === "#height") state.page = "height";
else if(location.hash === "#reports") state.page = "reports";
else if(location.hash === "#board") state.page = "board";
render();
drawReports();
document.getElementById("lhelp").innerHTML = LOGIN_HELP;
drawNewsBadge();
drawLogin();
drawFooter();
(function(){ const m = /^#HO(\d+)$/.exec(location.hash); if(m) openModal(parseInt(m[1], 10)); })();
