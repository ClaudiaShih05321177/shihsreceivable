DROP POLICY "Admins update customers" ON public.customers;
CREATE POLICY "Members update own customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_see_customer(id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_see_customer(id));

CREATE OR REPLACE FUNCTION public.guard_customer_bonus_rate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.annual_extra_rate IS DISTINCT FROM OLD.annual_extra_rate AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    NEW.annual_extra_rate := OLD.annual_extra_rate;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_guard_bonus_rate BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_bonus_rate();