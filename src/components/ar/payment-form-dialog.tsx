import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { CustomerRetirementDialog } from "@/components/ar/customer-retirement-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { filingsQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { formatTWD, PAYMENT_METHODS, paymentOffset } from "@/lib/receivables";

export function PaymentFormDialog({ invoiceId, balance, trigger }: { invoiceId: string; balance: number; trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [retirementCustomer, setRetirementCustomer] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [postedDate, setPostedDate] = useState("");
  const [method, setMethod] = useState<string>("匯款");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("0");
  const feeNum = Math.max(0, Math.round(Number(fee) || 0));
  const offset = paymentOffset(Number(amount) || 0, feeNum);
  const pickFee = (f: number) => { setFee(String(f)); setAmount(String(Math.max(0, balance - f))); };

  const save = useMutation({
    mutationFn: async () => {
      if (!me.canRecordPayment) throw new Error("只有管理員可以銷帳");
      const value = Math.round(Number(amount));
      if (!value || value <= 0) throw new Error("請輸入實收金額");
      if (!paidDate) throw new Error("請選擇收款日期");
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount: paymentOffset(value, feeNum),
        bank_fee: feeNum,
        paid_date: paidDate,
        posted_date: postedDate || null,
        method,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("已登錄收款");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      try {
        const [invoices] = await Promise.all([qc.fetchQuery(invoicesQuery), qc.fetchQuery(filingsQuery)]);
        const customerId = invoices.find((i) => i.id === invoiceId)?.customer_id;
        if (customerId) setRetirementCustomer(customerId);
      } catch { toast.error("收款已登錄，但無法確認註銷客戶狀態，請稍後重試"); }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  if (!me.canRecordPayment) return null;
  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setAmount(balance > 0 ? String(balance) : "");
          setPaidDate("");
          setPostedDate("");
          setMethod("匯款");
          setNotes("");
          setFee("0");
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
            <Label htmlFor="p-amount">實收金額 *</Label>
            <Input id="p-amount" type="number" min={1} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular text-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-fee">扣匯費</Label>
            <div className="flex gap-2">
              {[0, 15, 30].map((f) => (
                <Button key={f} type="button" size="sm" variant={feeNum === f ? "default" : "outline"} onClick={() => pickFee(f)}>{f === 0 ? "無" : `${f} 元`}</Button>
              ))}
              <Input id="p-fee" type="number" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} className="tabular w-24" />
            </div>
            <p className="text-sm text-muted-foreground">實收 {formatTWD(Number(amount) || 0)} ＋ 匯費 {formatTWD(feeNum)} ＝ 沖銷 <span className="font-semibold text-foreground">{formatTWD(offset)}</span></p>
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
    {retirementCustomer && <CustomerRetirementDialog customerId={retirementCustomer} onClose={() => setRetirementCustomer(null)} />}
    </>
  );
}
