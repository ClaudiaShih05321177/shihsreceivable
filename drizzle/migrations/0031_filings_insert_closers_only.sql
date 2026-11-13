DROP POLICY IF EXISTS "Members insert filings" ON public.filings;
CREATE POLICY "Admins and closers insert filings" ON public.filings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) IN ('CA','MN'))));