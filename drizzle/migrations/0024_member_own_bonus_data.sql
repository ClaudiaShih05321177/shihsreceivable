CREATE OR REPLACE FUNCTION public.bookkeeper_bonus_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE _admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_member(auth.uid()) THEN
    RAISE EXCEPTION '沒有權限查看獎金' USING ERRCODE = '42501';
  END IF;
  _admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  -- Non-admins only see their own customers via customers/invoices/payments RLS (can_see_customer).
  RETURN jsonb_build_object(
    'staff', COALESCE((SELECT jsonb_agg(DISTINCT c.staff_code) FROM public.customers c WHERE c.staff_code IS NOT NULL AND btrim(c.staff_code) <> ''), '[]'::jsonb),
    'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'billing_type', c.billing_type, 'bookkeeping_fee', c.bookkeeping_fee,
      'annual_extra_rate', CASE WHEN _admin THEN (SELECT r.annual_extra_rate FROM public.customer_bonus_rates(c.id) r LIMIT 1) ELSE (SELECT x.annual_extra_rate FROM public.customers x WHERE false) END)) FROM public.customers c), '[]'::jsonb),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'customer_id', i.customer_id, 'customer_name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'period_year', i.period_year, 'period_month', i.period_month, 'items', i.items, 'amount', i.amount, 'paid_amount', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))) FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bookkeeper_bonus_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bookkeeper_bonus_data() TO authenticated, service_role;