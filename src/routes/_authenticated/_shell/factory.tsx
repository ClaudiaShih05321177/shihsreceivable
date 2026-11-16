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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <PageHeader eyebrow="勤豐工商顧問有限公司" title="工廠登記進度表" description="環保與現場會勘為選辦；免跑環保或客戶自辦環保的案件從送件工商科開始。" actions={me.isAdmin ? <FactoryFormDialog trigger={<Button><Plus /> 新增案件</Button>} /> : undefined} />
      <div className="mb-5 flex flex-wrap gap-2">
        {btn("open", "進行中", rows.filter((r) => r.stage !== "核准結案").length)}
        {FACTORY_STAGES.map((s) => btn(s, s, rows.filter((r) => r.stage === s).length))}
        {btn("all", "全部", rows.length)}
      </div>
      <div className="ledger-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>廠名</TableHead><TableHead>申辦項目</TableHead><TableHead>Status</TableHead><TableHead>聯絡人</TableHead>
              <TableHead>階段</TableHead><TableHead>環保 送件／核准</TableHead><TableHead>工商科送件</TableHead><TableHead>現場會勘</TableHead><TableHead>核准結案</TableHead>
<TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && <TableRow><TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">尚無案件</TableCell></TableRow>}
            {shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.factory_name}{r.tax_id && <div className="tabular text-xs font-normal text-muted-foreground">{r.tax_id}</div>}</TableCell>
                <TableCell className="text-sm">{r.application_item ?? "—"}</TableCell>
                <TableCell className="min-w-64 max-w-96 text-sm whitespace-pre-wrap">{r.status_note ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.contact ?? "—"}</TableCell>
                <TableCell><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", r.stage === "核准結案" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{r.stage}</span></TableCell>
                <TableCell className="text-sm whitespace-nowrap">{needsEnv(r.env_mode) ? d(r.env_filed_date, r.env_approved_date) : r.env_mode}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{d(r.bureau_filed_date)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{d(r.inspection_date)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{d(r.approved_date)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {me.isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "quote", stage: "尾款" }}><FileText className="size-3.5" /> 報價單</Link></Button>}
                    {me.isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "invoice", stage: "尾款" }}><Receipt className="size-3.5" /> 請款單</Link></Button>}
                    {canProgress && r.stage !== "核准結案" && (
                      <Button variant="ghost" size="sm" onClick={() => advance.mutate({ r })} aria-label={`${r.factory_name} 推進到${nextFactoryStage(r.stage)}`}><ArrowRight className="size-3.5" /> {nextFactoryStage(r.stage)}</Button>
                    )}
                    {canProgress && r.stage === "送件工商科" && (
                      <Button variant="ghost" size="sm" onClick={() => advance.mutate({ r, skip: true })}><CheckCheck className="size-3.5" /> 免會勘結案</Button>
                    )}
                    {me.isAdmin && <FactoryFormDialog record={r} trigger={<Button variant="ghost" size="icon" aria-label={`編輯 ${r.factory_name}`}><Pencil className="size-3.5" /></Button>} />}
                    {!me.isAdmin && canProgress && <FactoryProgressDialog record={r} trigger={<Button variant="ghost" size="icon" aria-label={`變更 ${r.factory_name} 進度`}><Pencil className="size-3.5" /></Button>} />}
                    {me.isAdmin && <Button variant="ghost" size="icon" aria-label={`刪除 ${r.factory_name}`} onClick={() => { if (window.confirm(`確定刪除「${r.factory_name}」？`)) remove.mutate(r.id); }}><Trash2 className="size-3.5 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
