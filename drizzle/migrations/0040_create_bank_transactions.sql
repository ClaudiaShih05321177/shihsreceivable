CREATE TABLE public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  txn_date date,
  amount integer not null check (amount > 0),
  memo text not null default '',
  fingerprint text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bank transactions" ON public.bank_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert bank transactions" ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bank transactions" ON public.bank_transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));