import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";
import { formatTWD, PAYMENT_METHODS, todayISO } from "@/lib/receivables";

export function PaymentFormDialog({ invoiceId, balance, trigger }: { invoiceId: string; balance: number; trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());
  const [postedDate, setPostedDate] = useState(todayISO());
  const [method, setMethod] = useState<string>("匯款");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!me.canRecordPayment) throw new Error("只有管理員可以銷帳");
      const value = Math.round(Number(amount));
      if (!value || value <= 0) throw new Error("請輸入收款金額");
      if (!paidDate) throw new Error("請選擇收款日期");
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount: value,
        paid_date: paidDate,
        posted_date: postedDate || null,
        method,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已登錄收款");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  if (!me.canRecordPayment) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(balance > 0 ? String(balance) : "");
          setPaidDate(todayISO());
          setPostedDate(todayISO());
          setMethod("匯款");
          setNotes("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">登錄收款</DialogTitle>
          <p className="text-sm text-muted-foreground">目前應收餘額 {formatTWD(balance)}</p>
        </DialogHeader>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="p-amount">收款金額 *</Label>
            <Input id="p-amount" type="number" min={1} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular text-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-paid">收款日期 *</Label>
              <RocDateInput id="p-paid" required value={paidDate} onChange={setPaidDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-posted">登帳日期</Label>
              <RocDateInput id="p-posted" value={postedDate} onChange={setPostedDate} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>支付方式</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">備註</Label>
            <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "登錄收款"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
