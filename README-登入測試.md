# 山居學習中心 Google 登入串接測試（非正式版）

此壓縮檔保留原本 frontend-demo 展示版的 index.html、app.js、styles.css 與場地照片；新增 auth-test.html / auth-test.js 用於實際 Supabase Google OAuth 登入測試。

## Mac 測試

1. 解壓縮，進入此資料夾（包含 auth-test.html）。
2. 在 Finder 對資料夾按右鍵或將資料夾拖入終端機：終端機輸入 `cd `（尾端空格），拖入資料夾，按 Enter。
3. 輸入 `python3 -m http.server 3000`。
4. Chrome 開啟 http://localhost:3000/auth-test.html。

## Supabase Authentication → URL Configuration

- Site URL: http://localhost:3000
- Redirect URLs: 新增 `http://localhost:3000/auth-test.html`（完整網址，不用 *）。

Google Cloud OAuth 用戶端的 Authorized redirect URI 應為 Supabase 提供的 `https://urgmjidcjrglyfgoohtx.supabase.co/auth/v1/callback`，**不是** localhost。Google OAuth 測試模式下，測試帳號須在 Google Auth Platform 的測試使用者清單中。

## 安全與進度

- Publishable key 是公開金鑰，前端可使用；絕不可放入 service_role、sb_secret 或 Google OAuth Client Secret。
- 登入頁只展示身分狀態，沒有新增/修改任何預約。
- 原本 index.html 仍是 localStorage 展示版；不得用於真實學生預約或管理員審核。
- Google 登入本身不會阻止非政大 Google 帳號登入 Supabase。登入頁的 Email 格式提示不是安全邊界；後端預約 RPC 必須驗證身分與權限。之後還須測試帳號 email_verified 等資訊及 RLS / RPC 權限。
- 正式版仍需將預約送出、我的申請、公開日曆、管理員後台、通知與 Google Calendar 同步逐項接上真實後端。
