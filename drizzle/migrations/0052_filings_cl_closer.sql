DROP POLICY IF EXISTS "Admins and closers insert filings" ON public.filings;
CREATE POLICY "Admins and closers insert filings" ON public.filings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN','CL'))));
DROP POLICY IF EXISTS "Admins and closers update filings" ON public.filings;
CREATE POLICY "Admins and closers update filings" ON public.filings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN','CL'))))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN','CL'))));
CREATE OR REPLACE FUNCTION public.close_filing(_filing_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f public.filings%ROWTYPE; p text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND upper(trim(coalesce(pr.staff_code,''))) IN ('CA','MN','CL') AND public.is_member(auth.uid()))) THEN
    RAISE EXCEPTION '只有 CA、MN、CL 專員或管理員可以結案';
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