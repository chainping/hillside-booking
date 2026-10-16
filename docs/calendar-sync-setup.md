# 山居學習中心 Google Calendar 同步部署說明

## 架構
管理員審核／取消 → bookings trigger → booking_calendar_sync 待處理佇列 → 定期執行 Supabase Edge Function → 現有 Google Calendar。Google 金鑰只放 Supabase Secrets；學生與管理員網頁不接觸金鑰。

## 上線前必做
1. **先盤點現有日曆活動**：若過去已手動建立核准預約的 Google 活動，先在 `booking_calendar_sync` 補入對應 `google_event_id`，或排除不應重新同步的預約；否則第一次執行可能重複建立。尚未完成盤點前不要啟動排程。
2. Supabase SQL Editor 執行 `supabase/migrations/20261016_calendar_sync.sql`。先確認 `bookings.id` 是 uuid，以及 status / start_at / end_at / room_id / activity_name 欄位存在。
3. 在 Google Cloud 建立服務帳號、啟用 Google Calendar API，取得服務帳號 JSON 私鑰；把**現有山居學習中心 Google Calendar**分享給服務帳號的 `client_email`，權限設「變更活動」。若學校政策禁止服務帳號私鑰，改用受控 OAuth 授權流程，不要把私鑰上傳 GitHub。
4. Supabase Secrets 設定 `GOOGLE_SERVICE_ACCOUNT_JSON`（整份 JSON）、`GOOGLE_CALENDAR_ID`（現有日曆的 Calendar ID）、`CALENDAR_SYNC_SECRET`（隨機高強度字串）；SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 使用 Supabase 後端環境提供的值。**任何金鑰都不可貼到聊天或提交 GitHub。**
5. 部署 `supabase/functions/calendar-sync/index.ts` 為 Edge Function `calendar-sync`。以 Supabase cron / pg_net 或可信任的外部排程每分鐘或每五分鐘 POST 呼叫，HTTP header 設 `x-calendar-sync-secret`；如平台啟用 JWT 驗證，排程亦須依 Supabase 設定提供授權。禁止無驗證公開呼叫。
6. 使用未來的**測試預約**驗證核准後建立、取消後刪除、重試與 409 重複事件處理；確認時間是 Asia/Taipei、活動名稱與場地正確。

## 安全與限制
- 同步是非同步；核准成功不代表 Google 活動已經建立。可查 `booking_calendar_sync.sync_status`、`attempts`、`last_error`。
- 服務帳號必須對**現有日曆**有寫入權限。單純提供 Calendar ID 不足以授權。
- 本版本不會自動匯入 Google Calendar 原有活動，也不會自動修改 `calendar_external_events`；原本外部活動衝突檢查仍須另外驗證。
- 若同一筆預約在同步工作執行中被取消，舊工作的結果可能短暫建立活動；佇列會重新處理最新狀態。正式使用前請測試競態與對帳。
- 刪除時會使用固定 event ID；若事件被人工改名或刪除，404 視為已刪除。不要手動更改自動建立活動的 ID。
- 若已存在核准預約，首次 backfill 可能建立歷史事件；請在啟用排程前處理歷史資料。
