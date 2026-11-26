import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Inv = { id: string; customer_id: string; period_year: number | null; period_label: string | null; amount: number | string; payments: unknown[]; customer?: { name: string; customer_code: string | null } | null };

/** 管理員撤銷誤立帳款：依專員＋期別，只刪尚未收款的帳款。 */
export function BatchDeleteDialog({ invoices, staffById }: { invoices: Inv[]; staffById: Map<string, string> }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState("");
  const [period, setPeriod] = useState("");
  const qc = useQueryClient();
  const keyOf = (i: Inv) => `${i.period_year ?? ""}|${i.period_label ?? ""}`;
  const unpaid = invoices.filter((i) => i.payments.length === 0);
  const staffs = [...new Set(unpaid.map((i) => staffById.get(i.customer_id)).filter(Boolean))].sort() as string[];
  const periods = [...new Set(unpaid.filter((i) => staffById.get(i.customer_id) === staff).map(keyOf))].sort();
  const targets = useMemo(() => unpaid.filter((i) => staffById.get(i.customer_id) === staff && keyOf(i) === period), [unpaid, staff, period, staffById]);
  const label = (k: string) => { const [y, l] = k.split("|"); return `${y ? Number(y) - 1911 + "年 " : ""}${l || "（無期別）"}`; };
  const del = useMutation({
    mutationFn: async () => {
      const ids = targets.map((t) => t.id);
      const { data, error } = await supabase.from("invoices").delete().in("id", ids).select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: async (n) => { await qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success(`已刪除 ${n} 筆帳款`); setOpen(false); setPeriod(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline"><Trash2 /> 批次刪除</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>批次刪除誤立帳款</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">只會刪除尚未收款的帳款；已有收款的不會動到。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2"><Label>會計專員</Label><Select value={staff} onValueChange={(v) => { setStaff(v); setPeriod(""); }}><SelectTrigger aria-label="會計專員"><SelectValue placeholder="選擇專員" /></SelectTrigger><SelectContent>{staffs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>期別</Label><Select value={period} onValueChange={setPeriod} disabled={!staff}><SelectTrigger aria-label="期別"><SelectValue placeholder="選擇期別" /></SelectTrigger><SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{label(p)}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {period && <div className="max-h-60 overflow-y-auto rounded border text-sm">{targets.map((t) => <div key={t.id} className="flex justify-between border-b px-3 py-1.5 last:border-0"><span>{t.customer?.customer_code} {t.customer?.name}</span><span className="tabular">{Number(t.amount).toLocaleString("zh-TW")}</span></div>)}</div>}
      <DialogFooter><Button variant="destructive" disabled={!targets.length || del.isPending} onClick={() => { if (window.confirm(`確定刪除 ${staff} ${label(period)} 共 ${targets.length} 筆帳款？`)) del.mutate(); }}>{del.isPending ? "刪除中…" : `刪除 ${targets.length} 筆`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
