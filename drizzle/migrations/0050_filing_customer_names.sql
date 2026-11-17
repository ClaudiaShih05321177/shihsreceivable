CREATE OR REPLACE FUNCTION public.filing_customer_names()
RETURNS TABLE(customer_id uuid, name text, customer_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT c.id, c.name, c.customer_code
  FROM public.filings f JOIN public.customers c ON c.id = f.customer_id
  WHERE public.is_member(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.filing_customer_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filing_customer_names() TO authenticated;