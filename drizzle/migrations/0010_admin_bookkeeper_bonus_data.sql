CREATE OR REPLACE FUNCTION public.bookkeeper_bonus_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION '只有管理員可以查看獎金' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'staff', COALESCE((SELECT jsonb_agg(DISTINCT c.staff_code) FROM public.customers c WHERE c.staff_code IS NOT NULL AND btrim(c.staff_code) <> ''), '[]'::jsonb),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'customer_name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'period_year', i.period_year, 'period_month', i.period_month, 'items', i.items, 'amount', i.amount, 'paid_amount', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))) FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bookkeeper_bonus_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bookkeeper_bonus_data() TO authenticated, service_role;