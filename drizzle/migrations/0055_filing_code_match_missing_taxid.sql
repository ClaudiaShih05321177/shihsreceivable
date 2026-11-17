CREATE OR REPLACE FUNCTION public.filing_directory_code(_customer_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(trim(c.customer_code), ''), (
    WITH candidates AS (
      SELECT fc.customer_code,
        CASE WHEN nullif(trim(c.tax_id),'') IS NOT NULL AND trim(fc.tax_id)=trim(c.tax_id) THEN 1 ELSE 2 END AS priority
      FROM public.factory_customers fc
      WHERE (nullif(trim(c.tax_id),'') IS NOT NULL AND trim(fc.tax_id)=trim(c.tax_id))
        OR (trim(fc.name)=trim(c.name) AND (nullif(trim(c.tax_id),'') IS NULL OR nullif(trim(fc.tax_id),'') IS NULL OR trim(fc.tax_id)=trim(c.tax_id)))
    )
    SELECT CASE WHEN count(*)=1 THEN max(nullif(trim(customer_code),'')) END
    FROM candidates WHERE priority=(SELECT min(priority) FROM candidates)
  )) FROM public.customers c WHERE c.id=_customer_id;
$$;
REVOKE ALL ON FUNCTION public.filing_directory_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.filing_directory_code(uuid) TO service_role;