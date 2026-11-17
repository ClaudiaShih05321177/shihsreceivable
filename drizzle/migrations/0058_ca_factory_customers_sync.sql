CREATE OR REPLACE FUNCTION public.can_use_factory_customers(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role) OR (public.is_member(_uid) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _uid AND upper(trim(both from coalesce(p.staff_code,''))) IN ('MN','CA')))
$$;

CREATE OR REPLACE FUNCTION public.sync_filing_factory_customer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code text; nm text; tid text;
BEGIN
  SELECT nullif(upper(trim(coalesce(c.customer_code, ''))), ''), c.name, c.tax_id INTO code, nm, tid FROM public.customers c WHERE c.id = NEW.customer_id;
  code := coalesce(nullif(upper(trim(coalesce(NEW.customer_code,''))), ''), code);
  nm := coalesce(nm, nullif(trim(coalesce(NEW.company_name,'')), ''));
  IF code IS NULL OR code !~ '^CF' OR nm IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factory_customers fc WHERE upper(trim(fc.customer_code)) = code) THEN
    INSERT INTO public.factory_customers (customer_code, name, tax_id, created_by) VALUES (code, nm, tid, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS filings_sync_factory_customer ON public.filings;
CREATE TRIGGER filings_sync_factory_customer AFTER INSERT OR UPDATE OF customer_code, customer_id, company_name ON public.filings FOR EACH ROW EXECUTE FUNCTION public.sync_filing_factory_customer();

INSERT INTO public.factory_customers (customer_code, name, tax_id)
SELECT DISTINCT ON (code) code, nm, tid FROM (
  SELECT upper(trim(coalesce(nullif(trim(f.customer_code),''), c.customer_code))) AS code, coalesce(c.name, nullif(trim(f.company_name),'')) AS nm, c.tax_id AS tid
  FROM public.filings f LEFT JOIN public.customers c ON c.id = f.customer_id) s
WHERE code ~ '^CF' AND nm IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.factory_customers fc WHERE upper(trim(fc.customer_code)) = s.code);