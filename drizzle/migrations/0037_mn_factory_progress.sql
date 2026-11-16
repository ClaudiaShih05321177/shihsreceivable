CREATE OR REPLACE FUNCTION public.update_factory_progress(_id uuid, _stage text, _status_note text, _env_filed_date date, _env_approved_date date, _bureau_filed_date date, _inspection_date date, _approved_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND upper(trim(staff_code)) = 'MN'))) THEN
    RAISE EXCEPTION '只有管理員或 MN 可變更工廠進度' USING ERRCODE = '42501';
  END IF;
  IF _stage NOT IN ('送件環保', '環保核准', '送件工商科', '現場會勘', '核准結案') OR _stage IS NULL THEN RAISE EXCEPTION '無效的工廠進度'; END IF;
  UPDATE public.factory_registrations SET stage = _stage, status_note = nullif(trim(_status_note), ''), env_filed_date = _env_filed_date, env_approved_date = _env_approved_date, bureau_filed_date = _bureau_filed_date, inspection_date = _inspection_date, approved_date = _approved_date WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到工廠案件'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_factory_progress(uuid,text,text,date,date,date,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_factory_progress(uuid,text,text,date,date,date,date,date) TO authenticated, service_role;