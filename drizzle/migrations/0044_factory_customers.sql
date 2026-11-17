CREATE OR REPLACE FUNCTION public.is_admin_or_mn(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role) OR (public.is_member(_uid) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _uid AND upper(trim(both from coalesce(p.staff_code,''))) = 'MN'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_mn(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_mn(uuid) TO authenticated;

CREATE TABLE public.factory_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text,
  name text NOT NULL,
  tax_id text,
  address text,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factory_customers TO authenticated;
GRANT ALL ON public.factory_customers TO service_role;
ALTER TABLE public.factory_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and MN read factory customers" ON public.factory_customers FOR SELECT TO authenticated USING (public.is_admin_or_mn(auth.uid()));
CREATE POLICY "Admin and MN insert factory customers" ON public.factory_customers FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_mn(auth.uid()));
CREATE POLICY "Admin and MN update factory customers" ON public.factory_customers FOR UPDATE TO authenticated USING (public.is_admin_or_mn(auth.uid())) WITH CHECK (public.is_admin_or_mn(auth.uid()));
CREATE POLICY "Admins delete factory customers" ON public.factory_customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER factory_customers_touch BEFORE UPDATE ON public.factory_customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();