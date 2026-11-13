ALTER TABLE public.filings ADD COLUMN change_detail text;
GRANT SELECT (change_detail), INSERT (change_detail), UPDATE (change_detail) ON public.filings TO authenticated;