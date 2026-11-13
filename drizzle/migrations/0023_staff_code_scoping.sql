ALTER TABLE public.profiles ADD COLUMN staff_code text;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.can_see_customer(_customer_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.customers c JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = _customer_id AND public.is_member(auth.uid())
      AND coalesce(p.staff_code,'') <> ''
      AND upper(coalesce(nullif(c.staff_code,''), left(c.customer_code,2))) = upper(p.staff_code))
$$;

CREATE OR REPLACE FUNCTION public.set_staff_code(_user_id uuid, _code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.profiles SET staff_code = nullif(upper(trim(_code)),'') WHERE id = _user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_staff_code(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_staff_code(uuid, text) TO authenticated;

DROP POLICY "Members read customers" ON public.customers;
CREATE POLICY "Members read own customers" ON public.customers FOR SELECT TO authenticated USING (public.can_see_customer(id));
DROP POLICY "Members read invoices" ON public.invoices;
CREATE POLICY "Members read own invoices" ON public.invoices FOR SELECT TO authenticated USING (public.can_see_customer(customer_id));
DROP POLICY "Members read payments" ON public.payments;
CREATE POLICY "Members read own payments" ON public.payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_see_customer(i.customer_id)));
DROP POLICY "Members read tax filings" ON public.tax_filings;
CREATE POLICY "Members read own tax filings" ON public.tax_filings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_see_customer(i.customer_id)));