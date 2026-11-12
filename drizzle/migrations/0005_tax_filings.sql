CREATE TABLE public.tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item text NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  paid_date date,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_filings TO authenticated;
GRANT ALL ON public.tax_filings TO service_role;
ALTER TABLE public.tax_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read tax filings" ON public.tax_filings FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins insert tax filings" ON public.tax_filings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update tax filings" ON public.tax_filings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tax filings" ON public.tax_filings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tax_filings_touch BEFORE UPDATE ON public.tax_filings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();