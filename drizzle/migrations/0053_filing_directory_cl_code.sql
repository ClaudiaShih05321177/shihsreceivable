CREATE OR REPLACE FUNCTION public.is_filing_closer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role) OR (public.is_member(_uid) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN','CL')))
$$;
REVOKE ALL ON FUNCTION public.is_filing_closer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_filing_closer(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.filing_customer_directory()
RETURNS TABLE(id uuid, name text, customer_code text, tax_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_filing_closer(auth.uid()) THEN
    RAISE EXCEPTION '只有管理員、CA、MN 或 CL 可以搜尋工商客戶';
  END IF;
  RETURN QUERY SELECT c.id, c.name, c.customer_code, c.tax_id FROM public.customers c WHERE c.archived_at IS NULL ORDER BY c.customer_code NULLS LAST, c.name, c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_filing_customer_code(_customer_id uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := nullif(upper(trim(coalesce(_code,''))), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_filing_closer(auth.uid()) THEN
    RAISE EXCEPTION '沒有權限變更客戶代碼';
  END IF;
  IF c IS NULL THEN RETURN; END IF;
  UPDATE public.customers SET customer_code = c,
    staff_code = CASE WHEN c ~ '^[A-Z]{2}' THEN substr(c,1,2) ELSE staff_code END
  WHERE id = _customer_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_filing_customer_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_filing_customer_code(uuid, text) TO authenticated, service_role;