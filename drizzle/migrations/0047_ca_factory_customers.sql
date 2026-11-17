CREATE OR REPLACE FUNCTION public.can_use_factory_customers(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role) OR (public.is_member(_uid) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _uid AND upper(trim(both from coalesce(p.staff_code,''))) IN ('MN','CA')))
$$;
DROP POLICY IF EXISTS "Admin and MN insert factory customers" ON public.factory_customers;
DROP POLICY IF EXISTS "Admin and MN read factory customers" ON public.factory_customers;
DROP POLICY IF EXISTS "Admin and MN update factory customers" ON public.factory_customers;
CREATE POLICY "Admin MN CA insert factory customers" ON public.factory_customers FOR INSERT TO authenticated WITH CHECK (public.can_use_factory_customers(auth.uid()));
CREATE POLICY "Admin MN CA read factory customers" ON public.factory_customers FOR SELECT TO authenticated USING (public.can_use_factory_customers(auth.uid()));
CREATE POLICY "Admin MN CA update factory customers" ON public.factory_customers FOR UPDATE TO authenticated USING (public.can_use_factory_customers(auth.uid())) WITH CHECK (public.can_use_factory_customers(auth.uid()));