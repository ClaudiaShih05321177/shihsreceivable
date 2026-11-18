import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { lookupCompany } from "@/lib/company-lookup.functions";
import { factoryCustomersQuery } from "@/lib/factory-customer-queries";
import { meQuery } from "@/lib/queries";

type FactoryCustomer = Database["public"]["Tables"]["factory_customers"]["Row"];

export const Route = createFileRoute("/_authenticated/_shell/factory-customers")({
  head: () => ({
    meta: [
      { title: "客戶資料 · 勤豐工商顧問" },
      { name: "description", content: "勤豐工商顧問客戶名冊：客戶代碼、公司名稱、統編與聯絡方式。" },
      { property: "og:title", content: "客戶資料 · 勤豐工商顧問" },
      { property: "og:description", content: "勤豐工商顧問客戶名冊。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(factoryCustomersQuery),
  component: FactoryCustomersPage,
});

function FactoryCustomersPage() {
  const { data: rows } = useSuspenseQuery(factoryCustomersQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const key = q.trim().toLowerCase();
  const shown = [...rows.filter((r) => r.customer_code?.trim()).reverse(), ...rows.filter((r) => !r.customer_code?.trim())].filter((r) => `${r.customer_code ?? ""} ${r.name} ${r.tax_id ?? ""} ${r.responsible_person ?? ""} ${r.address ?? ""} ${r.last_change_year ?? ""} ${r.notes ?? ""}`.toLowerCase().includes(key));
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("factory_customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已刪除"); qc.invalidateQueries({ queryKey: ["factory_customers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });
  return (
    <>
      <PageHeader eyebrow="勤豐工商顧問有限公司" title="客戶資料" description={`共 ${rows.length} 位客戶 · 依客戶代碼由新到舊排序`} actions={<CustomerDialog trigger={<Button><Plus /> 新增客戶</Button>} />} />
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜尋客戶代碼、名稱、統編、負責人、地址…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card pl-9" />
      </div>
      <div className="ledger-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>客戶代碼</TableHead><TableHead>客戶名稱</TableHead><TableHead>統一編號</TableHead><TableHead>工廠地址</TableHead><TableHead>負責人</TableHead><TableHead>最後變更年度</TableHead><TableHead>備註</TableHead><TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">尚無客戶資料</TableCell></TableRow>}
            {shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.customer_code ?? "—"}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono">{r.tax_id ?? ""}</TableCell>
                <TableCell className="max-w-64 truncate">{r.address ?? ""}</TableCell>
                <TableCell>{r.responsible_person ?? ""}</TableCell>
                <TableCell className="font-mono">{r.last_change_year ?? ""}</TableCell>
                <TableCell className="max-w-40 truncate">{r.notes ?? ""}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <CustomerDialog record={r} trigger={<Button variant="ghost" size="icon" aria-label="編輯"><Pencil className="size-4" /></Button>} />
                  {me.isAdmin && <Button variant="ghost" size="icon" aria-label="刪除" onClick={() => { if (confirm(`刪除「${r.name}」？`)) remove.mutate(r.id); }}><Trash2 className="size-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

const FIELDS = ["customer_code", "name", "tax_id", "responsible_person", "last_change_year", "address", "notes"] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const toForm = (r?: FactoryCustomer): Form => Object.fromEntries(FIELDS.map((k) => [k, r?.[k] == null ? "" : String(r[k])])) as Form;

function CustomerDialog({ record, trigger }: { record?: FactoryCustomer; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(toForm(record));
  const [looking, setLooking] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      const row = Object.fromEntries(FIELDS.map((k) => [k, form[k].trim() || null])) as Record<keyof Form, string | null>;
      row.customer_code = row.customer_code?.toUpperCase() ?? null;
      const year = row.last_change_year ? Number(row.last_change_year) : null;
      const payload = { ...row, last_change_year: Number.isFinite(year) ? year : null, name: form.name.trim() };
      const { error } = record
        ? await supabase.from("factory_customers").update(payload).eq("id", record.id)
        : await supabase.from("factory_customers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(record ? "已更新客戶" : "已新增客戶"); setOpen(false); qc.invalidateQueries({ queryKey: ["factory_customers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });
  const lookup = async () => {
    const taxId = form.tax_id.trim();
    if (!/^\d{8}$/.test(taxId)) { toast.error("請先輸入 8 位數統一編號"); return; }
    setLooking(true);
    try {
      const r = await lookupCompany({ data: { taxId } });
      if (!r?.name) { toast.error("查無資料"); return; }
      setForm((f) => ({ ...f, name: f.name || r.name || "", address: f.address || r.address || "" }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "查詢失敗"); } finally { setLooking(false); }
  };
  const field = (k: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={`fc-${k}`}>{label}</Label><Input id={`fc-${k}`} value={form[k]} onChange={(e) => set(k)(e.target.value)} {...props} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(toForm(record)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{record ? "編輯客戶" : "新增客戶"}</DialogTitle></DialogHeader>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("customer_code", "客戶代碼", { maxLength: 40, placeholder: "例：KF01" })}
            {field("name", "客戶名稱 *", { required: true, maxLength: 120 })}
            <div className="space-y-1.5">
              <Label htmlFor="fc-tax_id">統一編號</Label>
              <div className="flex gap-2">
                <Input id="fc-tax_id" value={form.tax_id} onChange={(e) => set("tax_id")(e.target.value)} inputMode="numeric" maxLength={8} />
                <Button type="button" variant="outline" onClick={lookup} disabled={looking}>{looking ? "查詢中…" : "帶入公示資料"}</Button>
              </div>
            </div>
            {field("responsible_person", "負責人", { maxLength: 60 })}
            {field("last_change_year", "最後變更年度（民國）", { inputMode: "numeric", maxLength: 3, placeholder: "例：115" })}
          </div>
          {field("address", "工廠地址", { maxLength: 200 })}
          <div className="space-y-1.5"><Label htmlFor="fc-notes">備註</Label><Textarea id="fc-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={1000} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
