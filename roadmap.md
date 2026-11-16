# Roadmap

- [x] 工廠訂金自動算稅金：訂金維持手動輸入（可修改），系統自動拆成未稅＋5%稅，顯示於編輯視窗、勤豐應收帳款列表及訂金請款單；18項測試通過，管理員畫面驗證通過。

- [x] 管理員可直接開啟工廠登記進度，並使用「變更進度」按鈕；管理員儲存階段／Status 並重載驗證成功，23項測試通過，原資料已還原。

- [x] 開放 MN 新增工廠案件；23項測試通過，MN 實際新增並重載確認、日期空白且不能新增帳款金額，暫存案件已清除。

- [x] 智能核對入帳：網銀無 Excel、只能截圖 → /reconcile 上傳截圖由 AI 辨識存入交易（日期/金額/匯款人），建議配對未收帳款（名稱+金額、合併付款、溢收、部分收款），管理員確認後登錄收款；bank_transactions 指紋防重複入帳。19 項新測試通過，管理員實測上傳截圖辨識 3 筆、確認入帳 2 筆成功，暫存資料已清除。

- [x] MN 可查看工廠進度並修改階段、狀況與進度日期；22項測試通過，MN 實際儲存並重載確認、勤豐帳款頁仍禁止存取，驗證後還原原進度。

- [x] 工商代辦費收據：只列代辦費、管理員隨時列印、日期預設空白；3項測試通過，已驗證未立帳案件8,000元收據、民國日期及電腦／手機畫面，暫存案件已清除。

- [x] 註銷結案且所有帳款收清後詢問管理員是否移除客戶；保留歷史帳務，63項相關測試通過，實際驗證保留、確認移除及歷史請款單，暫存資料已清除。

- [x] 溢繳自動折抵後期帳款，請款單分列；跨期與不重複折抵測試通過，管理員實際登錄6,000元／帳款5,000元，下一期5,000元折抵1,000元後請款4,000元；暫存測試資料已清除。

- [x] 修正半年收獎金分攤：客戶記帳費為半年總額÷3，華珍12,000元每期4,000元；10項測試及管理員頁面驗證通過，不修改立帳規則或客戶資料。

- [x] 年度加收獎金特殊%僅管理員查看及編輯：撤銷直接讀取私密欄位，改走管理員檢查；19項測試通過，管理員儲存與重載已驗證並還原原值，尚無一般使用者帳號供登入驗證。
- [x] 每位會計專員獎金總和下新增確認簽名空白欄，依Excel提供手寫簽名位置；9位專員均已於電腦及手機畫面驗證。

- [x] 修正會計專員獎金漏計期收與半年收記帳費：未立帳仍依客戶設定計入，期收月費×2、半年收分三期且不重複計帳；17項測試通過，管理員畫面264位期收及2位半年收逐戶金額與合計驗證通過。

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
- [x] 收費狀態加入「停業」選項；資料庫 29 筆「暫停/暫停-22」改為「停業/停業-22」、20 個客戶名稱的「暫停」改為「停業」；表單下拉與客戶資料已登入驗證。
- [x] 收費狀態「停業-22」改成「停業」（4 位）；刪除收費狀態「繕歇」的客戶宏年機電（無應收帳款）；瀏覽器確認。
- [x] 停業客戶記帳費、文具費、結算費歸零（自動帶入、一鍵立帳、表單切換停業即歸零；32 位現有停業客戶已更新）
- [x] 客戶資料以統編帶入經濟部商工公示資料（名稱、負責人、地址）
- [x] 工商進度表並與應收帳款連接（預查→送件→核准→結案；結案一鍵立帳，代辦費＋代墊規費合併一筆；瀏覽器驗證通過）
- [x] BF09 獎金改為每期只固定算一筆 5 萬元（同編號兩戶合計一筆；記帳費立帳不變）；測試通過、獎金頁瀏覽器驗證通過
- [x] BI06 不收費但每期固定計入獎金 5,000 元；CL09 完全不計入獎金；測試通過、獎金頁瀏覽器驗證通過
- [x] 工商進度表加國稅局進度、只送國稅局、新設立無統編案件
- [x] 工商進度表：統編新增客戶（同仁可建）、代墊規費/印章同仁可填、代辦費僅管理員、客戶代碼派案（前兩碼＝會計專員，取代會計專員代號欄）、結案併入雙月記帳費帳款
- [x] 稅額明細：扣繳與二代健保拆第1／第2個月各自勾選已繳費與日期（舊勾選紀錄兩個月皆沿用）
- [x] 工商進度表：經濟部改稱主管機關、新增「只送主管機關」流程、特許目的事業主管機關與日期、應收帳款欄僅管理員可見
- [x] 公司切換（施慶豐事務所／勤豐工商顧問有限公司）
- [x] 勤豐工廠登記進度表（廠名/申辦項目/Status/聯絡人/備註；環保與會勘選辦；各單位送件與完成日期）＋專案應收帳款（報價/訂金/尾款/規費/其他費用/收款日期）
- [x] 所有頁籤日期欄位預設空白
- [x] 展延停業結案自動延一年、更新客戶停業期間
- [x] 稅額明細只拆租金扣繳、租金二代兩個月；1月收1-2月期別
- [x] 費用欄位顯示名稱對齊欄位代碼（無重複名稱）；11月文具費、1月結算費自動帶入改用同名欄位（文具／結算）；52項測試通過、表單畫面驗證
- [x] 費用欄位照使用者指定順序排列；未加徵改名「加徵5%營所稅」；工商結案立帳代辦費改存「工商」欄位；123項測試全數通過、表單順序畫面驗證
- [x] 勤豐進度：填入日期後自動更新對應階段
