ALTER TABLE public.factory_registrations ADD COLUMN discount numeric NOT NULL DEFAULT 0, ADD COLUMN quote_terms jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.set_factory_quote_terms(_id uuid, _terms jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_mn(auth.uid()) THEN RAISE EXCEPTION '只有管理員或 MN 可修改報價條款' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(_terms) <> 'object' THEN RAISE EXCEPTION '條款格式錯誤'; END IF;
  UPDATE public.factory_registrations SET quote_terms = _terms WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION '找不到工廠案件'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_factory_quote_terms(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_factory_quote_terms(uuid, jsonb) TO authenticated, service_role;