# 行程助理使用方式與 Gemini 設定

## 新增、修改行程與任務

- 可直接輸入「幫我新增明天下午三點「微積分讀書」」或「把「微積分讀書」改到下週五 18:30」。也可點「新增行程」或「修改行程」開啟草稿。
- 常見日期、時間與操作由本機程式辨識，不依賴 Gemini。請檢查草稿內的名稱、類型、科目、日期與時間，再按「確認並儲存」。缺少日期或科目時需手動補齊。
- 同名行程必須選擇目標；確認前不寫入資料。更改尚未儲存時可重試，不會重複新增。
- 修改會保留既有備註、提醒時間及子任務。改期後如需調整提醒，請到原行程編輯視窗修改。
- 固定重複課程仍由「固定課表」管理。草稿只保留在目前開啟的頁面，不會隨聊天紀錄保存。
- 本機辨識不是完整自然語言模型；不明確的說法請直接在草稿表單中修正。未啟用 Gemini 時，介面會如實顯示「Gemini 問答未啟用」。

## Gemini 自由問答

`index.html` 已加入 Firebase AI Logic 前端整合、App Check 初始化位置與行程助理介面。Gemini 使用穩定模型 `gemini-3.8-flash`；刪除行程由網頁本地程式處理，並會先要求確認，不會讓 Gemini 直接修改資料。

## 尚須完成的 Firebase 設定

### 1. 接受 Google Generative Language API 服務條款

Firebase CLI 初始化回報專案尚未接受此條款。請以專案管理者帳號開啟 [Generative Language API 服務條款](https://console.cloud.google.com/terms/generative-language-api?project=i002-1030)並自行接受。

### 2. 啟用 Firebase AI Logic

接受條款後，在本專案資料夾執行：

```powershell
.\node_modules\.bin\firebase.cmd init ailogic --project i002-1030 --interactive
```

選取 `拾光課業行程` Web App。成功完成後，將 `index.html` 裡的 `window.SHIGUANG_AI_LOGIC_PROVISIONED` 設為 `true`。

### 3. 設定正式網站的 App Check

Firebase AI Logic 的 Web 請求需要 App Check。請在 Google Cloud 的專案 `i002-1030` 建立 reCAPTCHA Enterprise Web key，允許正式網站網域 `chatgptlee0111-art.github.io`，再到 Firebase Console 的 **Security → App Check**，為 `拾光課業行程` Web App 註冊此 key。

把取得的 **site key（公開金鑰）** 填入 `index.html`：

```js
window.SHIGUANG_RECAPTCHA_ENTERPRISE_SITE_KEY = '你的 reCAPTCHA Enterprise site key';
```

不要把 reCAPTCHA secret、服務帳號私鑰或 Gemini API key 放進前端。正式 key 不要加入 `localhost` 網域。

## 助理行為與資料範圍

- 問題及未來 14 天必要的行程名稱、科目、日期、時間與固定課表資料會送給 Google Gemini；備註不會傳送。
- 對話紀錄只保存在目前瀏覽器的 `localStorage`，不寫入 Firestore。
- 「比較哪天比較空」在瀏覽器依本週或下週行程計算；時間區間為 08:00–22:00，沒有結束時間的一般行程暫以 1 小時計算，作業期限另列且不計入占用時間。
- 「刪除所有行程」只會刪除一般行程項目，執行前顯示確認；課業任務與固定課表會保留。
- 網頁版透過 GitHub Pages 發佈時，請確保 `ai-assistant.js`、`assistant-actions.js`、`workspace.css` 與 `index.html` 一起發佈。
