-- 一般使用者可以修改自己客戶的應收帳款（與客戶資料相同的 can_see_customer 界線）
CREATE POLICY "Members update own invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (can_see_customer(customer_id))
WITH CHECK (can_see_customer(customer_id));