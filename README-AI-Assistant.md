# 行程助理使用方式與 Gemini 設定

## 新增、修改行程與任務

- 可直接輸入「幫我新增明天下午三點「微積分讀書」」或「把「微積分讀書」改到下週五 18:30」。也可點「新增行程」或「修改行程」開啟草稿。
- 常見日期、時間與操作由本機程式辨識，不依賴 Gemini。請檢查草稿內的名稱、類型、科目、日期與時間，再按「確認並儲存」。缺少日期或科目時需手動補齊。
- 同名行程必須選擇目標；確認前不寫入資料。更改尚未儲存時可重試，不會重複新增。
- 修改會保留既有備註、提醒時間及子任務。改期後如需調整提醒，請到原行程編輯視窗修改。
- 固定重複課程仍由「固定課表」管理。草稿只保留在目前開啟的頁面，不會隨聊天紀錄保存。
- 本機辨識不是完整自然語言模型；不明確的說法請直接在草稿表單中修正。未啟用 Gemini 時，介面會如實顯示「Gemini 問答未啟用」。

## 刪除行程

- 可輸入「刪除「物理討論」」、「刪除明天全部行程」或「刪除下週全部行程」。助理會列出範圍與項目，按「確認刪除」後才儲存；按「取消」不更動資料。
- 同名項目必須先選擇；日期無效、範圍不明或資料已變更時不執行。只刪除一般行程，課業任務與固定課表保留。
- 「不要刪除」及「你會刪除所有行程嗎？」等否定或疑問句不會啟動刪除。複雜排除條件請改用明確日期或完整名稱。
- 儲存失敗時，可在確認卡重試，不會重複套用變更。

## 功能驗證紀錄

2026-11-22：43 項自動情境與 21 項瀏覽器檢查通過，涵蓋新增、修改、單筆／日期／科目／整週刪除、取消、同名選擇、無效日期、資料變更衝突、儲存失敗重試與服務錯誤。另實際送出 5 次 Gemini 請求，驗證概念解釋、接續問答、課業期限、讀書建議與疑問句不修改資料。

操作使用範例課表及模擬儲存，沒有改動使用者的正式行程；正式 Firestore 測試前後的內容與更新時間雜湊一致。測試副本、對話及畫面已還原，暫時 App Check 憑證已移除。測試程式與報告保留於 `.qa`，不發布到網站。

## Gemini 自由問答

`index.html` 已完成 Firebase AI Logic 與 reCAPTCHA Enterprise App Check 整合，並已開啟 Gemini 自由問答。模型使用 `gemini-3.5-flash-lite`，可說明一般知識、課業觀念與讀書方法；個人行程問題只依附上的資料回答。新增、修改及刪除仍由本機確認流程處理，模型不會直接修改資料。

## Firebase 啟用紀錄

2026-11-21：管理者完成 Firebase Console 的 AI Logic「開始使用」流程後，已確認 `firebasevertexai.googleapis.com` 與 `generativelanguage.googleapis.com` 均為 ENABLED。App Check 已為拾光 Web App 註冊 SCORE 網站金鑰（僅允許正式網域 `chatgptlee0111-art.github.io`、TTL 1 小時、最低風險分數 0.5），且已填入前端公開 site key、開啟 `SHIGUANG_AI_LOGIC_PROVISIONED`。

Gemini 3.8 Flash 的實測曾回傳需求量過高，因此目前採用已實際成功回覆的 Gemini 3.5 Flash-Lite。實測使用不含私人資料的測試句，透過暫時 App Check 憑證取得回覆後立即刪除測試憑證。一般請求逾時上限為 45 秒；額度限制、服務忙碌與 App Check 錯誤會分別顯示提示。

以下步驟供未來更換專案時參考；目前專案無須重複建立金鑰或接受條款。

### 1. 接受 Google Generative Language API 服務條款

新專案若回傳 `TOS_REQUIRED`，請以專案管理者帳號開啟 [Generative Language API 服務條款](https://console.cloud.google.com/terms/generative-language-api?project=i002-1030)閱讀並接受，再完成 Firebase AI Logic「開始使用」流程。

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
