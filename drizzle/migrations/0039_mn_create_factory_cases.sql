DROP POLICY "Members insert factory registrations" ON public.factory_registrations;
CREATE POLICY "Admins and MN insert factory registrations" ON public.factory_registrations FOR INSERT TO authenticated WITH CHECK (
 public.has_role(auth.uid(), 'admin') OR (
 public.is_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND upper(trim(p.staff_code)) = 'MN')
 AND created_by = auth.uid() AND company = '勤豐工商顧問有限公司'
 AND quote_amount = 0 AND deposit_invoice_amount = 0 AND deposit_received_amount = 0
 AND final_invoice_amount = 0 AND government_fee = 0 AND other_fee = 0 AND final_received_amount = 0
 AND deposit_received_date IS NULL AND final_received_date IS NULL AND ar_notes IS NULL AND extra_fees = '[]'::jsonb
 ));