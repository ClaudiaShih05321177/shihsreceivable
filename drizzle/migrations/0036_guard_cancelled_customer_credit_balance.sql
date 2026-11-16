CREATE OR REPLACE FUNCTION public.archive_cancelled_customer(_customer_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; available numeric := 0;
BEGIN
IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION '只有管理員可以移除客戶'; END IF;
PERFORM 1 FROM public.customers WHERE id = _customer_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION '找不到客戶'; END IF;
IF NOT EXISTS (SELECT 1 FROM public.filings f JOIN public.invoices i ON i.id = f.invoice_id AND i.customer_id = _customer_id WHERE f.customer_id = _customer_id AND f.case_type = '註銷登記' AND f.stage = '結案') THEN RAISE EXCEPTION '註銷案件尚未結案立帳'; END IF;
IF EXISTS (SELECT 1 FROM public.filings WHERE customer_id = _customer_id AND (stage <> '結案' OR invoice_id IS NULL)) THEN RAISE EXCEPTION '仍有案件未完成立帳'; END IF;
FOR r IN SELECT COALESCE(i.period_year,0) y, COALESCE(i.period_month,0) m, sum(greatest(0,i.amount-COALESCE(p.paid,0))) due, sum(greatest(0,COALESCE(p.cash,0)-i.amount)) extra FROM public.invoices i LEFT JOIN (SELECT invoice_id,sum(amount) paid,sum(amount-COALESCE(bank_fee,0)) cash FROM public.payments GROUP BY invoice_id) p ON p.invoice_id=i.id WHERE i.customer_id=_customer_id GROUP BY COALESCE(i.period_year,0),COALESCE(i.period_month,0) ORDER BY y,m LOOP
IF r.due > available THEN RAISE EXCEPTION '客戶仍有未收清帳款'; END IF;
available := available - r.due + r.extra;
END LOOP;
IF available > 0 THEN RAISE EXCEPTION '客戶仍有溢繳餘款，請先處理'; END IF;
UPDATE public.customers SET archived_at=now() WHERE id=_customer_id;
END $$;
REVOKE ALL ON FUNCTION public.archive_cancelled_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_cancelled_customer(uuid) TO authenticated, service_role;