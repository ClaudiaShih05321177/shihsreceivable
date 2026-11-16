import { todayISO } from "@/lib/receivables";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { formatTWD, outstanding, PAYMENT_METHODS, paymentOffset, periodMonthLabel, rocYear } from "@/lib/receivables";
import { compareCustomerCode } from "@/lib/customer-sort";

export function PaymentFormDialog({ invoiceId: initialId, balance: initialBalance, trigger }: { invoiceId: string; balance: number; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ id: string; balance: number; label: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const invoiceId = target?.id ?? initialId;
  const balance = target?.balance ?? initialBalance;
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [retirementCustomer, setRetirementCustomer] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [method, setMethod] = useState<string>("匯款");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("0");
  const feeNum = Math.max(0, Math.round(Number(fee) || 0));
  const offset = paymentOffset(Number(amount) || 0, feeNum);
  const pickFee = (f: number) => { setFee(String(f)); setAmount(String(Math.max(0, balance - f))); };

  const save = useMutation({
    mutationFn: async (_next: boolean) => {
      if (!me.canRecordPayment) throw new Error("只有管理員可以銷帳");
      const value = Math.round(Number(amount));
      if (!value || value <= 0) throw new Error("請輸入實收金額");
      if (!paidDate) throw new Error("請選擇收款日期");
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount: paymentOffset(value, feeNum),
        bank_fee: feeNum,
        paid_date: paidDate,
        method,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async (_d, next) => {
      toast.success("已登錄收款");
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      if (next) {
        setSavedCount((n) => n + 1);
        setNotes(""); setFee("0"); setAmount(""); setSearch(""); setPicking(true);
        return;
      }
      setOpen(false);
      try {
        const [invoices] = await Promise.all([qc.fetchQuery(invoicesQuery), qc.fetchQuery(filingsQuery)]);
        const customerId = invoices.find((i) => i.id === invoiceId)?.customer_id;
        if (customerId) setRetirementCustomer(customerId);
      } catch { toast.error("收款已登錄，但無法確認註銷客戶狀態，請稍後重試"); }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  const { data: allInvoices } = useQuery({ ...invoicesQuery, enabled: open && picking });
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allInvoices ?? [])
      .filter((i) => outstanding(i) > 0)
      .filter((i) => !q || `${i.customer?.customer_code ?? ""} ${i.customer?.name ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => compareCustomerCode(a.customer?.customer_code, b.customer?.customer_code, a.customer?.name, b.customer?.name))
      .slice(0, 30);
  }, [allInvoices, search]);
  const pick = (i: NonNullable<typeof allInvoices>[number]) => {
    const b = outstanding(i);
    setTarget({ id: i.id, balance: b, label: `${i.customer?.customer_code ?? ""} ${i.customer?.name ?? ""}`.trim() });
    setAmount(String(b)); setFee("0"); setPicking(false);
  };

  if (!me.canRecordPayment) return null;
  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && savedCount > 0) void qc.invalidateQueries({ queryKey: ["filings"] });
        if (o) {
          setTarget(null); setPicking(false); setSearch(""); setSavedCount(0);
          setAmount(balance > 0 ? String(balance) : "");
          setPaidDate(todayISO());
          setMethod("匯款");
          setNotes("");
          setFee("0");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">登錄收款</DialogTitle>
          {picking ? (
            <p className="text-sm text-muted-foreground">本次已沖 {savedCount} 筆，請選下一位客戶</p>
          ) : (
            <p className="text-sm text-muted-foreground">{target ? `${target.label}・` : ""}目前應收餘額 {formatTWD(balance)}{savedCount > 0 ? `（本次已沖 ${savedCount} 筆）` : ""}</p>
          )}
        </DialogHeader>
        {picking ? (
          <div className="space-y-3">
            <Input autoFocus placeholder="輸入客戶代碼或名稱，例如 AD02" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && candidates[0]) { e.preventDefault(); pick(candidates[0]); } }} />
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {allInvoices === undefined ? <p className="p-3 text-sm text-muted-foreground">載入中…</p>
                : candidates.length === 0 ? <p className="p-3 text-sm text-muted-foreground">找不到未收清的帳款</p>
                : candidates.map((i) => (
                  <button key={i.id} type="button" onClick={() => pick(i)} className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent">
                    <span><span className="mr-2 font-mono text-muted-foreground">{i.customer?.customer_code}</span>{i.customer?.name}
                      <span className="ml-2 text-xs text-muted-foreground">{i.period_year ? `${rocYear(i.period_year)}年 ` : ""}{periodMonthLabel(i.period_month)}</span></span>
                    <span className="tabular font-semibold">{formatTWD(outstanding(i))}</span>
                  </button>
                ))}
            </div>
            <DialogFooter><Button type="button" onClick={() => setOpen(false)}>完成</Button></DialogFooter>
          </div>
        ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate(false);
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
          <div className="space-y-1.5">
            <Label htmlFor="p-paid">收款日期 *</Label>
            <RocDateInput id="p-paid" required value={paidDate} onChange={setPaidDate} />
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
            <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={(e) => { const f = e.currentTarget.form; if (f && !f.reportValidity()) return; save.mutate(true); }}>儲存並沖下一筆</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "登錄收款"}</Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
    {retirementCustomer && <CustomerRetirementDialog customerId={retirementCustomer} onClose={() => setRetirementCustomer(null)} />}
    </>
  );
}
