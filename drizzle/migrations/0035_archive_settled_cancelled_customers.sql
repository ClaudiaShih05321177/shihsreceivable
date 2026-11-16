ALTER TABLE public.customers ADD COLUMN archived_at timestamptz;
GRANT SELECT (archived_at) ON public.customers TO authenticated;
CREATE OR REPLACE FUNCTION public.archive_cancelled_customer(_customer_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE balance numeric; excess numeric;
BEGIN
IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION '只有管理員可以移除客戶'; END IF;
PERFORM 1 FROM public.customers WHERE id = _customer_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION '找不到客戶'; END IF;
IF NOT EXISTS (SELECT 1 FROM public.filings f JOIN public.invoices i ON i.id = f.invoice_id AND i.customer_id = _customer_id WHERE f.customer_id = _customer_id AND f.case_type = '註銷登記' AND f.stage = '結案') THEN RAISE EXCEPTION '註銷案件尚未結案立帳'; END IF;
IF EXISTS (SELECT 1 FROM public.filings WHERE customer_id = _customer_id AND (stage <> '結案' OR invoice_id IS NULL)) THEN RAISE EXCEPTION '仍有案件未完成立帳'; END IF;
SELECT COALESCE(sum(i.amount - COALESCE(p.paid, 0)), 0), COALESCE(sum(COALESCE(p.fees,0)),0) INTO balance, excess FROM public.invoices i LEFT JOIN (SELECT invoice_id, sum(amount) paid, sum(bank_fee) fees FROM public.payments GROUP BY invoice_id) p ON p.invoice_id = i.id WHERE i.customer_id = _customer_id;
IF balance > 0 THEN RAISE EXCEPTION '客戶仍有未收清帳款'; END IF;
IF balance < 0 THEN RAISE EXCEPTION '客戶仍有溢繳餘款，請先處理'; END IF;
UPDATE public.customers SET archived_at = now() WHERE id = _customer_id;
END $$;
REVOKE ALL ON FUNCTION public.archive_cancelled_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_cancelled_customer(uuid) TO authenticated, service_role;