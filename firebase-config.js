/* ロアドの児従録 ポータル用の設定ファイル
   character_portal.html(index.html)と同じ場所に置く。HTMLを差し替えても、このファイルはそのまま使い回せる */

// ① Firebaseコンソールの「マイアプリ」に出る firebaseConfig を、下の null の代わりにそのまま貼る
//    例: const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", ... };
const firebaseConfig = {
  apiKey: "AIzaSyBhuX48vaAbZqjHKnts-70CQnN9M3s4eAA",
  authDomain: "children-81e2c.firebaseapp.com",
  projectId: "children-81e2c",
  storageBucket: "children-81e2c.firebasestorage.app",
  messagingSenderId: "83378381554",
  appId: "1:83378381554:web:3f9067554820c01ed9e66b"
};

// ② 管理者ID(「修正済みにする」を押せる人)。必ず "" で囲む。複数なら , で区切る
const ADMIN_UIDS = ["aXHRxtCbAhXXAXF1Xb1W8sscwch1"];
