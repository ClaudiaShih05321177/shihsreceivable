import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
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
import { CASE_TYPES, SUSPEND_CASE_TYPES, extendSuspendedPeriod, FILING_ROUTES, initialStage, routeHasAuthority, routeHasTaxBureau, staffFromCode, filingExtraFees } from "@/lib/filings";
import { lookupCompany } from "@/lib/company-lookup.functions";
import { customersQuery, filingServiceFeesQuery, meQuery, type Filing } from "@/lib/queries";
import { filingCustomersQuery } from "@/lib/filing-customer-queries";
import { filingCustomerCode, filingCustomerLink, findFilingCustomer } from "@/lib/filing-customers";

type Form = {
  customer_id: string;
  company_name: string;
  customer_code: string;
  route: string;
  case_type: string;
  tax_filed_date: string;
  tax_approved_date: string;
  filed_date: string;
  approved_date: string;
  service_fee: string;
  advance_fee: string;
  stamp_fee: string;
  extra_fees: { label: string; amount: string }[];
  notes: string;
  special_authority: string;
  change_detail: string;
  suspended_period: string;
  special_filed_date: string;
  special_approved_date: string;
};

const NEW = "__new__";

const EMPTY: Form = { customer_id: "", company_name: "", customer_code: "", route: FILING_ROUTES[0], tax_filed_date: "", tax_approved_date: "", case_type: CASE_TYPES[0], change_detail: "", suspended_period: "", filed_date: "", approved_date: "", service_fee: "", advance_fee: "", stamp_fee: "", extra_fees: [], notes: "", special_authority: "", special_filed_date: "", special_approved_date: "" };

function toForm(filing: Filing, serviceFee?: number): Form {
  return {
    customer_id: filing.customer_id ?? NEW,
    company_name: filing.company_name ?? "",
    customer_code: filingCustomerCode(filing.customer?.customer_code, filing.customer_code),
    route: filing.route,
    tax_filed_date: filing.tax_filed_date ?? "",
    tax_approved_date: filing.tax_approved_date ?? "",
    case_type: filing.case_type,
    filed_date: filing.filed_date ?? "",
    approved_date: filing.approved_date ?? "",
    service_fee: serviceFee ? String(serviceFee) : "",
    advance_fee: filing.advance_fee ? String(filing.advance_fee) : "",
    stamp_fee: filing.stamp_fee ? String(filing.stamp_fee) : "",
    extra_fees: filingExtraFees(filing.extra_fees).map((x) => ({ label: x.label, amount: String(x.amount) })),
    notes: filing.notes ?? "",
    special_authority: filing.special_authority ?? "",
    change_detail: filing.change_detail ?? "",
    suspended_period: filing.suspended_period ?? "",
    special_filed_date: filing.special_filed_date ?? "",
    special_approved_date: filing.special_approved_date ?? "",
  };
}

const money = (v: string) => Math.round(Number(v) || 0);

export function FilingFormDialog({ trigger, filing }: { trigger: ReactNode; filing?: Filing }) {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: fees } = useQuery({ ...filingServiceFeesQuery, enabled: me.isAdmin });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [taxId, setTaxId] = useState("");
  const [looking, setLooking] = useState(false);
  const { data: directory = [], error: directoryError, isPending: directoryPending } = useQuery({ ...filingCustomersQuery, enabled: open });
  // 同仁新建的客戶尚未派專員代碼，RLS 看不到，先記在本地供選單顯示。
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (open) { setForm(filing ? toForm(filing, fees?.[filing.id]) : EMPTY); setTaxId(""); setCreated(null); }
  }, [open, filing, fees]);

  useEffect(() => {
    if (!open || !filing?.customer_id) return;
    const customer = directory.find((c) => c.id === filing.customer_id);
    if (!customer?.customer_code) return;
    setForm((current) => current.customer_id === customer.id && !current.customer_code.trim()
      ? { ...current, customer_code: customer.customer_code ?? "" }
      : current);
  }, [open, directory, filing?.customer_id]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const options = [...directory];
  if (filing?.customer && !options.some((c) => c.id === filing.customer?.id)) options.push(filing.customer);
  if (created && !options.some((c) => c.id === created.id)) options.push({ ...created, customer_code: form.customer_code });
  const pickCustomer = (id: string) => {
    if (id === NEW) { set({ customer_id: NEW, customer_code: "", company_name: "" }); return; }
    const customer = options.find((c) => c.id === id);
    if (!customer) return;
    set({ ...filingCustomerLink(customer), ...(form.case_type === "展延停業" && !form.suspended_period ? { suspended_period: extendSuspendedPeriod(customers.find((c) => c.id === id)?.suspended_period) } : {}) });
  };

  const createByTaxId = async () => {
    const id = taxId.trim();
    if (!/^\d{8}$/.test(id)) { toast.error("請輸入 8 位數統一編號"); return; }
    if (filing?.invoice_id) return;
    if (directoryPending || directoryError) { toast.error("客戶名冊尚未載入，請稍後再試"); return; }
    const existing = findFilingCustomer(directory, "", id);
    if (existing) { pickCustomer(existing.id); toast.success(`已帶入 ${existing.customer_code ?? ""} · ${existing.name}`); return; }
    if (directory.some((c) => c.tax_id === id)) { toast.error("此統編有多個客戶帳戶，請在客戶選單選擇正確代碼"); return; }
    setLooking(true);
    try {
      const r = await lookupCompany({ data: { taxId: id } });
      if (!r?.name) { toast.error("經濟部查無此統一編號"); return; }
      const data = { id: crypto.randomUUID() };
      const { error } = await supabase
        .from("customers")
        .insert({ id: data.id, name: r.name, tax_id: id, contact_person: r.responsible || null, address: r.address || null, bookkeeping_fee: 0 });
      if (error) throw error;
      setCreated({ id: data.id, name: r.name });
      // 管理員已填客戶代碼時，一併寫入新客戶（前兩碼為會計專員代號）。
      const code = form.customer_code.trim().toUpperCase();
      if (me.isAdmin && code) {
        await supabase.from("customers").update({ customer_code: code, staff_code: staffFromCode(code) }).eq("id", data.id);
      }
      await qc.invalidateQueries({ queryKey: ["customers"] });
      await qc.invalidateQueries({ queryKey: ["filing_customers"] });
      set({ customer_id: data.id });
      setTaxId("");
      toast.success(`已新增客戶：${r.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "經濟部公示資料暫時無法查詢，請稍後再試");
    } finally {
      setLooking(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const isNew = form.customer_id === NEW;
      if (!form.customer_id) throw new Error("請選擇客戶");
      if (filing?.invoice_id && form.customer_id !== filing.customer_id) throw new Error("已立帳案件不能更換帳款客戶");
      if (isNew && !form.company_name.trim()) throw new Error("請輸入新設立公司名稱");
      const row = {
        customer_id: isNew ? null : form.customer_id,
        company_name: isNew ? form.company_name.trim() : null,
        // 管理員可先填客戶代碼（新設立案件先存在案件上，連結客戶後同步）。
        customer_code: form.customer_code.trim().toUpperCase() || null,
        route: form.route,
        tax_filed_date: form.tax_filed_date || null,
        tax_approved_date: form.tax_approved_date || null,
        case_type: form.case_type,
        filed_date: form.filed_date || null,
        approved_date: form.approved_date || null,
        advance_fee: money(form.advance_fee),
        stamp_fee: money(form.stamp_fee),
        extra_fees: filingExtraFees(form.extra_fees),
        notes: form.notes.trim() || null,
        special_authority: form.special_authority.trim() || null,
        change_detail: form.case_type === "變更登記" ? form.change_detail.trim() || null : null,
        suspended_period: SUSPEND_CASE_TYPES.includes(form.case_type) ? form.suspended_period.trim() || null : null,
        special_filed_date: form.special_filed_date || null,
        special_approved_date: form.special_approved_date || null,
      };
      let id = filing?.id;
      if (filing) {
        const { error } = await supabase.from("filings").update(row).eq("id", filing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("filings").insert({ ...row, stage: initialStage(form.route) }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (me.isAdmin && id) {
        const { error } = await supabase.rpc("set_filing_service_fee", { _filing_id: id, _fee: money(form.service_fee) });
        if (error) throw error;
      }
      // 客戶代碼寫回客戶資料，前兩碼即會計專員（管理員/CA/MN/CL）。
      const code = form.customer_code.trim().toUpperCase();
      const current = directory.find((c) => c.id === row.customer_id);
      if (current && code && code !== (current.customer_code ?? "")) {
        const { error: cErr } = await supabase.rpc("set_filing_customer_code", { _customer_id: current.id, _code: code });
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => {
      toast.success(filing ? "案件已更新" : "案件已新增");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["filings"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["filing_customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  const staff = staffFromCode(form.customer_code);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{filing ? "編輯工商案件" : "新增工商案件"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {me.isAdmin && (
            <div className="grid gap-2 rounded-md border-2 border-primary bg-primary/5 p-3">
              <Label htmlFor="f-service" className="text-base font-semibold">工商代辦費（僅管理員）</Label>
              <Input id="f-service" type="number" min={0} value={form.service_fee} onChange={(e) => set({ service_fee: e.target.value })} placeholder="0" className="text-lg" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="f-taxid">統編查詢客戶</Label>
            <div className="flex gap-2">
              <Input id="f-taxid" inputMode="numeric" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="輸入 8 位數統一編號" disabled={!!filing?.invoice_id} />
              <Button type="button" variant="outline" onClick={createByTaxId} disabled={looking || directoryPending || !!directoryError || !!filing?.invoice_id}>{looking ? "查詢中…" : "查詢／帶入"}</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-customer">客戶</Label>
            <CustomerPicker customers={[{ id: NEW, name: "＋ 新設立（尚無統編／客戶資料）", customer_code: null }, ...options]} value={form.customer_id} onSelect={pickCustomer} searchTaxId disabled={!!filing?.invoice_id || directoryPending || !!directoryError} />
            {directoryError && <p role="alert" className="text-sm text-destructive">客戶名冊載入失敗，請關閉後重新開啟。</p>}
          </div>
          {form.customer_id === NEW && (
            <div className="grid gap-2">
              <Label htmlFor="f-company">新設立公司名稱</Label>
              <Input
                id="f-company"
                value={form.company_name}
                onChange={(e) => set({ company_name: e.target.value })}
                onBlur={() => {
                  const name = form.company_name.trim();
                  if (!name) return;
                  const match = findFilingCustomer(directory, name, "");
                  if (match) {
                    pickCustomer(match.id);
                    toast.success(`已帶入既有客戶：${match.customer_code ? `${match.customer_code} · ` : ""}${match.name}`);
                  }
                }}
                placeholder="預查名稱"
              />
              <p className="text-xs text-muted-foreground">輸入的名稱若與既有客戶相同，會自動帶入該客戶與客戶代碼；取得統編後，也可用上方「用統編新增客戶」建立客戶並選擇，才能結案立帳。</p>
            </div>
          )}
          {form.customer_id && (
            <div className="grid gap-2">
              <Label htmlFor="f-code">客戶代碼（派案）</Label>
              <Input id="f-code" value={form.customer_code} onChange={(e) => set({ customer_code: e.target.value })} placeholder="尚未編碼" maxLength={40} readOnly={!!filing?.invoice_id} />
              {<p className="text-xs text-muted-foreground">
                {form.customer_id === NEW
                  ? "新設立案件先存在案件上；之後用統編建立或選擇客戶時會一併寫入客戶資料。"
                  : staff
                    ? `派給會計專員 ${staff}，儲存後同步更新客戶資料。`
                    : "前兩位英文字母為會計專員代號；尚未派案可留空。"}
              </p>}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="f-route">送件流程</Label>
            <Select value={form.route} onValueChange={(v) => set({ route: v })} disabled={!!filing}>
              <SelectTrigger id="f-route" aria-label="送件流程"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILING_ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-case">案件類型</Label>
            <Select value={form.case_type} onValueChange={(v) => set({ case_type: v, ...(v === "展延停業" && !form.suspended_period ? { suspended_period: extendSuspendedPeriod(customers.find((c) => c.id === form.customer_id)?.suspended_period) } : {}) })}>
              <SelectTrigger id="f-case" aria-label="案件類型"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.case_type === "變更登記" && (
            <div className="grid gap-2">
              <Label htmlFor="f-change">變更內容</Label>
              <Input id="f-change" value={form.change_detail} onChange={(e) => set({ change_detail: e.target.value })} placeholder="例：遷址、增資、董監事變更" />
            </div>
          )}
          {SUSPEND_CASE_TYPES.includes(form.case_type) && (
            <div className="grid gap-2">
              <Label htmlFor="f-susp">停業期間</Label>
              <Input id="f-susp" value={form.suspended_period} onChange={(e) => set({ suspended_period: e.target.value })} maxLength={60} />
              <p className="text-xs text-muted-foreground">結案時會寫入客戶資料的停業期間。{form.case_type === "展延停業" ? "已依客戶原停業期間自動帶入下一年，可修改。" : ""}</p>
            </div>
          )}
          {routeHasAuthority(form.route) && <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-filed">主管機關送件日期</Label>
              <RocDateInput id="f-filed" value={form.filed_date} onChange={(v) => set({ filed_date: v })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-approved">主管機關核准日期</Label>
              <RocDateInput id="f-approved" value={form.approved_date} onChange={(v) => set({ approved_date: v })} />
            </div>
          </div>}
          {routeHasAuthority(form.route) && (
            <div className="grid gap-4 rounded-md border border-dashed p-3">
              <div className="grid gap-2">
                <Label htmlFor="f-special">特許目的事業主管機關（特許行業才填）</Label>
                <Input id="f-special" value={form.special_authority} onChange={(e) => set({ special_authority: e.target.value })} placeholder="例：教育局、衛生局" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="f-sfiled">特許送件日期</Label>
                  <RocDateInput id="f-sfiled" value={form.special_filed_date} onChange={(v) => set({ special_filed_date: v })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="f-sapproved">特許核准日期</Label>
                  <RocDateInput id="f-sapproved" value={form.special_approved_date} onChange={(v) => set({ special_approved_date: v })} />
                </div>
              </div>
            </div>
          )}
          {routeHasTaxBureau(form.route) && <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-tfiled">國稅局送件日期</Label>
              <RocDateInput id="f-tfiled" value={form.tax_filed_date} onChange={(v) => set({ tax_filed_date: v })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-tapproved">國稅局核准日期</Label>
              <RocDateInput id="f-tapproved" value={form.tax_approved_date} onChange={(v) => set({ tax_approved_date: v })} />
            </div>
          </div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-advance">規費</Label>
              <Input id="f-advance" type="number" min={0} value={form.advance_fee} onChange={(e) => set({ advance_fee: e.target.value })} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-stamp">代刻印章</Label>
              <Input id="f-stamp" type="number" min={0} value={form.stamp_fee} onChange={(e) => set({ stamp_fee: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>其他費用</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => set({ extra_fees: [...form.extra_fees, { label: "", amount: "" }] })}>＋ 新增費用</Button>
            </div>
            {form.extra_fees.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={`其他費用 ${i + 1} 名稱`} placeholder="項目名稱" value={x.label} className="flex-1" onChange={(e) => set({ extra_fees: form.extra_fees.map((y, j) => j === i ? { ...y, label: e.target.value } : y) })} />
                <Input aria-label={`其他費用 ${i + 1} 金額`} type="number" min={0} placeholder="0" value={x.amount} className="w-28" onChange={(e) => set({ extra_fees: form.extra_fees.map((y, j) => j === i ? { ...y, amount: e.target.value } : y) })} />
                <Button type="button" variant="ghost" size="sm" aria-label={`刪除其他費用 ${i + 1}`} onClick={() => set({ extra_fees: form.extra_fees.filter((_, j) => j !== i) })}>✕</Button>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-notes">備註</Label>
            <Textarea id="f-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
