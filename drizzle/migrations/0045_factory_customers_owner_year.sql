ALTER TABLE public.factory_customers ADD COLUMN IF NOT EXISTS responsible_person text, ADD COLUMN IF NOT EXISTS last_change_year integer;
COMMENT ON COLUMN public.factory_customers.contact_person IS 'DEPRECATED: replaced by responsible_person';
COMMENT ON COLUMN public.factory_customers.phone IS 'DEPRECATED: no longer shown';
COMMENT ON COLUMN public.factory_customers.email IS 'DEPRECATED: no longer shown';