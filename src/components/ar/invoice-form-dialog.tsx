import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, meQuery, type Invoice } from "@/lib/queries";
import { FEE_ITEMS, formatTWD, itemsTotal, rocYear, todayISO, type FeeItems } from "@/lib/receivables";

const COMMON_ITEMS = ["記帳費", "營業稅", "發票", "文具", "結算", "工商", "營所稅", "暫繳", "其他"];

function suggestPeriod(month: number): string {
  if (month === 0) return "11-12";
  if (month >= 3 && month % 2 === 1) return `${month - 2}-${month - 1}`;
  return "";
}

type Form = {
  customer_id: string;
  roc_year: string;
  month: string;
  period_label: string;
  invoice_no: string;
  issue_date: string;
  due_date: string;
  notes: string;
  items: Record<string, string>;
};

function toForm(inv?: Invoice | null, customerId?: string): Form {
  const today = todayISO();
  const month = inv ? inv.period_month ?? 0 : new Date().getMonth() + 1;
  const items: Record<string, string> = {};
  for (const [k, v] of Object.entries((inv?.items as FeeItems) ?? {})) if (v) items[k] = String(v);
  return {
    customer_id: inv?.customer_id ?? customerId ?? "",
    roc_year: String(rocYear(inv?.period_year ?? new Date().getFullYear())),
    month: String(month),
    period_label: inv ? inv.period_label ?? "" : suggestPeriod(month),
    invoice_no: inv?.invoice_no ?? "",
    issue_date: inv?.issue_date ?? today,
    due_date: inv?.due_date ?? "",
    notes: inv?.notes ?? "",
    items,
  };
}

export function InvoiceFormDialog({ invoice, customerId, trigger }: { invoice?: Invoice | null; customerId?: string; trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const navigate = useNavigate();
  const { data: customers = [] } = useQuery(customersQuery);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState<Form>(toForm(invoice, customerId));
  const set = (k: keyof Omit<Form, "items">) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (k: string, v: string) => setForm((f) => ({ ...f, items: { ...f.items, [k]: v } }));

  const numericItems: FeeItems = Object.fromEntries(
    Object.entries(form.items).map(([k, v]) => [k, Math.round(Number(v) || 0)]).filter(([, v]) => v !== 0),
  );
  const total = itemsTotal(numericItems);
  const visible = showAll ? [...FEE_ITEMS] : FEE_ITEMS.filter((k) => COMMON_ITEMS.includes(k) || form.items[k]);

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm((f) => {
      const items = { ...f.items };
      if (c && !invoice) {
        if (!items["記帳費"] && Number(c.bookkeeping_fee)) items["記帳費"] = String(c.bookkeeping_fee);
        if (!items["文具"] && Number(c.stationery_fee)) items["文具"] = String(c.stationery_fee);
        if (!items["結算"] && Number(c.settlement_fee)) items["結算"] = String(c.settlement_fee);
      }
      return { ...f, customer_id: id, items };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (invoice ? !me.canEdit : !me.canCreate) throw new Error("您沒有此操作的權限");
      if (!form.customer_id) throw new Error("請選擇客戶");
      if (total <= 0) throw new Error("應收帳款金額需大於 0，請填寫費用項目");
      if (form.due_date && form.due_date < form.issue_date) throw new Error("到期日不可早於開立日期");
      const year = Number(form.roc_year) + 1911;
      const payload = {
        customer_id: form.customer_id,
        invoice_no: form.invoice_no.trim(),
        period_year: Number.isFinite(year) ? year : null,
        period_month: Number(form.month),
        period_label: form.period_label.trim() || null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        items: numericItems,
        amount: total,
      };
      if (invoice) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
        if (error) throw error;
        return invoice.id;
      }
      const { data, error } = await supabase.from("invoices").insert(payload).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success(invoice ? "已更新帳款" : "已新增應收帳款");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      if (!invoice) navigate({ to: "/invoices/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  if (invoice ? !me.canEdit : !me.canCreate) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setForm(toForm(invoice, customerId));
          setShowAll(false);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{invoice ? "編輯應收帳款" : "新增應收帳款"}</DialogTitle>
        </DialogHeader>
        {customers.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">請先到「客戶資料」新增客戶，再建立應收帳款。</p>
        ) : (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>客戶名稱 *</Label>
                <Select value={form.customer_id} onValueChange={pickCustomer}>
                  <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.customer_code ? `${c.customer_code} · ` : ""}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-year">年度（民國）</Label>
                <Input id="i-year" type="number" value={form.roc_year} onChange={(e) => set("roc_year")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>月份</Label>
                <Select
                  value={form.month}
                  onValueChange={(v) => setForm((f) => ({ ...f, month: v, period_label: f.period_label || suggestPeriod(Number(v)) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">前期</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} 月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-period">期別</Label>
                <Input id="i-period" placeholder="例：1-2" value={form.period_label} onChange={(e) => set("period_label")(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-issue">開立日期</Label>
                <Input id="i-issue" type="date" value={form.issue_date} onChange={(e) => set("issue_date")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-due">到期日 *</Label>
                <Input id="i-due" type="date" value={form.due_date} onChange={(e) => set("due_date")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-no">單號</Label>
                <Input id="i-no" value={form.invoice_no} onChange={(e) => set("invoice_no")(e.target.value)} maxLength={40} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-paper p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold">費用項目</h3>
                <button type="button" onClick={() => setShowAll((s) => !s)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  {showAll ? "只顯示常用項目" : `顯示全部 ${FEE_ITEMS.length} 項`}
                  <ChevronDown className={`size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((k) => (
                  <div key={k} className="space-y-1">
                    <Label htmlFor={`item-${k}`} className="text-xs text-muted-foreground">{k}</Label>
                    <Input
                      id={`item-${k}`}
                      type="number"
                      step={1}
                      value={form.items[k] ?? ""}
                      onChange={(e) => setItem(k, e.target.value)}
                      className="tabular h-8"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-baseline justify-end gap-3 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">應收帳款合計</span>
                <span className="tabular text-2xl font-semibold">{formatTWD(total)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-notes">備註</Label>
              <Textarea id="i-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
