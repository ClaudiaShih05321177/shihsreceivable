import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCheck, FileText, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FactoryFormDialog } from "@/components/ar/factory-form-dialog";
import { FactoryProgressDialog } from "@/components/ar/factory-progress-dialog";
import { canManageFactoryProgress } from "@/lib/permissions";
import { PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FACTORY_STAGES, needsEnv, nextFactoryStage } from "@/lib/factory";
import { factoryRegistrationsQuery, meQuery, type FactoryRegistration } from "@/lib/queries";
import { formatDate } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/factory")({
  head: () => ({
    meta: [
      { title: "工廠登記進度 · 勤豐工商顧問" },
      { name: "description", content: "勤豐工商顧問工廠登記案件：環保、工商科、現場會勘到核准結案的進度表。" },
      { property: "og:title", content: "工廠登記進度 · 勤豐工商顧問" },
      { property: "og:description", content: "工廠登記案件進度表。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(factoryRegistrationsQuery),
  component: FactoryPage,
});


function FactoryPage() {
  const { data: rows } = useSuspenseQuery(factoryRegistrationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const canProgress = canManageFactoryProgress(me);
  const qc = useQueryClient();
  const [stage, setStage] = useState("open");
  const shown = rows.filter((r) => (stage === "all" ? true : stage === "open" ? r.stage !== "核准結案" : r.stage === stage));

  const advance = useMutation({
    mutationFn: async ({ r, skip }: { r: FactoryRegistration; skip?: boolean }) => {
      const next = nextFactoryStage(r.stage, skip);
      const { error } = await supabase.rpc("update_factory_progress", { _id: r.id, _stage: next, _status_note: r.status_note ?? "", _env_filed_date: r.env_filed_date ?? "", _env_approved_date: r.env_approved_date ?? "", _bureau_filed_date: r.bureau_filed_date ?? "", _inspection_date: r.inspection_date ?? "", _approved_date: r.approved_date ?? "" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["factory_registrations"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("factory_registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["factory_registrations"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });

  const btn = (key: string, label: string, count: number) => (
    <button key={key} onClick={() => setStage(key)} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", stage === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent")}>
      {label} <span className="tabular ml-1 text-xs opacity-70">{count}</span>
    </button>
  );
  const d = (a: string | null, b?: string | null) => `${formatDate(a)}${b !== undefined ? `／${formatDate(b)}` : ""}`;

  return (
    <>
      <PageHeader eyebrow="勤豐工商顧問有限公司" title="工廠登記進度表" description="環保與現場會勘為選辦；免跑環保或客戶自辦環保的案件從送件工商科開始。" actions={canProgress ? <FactoryFormDialog trigger={<Button><Plus /> 新增案件</Button>} /> : undefined} />
      <div className="mb-5 flex flex-wrap gap-2">
        {btn("open", "進行中", rows.filter((r) => r.stage !== "核准結案").length)}
        {FACTORY_STAGES.map((s) => btn(s, s, rows.filter((r) => r.stage === s).length))}
        {btn("all", "全部", rows.length)}
      </div>
      <div className="grid gap-3">
        {shown.length === 0 && <div className="ledger-card py-10 text-center text-sm text-muted-foreground">尚無案件</div>}
        {shown.map((r) => {
          const title = <span className="font-medium">{r.factory_name}</span>;
          const steps = [
            needsEnv(r.env_mode) ? `環保：${d(r.env_filed_date, r.env_approved_date)}` : `環保：${r.env_mode}`,
            `工商科送件：${d(r.bureau_filed_date)}`, `會勘：${d(r.inspection_date)}`, `核准結案：${d(r.approved_date)}`,
          ];
          return (
            <div key={r.id} className="ledger-card grid gap-3 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  {me.isAdmin ? (
                    <FactoryFormDialog record={r} trigger={<button type="button" className="text-left text-primary underline-offset-4 hover:underline" aria-label={`編輯 ${r.factory_name}`}>{title}</button>} />
                  ) : title}
                  <div className="text-xs text-muted-foreground">{[r.tax_id, r.application_item, r.contact].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", r.stage === "核准結案" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{r.stage}</span>
                  {canProgress && <FactoryProgressDialog record={r} trigger={<Button variant="ghost" size="sm" aria-label={`變更 ${r.factory_name} 進度`}><Pencil className="size-3.5" /> 變更進度</Button>} />}
                </div>
              </div>
              {r.status_note && <p className="text-sm whitespace-pre-wrap">{r.status_note}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{steps.map((s) => <span key={s}>{s}</span>)}</div>
              <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                {me.isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "quote", stage: "尾款" }}><FileText className="size-3.5" /> 報價單</Link></Button>}
                {me.isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "invoice", stage: "尾款" }}><Receipt className="size-3.5" /> 請款單</Link></Button>}
                {canProgress && r.stage !== "核准結案" && (
                  <Button variant="ghost" size="sm" onClick={() => advance.mutate({ r })} aria-label={`${r.factory_name} 推進到${nextFactoryStage(r.stage)}`}><ArrowRight className="size-3.5" /> {nextFactoryStage(r.stage)}</Button>
                )}
                {canProgress && r.stage === "送件工商科" && (
                  <Button variant="ghost" size="sm" onClick={() => advance.mutate({ r, skip: true })}><CheckCheck className="size-3.5" /> 免會勘結案</Button>
                )}
                {me.isAdmin && <Button variant="ghost" size="sm" className="ml-auto" aria-label={`刪除 ${r.factory_name}`} onClick={() => { if (window.confirm(`確定刪除「${r.factory_name}」？`)) remove.mutate(r.id); }}><Trash2 className="size-3.5 text-destructive" /></Button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
