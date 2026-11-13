ALTER TABLE public.filings ADD COLUMN IF NOT EXISTS suspended_period text;
CREATE OR REPLACE FUNCTION public.close_filing(_filing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.filings%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(p.staff_code) IN ('CA','MN') AND public.is_member(auth.uid()))) THEN
    RAISE EXCEPTION '只有 CA、MN 專員或管理員可以結案';
  END IF;
  SELECT * INTO f FROM public.filings WHERE id = _filing_id;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到案件'; END IF;
  UPDATE public.filings SET stage = '結案' WHERE id = _filing_id;
  IF f.customer_id IS NOT NULL THEN
    IF f.case_type IN ('停業登記','停復業登記','展延停業') THEN
      UPDATE public.customers SET billing_type = '停業', suspended_period = COALESCE(NULLIF(trim(f.suspended_period),''), suspended_period) WHERE id = f.customer_id;
    ELSIF f.case_type = '復業登記' THEN
      UPDATE public.customers SET billing_type = '期收', suspended_period = NULL WHERE id = f.customer_id AND billing_type LIKE '停業%';
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.close_filing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_filing(uuid) TO authenticated;