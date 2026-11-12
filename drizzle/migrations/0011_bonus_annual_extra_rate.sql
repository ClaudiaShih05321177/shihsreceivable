ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS annual_extra_rate numeric;
COMMENT ON COLUMN public.customers.annual_extra_rate IS 'Bookkeeper bonus % for 年度加收; NULL means the normal 30%';
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
    'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'billing_type', c.billing_type, 'bookkeeping_fee', c.bookkeeping_fee, 'annual_extra_rate', c.annual_extra_rate)) FROM public.customers c), '[]'::jsonb),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'customer_id', i.customer_id, 'customer_name', c.name, 'customer_code', c.customer_code, 'staff_code', c.staff_code, 'period_year', i.period_year, 'period_month', i.period_month, 'items', i.items, 'amount', i.amount, 'paid_amount', COALESCE((SELECT sum(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0))) FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bookkeeper_bonus_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bookkeeper_bonus_data() TO authenticated, service_role;