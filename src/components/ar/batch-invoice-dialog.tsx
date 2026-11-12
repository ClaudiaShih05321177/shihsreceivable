import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { batchInvoiceDrafts } from "@/lib/billing";
import { customersQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { bookkeepingCollectionMonth, formatTWD, rocYear, todayISO } from "@/lib/receivables";

export function BatchInvoiceDialog() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const qc = useQueryClient();
  const now = new Date();
  const cm = bookkeepingCollectionMonth(now.getMonth() + 1);
  const [open, setOpen] = useState(false);
  const [rocY, setRocY] = useState(String(rocYear(now.getFullYear() + (cm === 13 ? 1 : 0))));
  const [month, setMonth] = useState(String(cm === 13 ? 1 : cm));
  const year = Number(rocY) + 1911;
  const drafts = batchInvoiceDrafts(customers, invoices, year, Number(month));
  const total = drafts.reduce((s, d) => s + d.amount, 0);

  const run = useMutation({
    mutationFn: async () => {
      if (!me.canCreate) throw new Error("沒有立帳權限");
      const rows = drafts.map((d) => ({ ...d, issue_date: todayISO() }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("invoices").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`已建立 ${n} 筆應收帳款`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "建立失敗"),
  });

  if (!me.canCreate) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><CalendarPlus /> 一鍵立帳</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>一鍵立帳</DialogTitle>
          <DialogDescription>依收款月份為所有客戶自動帶入記帳費（單數月 ×2）、文具費（11月）、結算費（1月）。該月已有帳款的客戶會略過。</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-year">年度（民國）</Label>
            <Input id="b-year" inputMode="numeric" value={rocY} onChange={(e) => setRocY(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>收款月份</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger aria-label="收款月份"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}月</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="rounded-md bg-muted p-3 text-sm">將建立 <b>{drafts.length}</b> 筆，合計 <b>{formatTWD(total)}</b></p>
        <DialogFooter>
          <Button disabled={!drafts.length || run.isPending} onClick={() => run.mutate()}>{run.isPending ? "建立中…" : "確認建立"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
