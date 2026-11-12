ALTER TABLE public.customers
  ADD COLUMN customer_code text,
  ADD COLUMN billing_type text NOT NULL DEFAULT '期收',
  ADD COLUMN bookkeeping_fee numeric(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN stationery_fee numeric(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN settlement_fee numeric(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN suspended_period text,
  ADD COLUMN staff_code text;

ALTER TABLE public.invoices ALTER COLUMN invoice_no SET DEFAULT '';
ALTER TABLE public.invoices
  ADD COLUMN items jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN period_year integer,
  ADD COLUMN period_month integer,
  ADD COLUMN period_label text;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_amount_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_amount_nonneg CHECK (amount >= 0);

ALTER TABLE public.payments ADD COLUMN posted_date date;