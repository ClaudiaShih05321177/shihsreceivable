import { todayISO } from "@/lib/receivables";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CheckFields, EMPTY_CHECK, checkRow, errorText, type CheckInfo } from "@/components/ar/check-fields";
import { allocateCombined } from "@/lib/combined";
import { meQuery, type Invoice } from "@/lib/queries";
import { formatTWD, outstanding, PAYMENT_METHODS } from "@/lib/receivables";

export function CombinedPaymentDialog({ invoices, trigger, onDone }: { invoices: Invoice[]; trigger: ReactNode; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const total = invoices.reduce((s, i) => s + outstanding(i), 0);
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [paidDate, setPaidDate] = useState("");
  const [method, setMethod] = useState("匯款");
  const [check, setCheck] = useState<CheckInfo>(EMPTY_CHECK);
  const feeNum = Math.max(0, Math.round(Number(fee) || 0));
  const targets = invoices.map((i) => ({ id: i.id, balance: outstanding(i) }));
  const parts = allocateCombined(targets, Number(amount) || 0, feeNum);
  const names = invoices.map((i) => i.customer?.name ?? "").filter((v, k, a) => v && a.indexOf(v) === k).join("、");

  const save = useMutation({
    mutationFn: async () => {
      if (!me.canRecordPayment) throw new Error("只有管理員可以銷帳");
      if (!(Number(amount) > 0)) throw new Error("請輸入實收金額");
      if (!paidDate) throw new Error("請選擇收款日期");
      const note = `合併收款（${names}，共 ${formatTWD(Math.round(Number(amount)))}）`;
      const { error } = await supabase.from("payments").insert(parts.map((p) => ({ ...p, paid_date: paidDate, method, notes: note, ...checkRow(method, check) })));
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(`已合併登錄 ${parts.length} 筆收款`);
      setOpen(false);
      onDone();
      await qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  if (!me.canRecordPayment) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAmount(String(total)); setFee("0"); setPaidDate(todayISO()); setMethod("匯款"); setCheck(EMPTY_CHECK); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">合併收款</DialogTitle>
          <p className="text-sm text-muted-foreground">{invoices.length} 筆帳款，未收合計 {formatTWD(total)}</p>
        </DialogHeader>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-amount">實收金額 *</Label>
            <Input id="c-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular text-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-fee">扣匯費</Label>
            <div className="flex gap-2">
              {[0, 15, 30].map((f) => (
                <Button key={f} type="button" size="sm" variant={feeNum === f ? "default" : "outline"} onClick={() => { setFee(String(f)); setAmount(String(Math.max(0, total - f))); }}>{f === 0 ? "無" : `${f} 元`}</Button>
              ))}
              <Input id="c-fee" type="number" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} className="tabular w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="c-paid">收款日期 *</Label><RocDateInput id="c-paid" value={paidDate} onChange={setPaidDate} /></div>
            <div className="space-y-1.5">
              <Label>支付方式</Label>
              <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          {method === "支票" && <CheckFields value={check} onChange={setCheck} />}
          <div className="rounded-md border text-sm">
            {invoices.map((inv) => {
              const p = parts.find((x) => x.invoice_id === inv.id);
              return (
                <div key={inv.id} className="flex justify-between border-b px-3 py-1.5 last:border-0">
                  <span>{inv.customer?.customer_code} {inv.customer?.name}<span className="ml-2 text-muted-foreground">未收 {formatTWD(outstanding(inv))}</span></span>
                  <span className="tabular font-medium">沖銷 {formatTWD(p?.amount ?? 0)}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "登錄合併收款"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
