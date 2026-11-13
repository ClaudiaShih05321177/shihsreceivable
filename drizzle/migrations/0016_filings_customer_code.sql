ALTER TABLE public.filings ADD COLUMN customer_code TEXT;
COMMENT ON COLUMN public.filings.customer_code IS '新設立案件暫存的客戶代碼；連結客戶後同步寫入 customers.customer_code，前兩位英文字母為會計專員代號。';