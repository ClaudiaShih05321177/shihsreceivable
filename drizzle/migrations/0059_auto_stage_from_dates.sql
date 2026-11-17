CREATE OR REPLACE FUNCTION public.factory_stage_from_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE stages text[] := ARRAY['送件環保','環保核准','送件工商科','現場會勘','核准結案']; hit text;
BEGIN
  IF NEW.stage = '未成交結案' THEN RETURN NEW; END IF;
  hit := CASE WHEN NEW.approved_date IS NOT NULL THEN '核准結案' WHEN NEW.inspection_date IS NOT NULL THEN '現場會勘'
    WHEN NEW.bureau_filed_date IS NOT NULL THEN '送件工商科' WHEN NEW.env_approved_date IS NOT NULL THEN '環保核准'
    WHEN NEW.env_filed_date IS NOT NULL THEN '送件環保' END;
  IF hit IS NOT NULL AND array_position(stages, hit) > coalesce(array_position(stages, NEW.stage), 0) THEN NEW.stage := hit; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS factory_stage_from_dates ON public.factory_registrations;
CREATE TRIGGER factory_stage_from_dates BEFORE INSERT OR UPDATE ON public.factory_registrations FOR EACH ROW EXECUTE FUNCTION public.factory_stage_from_dates();

CREATE OR REPLACE FUNCTION public.filing_stage_from_dates() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE stages text[] := ARRAY['預查','送件','核准','國稅局送件','國稅局核准','結案']; hit text;
BEGIN
  IF NEW.stage = '結案' THEN RETURN NEW; END IF;
  hit := CASE
    WHEN NEW.route <> '只送主管機關' AND NEW.tax_approved_date IS NOT NULL THEN '國稅局核准'
    WHEN NEW.route <> '只送主管機關' AND NEW.tax_filed_date IS NOT NULL THEN '國稅局送件'
    WHEN NEW.route <> '只送國稅局' AND NEW.approved_date IS NOT NULL THEN '核准'
    WHEN NEW.route <> '只送國稅局' AND NEW.filed_date IS NOT NULL THEN '送件' END;
  IF hit IS NOT NULL AND array_position(stages, hit) > coalesce(array_position(stages, NEW.stage), 0) THEN NEW.stage := hit; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS filing_stage_from_dates ON public.filings;
CREATE TRIGGER filing_stage_from_dates BEFORE INSERT OR UPDATE ON public.filings FOR EACH ROW EXECUTE FUNCTION public.filing_stage_from_dates();

UPDATE public.factory_registrations SET stage = stage WHERE coalesce(env_filed_date, env_approved_date, bureau_filed_date, inspection_date, approved_date) IS NOT NULL;
UPDATE public.filings SET stage = stage WHERE coalesce(filed_date, approved_date, tax_filed_date, tax_approved_date) IS NOT NULL;