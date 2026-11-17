import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { depositDue, finalDue } from "@/lib/factory";
import type { FactoryRegistration } from "@/lib/queries";
import { todayISO } from "@/lib/receivables";

export function FactoryPaymentDialog({ record: r, trigger }: { record: FactoryRegistration; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const init = () => ({
    dAmt: r.deposit_received_amount ? String(r.deposit_received_amount) : "",
    dDate: r.deposit_received_date ?? "",
    fAmt: r.final_received_amount ? String(r.final_received_amount) : "",
    fDate: r.final_received_date ?? "",
    notes: r.ar_notes ?? "",
  });
  const [f, setF] = useState(init);
  const dDue = depositDue(r.deposit_invoice_amount, r.invoice_type);
  const fDue = finalDue(r);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("factory_registrations").update({
        deposit_received_amount: Number(f.dAmt) || 0,
        deposit_received_date: f.dDate || null,
        final_received_amount: Number(f.fAmt) || 0,
        final_received_date: f.fDate || null,
        ar_notes: f.notes || null,
      }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已登帳"); qc.invalidateQueries({ queryKey: ["factory_registrations"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const row = (label: string, due: number, amt: "dAmt" | "fAmt", date: "dDate" | "fDate") => (
    <section className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">應收 {due.toLocaleString("zh-TW")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1"><Label>收款金額</Label><Input inputMode="numeric" value={f[amt]} onChange={(e) => setF({ ...f, [amt]: e.target.value })} /></div>
        <div className="grid gap-1"><Label>收款日期</Label><RocDateInput value={f[date]} onChange={(v) => setF({ ...f, [date]: v })} /></div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => setF({ ...f, [amt]: String(due), [date]: f[date] || todayISO() })}>帶入應收金額與今日</Button>
    </section>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(init()); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>登帳 · {r.factory_name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {dDue > 0 && row("訂金", dDue, "dAmt", "dDate")}
          {row("尾款", fDue, "fAmt", "fDate")}
          <div className="grid gap-1"><Label>備註</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
