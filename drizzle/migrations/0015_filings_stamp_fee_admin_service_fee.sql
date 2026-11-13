ALTER TABLE public.filings ADD COLUMN stamp_fee numeric NOT NULL DEFAULT 0;
REVOKE SELECT, INSERT, UPDATE ON public.filings FROM authenticated;
GRANT SELECT (id, customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, invoice_id, notes, created_by, created_at, updated_at, company_name, route, tax_filed_date, tax_approved_date) ON public.filings TO authenticated;
GRANT INSERT (customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, notes, company_name, route, tax_filed_date, tax_approved_date) ON public.filings TO authenticated;
GRANT UPDATE (customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, invoice_id, notes, company_name, route, tax_filed_date, tax_approved_date) ON public.filings TO authenticated;
CREATE OR REPLACE FUNCTION public.filing_service_fees()
RETURNS TABLE(filing_id uuid, service_fee numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION '只有管理員可以查看工商代辦費' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT f.id, f.service_fee FROM public.filings f;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_filing_service_fee(_filing_id uuid, _fee numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION '只有管理員可以輸入工商代辦費' USING ERRCODE = '42501';
  END IF;
  UPDATE public.filings SET service_fee = round(coalesce(_fee, 0)) WHERE id = _filing_id;
END;
$$;
REVOKE ALL ON FUNCTION public.filing_service_fees() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_filing_service_fee(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filing_service_fees() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_filing_service_fee(uuid, numeric) TO authenticated;
DROP POLICY "Admins insert customers" ON public.customers;
CREATE POLICY "Members insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));