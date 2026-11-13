CREATE TABLE public.filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  case_type text NOT NULL,
  stage text NOT NULL DEFAULT '預查',
  filed_date date,
  approved_date date,
  service_fee numeric NOT NULL DEFAULT 0,
  advance_fee numeric NOT NULL DEFAULT 0,
  invoice_id uuid REFERENCES public.invoices(id),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filings TO authenticated;
GRANT ALL ON public.filings TO service_role;
ALTER TABLE public.filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read filings" ON public.filings FOR SELECT TO authenticated USING (is_member(auth.uid()));
CREATE POLICY "Members insert filings" ON public.filings FOR INSERT TO authenticated WITH CHECK (is_member(auth.uid()));
CREATE POLICY "Admins update filings" ON public.filings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete filings" ON public.filings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER filings_touch_updated_at BEFORE UPDATE ON public.filings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();