import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RocDateInput } from "@/components/ar/roc-date-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { lookupCompany } from "@/lib/company-lookup.functions";
import { extraFees, type ExtraFee, INVOICE_TYPES, autoFinalInvoice, contractTotal, issuesInvoice, ENV_MODES, FACTORY_STAGES, factoryInitialStage, finalDue, needsEnv } from "@/lib/factory";
import { meQuery, type FactoryRegistration } from "@/lib/queries";
import type { Database } from "@/integrations/supabase/types";
import { canManageFactoryProgress } from "@/lib/permissions";

type Update = Database["public"]["Tables"]["factory_registrations"]["Update"];

const TEXT = ["factory_name", "application_item", "status_note", "contact", "ar_notes", "tax_id", "company_name", "branch_name", "po_number"] as const;
const DATES = ["env_filed_date", "env_approved_date", "bureau_filed_date", "inspection_date", "approved_date", "deposit_received_date", "final_received_date"] as const;
const MONEY = ["quote_amount", "deposit_invoice_amount", "deposit_received_amount", "final_invoice_amount", "government_fee", "other_fee", "final_received_amount"] as const;
type Key = (typeof TEXT)[number] | (typeof DATES)[number] | (typeof MONEY)[number] | "env_mode" | "stage" | "invoice_type";
type Form = Record<Key, string>;

function toForm(r?: FactoryRegistration): Form {
  const f = { env_mode: r?.env_mode ?? ENV_MODES[0], stage: r?.stage ?? "", invoice_type: r?.invoice_type ?? INVOICE_TYPES[0] } as Form;
  for (const k of [...TEXT, ...DATES]) f[k] = (r?.[k] as string | null) ?? "";
  for (const k of MONEY) f[k] = r && Number(r[k]) ? String(r[k]) : "";
  return f;
}

export function FactoryFormDialog({ trigger, record, focus = "progress" }: { trigger: ReactNode; record?: FactoryRegistration; focus?: "progress" | "ar" }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(toForm(record));
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([]);
  useEffect(() => {
    if (open) { setForm(toForm(record)); setExtras(extraFees(record?.extra_fees).map((x) => ({ label: x.label, amount: String(x.amount) }))); }
  }, [open, record]);
  const extraRows = (): ExtraFee[] => extraFees(extras);
  const set = (k: Key, v: string) => setForm((f) => {
    const next = { ...f, [k]: v };
    if ((k === "company_name" || k === "branch_name") && next.company_name.trim()) next.factory_name = `${next.company_name.trim()}${next.branch_name.trim()}`;
    if (k === "quote_amount" || k === "deposit_invoice_amount" || k === "invoice_type") {
      if (!issuesInvoice(next.invoice_type)) { next.deposit_invoice_amount = ""; next.final_invoice_amount = ""; }
      else if (Number(next.quote_amount)) next.final_invoice_amount = String(autoFinalInvoice(next.quote_amount, next.deposit_invoice_amount, next.invoice_type));
    }
    return next;
  });

  const [looking, setLooking] = useState(false);
  const lookup = async () => {
    const taxId = form.tax_id.trim();
    if (!/^\d{8}$/.test(taxId)) { toast.error("請先輸入 8 位數統一編號"); return; }
    setLooking(true);
    try {
      const r = await lookupCompany({ data: { taxId } });
      if (!r?.name) { toast.error("經濟部查無此統一編號"); return; }
      set("company_name", r.name);
      toast.success(`已帶入：${r.name}${r.status ? `（${r.status}）` : ""}`);
    } catch {
      toast.error("經濟部公示資料暫時無法查詢，請稍後再試");
    } finally {
      setLooking(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.factory_name.trim()) throw new Error("請輸入廠名");
      if (!me.isAdmin) {
        if (record || !canManageFactoryProgress(me)) throw new Error("無權限新增工廠案件");
        const { error } = await supabase.from("factory_registrations").insert({
          factory_name: form.factory_name.trim(), company_name: form.company_name.trim() || null,
          branch_name: form.branch_name.trim() || null, tax_id: form.tax_id.trim() || null,
          application_item: form.application_item.trim() || null, contact: form.contact.trim() || null,
          po_number: form.po_number.trim() || null,
          status_note: form.status_note.trim() || null, env_mode: form.env_mode, stage: factoryInitialStage(form.env_mode),
          env_filed_date: form.env_filed_date || null, env_approved_date: form.env_approved_date || null,
          bureau_filed_date: form.bureau_filed_date || null, inspection_date: form.inspection_date || null,
          approved_date: form.approved_date || null,
        });
        if (error) throw error;
        return;
      }
      const row: Record<string, string | number | null> = { env_mode: form.env_mode, invoice_type: form.invoice_type };
      const typed = row as Update;
      for (const k of TEXT) row[k] = form[k].trim() || null;
      row["factory_name"] = form.factory_name.trim();
      for (const k of DATES) row[k] = form[k] || null;
      for (const k of MONEY) row[k] = Math.round(Number(form[k]) || 0);
      (row as Record<string, unknown>)["extra_fees"] = extraRows();
      if (record) {
        if (form.stage) row["stage"] = form.stage;
        const { error } = await supabase.from("factory_registrations").update(typed).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("factory_registrations").insert({ ...(typed as Update & { factory_name: string }), stage: factoryInitialStage(form.env_mode) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(record ? "已更新" : "已新增");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["factory_registrations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  const text = (k: Key, label: string, placeholder?: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`fr-${k}`}>{label}</Label>
      <Input id={`fr-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  );
  const date = (k: Key, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`fr-${k}`}>{label}</Label>
      <RocDateInput id={`fr-${k}`} value={form[k]} onChange={(v) => set(k, v)} />
    </div>
  );
  const money = (k: Key, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`fr-${k}`}>{label}</Label>
      <Input id={`fr-${k}`} type="number" min={0} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" />
    </div>
  );
  const due = finalDue({ ...Object.fromEntries(MONEY.map((k) => [k, form[k]])), invoice_type: form.invoice_type, extra_fees: extras } as never);
  const inv = issuesInvoice(form.invoice_type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? "編輯工廠登記案件" : "新增工廠登記案件"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 py-2">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="fr-tax_id">統一編號</Label>
              <div className="flex gap-2">
                <Input id="fr-tax_id" inputMode="numeric" maxLength={8} value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } }} placeholder="8 位數" />
                <Button type="button" variant="outline" onClick={lookup} disabled={looking}>{looking ? "查詢中…" : "查詢公司"}</Button>
              </div>
            </div>
            {text("company_name", "公司名稱")}
            {text("branch_name", "廠別（選填）", "例：新竹廠；沒有可留空")}
            {text("factory_name", "廠名（公司名稱＋廠別，可修改）")}
            {text("application_item", "申辦項目", "例：工廠登記、變更登記")}
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="fr-status_note">Status</Label><Textarea id="fr-status_note" rows={4} value={form.status_note} onChange={(e) => set("status_note", e.target.value)} placeholder="自由輸入目前狀況，例：等補件" /></div>
            {text("contact", "聯絡人", "姓名／電話")}
            {text("po_number", "PO 號碼（選填）", "客戶採購單號，會印在報價單／請款單上")}
            <div className="grid gap-2">
              <Label>環保</Label>
              <Select value={form.env_mode} onValueChange={(v) => set("env_mode", v)}>
                <SelectTrigger aria-label="環保"><SelectValue /></SelectTrigger>
                <SelectContent>{ENV_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {record && (
              <div className="grid gap-2">
                <Label>目前階段</Label>
                <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                  <SelectTrigger aria-label="目前階段"><SelectValue /></SelectTrigger>
                  <SelectContent>{FACTORY_STAGES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            {needsEnv(form.env_mode) && <>{date("env_filed_date", "環保送件日期")}{date("env_approved_date", "環保核准日期")}</>}
            {date("bureau_filed_date", "工商科送件日期")}
            {date("inspection_date", "現場會勘日期（選辦）")}
            {date("approved_date", "核准結案日期")}
          </section>
          {me.isAdmin && <section className={`grid gap-4 rounded-md border border-dashed p-3 sm:grid-cols-2 ${focus === "ar" ? "order-first" : ""}`}>
            <p className="text-sm font-semibold sm:col-span-2">應收帳款{!me.isAdmin && record ? "（僅管理員可修改）" : ""}</p>
            <div className="grid gap-2">
              <Label>發票</Label>
              <Select value={form.invoice_type} onValueChange={(v) => set("invoice_type", v)}>
                <SelectTrigger aria-label="發票"><SelectValue /></SelectTrigger>
                <SelectContent>{INVOICE_TYPES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {money("quote_amount", inv ? "報價金額（未稅）" : "報價金額")}
            {inv && <div className="grid gap-2"><Label>含稅總額（外加 5%）</Label><p className="tabular py-2 text-sm font-semibold">{contractTotal(form.quote_amount, form.invoice_type).toLocaleString("zh-TW")}</p></div>}
            {inv && money("deposit_invoice_amount", "訂金發票金額")}
            {money("deposit_received_amount", "訂金收款金額")}
            {date("deposit_received_date", "訂金收款日期")}
            {inv && money("final_invoice_amount", "尾款發票金額（自動補齊，可修改）")}
            {money("government_fee", "規費")}
            {Number(form.other_fee) ? money("other_fee", "其他費用") : null}
            <div className="grid gap-2 rounded-md border bg-card p-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">自訂費用項目 <span className="text-xs font-normal text-muted-foreground">例：竣工圖燒錄費、代刻印章</span></p>
                <button type="button" onClick={() => setExtras((e) => [...e, { label: "", amount: "" }])} className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="size-3.5" />新增費用</button>
              </div>
              {extras.length === 0 ? <p className="text-xs text-muted-foreground">沒有自訂費用。</p> : extras.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input aria-label={`費用 ${i + 1} 名稱`} placeholder="項目名稱" value={x.label} maxLength={40} className="h-8 flex-1" onChange={(e) => setExtras((all) => all.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                  <Input aria-label={`費用 ${i + 1} 金額`} type="number" placeholder="金額" value={x.amount} className="h-8 w-32" onChange={(e) => setExtras((all) => all.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                  <button type="button" aria-label={`刪除費用 ${i + 1}`} onClick={() => setExtras((all) => all.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <div className="grid gap-2"><Label>{inv ? "尾款＋規費＋其他費用項目" : "報價＋規費＋其他費用項目"}</Label><p className="tabular py-2 text-sm font-semibold">{due.toLocaleString("zh-TW")}</p></div>
            {money("final_received_amount", "尾款收款金額")}
            {date("final_received_date", "尾款收款日期")}
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="fr-ar_notes">帳款備註</Label><Textarea id="fr-ar_notes" rows={2} value={form.ar_notes} onChange={(e) => set("ar_notes", e.target.value)} /></div>
          </section>}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
