DROP FUNCTION public.update_factory_progress(uuid,text,text,date,date,date,date,date);
CREATE FUNCTION public.update_factory_progress(_id uuid, _stage text, _status_note text, _env_filed_date text, _env_approved_date text, _bureau_filed_date text, _inspection_date text, _approved_date text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND upper(trim(staff_code)) = 'MN'))) THEN RAISE EXCEPTION '只有管理員或 MN 可變更工廠進度' USING ERRCODE = '42501'; END IF;
  IF _stage NOT IN ('送件環保', '環保核准', '送件工商科', '現場會勘', '核准結案') OR _stage IS NULL THEN RAISE EXCEPTION '無效的工廠進度'; END IF;
  UPDATE public.factory_registrations SET stage = _stage, status_note = nullif(trim(_status_note), ''), env_filed_date = nullif(_env_filed_date, '')::date, env_approved_date = nullif(_env_approved_date, '')::date, bureau_filed_date = nullif(_bureau_filed_date, '')::date, inspection_date = nullif(_inspection_date, '')::date, approved_date = nullif(_approved_date, '')::date WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到工廠案件'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_factory_progress(uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_factory_progress(uuid,text,text,text,text,text,text,text) TO authenticated, service_role;