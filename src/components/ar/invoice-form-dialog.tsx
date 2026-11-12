import { AUDITORS } from "@/lib/auditors";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { customersQuery, invoicesQuery, meQuery, type Invoice } from "@/lib/queries";
import { applyScheduledFees, bookkeepingCollectionMonth, FEE_ITEMS, formatTWD, itemsTotal, priorVatCredit, rocYear, scheduledCustomerFees, suggestPeriod, todayISO, vatDue, type FeeItems } from "@/lib/receivables";

const COMMON_ITEMS = ["記帳費", "營業稅", "發票", "文具", "結算", "工商", "營所稅", "暫繳", "其他"];
const FEE_ITEM_LABELS: Record<string, string> = {
  文具: "工商代辦費",
  發票: "發票費用",
  結算: "印章代刻",
  工商: "公司2代健保(A-B)\n",
  營所稅: "2代-4倍獎金",
  暫繳: "租金2代",
  其他: "個人2代",
  "22-1申報": "租金2代健保\n",
  印章: "租金扣繳",
  印花稅: "薪資扣繳",
  "2代A-B": "其他扣繳",
  "2代-4X獎金": "",
};

type Form = {
  customer_id: string;
  roc_year: string;
  month: string;
  period_label: string;
  invoice_no: string;
  issue_date: string;
  due_date: string;
  notes: string;
  auditor: string;
  vat_output: string;
  vat_input: string;
  vat_prior: string;
  items: Record<string, string>;
};

function toForm(inv?: Invoice | null, customerId?: string): Form {
  const today = todayISO();
  const now = new Date();
  const collectionMonth = bookkeepingCollectionMonth(now.getMonth() + 1);
  const month = inv ? inv.period_month ?? 0 : collectionMonth === 13 ? 1 : collectionMonth;
  const items: Record<string, string> = {};
  for (const [k, v] of Object.entries((inv?.items as FeeItems) ?? {})) if (v) items[k] = String(v);
  return {
    customer_id: inv?.customer_id ?? customerId ?? "",
    roc_year: String(rocYear(inv?.period_year ?? now.getFullYear() + (collectionMonth === 13 ? 1 : 0))),
    month: String(month),
    period_label: inv ? inv.period_label ?? "" : suggestPeriod(month),
    invoice_no: inv?.invoice_no ?? "",
    issue_date: inv?.issue_date ?? today,
    due_date: inv?.due_date ?? "",
    notes: inv?.notes ?? "",
    auditor: inv?.auditor ?? "",
    vat_output: inv?.vat_output != null ? String(inv.vat_output) : "",
    vat_input: inv?.vat_input != null ? String(inv.vat_input) : "",
    vat_prior: inv?.vat_prior_credit != null ? String(inv.vat_prior_credit) : "",
    items,
  };
}

export function InvoiceFormDialog({ invoice, customerId, trigger }: { invoice?: Invoice | null; customerId?: string; trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const navigate = useNavigate();
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: allInvoices } = useSuspenseQuery(invoicesQuery);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState<Form>(toForm(invoice, customerId));
  const set = (k: keyof Omit<Form, "items">) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (k: string, v: string) => setForm((f) => ({ ...f, items: { ...f.items, [k]: v } }));

  function withPrior(f: Form): Form {
    if (invoice || !f.customer_id) return f;
    const credit = priorVatCredit({ customer_id: f.customer_id, period_year: Number(f.roc_year) + 1911, period_month: Number(f.month), period_label: f.period_label }, allInvoices);
    return recalcVat({ ...f, vat_prior: credit ? String(credit) : "" });
  }
  function recalcVat(f: Form): Form {
    if (f.vat_output === "" && f.vat_input === "") return f;
    const { due } = vatDue(Number(f.vat_output), Number(f.vat_input), Number(f.vat_prior));
    return { ...f, items: { ...f.items, 營業稅: due ? String(due) : "" } };
  }
  const setVat = (k: "vat_output" | "vat_input" | "vat_prior") => (v: string) => setForm((f) => recalcVat({ ...f, [k]: v }));
  const vat = vatDue(Number(form.vat_output), Number(form.vat_input), Number(form.vat_prior));
  const hasVat = form.vat_output !== "" || form.vat_input !== "";

  const numericItems: FeeItems = Object.fromEntries(
    Object.entries(form.items).map(([k, v]) => [k, Math.round(Number(v) || 0)]).filter(([, v]) => v !== 0),
  );
  const total = itemsTotal(numericItems);
  const visible = showAll ? [...FEE_ITEMS] : FEE_ITEMS.filter((k) => COMMON_ITEMS.includes(k) || form.items[k]);

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm((f) => {
      const previousCustomer = customers.find((x) => x.id === f.customer_id);
      const previous = previousCustomer ? scheduledCustomerFees(previousCustomer, Number(f.month)) : {};
      const items = c && !invoice ? applyScheduledFees(f.items, previous, scheduledCustomerFees(c, Number(f.month))) : f.items;
      return withPrior({ ...f, customer_id: id, items });
    });
  }

  function pickMonth(value: string) {
    setForm((f) => {
      const c = customers.find((x) => x.id === f.customer_id);
      const items = c && !invoice ? applyScheduledFees(f.items, scheduledCustomerFees(c, Number(f.month)), scheduledCustomerFees(c, Number(value))) : f.items;
      const period = !f.period_label || f.period_label === suggestPeriod(Number(f.month)) ? suggestPeriod(Number(value)) : f.period_label;
      return withPrior({ ...f, month: value, period_label: period, items });
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
        auditor: form.auditor || null,
        vat_output: hasVat ? Number(form.vat_output) || 0 : null,
        vat_input: hasVat ? Number(form.vat_input) || 0 : null,
        vat_prior_credit: hasVat ? Number(form.vat_prior) || 0 : null,
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
          const fresh = toForm(invoice, customerId);
          const c = customers.find((x) => x.id === fresh.customer_id);
          if (c && !invoice) fresh.items = applyScheduledFees(fresh.items, {}, scheduledCustomerFees(c, Number(fresh.month)));
          setForm(withPrior(fresh));
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
                <Label>收款月份</Label>
                <Select
                  value={form.month}
                  onValueChange={pickMonth}
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
                <Label htmlFor="i-due">到期日</Label>
                <Input id="i-due" type="date" value={form.due_date} onChange={(e) => set("due_date")(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-no">單號</Label>
                <Input id="i-no" value={form.invoice_no} onChange={(e) => set("invoice_no")(e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label>簽證會計師</Label>
                <Select value={form.auditor || "none"} onValueChange={(v) => set("auditor")(v === "none" ? "" : v)}>
                  <SelectTrigger aria-label="簽證會計師"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未指定</SelectItem>
                    {AUDITORS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                    <Label htmlFor={`item-${k}`} className="text-xs text-muted-foreground">{FEE_ITEM_LABELS[k] ?? k}</Label>
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
              <div className="mt-4 rounded-md border border-border bg-card p-3">
                <p className="mb-2 text-sm font-bold">營業稅計算 <span className="font-normal text-xs text-muted-foreground">應納 = 銷項 − 進項 − 上期留抵，自動帶入營業稅</span></p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {([["vat_output", "銷項稅額"], ["vat_input", "進項稅額"], ["vat_prior", "上期留抵"]] as const).map(([k, l]) => (
                    <div key={k} className="space-y-1">
                      <Label htmlFor={`vat-${k}`} className="text-xs text-muted-foreground">{l}</Label>
                      <Input id={`vat-${k}`} type="number" step={1} value={form[k]} onChange={(e) => setVat(k)(e.target.value)} className="tabular h-8" />
                    </div>
                  ))}
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">應納稅額</p><p className="tabular h-8 leading-8 font-semibold">{hasVat ? formatTWD(vat.due) : "—"}</p></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">本期留抵</p><p className="tabular h-8 leading-8">{hasVat ? formatTWD(vat.carry) : "—"}</p></div>
                </div>
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
