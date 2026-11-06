# 拾光 Google 登入設定教學（Firebase）

本網站使用 Firebase Authentication 的 Google Provider。`index.html` 已加入登入畫面與登入狀態守門；尚未填入 Firebase Web 設定前，網站會安全地顯示設定提示而不顯示課表。

## 步驟一：建立 Firebase 專案
1. 開啟 [Firebase Console](https://console.firebase.google.com/)，以 Google 帳號登入。
2. 點「新增專案」，輸入專案名稱（例如 `shiguang-planner`），依畫面完成建立。
3. 在專案總覽按網頁圖示 `</>` 新增 Web App，輸入暱稱（例如「拾光課業行程」）。
4. 註冊後，Firebase 顯示 Web app 的 `firebaseConfig`。複製其中 `apiKey`、`authDomain`、`projectId`、`appId` 四個值；不要把任何服務帳號私鑰或 Admin SDK 金鑰貼到網頁。

## 步驟二：啟用 Google 登入
1. Firebase Console 左側選「Build → Authentication → Get started」。
2. 開「Sign-in method」或「Sign-in providers」，選 Google，按「Enable」。
3. 選擇支援電子郵件，按「Save」。若 Firebase 要求設定 OAuth 支援電子郵件或同意畫面，照 Google/Firebase 畫面完成。

## 步驟三：加上 GitHub Pages 網域
1. Firebase Console → Authentication → Settings → Authorized domains。
2. 加入 `chatgptlee0111-art.github.io`（只填網域，不要加 `https://`、路徑或尾端斜線）。
3. `localhost` 僅供本機測試；正式網站使用以上 GitHub Pages 網域。

## 步驟四：把 Web 設定填入 index.html
在 `index.html` 找到：

```js
const firebaseConfig = window.SHIGUANG_FIREBASE_CONFIG;
```

緊接著在它前面加入 Firebase Console 提供的公開 Web 設定（以你自己的值替換）：

```js
window.SHIGUANG_FIREBASE_CONFIG = {
  apiKey: "你的 apiKey",
  authDomain: "你的專案ID.firebaseapp.com",
  projectId: "你的專案ID",
  appId: "你的 appId"
};
const firebaseConfig = window.SHIGUANG_FIREBASE_CONFIG;
```

Firebase Web config 是識別用設定，不是 Admin 私鑰；仍應在 Firebase/Google Cloud 設定適當 API 限制。**不要**將 service account JSON、私鑰、OAuth client secret 放入 HTML、GitHub 或本文件。

## 步驟五：部署並驗證
1. 儲存 `index.html`，提交並推送到 GitHub Pages 使用的 `10/30` 分支。
2. 等 GitHub Actions 的 `pages build and deployment` 成功。
3. 開啟 `https://chatgptlee0111-art.github.io/class_B_I002/`，確認未登入時只看到登入畫面。
4. 點「使用 Google 帳戶繼續」，選擇帳戶並完成授權；登入後應能看到拾光總覽，右上方顯示帳號並可登出。
5. 登出後重新整理，應再次只顯示登入畫面。

## 重要安全說明
目前登入功能是**前端登入閘門**：它可以控制一般訪客的頁面顯示，但 GitHub Pages 會把靜態檔案公開提供下載。若課表資料、程式碼或 API 本身不可公開，不能只靠隱藏 HTML；必須改用 Firebase Hosting 搭配伺服器端驗證，並將資料放到有 Firebase Security Rules 保護的 Firestore/服務端。現有行程存在瀏覽器 localStorage，登入不會自動加密或跨裝置同步這些資料。
