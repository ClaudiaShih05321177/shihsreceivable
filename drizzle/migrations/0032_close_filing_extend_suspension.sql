CREATE OR REPLACE FUNCTION public.extend_suspended_period(_p text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE m text[]; y int; mo int; ey int; em int;
BEGIN
  m := regexp_match(trim(coalesce(_p,'')), '(\d{2,3})/(\d{1,2})(?:/\d{1,2})?\s*[-~～－至]\s*(\d{2,3})/(\d{1,2})(?:/\d{1,2})?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  y := m[3]::int; mo := m[4]::int + 1;
  IF mo > 12 THEN mo := 1; y := y + 1; END IF;
  ey := y + 1; em := mo - 1;
  IF em < 1 THEN em := 12; ey := ey - 1; END IF;
  RETURN y || '/' || mo || '-' || ey || '/' || em;
END $$;

CREATE OR REPLACE FUNCTION public.close_filing(_filing_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f public.filings%ROWTYPE; p text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND upper(pr.staff_code) IN ('CA','MN') AND public.is_member(auth.uid()))) THEN
    RAISE EXCEPTION '只有 CA、MN 專員或管理員可以結案';
  END IF;
  SELECT * INTO f FROM public.filings WHERE id = _filing_id;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到案件'; END IF;
  p := NULLIF(trim(f.suspended_period),'');
  IF p IS NULL AND f.case_type = '展延停業' AND f.customer_id IS NOT NULL THEN
    SELECT public.extend_suspended_period(c.suspended_period) INTO p FROM public.customers c WHERE c.id = f.customer_id;
  END IF;
  UPDATE public.filings SET stage = '結案', suspended_period = COALESCE(p, suspended_period) WHERE id = _filing_id;
  IF f.customer_id IS NOT NULL THEN
    IF f.case_type IN ('停業登記','停復業登記','展延停業') THEN
      UPDATE public.customers SET billing_type = '停業', suspended_period = COALESCE(p, suspended_period) WHERE id = f.customer_id;
    ELSIF f.case_type = '復業登記' THEN
      UPDATE public.customers SET billing_type = '期收', suspended_period = NULL WHERE id = f.customer_id AND billing_type LIKE '停業%';
    END IF;
  END IF;
END $function$;