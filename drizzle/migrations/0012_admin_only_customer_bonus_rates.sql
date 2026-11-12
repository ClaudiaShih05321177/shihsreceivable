REVOKE SELECT ON public.customers FROM authenticated;
REVOKE SELECT (annual_extra_rate) ON public.customers FROM authenticated, anon;
GRANT SELECT (id, name, tax_id, contact_person, phone, email, address, notes, created_by, created_at, updated_at, customer_code, billing_type, bookkeeping_fee, stationery_fee, settlement_fee, suspended_period, staff_code) ON public.customers TO authenticated;
CREATE OR REPLACE FUNCTION public.customer_bonus_rates(_customer_id uuid DEFAULT NULL)
RETURNS TABLE(customer_id uuid, annual_extra_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION '只有管理員可以查看年度加收獎金比例' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.id, c.annual_extra_rate FROM public.customers c WHERE _customer_id IS NULL OR c.id = _customer_id;
END;
$$;
REVOKE ALL ON FUNCTION public.customer_bonus_rates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_bonus_rates(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.bookkeeper_bonus_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION '只有管理員可以查看獎金' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'staff', COALESCE((SELECT jsonb_agg(DISTINCT c.staff_code) FROM public.customers c WHERE c.staff_code IS NOT NULL AND btrim(c.staff_code) <> ''), '[]'::jsonb),
    'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'billing_type', c.billing_type, 'bookkeeping_fee', c.bookkeeping_fee, 'annual_extra_rate', r.annual_extra_rate)) FROM public.customers c LEFT JOIN public.customer_bonus_rates(NULL) r ON r.customer_id = c.id), '[]'::jsonb),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'customer_id', i.customer_id, 'customer_name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'period_year', i.period_year, 'period_month', i.period_month, 'items', i.items, 'amount', i.amount, 'paid_amount', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))) FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bookkeeper_bonus_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bookkeeper_bonus_data() TO authenticated, service_role;