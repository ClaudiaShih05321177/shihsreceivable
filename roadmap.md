# Roadmap

- [x] 管理員專用記帳員獎金頁：依新版Excel AC李瓊如表，當期記帳費超過20萬元部分×30%；實測25萬元→1.5萬元，測試帳款已清除；無一般使用者帳號可做登入驗證。

- [x] 移除應收帳款表單的到期日及單號欄位，保留既有帳款資料；已登入檢查表單。

- [x] Update receivable bookkeeping defaults: monthly fee × 2 in odd collection months; create/save/reload verified without changing existing invoices.
- [x] Prefill stationery only in November and settlement only in January; schedules tested and verified in signed-in UI.

- [x] Lovable Cloud, sign-in (email, Google, Lovable), team approval (first user = admin)
- [x] Receivables rules + tests (status, overdue, aging, monthly series)
- [x] Match the user's 應收帳款Sample.xlsx: client fields (客戶ID, 統編, 年收/期收, 記帳費/文具費/結算費, 停業期間, 記帳員工ID), billing rows with 月份/期別 and itemized fees (記帳費…其他), payments with 登帳日期/收款日期/支付方式(現金/支票/匯款/代墊)/收款金額
- [x] Pages: dashboard (overdue reminders, charts), receivables list + detail, customers list + detail, team approvals
- [x] ROC date display (115/1/15)
- [x] Verify end-to-end in browser, commit
- [x] Due date optional, no default (user: 不用預設到期日)
- [x] Import 115應收帳款.xlsx (客戶資料 + 總帳); due dates left blank per user
- [ ] In-app Excel import button (not yet requested to build)
- [x] Clear all receivables + payments, keep the 416 clients (user request)
- [ ] (Open, needs user) 「我要重新安排」— ask what the user wants to rearrange
- [x] 「其他」自訂項目：應收帳款可自行增列說明＋金額（存 items jsonb，鍵「其他：說明」），表單/明細/請款單顯示；測試通過、瀏覽器驗證（測試帳款已刪）
- [x] 營業稅計算區塊移到費用項目最上方（營業稅附近）
- [x] 文具費11月、結算費1月改帶入各自同名的顯示欄位；工商代辦費及印章代刻不自動帶入，保留已存帳款與手動金額。
- [x] Revised permissions enforced in UI and RLS: only admins settle, edit/delete and manage accounts; members view and create receivables. Permission tests passed; admin create/payment/delete/sign-out flow verified. No ordinary-user account available for a signed-in browser check.
- [x] Sort by 月份/期別: clickable column header on the receivables list and the tax detail page (由新到舊 → 由舊到新 → 回復原序), comparator tested in receivables.test.ts; verified in the signed-in UI with temporary rows that were then deleted.
- [x] 扣繳稅額 彙總範圍確認：22-1申報 不列入稅額明細；二代健保維持獨立一類。
- [x] 股利2代 從二代健保拆出，在稅額明細獨立為「股利二代」稅目；TAX_GROUPS 更新、稅目篩選與合計卡片自動帶入，測試通過、build OK。
- [x] 財稅簽頁：三位會計師（秉誠、詮益、眾智）分列、合計、收款狀態、已付會計師勾選與日期；應收帳款可選會計師。
- [x] 自動請款：一鍵立帳（依收款月份排定費用）＋可列印請款單（照事務所樣本，含前期未收餘額與匯款帳號）。
- [x] 營業稅 銷項／進項／上期留抵 於應收帳款計算並帶入營業稅，留抵自動結轉，請款單顯示。
- [x] 欄位名稱可自行管理：費用欄位改名、隱藏、恢復預設（fee_labels 表，管理員可改，全團隊共用），應收帳款／請款單／稅額明細一起跟著變。
- [x] 依使用者要求移除「欄位名稱」功能：改名/隱藏改由對話維護（FEE_LABELS 於 src/lib/fee-labels.ts），fee_labels 表標記 DEPRECATED；同時刪除最後一個沒有名稱的費用欄位「其他」。25 個欄位名稱全部保留、無空白欄位，測試通過、瀏覽器確認通過。

- [x] 獎金：年收1/6、結算費、年度加收特別%、明細欄位
- [x] 所有頁面「記帳員」改「會計專員」
