import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FilingFormDialog } from "@/components/ar/filing-form-dialog";
import { PageHeader, Money } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { FILING_STAGES, filingInvoiceItems, filingTotal, nextStage } from "@/lib/filings";
import { customersQuery, filingsQuery, meQuery, type Filing } from "@/lib/queries";
import { formatDate, todayISO } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/filings")({
  head: () => ({
    meta: [
      { title: "工商進度 · 帳房" },
      { name: "description", content: "工商登記案件進度表：預查、送件、核准、結案，結案時一鍵立帳到應收帳款。" },
      { property: "og:title", content: "工商進度 · 帳房" },
      { property: "og:description", content: "工商登記案件進度與立帳。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(filingsQuery), context.queryClient.ensureQueryData(customersQuery)]),
  component: FilingsPage,
});

function FilingsPage() {
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [stage, setStage] = useState<string>("open");

  const counts = Object.fromEntries(FILING_STAGES.map((s) => [s, filings.filter((f) => f.stage === s).length]));
  const openCount = filings.filter((f) => f.stage !== "結案").length;
  const rows = filings.filter((f) => (stage === "all" ? true : stage === "open" ? f.stage !== "結案" : f.stage === stage));

  const advance = useMutation({
    mutationFn: async (filing: Filing) => {
      const next = nextStage(filing.stage);
      const patch = {
        stage: next,
        filed_date: next === "送件" && !filing.filed_date ? todayISO() : filing.filed_date,
        approved_date: next === "核准" && !filing.approved_date ? todayISO() : filing.approved_date,
      };
      const { error } = await supabase.from("filings").update(patch).eq("id", filing.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filings"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const bill = useMutation({
    mutationFn: async (filing: Filing) => {
      const items = filingInvoiceItems(filing);
      const amount = filingTotal(filing);
      if (amount <= 0) throw new Error("代辦費與代墊規費皆為 0，無法立帳");
      const base = filing.approved_date ?? todayISO();
      const [y = 0, m = 0] = base.slice(0, 7).split("-").map(Number);
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          customer_id: filing.customer_id,
          amount,
          items,
          issue_date: todayISO(),
          period_year: y,
          period_month: m,
          period_label: filing.case_type,
          description: `工商${filing.case_type}`,
        })
        .select("id")
        .single();
      if (invError) throw invError;
      const { error } = await supabase.from("filings").update({ stage: "結案", invoice_id: invoice.id }).eq("id", filing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已結案並建立應收帳款");
      qc.invalidateQueries({ queryKey: ["filings"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "立帳失敗"),
  });

  const remove = useMutation({
    mutationFn: async (filing: Filing) => {
      const { error } = await supabase.from("filings").delete().eq("id", filing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("案件已刪除");
      qc.invalidateQueries({ queryKey: ["filings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });

  const filterBtn = (key: string, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setStage(key)}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        stage === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
      )}
    >
      {label} <span className="tabular ml-1 text-xs opacity-70">{count}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        eyebrow="工商登記"
        title="工商進度表"
        description={`進行中 ${openCount} 件；核准後可一鍵結案立帳，代辦費與代墊規費合併為一筆應收帳款。`}
        actions={<FilingFormDialog trigger={<Button><Plus /> 新增案件</Button>} />}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {filterBtn("open", "進行中", openCount)}
        {FILING_STAGES.map((s) => filterBtn(s, s, counts[s] ?? 0))}
        {filterBtn("all", "全部", filings.length)}
      </div>
      <div className="ledger-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>客戶名稱</TableHead>
              <TableHead>案件類型</TableHead>
              <TableHead>階段</TableHead>
              <TableHead>送件日期</TableHead>
              <TableHead>核准日期</TableHead>
              <TableHead className="text-right">代辦費</TableHead>
              <TableHead className="text-right">代墊規費</TableHead>
              <TableHead>應收帳款</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">尚無案件</TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.customer?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{f.case_type}</TableCell>
                <TableCell>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    f.stage === "結案" ? "bg-primary/10 text-primary" : f.stage === "核准" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                  )}>
                    {f.stage}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{formatDate(f.filed_date)}</TableCell>
                <TableCell className="text-sm">{formatDate(f.approved_date)}</TableCell>
                <TableCell className="text-right"><Money value={Number(f.service_fee)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(f.advance_fee)} /></TableCell>
                <TableCell className="text-sm">
                  {f.invoice_id ? (
                    <Link to="/invoices/$id" params={{ id: f.invoice_id }} className="text-primary hover:underline">查看帳款</Link>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {me.isAdmin && f.stage !== "結案" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => advance.mutate(f)} disabled={advance.isPending} aria-label={`${f.customer?.name ?? ""} 推進到${nextStage(f.stage)}`}>
                          <ArrowRight className="size-3.5" /> {nextStage(f.stage)}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => bill.mutate(f)} disabled={bill.isPending} aria-label={`${f.customer?.name ?? ""} 結案立帳`}>
                          <Receipt className="size-3.5" /> 結案立帳
                        </Button>
                      </>
                    )}
                    {me.isAdmin && (
                      <FilingFormDialog
                        filing={f}
                        trigger={<Button variant="ghost" size="icon" aria-label={`編輯 ${f.customer?.name ?? ""}`}><Pencil className="size-3.5" /></Button>}
                      />
                    )}
                    {me.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`刪除 ${f.customer?.name ?? ""}`}
                        onClick={() => { if (window.confirm(`確定刪除「${f.customer?.name ?? ""}」的${f.case_type}案件？`)) remove.mutate(f); }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
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
