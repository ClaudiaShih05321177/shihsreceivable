import { AUDITORS } from "@/lib/auditors";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { CustomerPicker } from "@/components/ar/customer-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, invoicesQuery, meQuery, type Invoice } from "@/lib/queries";
import { feeItemCount, feeLabel, visibleFeeItems } from "@/lib/fee-labels";
import { canEditInvoice } from "@/lib/permissions";
import { allocateCredits } from "@/lib/credits";
import { applyScheduledFees, bookkeepingCollectionMonth, formatTWD, isOtherKey, itemsTotal, otherEntries, priorVatCredit, rocYear, scheduledCustomerFees, suggestPeriod, todayISO, vatDue, withOtherItems, type FeeItems, defaultFeeYear, isAnnualFee, taxItemMonths, withTaxItemMonths } from "@/lib/receivables";

const PICK_GROUPS = [
  { title: "各類扣繳", items: ["租金扣繳", "薪資扣繳", "勞務扣繳", "其他扣繳"] },
  { title: "二代健保", items: ["租金2代", "股利2代", "2代-4X獎金", "個人2代", "2代A-B"] },
] as const;
const PICK_KEYS: readonly string[] = PICK_GROUPS.flatMap((g) => g.items);
/** 標籤顯示用：去掉「扣繳-」「二代健保-」前綴。 */
const shortLabel = (k: string) => feeLabel(k).replace(/^(扣繳|二代健保)-/, "");

const COMMON_ITEMS = ["記帳費", "營業稅", "發票", "文具", "結算", "工商", "營所稅", "暫繳", "股利2代"];

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
  years: Record<string, string>;
  tax_months: Record<string, string>;
  others: { label: string; amount: string }[];
};

function toForm(inv?: Invoice | null, customerId?: string): Form {
  const today = todayISO();
  const now = new Date();
  const collectionMonth = bookkeepingCollectionMonth(now.getMonth() + 1);
  const month = inv ? inv.period_month ?? 0 : collectionMonth === 13 ? 1 : collectionMonth;
  const items: Record<string, string> = {};
  for (const [k, v] of Object.entries((inv?.items as FeeItems) ?? {})) if (v && !isOtherKey(k)) items[k] = String(v);
  return {
    customer_id: inv?.customer_id ?? customerId ?? "",
    roc_year: String(rocYear(inv?.period_year ?? now.getFullYear() + (collectionMonth === 13 ? 1 : 0))),
    month: String(month),
    period_label: inv ? inv.period_label ?? "" : suggestPeriod(month),
    invoice_no: inv?.invoice_no ?? "",
    issue_date: todayISO(),
    due_date: inv?.due_date ?? "",
    notes: inv?.notes ?? "",
    auditor: inv?.auditor ?? "",
    vat_output: inv?.vat_output != null ? String(inv.vat_output) : "",
    vat_input: inv?.vat_input != null ? String(inv.vat_input) : "",
    vat_prior: inv?.vat_prior_credit != null ? String(inv.vat_prior_credit) : "",
    items,
    years: Object.fromEntries(Object.entries((inv?.item_years as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v)])),
    tax_months: taxItemMonths(inv?.item_years),
    others: otherEntries(inv?.items as FeeItems),
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
  const set = (k: keyof Omit<Form, "items" | "years" | "tax_months" | "others">) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
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

  const baseItems: FeeItems = Object.fromEntries(
    Object.entries(form.items).map(([k, v]) => [k, Math.round(Number(v) || 0)]).filter(([, v]) => v !== 0),
  );
  const numericItems = withOtherItems(baseItems, form.others);
  const total = itemsTotal(numericItems);
  const previewId = invoice?.id ?? "draft";
  const preview = allocateCredits([
    ...allInvoices.filter((i) => i.id !== previewId),
    { id: previewId, customer_id: form.customer_id, period_year: Number(form.roc_year) + 1911, period_month: Number(form.month), period_label: form.period_label, amount: total, payments: invoice?.payments ?? [] },
  ]).find((i) => i.id === previewId);
  const credit = preview?.credit_applied ?? 0;
  const setOther = (i: number, k: "label" | "amount", v: string) =>
    setForm((f) => ({ ...f, others: f.others.map((o, j) => (j === i ? { ...o, [k]: v } : o)) }));
  const addOther = () => setForm((f) => ({ ...f, others: [...f.others, { label: "", amount: "" }] }));
  const removeOther = (i: number) => setForm((f) => ({ ...f, others: f.others.filter((_, j) => j !== i) }));
  const hasValue = (k: string) => Number(form.items[k]) > 0;
  const visible = visibleFeeItems({ showAll, common: COMMON_ITEMS, hasValue }).filter((k) => !PICK_KEYS.includes(k));
  const [picked, setPicked] = useState<string[]>(() => PICK_KEYS.filter((k) => Number(toForm(invoice, customerId).items[k]) > 0));
  const isPicked = (k: string) => picked.includes(k) || hasValue(k);
  const togglePick = (k: string) => {
    if (isPicked(k)) {
      setPicked((p) => p.filter((x) => x !== k));
      setItem(k, "");
    } else setPicked((p) => [...p, k]);
  };

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm((f) => {
      const previousCustomer = customers.find((x) => x.id === f.customer_id);
      const previous = previousCustomer ? scheduledCustomerFees(previousCustomer, Number(f.month), "individual") : {};
      const items = c && !invoice ? applyScheduledFees(f.items, previous, scheduledCustomerFees(c, Number(f.month), "individual")) : f.items;
      return withPrior({ ...f, customer_id: id, items });
    });
  }

  function pickMonth(value: string) {
    setForm((f) => {
      const c = customers.find((x) => x.id === f.customer_id);
      const items = c && !invoice ? applyScheduledFees(f.items, scheduledCustomerFees(c, Number(f.month), "individual"), scheduledCustomerFees(c, Number(value), "individual")) : f.items;
      const period = !f.period_label || f.period_label === suggestPeriod(Number(f.month)) ? suggestPeriod(Number(value)) : f.period_label;
      return withPrior({ ...f, month: value, period_label: period, items });
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (invoice ? !canEditInvoice(me, invoice) : !me.canCreate) throw new Error(invoice ? "已有收款紀錄的帳款請由管理員修改" : "您沒有此操作的權限");
      if (!form.customer_id) throw new Error("請選擇客戶");
      if (total <= 0) throw new Error("應收帳款金額需大於 0，請填寫費用項目");
      if (form.due_date && form.issue_date && form.due_date < form.issue_date) throw new Error("到期日不可早於開立日期");
      const year = Number(form.roc_year) + 1911;
      const payload = {
        customer_id: form.customer_id,
        invoice_no: form.invoice_no.trim(),
        period_year: Number.isFinite(year) ? year : null,
        period_month: Number(form.month),
        period_label: form.period_label.trim() || null,
        issue_date: form.issue_date || todayISO(),
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        auditor: form.auditor || null,
        vat_output: hasVat ? Number(form.vat_output) || 0 : null,
        vat_input: hasVat ? Number(form.vat_input) || 0 : null,
        vat_prior_credit: hasVat ? Number(form.vat_prior) || 0 : null,
        items: numericItems,
        item_years: withTaxItemMonths(Object.fromEntries(Object.keys(numericItems).filter(isAnnualFee).map((k) => [k, Number(form.years[k]) || defaultFeeYear(k, Number.isFinite(year) ? year : null)]).filter(([, v]) => v)) as Record<string, number>, form.tax_months, numericItems),
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

  if (invoice ? !canEditInvoice(me, invoice) : !me.canCreate) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          const fresh = toForm(invoice, customerId);
          const c = customers.find((x) => x.id === fresh.customer_id);
          if (c && !invoice) fresh.items = applyScheduledFees(fresh.items, {}, scheduledCustomerFees(c, Number(fresh.month), "individual"));
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
                <CustomerPicker customers={customers} value={form.customer_id} onSelect={pickCustomer} />
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
                <Input id="i-period" placeholder="例：9-10" value={form.period_label} onChange={(e) => set("period_label")(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-issue">開立日期</Label>
                 <RocDateInput id="i-issue" value={form.issue_date} onChange={set("issue_date")} />
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">費用項目</h3>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowAll((s) => !s)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    {showAll ? "只顯示常用項目" : `顯示全部 ${feeItemCount()} 項`}
                    <ChevronDown className={`size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
              <div className="mb-4 rounded-md border border-border bg-card p-3">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((k) => (
                  <div key={k} className="space-y-1">
                    <Label htmlFor={`item-${k}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                      {isAnnualFee(k) && (
                        <input aria-label={`${feeLabel(k)}所屬年度`} inputMode="numeric" maxLength={3}
                          placeholder={String(defaultFeeYear(k, Number(form.roc_year) + 1911) ?? "")}
                          value={form.years[k] ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setForm((f) => ({ ...f, years: { ...f.years, [k]: v } })); }}
                          className="w-10 rounded border border-input bg-card px-1 text-center text-foreground tabular" />
                      )}
                      {isAnnualFee(k) ? `年度${feeLabel(k)}` : feeLabel(k)}
                    </Label>
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
              {PICK_GROUPS.map((g) => {
                const sub = g.items.reduce((t, k) => t + (Math.round(Number(form.items[k]) || 0)), 0);
                const shown = g.items.filter(isPicked);
                return (
                  <div key={g.title} className="mt-4 rounded-md border border-border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{g.title}</p>
                      <p className="tabular text-xs text-muted-foreground">小計：{formatTWD(sub)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">點擊加選：</span>
                      {g.items.map((k) => {
                        const on = isPicked(k);
                        return (
                          <button key={k} type="button" aria-pressed={on} onClick={() => togglePick(k)}
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"}`}>
                            {on ? <Check className="size-3" /> : <Plus className="size-3" />}{shortLabel(k)}
                          </button>
                        );
                      })}
                    </div>
                    {shown.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {shown.map((k) => (
                          <div key={k} className="space-y-1">
                            <Label htmlFor={`item-${k}`} className="text-xs text-muted-foreground">{feeLabel(k)}</Label>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`tax-months-${k}`} className="shrink-0 text-xs text-muted-foreground">月份</Label>
                              <Input id={`tax-months-${k}`} aria-label={`${feeLabel(k)}月份`} placeholder="例：11或11-12" value={form.tax_months[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, tax_months: { ...f.tax_months, [k]: e.target.value } }))} maxLength={10} className="h-8 min-w-0" />
                            </div>
                            <div className="flex items-center gap-1">
                              <Input id={`item-${k}`} type="number" step={1} autoFocus={!hasValue(k)} value={form.items[k] ?? ""} onChange={(e) => setItem(k, e.target.value)} className="tabular h-8" />
                              <button type="button" aria-label={`移除${feeLabel(k)}`} onClick={() => togglePick(k)} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-4 rounded-md border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">其他項目 <span className="font-normal text-xs text-muted-foreground">可自行增列說明與金額</span></p>
                  <button type="button" onClick={addOther} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3.5" />新增其他項目
                  </button>
                </div>
                {form.others.length === 0 ? (
                  <p className="text-xs text-muted-foreground">沒有其他項目。</p>
                ) : (
                  <div className="space-y-2">
                    {form.others.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          aria-label={`其他項目 ${i + 1} 說明`}
                          placeholder="說明（例：代墊規費）"
                          value={o.label}
                          onChange={(e) => setOther(i, "label", e.target.value)}
                          className="h-8 flex-1"
                          maxLength={40}
                        />
                        <Input
                          aria-label={`其他項目 ${i + 1} 金額`}
                          type="number"
                          step={1}
                          placeholder="金額"
                          value={o.amount}
                          onChange={(e) => setOther(i, "amount", e.target.value)}
                          className="tabular h-8 w-32"
                        />
                        <button type="button" onClick={() => removeOther(i)} aria-label={`刪除其他項目 ${i + 1}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-baseline justify-end gap-3 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">應收帳款合計</span>
                <span className="tabular text-2xl font-semibold">{formatTWD(total)}</span>
              </div>
              {credit > 0 && <div className="mt-2 space-y-1 text-right text-sm"><p>前期溢繳折抵：−{formatTWD(credit)}</p><p className="font-semibold">折抵後本期請款：{formatTWD(Math.max(0, total - credit))}</p></div>}
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
