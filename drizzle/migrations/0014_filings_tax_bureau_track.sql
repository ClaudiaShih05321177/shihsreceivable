ALTER TABLE public.filings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.filings ADD COLUMN company_name text;
ALTER TABLE public.filings ADD COLUMN route text NOT NULL DEFAULT '經濟部+國稅局';
ALTER TABLE public.filings ADD COLUMN tax_filed_date date;
ALTER TABLE public.filings ADD COLUMN tax_approved_date date;
ALTER TABLE public.filings ADD CONSTRAINT filings_customer_or_name CHECK (customer_id IS NOT NULL OR coalesce(btrim(company_name),'') <> '');