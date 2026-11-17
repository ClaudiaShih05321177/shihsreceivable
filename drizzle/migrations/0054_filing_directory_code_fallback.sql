CREATE OR REPLACE FUNCTION public.filing_directory_code(_customer_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(trim(c.customer_code), ''), (
    SELECT CASE WHEN count(*) = 1 THEN max(nullif(trim(fc.customer_code), '')) END
    FROM public.factory_customers fc
    WHERE CASE WHEN nullif(trim(c.tax_id),'') IS NOT NULL
      THEN trim(fc.tax_id) = trim(c.tax_id)
      ELSE trim(fc.name) = trim(c.name) END
  )) FROM public.customers c WHERE c.id = _customer_id;
$$;
REVOKE ALL ON FUNCTION public.filing_directory_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.filing_directory_code(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.filing_customer_directory()
RETURNS TABLE(id uuid, name text, customer_code text, tax_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_filing_closer(auth.uid()) THEN
    RAISE EXCEPTION '只有管理員、CA、MN 或 CL 可以搜尋工商客戶';
  END IF;
  RETURN QUERY SELECT c.id, c.name, public.filing_directory_code(c.id), c.tax_id
    FROM public.customers c WHERE c.archived_at IS NULL
    ORDER BY public.filing_directory_code(c.id) NULLS LAST, c.name, c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.filing_customer_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filing_customer_directory() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.filing_customer_names()
RETURNS TABLE(customer_id uuid, name text, customer_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT c.id, c.name, public.filing_directory_code(c.id)
  FROM public.filings f JOIN public.customers c ON c.id=f.customer_id
  WHERE public.is_member(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.filing_customer_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filing_customer_names() TO authenticated, service_role;