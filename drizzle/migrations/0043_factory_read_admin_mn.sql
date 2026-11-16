DROP POLICY IF EXISTS "Members read factory registrations" ON public.factory_registrations;
CREATE POLICY "Admins and MN read factory registrations" ON public.factory_registrations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_member(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(both from p.staff_code)) = 'MN')));
