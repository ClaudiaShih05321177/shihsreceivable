DROP POLICY IF EXISTS "Admins update filings" ON public.filings;
CREATE POLICY "Admins and closers update filings" ON public.filings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (is_member(auth.uid()) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) = ANY (ARRAY['CA','MN']))))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (is_member(auth.uid()) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND upper(trim(coalesce(p.staff_code,''))) = ANY (ARRAY['CA','MN']))));