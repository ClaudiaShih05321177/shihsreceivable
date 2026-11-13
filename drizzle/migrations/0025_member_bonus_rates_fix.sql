CREATE OR REPLACE FUNCTION public.visible_bonus_rate(_customer_id uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.annual_extra_rate FROM public.customers c WHERE c.id = _customer_id AND public.can_see_customer(_customer_id)
$$;
REVOKE ALL ON FUNCTION public.visible_bonus_rate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visible_bonus_rate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bookkeeper_bonus_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member(auth.uid()) THEN
    RAISE EXCEPTION '沒有權限查看獎金' USING ERRCODE = '42501';
  END IF;
  -- Non-admins only see their own customers via RLS (can_see_customer).
  RETURN jsonb_build_object(
    'staff', COALESCE((SELECT jsonb_agg(DISTINCT c.staff_code) FROM public.customers c WHERE c.staff_code IS NOT NULL AND btrim(c.staff_code) <> ''), '[]'::jsonb),
    'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'billing_type', c.billing_type, 'bookkeeping_fee', c.bookkeeping_fee, 'annual_extra_rate', public.visible_bonus_rate(c.id))) FROM public.customers c), '[]'::jsonb),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'customer_id', i.customer_id, 'customer_name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'period_year', i.period_year, 'period_month', i.period_month, 'items', i.items, 'amount', i.amount, 'paid_amount', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))) FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id), '[]'::jsonb)
  );
END;
$$;