import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, Money } from "@/components/ar/page-header";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { auditFee, auditSummary } from "@/lib/auditors";
import { invoicesQuery, meQuery } from "@/lib/queries";
import { comparePeriod, formatDate, outstanding, periodMonthLabel, rocYear } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/audits")({
  head: () => ({
    meta: [
      { title: "財稅簽 · 應收帳款管理系統" },
      { name: "description", content: "依簽證會計師（秉誠、詮益、眾智）列出財稅簽證費用、收款狀態與付會計師日期。" },
      { property: "og:title", content: "財稅簽 · 應收帳款管理系統" },
      { property: "og:description", content: "各會計師財稅簽證明細與合計。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: AuditsPage,
});

function AuditsPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const groups = auditSummary(invoices);

  const save = useMutation({
    mutationFn: async (v: { id: string; auditor_paid: boolean; auditor_paid_date: string | null }) => {
      if (!me.isAdmin) throw new Error("只有管理員可以登錄");
      const { error } = await supabase.from("invoices").update({ auditor_paid: v.auditor_paid, auditor_paid_date: v.auditor_paid_date }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="財稅簽" description="依簽證會計師列出財稅簽證費用；在應收帳款中選擇會計師即會歸到該會計師。" />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="unpaid">未收</SelectItem>
          <SelectItem value="paid">已收</SelectItem>
        </SelectContent>
      </Select>
      <div className="grid gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <div key={g.name} className="ledger-card p-4">
            <p className="text-xs text-muted-foreground">{g.name}</p>
            <Money value={g.total} className="text-lg font-semibold" />
            <p className="mt-1 text-xs text-muted-foreground">{g.rows.length} 筆</p>
          </div>
        ))}
      </div>
      {groups.filter((g) => g.rows.length).map((g) => {
        const rows = g.rows
          .filter((inv) => status === "all" || (status === "paid" ? outstanding(inv) <= 0 : outstanding(inv) > 0))
          .sort((a, b) => -comparePeriod(a, b));
        return (
          <section key={g.name} className="space-y-2">
            <h2 className="font-serif text-lg font-semibold">{g.name}　<Money value={g.total} /></h2>
            <div className="ledger-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>客戶名稱</TableHead>
                    <TableHead>期別</TableHead>
                    <TableHead className="text-right">財稅簽證</TableHead>
                    <TableHead>收款狀態</TableHead>
                    <TableHead>收款日期</TableHead>
                    <TableHead>已付會計師</TableHead>
                    <TableHead>付款日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => {
                    const paid = outstanding(inv) <= 0;
                    const last = [...(inv.payments ?? [])].map((p) => p.paid_date).sort().at(-1);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:text-primary hover:underline">{inv.customer?.name ?? "—"}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{inv.period_year ? `${rocYear(inv.period_year)}年 ` : ""}{periodMonthLabel(inv.period_month)}{inv.period_label ? ` · ${inv.period_label}` : ""}</TableCell>
                        <TableCell className="text-right"><Money value={auditFee(inv)} /></TableCell>
                        <TableCell className={paid ? "text-sm text-primary" : "text-sm text-destructive"}>{paid ? "已收" : "未收"}</TableCell>
                        <TableCell className="text-sm">{last ? formatDate(last) : "—"}</TableCell>
                        <TableCell>
                          <Checkbox
                            aria-label={`${inv.customer?.name ?? ""} 已付會計師`}
                            checked={inv.auditor_paid}
                            disabled={!me.isAdmin}
                            onCheckedChange={(c) => save.mutate({ id: inv.id, auditor_paid: c === true, auditor_paid_date: c === true ? inv.auditor_paid_date ?? null : null })}
                          />
                        </TableCell>
                        <TableCell>
                          {me.isAdmin && inv.auditor_paid ? (
                            <RocDateInput className="h-8 w-32" value={inv.auditor_paid_date ?? ""} onChange={(v) => save.mutate({ id: inv.id, auditor_paid: true, auditor_paid_date: v || null })} />
                          ) : (
                            <span className="text-sm">{inv.auditor_paid_date ? formatDate(inv.auditor_paid_date) : "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
