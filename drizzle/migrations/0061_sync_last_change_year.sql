ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_change_year integer;

CREATE OR REPLACE FUNCTION public.sync_factory_last_change_year() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y integer;
BEGIN
  IF NEW.stage = '核准結案' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage OR OLD.approved_date IS DISTINCT FROM NEW.approved_date) THEN
    y := extract(year FROM coalesce(NEW.approved_date, (now() AT TIME ZONE 'Asia/Taipei')::date))::int - 1911;
    UPDATE public.factory_customers SET last_change_year = y
     WHERE btrim(name) = btrim(NEW.factory_name);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_factory_last_change_year ON public.factory_registrations;
CREATE TRIGGER trg_factory_last_change_year AFTER INSERT OR UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_factory_last_change_year();

CREATE OR REPLACE FUNCTION public.sync_filing_last_change_year() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y integer;
BEGIN
  IF NEW.stage = '結案' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    y := extract(year FROM coalesce(NEW.tax_approved_date, NEW.approved_date, (now() AT TIME ZONE 'Asia/Taipei')::date))::int - 1911;
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE public.customers SET last_change_year = y WHERE id = NEW.customer_id;
    END IF;
    IF coalesce(btrim(NEW.company_name), '') <> '' THEN
      UPDATE public.factory_customers SET last_change_year = y WHERE btrim(name) = btrim(NEW.company_name);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_filing_last_change_year ON public.filings;
CREATE TRIGGER trg_filing_last_change_year AFTER INSERT OR UPDATE ON public.filings
FOR EACH ROW EXECUTE FUNCTION public.sync_filing_last_change_year();