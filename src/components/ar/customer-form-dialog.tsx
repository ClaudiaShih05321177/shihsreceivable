import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, type Customer } from "@/lib/queries";
import { BILLING_TYPES, isSuspended } from "@/lib/receivables";
import { lookupCompany } from "@/lib/company-lookup.functions";

type Form = {
  name: string;
  customer_code: string;
  tax_id: string;
  billing_type: string;
  bookkeeping_fee: string;
  stationery_fee: string;
  settlement_fee: string;
  suspended_period: string;
  staff_code: string;
  annual_extra_rate: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

function toForm(c?: Customer | null): Form {
  return {
    name: c?.name ?? "",
    customer_code: c?.customer_code ?? "",
    tax_id: c?.tax_id ?? "",
    billing_type: c?.billing_type ?? "期收",
    bookkeeping_fee: c ? String(c.bookkeeping_fee ?? 0) : "",
    stationery_fee: c ? String(c.stationery_fee ?? 0) : "",
    settlement_fee: c ? String(c.settlement_fee ?? 0) : "",
    suspended_period: c?.suspended_period ?? "",
    staff_code: c?.staff_code ?? "",
    annual_extra_rate: c?.annual_extra_rate != null ? String(c.annual_extra_rate) : "",
    contact_person: c?.contact_person ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    notes: c?.notes ?? "",
  };
}

export function CustomerFormDialog({ customer, trigger }: { customer?: Customer | null; trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(toForm(customer));
  const set = (k: keyof Form) => (v: string) =>
    setForm((f) => (k === "billing_type" && isSuspended(v) ? { ...f, billing_type: v, bookkeeping_fee: "0", stationery_fee: "0", settlement_fee: "0" } : { ...f, [k]: v }));
  const [looking, setLooking] = useState(false);
  const lookup = async () => {
    const taxId = form.tax_id.trim();
    if (!/^\d{8}$/.test(taxId)) return toast.error("請先輸入 8 位數統一編號");
    setLooking(true);
    try {
      const r = await lookupCompany({ data: { taxId } });
      if (!r) return toast.error("經濟部查無此統一編號");
      setForm((f) => ({ ...f, name: r.name || f.name, contact_person: r.responsible || f.contact_person, address: r.address || f.address }));
      toast.success(`已帶入：${r.name}${r.status ? `（${r.status}）` : ""}`);
    } catch {
      toast.error("經濟部公示資料暫時無法查詢，請稍後再試");
    } finally {
      setLooking(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!me.isAdmin) throw new Error("只有管理員可以管理客戶資料");
      const name = form.name.trim();
      if (!name) throw new Error("請輸入客戶名稱");
      if (form.tax_id && !/^\d{8}$/.test(form.tax_id.trim())) throw new Error("統一編號應為 8 位數字");
      const payload = {
        name,
        customer_code: form.customer_code.trim() || null,
        tax_id: form.tax_id.trim() || null,
        billing_type: form.billing_type,
        bookkeeping_fee: Number(form.bookkeeping_fee) || 0,
        stationery_fee: Number(form.stationery_fee) || 0,
        settlement_fee: Number(form.settlement_fee) || 0,
        suspended_period: form.suspended_period.trim() || null,
        staff_code: form.staff_code.trim().toUpperCase() || null,
        annual_extra_rate: form.annual_extra_rate.trim() === "" ? null : Number(form.annual_extra_rate),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { error } = customer
        ? await supabase.from("customers").update(payload).eq("id", customer.id)
        : await supabase.from("customers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(customer ? "已更新客戶資料" : "已新增客戶");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["bonuses"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const field = (k: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`c-${k}`}>{label}</Label>
      <Input id={`c-${k}`} value={form[k]} onChange={(e) => set(k)(e.target.value)} {...props} />
    </div>
  );

  if (!me.isAdmin) return null;

  const billingOptions =
    !form.billing_type || (BILLING_TYPES as readonly string[]).includes(form.billing_type)
      ? [...BILLING_TYPES]
      : [...BILLING_TYPES, form.billing_type];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(toForm(customer));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{customer ? "編輯客戶" : "新增客戶"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "客戶名稱 *", { required: true, maxLength: 120 })}
            {field("customer_code", "客戶ID", { maxLength: 40 })}
            <div className="space-y-1.5">
              <Label htmlFor="c-tax_id">統一編號</Label>
              <div className="flex gap-2">
                <Input id="c-tax_id" value={form.tax_id} onChange={(e) => set("tax_id")(e.target.value)} inputMode="numeric" maxLength={8} />
                <Button type="button" variant="outline" onClick={lookup} disabled={looking}>{looking ? "查詢中…" : "帶入公示資料"}</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>收費狀態</Label>
              <Select value={form.billing_type} onValueChange={set("billing_type")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {billingOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("bookkeeping_fee", "記帳費", { type: "number", min: 0, step: 1 })}
            {field("stationery_fee", "文具費", { type: "number", min: 0, step: 1 })}
            {field("settlement_fee", "結算費", { type: "number", min: 0, step: 1 })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("staff_code", "會計專員工ID", { placeholder: "例：AC", maxLength: 10 })}
            {me.canManageBonusRates && field("annual_extra_rate", "年度加收獎金%（特殊客戶）", { type: "number", min: 0, step: 1, placeholder: "空白＝30%" })}
            {field("suspended_period", "停業期間", { placeholder: "例：114/7-115/6", maxLength: 60 })}
            {field("contact_person", "聯絡人", { maxLength: 60 })}
            {field("phone", "電話", { maxLength: 40 })}
            {field("email", "電子郵件", { type: "email", maxLength: 120 })}
            {field("address", "地址", { maxLength: 200 })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">備註</Label>
            <Textarea id="c-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
