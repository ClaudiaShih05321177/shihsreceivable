import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CASE_TYPES, FILING_ROUTES, initialStage, staffFromCode } from "@/lib/filings";
import { lookupCompany } from "@/lib/company-lookup.functions";
import { customersQuery, filingServiceFeesQuery, meQuery, type Filing } from "@/lib/queries";

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
  notes: string;
};

const NEW = "__new__";

const EMPTY: Form = { customer_id: "", company_name: "", customer_code: "", route: FILING_ROUTES[0], tax_filed_date: "", tax_approved_date: "", case_type: CASE_TYPES[0], filed_date: "", approved_date: "", service_fee: "", advance_fee: "", stamp_fee: "", notes: "" };

function toForm(filing: Filing, serviceFee?: number): Form {
  return {
    customer_id: filing.customer_id ?? NEW,
    company_name: filing.company_name ?? "",
    customer_code: filing.customer?.customer_code ?? filing.customer_code ?? "",
    route: filing.route,
    tax_filed_date: filing.tax_filed_date ?? "",
    tax_approved_date: filing.tax_approved_date ?? "",
    case_type: filing.case_type,
    filed_date: filing.filed_date ?? "",
    approved_date: filing.approved_date ?? "",
    service_fee: serviceFee ? String(serviceFee) : "",
    advance_fee: filing.advance_fee ? String(filing.advance_fee) : "",
    stamp_fee: filing.stamp_fee ? String(filing.stamp_fee) : "",
    notes: filing.notes ?? "",
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

  useEffect(() => {
    if (open) { setForm(filing ? toForm(filing, fees?.[filing.id]) : EMPTY); setTaxId(""); }
  }, [open, filing, fees]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const createByTaxId = async () => {
    const id = taxId.trim();
    if (!/^\d{8}$/.test(id)) { toast.error("請輸入 8 位數統一編號"); return; }
    const existing = customers.find((c) => c.tax_id === id);
    if (existing) { set({ customer_id: existing.id, customer_code: form.customer_code || existing.customer_code || "" }); toast.success(`已選擇既有客戶：${existing.name}`); return; }
    setLooking(true);
    try {
      const r = await lookupCompany({ data: { taxId: id } });
      if (!r?.name) { toast.error("經濟部查無此統一編號"); return; }
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: r.name, tax_id: id, contact_person: r.responsible || null, address: r.address || null, bookkeeping_fee: 0 })
        .select("id")
        .single();
      if (error) throw error;
      // 管理員已填客戶代碼時，一併寫入新客戶（前兩碼為會計專員代號）。
      const code = form.customer_code.trim().toUpperCase();
      if (me.isAdmin && code) {
        await supabase.from("customers").update({ customer_code: code, staff_code: staffFromCode(code) }).eq("id", data.id);
      }
      await qc.invalidateQueries({ queryKey: ["customers"] });
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
      if (isNew && !form.company_name.trim()) throw new Error("請輸入新設立公司名稱");
      const row = {
        customer_id: isNew ? null : form.customer_id,
        company_name: isNew ? form.company_name.trim() : null,
        // 管理員可先填客戶代碼（新設立案件先存在案件上，連結客戶後同步）。
        ...(me.isAdmin ? { customer_code: form.customer_code.trim().toUpperCase() || null } : {}),
        route: form.route,
        tax_filed_date: form.tax_filed_date || null,
        tax_approved_date: form.tax_approved_date || null,
        case_type: form.case_type,
        filed_date: form.filed_date || null,
        approved_date: form.approved_date || null,
        advance_fee: money(form.advance_fee),
        stamp_fee: money(form.stamp_fee),
        notes: form.notes.trim() || null,
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
        // 管理員派案：客戶代碼寫回客戶資料，前兩碼即會計專員。
        const code = form.customer_code.trim().toUpperCase();
        const current = customers.find((c) => c.id === row.customer_id);
        if (current && code && code !== (current.customer_code ?? "")) {
          const { error: cErr } = await supabase.from("customers").update({ customer_code: code, staff_code: staffFromCode(code) ?? current.staff_code }).eq("id", current.id);
          if (cErr) throw cErr;
        }
      }
    },
    onSuccess: () => {
      toast.success(filing ? "案件已更新" : "案件已新增");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["filings"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
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
          <div className="grid gap-2">
            <Label htmlFor="f-taxid">用統編新增客戶</Label>
            <div className="flex gap-2">
              <Input id="f-taxid" inputMode="numeric" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="輸入 8 位數統一編號" />
              <Button type="button" variant="outline" onClick={createByTaxId} disabled={looking}>{looking ? "查詢中…" : "查詢並新增"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">自動帶入經濟部公示的公司名稱、負責人與地址，並選為本案客戶。</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-customer">客戶</Label>
            <Select value={form.customer_id} onValueChange={(v) => set({ customer_id: v, customer_code: form.customer_code || customers.find((c) => c.id === v)?.customer_code || "" })}>
              <SelectTrigger id="f-customer" aria-label="客戶"><SelectValue placeholder="選擇客戶" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW}>＋ 新設立（尚無統編／客戶資料）</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.customer_code ? `${c.customer_code} · ` : ""}{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.customer_id === NEW && (
            <div className="grid gap-2">
              <Label htmlFor="f-company">新設立公司名稱</Label>
              <Input id="f-company" value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="預查名稱" />
              <p className="text-xs text-muted-foreground">取得統編後，用上方「用統編新增客戶」建立客戶並選擇，才能結案立帳。</p>
            </div>
          )}
          {me.isAdmin && form.customer_id && (
            <div className="grid gap-2">
              <Label htmlFor="f-code">客戶代碼（派案）</Label>
              <Input id="f-code" value={form.customer_code} onChange={(e) => set({ customer_code: e.target.value })} placeholder="例：AC15，可先留空" maxLength={40} />
              <p className="text-xs text-muted-foreground">
                {form.customer_id === NEW
                  ? "新設立案件先存在案件上；之後用統編建立或選擇客戶時會一併寫入客戶資料。"
                  : staff
                    ? `派給會計專員 ${staff}，儲存後同步更新客戶資料。`
                    : "前兩位英文字母為會計專員代號；尚未派案可留空。"}
              </p>
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
            <Select value={form.case_type} onValueChange={(v) => set({ case_type: v })}>
              <SelectTrigger id="f-case" aria-label="案件類型"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.route !== "只送國稅局" && <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-filed">經濟部送件日期</Label>
              <Input id="f-filed" type="date" value={form.filed_date} onChange={(e) => set({ filed_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-approved">經濟部核准日期</Label>
              <Input id="f-approved" type="date" value={form.approved_date} onChange={(e) => set({ approved_date: e.target.value })} />
            </div>
          </div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-tfiled">國稅局送件日期</Label>
              <Input id="f-tfiled" type="date" value={form.tax_filed_date} onChange={(e) => set({ tax_filed_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-tapproved">國稅局核准日期</Label>
              <Input id="f-tapproved" type="date" value={form.tax_approved_date} onChange={(e) => set({ tax_approved_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="f-advance">代墊規費</Label>
              <Input id="f-advance" type="number" min={0} value={form.advance_fee} onChange={(e) => set({ advance_fee: e.target.value })} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-stamp">印章</Label>
              <Input id="f-stamp" type="number" min={0} value={form.stamp_fee} onChange={(e) => set({ stamp_fee: e.target.value })} placeholder="0" />
            </div>
            {me.isAdmin && (
              <div className="grid gap-2">
                <Label htmlFor="f-service">工商代辦費（僅管理員）</Label>
                <Input id="f-service" type="number" min={0} value={form.service_fee} onChange={(e) => set({ service_fee: e.target.value })} placeholder="0" />
              </div>
            )}
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
