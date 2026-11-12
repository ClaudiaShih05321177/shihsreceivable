CREATE TABLE public.fee_labels (
  key text PRIMARY KEY,
  label text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  position integer,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_labels TO authenticated;
GRANT ALL ON public.fee_labels TO service_role;
ALTER TABLE public.fee_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read fee labels" ON public.fee_labels FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins insert fee labels" ON public.fee_labels FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update fee labels" ON public.fee_labels FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete fee labels" ON public.fee_labels FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER fee_labels_touch BEFORE UPDATE ON public.fee_labels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();