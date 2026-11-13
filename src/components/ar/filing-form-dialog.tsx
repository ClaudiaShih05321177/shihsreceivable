import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CASE_TYPES } from "@/lib/filings";
import { customersQuery, type Filing } from "@/lib/queries";

type Form = {
  customer_id: string;
  case_type: string;
  filed_date: string;
  approved_date: string;
  service_fee: string;
  advance_fee: string;
  notes: string;
};

const EMPTY: Form = { customer_id: "", case_type: CASE_TYPES[0], filed_date: "", approved_date: "", service_fee: "", advance_fee: "", notes: "" };

function toForm(filing: Filing): Form {
  return {
    customer_id: filing.customer_id,
    case_type: filing.case_type,
    filed_date: filing.filed_date ?? "",
    approved_date: filing.approved_date ?? "",
    service_fee: filing.service_fee ? String(filing.service_fee) : "",
    advance_fee: filing.advance_fee ? String(filing.advance_fee) : "",
    notes: filing.notes ?? "",
  };
}

export function FilingFormDialog({ trigger, filing }: { trigger: ReactNode; filing?: Filing }) {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (open) setForm(filing ? toForm(filing) : EMPTY);
  }, [open, filing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.customer_id) throw new Error("請選擇客戶");
      const row = {
        customer_id: form.customer_id,
        case_type: form.case_type,
        filed_date: form.filed_date || null,
        approved_date: form.approved_date || null,
        service_fee: Math.round(Number(form.service_fee) || 0),
        advance_fee: Math.round(Number(form.advance_fee) || 0),
        notes: form.notes.trim() || null,
      };
      const { error } = filing
        ? await supabase.from("filings").update(row).eq("id", filing.id)
        : await supabase.from("filings").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(filing ? "案件已更新" : "案件已新增");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["filings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{filing ? "編輯工商案件" : "新增工商案件"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="f-customer">客戶</Label>
            <Select value={form.customer_id} onValueChange={(v) => set({ customer_id: v })}>
              <SelectTrigger id="f-customer" aria-label="客戶"><SelectValue placeholder="選擇客戶" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-case">案件類型</Label>
            <Select value={form.case_type} onValueChange={(v) => set({ case_type: v })}>
              <SelectTrigger id="f-case" aria-label="案件類型"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-filed">送件日期</Label>
              <Input id="f-filed" type="date" value={form.filed_date} onChange={(e) => set({ filed_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-approved">核准日期</Label>
              <Input id="f-approved" type="date" value={form.approved_date} onChange={(e) => set({ approved_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-service">代辦費</Label>
              <Input id="f-service" type="number" min={0} value={form.service_fee} onChange={(e) => set({ service_fee: e.target.value })} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-advance">代墊規費</Label>
              <Input id="f-advance" type="number" min={0} value={form.advance_fee} onChange={(e) => set({ advance_fee: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-notes">備註</Label>
            <Textarea id="f-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
