import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { FACTORY_STAGES, needsEnv } from "@/lib/factory";
import type { FactoryRegistration } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

const dates = [
  ["env_filed_date", "環保送件日期"], ["env_approved_date", "環保核准日期"],
  ["bureau_filed_date", "工商科送件日期"], ["inspection_date", "現場會勘日期"], ["approved_date", "核准結案日期"],
] as const;

export function FactoryProgressDialog({ record, trigger }: { record: FactoryRegistration; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(record);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_factory_progress", {
        _id: record.id, _stage: form.stage, _status_note: form.status_note ?? "",
        _env_filed_date: form.env_filed_date ?? "", _env_approved_date: form.env_approved_date ?? "",
        _bureau_filed_date: form.bureau_filed_date ?? "", _inspection_date: form.inspection_date ?? "", _approved_date: form.approved_date ?? "",
      });
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["factory_registrations"] }); setOpen(false); toast.success("已更新工廠進度"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });
  return <Dialog open={open} onOpenChange={(value) => { if (value) setForm(record); setOpen(value); }}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>變更工廠進度 · {record.factory_name}</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>目前階段</Label><Select value={form.stage} onValueChange={(stage) => setForm((f) => ({ ...f, stage }))}>
          <SelectTrigger aria-label="目前階段"><SelectValue /></SelectTrigger>
          <SelectContent>{FACTORY_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent>
        </Select></div>
        <div className="grid gap-2"><Label htmlFor="factory-progress-status">Status</Label><Textarea id="factory-progress-status" value={form.status_note ?? ""} onChange={(e) => setForm((f) => ({ ...f, status_note: e.target.value }))} /></div>
        {dates.filter(([key]) => !key.startsWith("env_") || needsEnv(record.env_mode)).map(([key, label]) => <div key={key} className="grid gap-2">
          <Label htmlFor={`progress-${key}`}>{label}</Label><RocDateInput id={`progress-${key}`} value={form[key] ?? ""} onChange={(value) => setForm((f) => ({ ...f, [key]: value || null }))} />
        </div>)}
      </div>
      <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "儲存中…" : "儲存"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}