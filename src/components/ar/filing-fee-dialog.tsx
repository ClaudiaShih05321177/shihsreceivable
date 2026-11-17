import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filingServiceFeesQuery } from "@/lib/queries";
import { formatTWD } from "@/lib/receivables";

export function FilingFeeDialog({ id, name, fee }: { id: string; name: string; fee: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) throw new Error("請輸入有效的代辦費金額");
      const { error } = await supabase.rpc("set_filing_service_fee", { _filing_id: id, _fee: Math.round(value) });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["filings"] });
    },
    onSuccess: () => { setOpen(false); toast.success("工商代辦費已更新"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });
  const show = async () => {
    setLoading(true);
    try {
      const fees = await qc.fetchQuery({ ...filingServiceFeesQuery, staleTime: 0 });
      setAmount(String(fees[id] ?? 0));
      setOpen(true);
    } catch { toast.error("無法讀取工商代辦費，請重試"); }
    finally { setLoading(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label={`修改 ${name} 代辦費`} disabled={loading} onClick={(e) => { e.preventDefault(); void show(); }} className="tabular text-primary underline underline-offset-4">{formatTWD(fee)}</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm"><DialogHeader><DialogTitle>修改工商代辦費</DialogTitle></DialogHeader><p className="text-sm">{name}</p><div className="grid gap-2"><Label htmlFor="filing-fee-amount">工商代辦費</Label><Input id="filing-fee-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div><DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button></DialogFooter></DialogContent>
  </Dialog>;
}