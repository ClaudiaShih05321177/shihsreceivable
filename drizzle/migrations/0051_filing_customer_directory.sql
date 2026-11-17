CREATE OR REPLACE FUNCTION public.filing_customer_directory()
RETURNS TABLE(id uuid, name text, customer_code text, tax_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN')))) THEN
    RAISE EXCEPTION '只有管理員、CA 或 MN 可以搜尋工商客戶';
  END IF;
  RETURN QUERY SELECT c.id, c.name, c.customer_code, c.tax_id FROM public.customers c WHERE c.archived_at IS NULL ORDER BY c.customer_code NULLS LAST, c.name, c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.filing_customer_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filing_customer_directory() TO authenticated, service_role;