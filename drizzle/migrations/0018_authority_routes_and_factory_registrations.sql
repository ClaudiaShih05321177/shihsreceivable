ALTER TABLE public.filings ADD COLUMN special_authority text, ADD COLUMN special_filed_date date, ADD COLUMN special_approved_date date;
ALTER TABLE public.filings ALTER COLUMN route SET DEFAULT '主管機關+國稅局';
UPDATE public.filings SET route = '主管機關+國稅局' WHERE route = '經濟部+國稅局';

-- 重新套用欄位權限：一般成員不能直接讀寫工商代辦費
REVOKE SELECT, INSERT, UPDATE ON public.filings FROM authenticated;
GRANT SELECT (id, customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, invoice_id, notes, created_by, created_at, updated_at, company_name, route, tax_filed_date, tax_approved_date, customer_code, special_authority, special_filed_date, special_approved_date) ON public.filings TO authenticated;
GRANT INSERT (customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, notes, company_name, route, tax_filed_date, tax_approved_date, customer_code, special_authority, special_filed_date, special_approved_date) ON public.filings TO authenticated;
GRANT UPDATE (customer_id, case_type, stage, filed_date, approved_date, advance_fee, stamp_fee, invoice_id, notes, company_name, route, tax_filed_date, tax_approved_date, customer_code, special_authority, special_filed_date, special_approved_date) ON public.filings TO authenticated;

CREATE TABLE public.factory_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL DEFAULT '勤豐工商顧問有限公司',
  factory_name text NOT NULL,
  application_item text,
  status_note text,
  contact text,
  notes text,
  stage text NOT NULL DEFAULT '送件環保',
  env_mode text NOT NULL DEFAULT '需跑環保',
  env_filed_date date,
  env_approved_date date,
  bureau_filed_date date,
  inspection_date date,
  approved_date date,
  quote_amount numeric NOT NULL DEFAULT 0,
  deposit_invoice_amount numeric NOT NULL DEFAULT 0,
  deposit_received_amount numeric NOT NULL DEFAULT 0,
  deposit_received_date date,
  final_invoice_amount numeric NOT NULL DEFAULT 0,
  government_fee numeric NOT NULL DEFAULT 0,
  other_fee numeric NOT NULL DEFAULT 0,
  final_received_amount numeric NOT NULL DEFAULT 0,
  final_received_date date,
  ar_notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factory_registrations TO authenticated;
GRANT ALL ON public.factory_registrations TO service_role;
ALTER TABLE public.factory_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read factory registrations" ON public.factory_registrations FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members insert factory registrations" ON public.factory_registrations FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Admins update factory registrations" ON public.factory_registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete factory registrations" ON public.factory_registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER factory_registrations_touch BEFORE UPDATE ON public.factory_registrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();