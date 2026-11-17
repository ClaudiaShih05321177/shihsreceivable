ALTER TABLE public.filings ADD COLUMN extra_fees jsonb NOT NULL DEFAULT '[]'::jsonb;
GRANT SELECT (extra_fees), INSERT (extra_fees), UPDATE (extra_fees) ON public.filings TO authenticated;