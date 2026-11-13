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
import { INVOICE_TYPES, autoFinalInvoice, contractTotal, issuesInvoice, ENV_MODES, FACTORY_STAGES, factoryInitialStage, finalDue, needsEnv } from "@/lib/factory";
import { meQuery, type FactoryRegistration } from "@/lib/queries";
import type { Database } from "@/integrations/supabase/types";

type Update = Database["public"]["Tables"]["factory_registrations"]["Update"];

const TEXT = ["factory_name", "application_item", "status_note", "contact", "notes", "ar_notes"] as const;
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
  useEffect(() => { if (open) setForm(toForm(record)); }, [open, record]);
  const set = (k: Key, v: string) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === "quote_amount" || k === "deposit_invoice_amount" || k === "invoice_type") {
      if (!issuesInvoice(next.invoice_type)) { next.deposit_invoice_amount = ""; next.final_invoice_amount = ""; }
      else if (Number(next.quote_amount)) next.final_invoice_amount = String(autoFinalInvoice(next.quote_amount, next.deposit_invoice_amount, next.invoice_type));
    }
    return next;
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.factory_name.trim()) throw new Error("請輸入廠名");
      const row: Record<string, string | number | null> = { env_mode: form.env_mode, invoice_type: form.invoice_type };
      const typed = row as Update;
      for (const k of TEXT) row[k] = form[k].trim() || null;
      row["factory_name"] = form.factory_name.trim();
      for (const k of DATES) row[k] = form[k] || null;
      for (const k of MONEY) row[k] = Math.round(Number(form[k]) || 0);
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
      <Input id={`fr-${k}`} type="date" value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const money = (k: Key, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`fr-${k}`}>{label}</Label>
      <Input id={`fr-${k}`} type="number" min={0} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" />
    </div>
  );
  const due = finalDue({ ...Object.fromEntries(MONEY.map((k) => [k, form[k]])), invoice_type: form.invoice_type } as never);
  const inv = issuesInvoice(form.invoice_type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? "編輯工廠登記案件" : "新增工廠登記案件"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 py-2">
          <section className="grid gap-4 sm:grid-cols-2">
            {text("factory_name", "廠名")}
            {text("application_item", "申辦項目", "例：工廠登記、變更登記")}
            <div className="sm:col-span-2">{text("status_note", "Status", "自由輸入目前狀況，例：等補件")}</div>
            {text("contact", "聯絡人", "姓名／電話")}
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
          <section className={`grid gap-4 rounded-md border border-dashed p-3 sm:grid-cols-2 ${focus === "ar" ? "order-first" : ""}`}>
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
            {money("other_fee", "其他費用")}
            <div className="grid gap-2"><Label>{inv ? "尾款＋規費＋其他費用" : "報價＋規費＋其他費用"}</Label><p className="tabular py-2 text-sm font-semibold">{due.toLocaleString("zh-TW")}</p></div>
            {money("final_received_amount", "尾款收款金額")}
            {date("final_received_date", "尾款收款日期")}
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="fr-ar_notes">帳款備註</Label><Textarea id="fr-ar_notes" rows={2} value={form.ar_notes} onChange={(e) => set("ar_notes", e.target.value)} /></div>
          </section>
          <div className="grid gap-2"><Label htmlFor="fr-notes">備註</Label><Textarea id="fr-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
