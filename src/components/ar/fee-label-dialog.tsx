import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_FEE_LABELS, feeLabel, feeLabelMap, isFeeHidden } from "@/lib/fee-labels";
import { feeLabelsQuery, meQuery } from "@/lib/queries";
import { FEE_ITEMS } from "@/lib/receivables";

/** 費用欄位名稱管理：改名、隱藏、恢復預設；全團隊共用同一份。 */
export function FeeLabelDialog({ trigger }: { trigger: ReactNode }) {
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery(feeLabelsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const map = feeLabelMap(rows);

  const refresh = () => qc.invalidateQueries({ queryKey: ["fee_labels"] });

  const save = useMutation({
    mutationFn: async (v: { key: string; label: string; hidden: boolean }) => {
      const { error } = await supabase.from("fee_labels").upsert({ key: v.key, label: v.label, hidden: v.hidden }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("欄位名稱已更新"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const reset = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.from("fee_labels").delete().eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("已恢復預設名稱"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "恢復失敗"),
  });

  const defaultOf = (k: string) => map[k]?.label ?? DEFAULT_FEE_LABELS[k] ?? k;
  const dirty = (k: string) => draft[k] !== undefined && draft[k] !== defaultOf(k);
  const dirtyKeys = FEE_ITEMS.filter(dirty);

  function saveOne(k: string) {
    const label = draft[k];
    if (label === undefined) return;
    save.mutate({ key: k, label, hidden: isFeeHidden(k, map) });
    setDraft((d) => {
      const next = { ...d };
      delete next[k];
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDraft({});
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">欄位名稱</DialogTitle>
          <DialogDescription className="text-sm">
            替費用欄位改名或隱藏，應收帳款、請款單與稅額明細都會一起跟著變；已記錄的金額不受影響。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {FEE_ITEMS.map((k) => {
            const value = draft[k] ?? feeLabel(k, map);
            return (
              <div key={k} className="flex items-center gap-3 rounded-md border border-border bg-paper p-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    disabled={!me.canEdit}
                    aria-label={`${k} 顯示名稱`}
                    className="h-8"
                  />
                  <p className="truncate text-xs text-muted-foreground">欄位代碼：{k}</p>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={!isFeeHidden(k, map)}
                    disabled={!me.canEdit}
                    aria-label={`${k} 顯示`}
                    onCheckedChange={(c) => save.mutate({ key: k, label: value, hidden: c !== true })}
                  />
                  顯示
                </label>
                {dirty(k) && (
                  <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1" onClick={() => saveOne(k)}>
                    <Save className="size-3.5" /> 儲存
                  </Button>
                )}
                {map[k] && !dirty(k) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 shrink-0 gap-1 text-xs"
                    disabled={!me.canEdit}
                    onClick={() => reset.mutate(k)}
                  >
                    <RotateCcw className="size-3.5" /> 恢復預設
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">隱藏的欄位不會出現在新增帳款的費用項目裡；已填過金額的仍會顯示。</p>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1"
            disabled={dirtyKeys.length === 0 || save.isPending}
            onClick={() => dirtyKeys.forEach(saveOne)}
          >
            <Save className="size-3.5" /> 全部儲存{dirtyKeys.length ? `（${dirtyKeys.length}）` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
