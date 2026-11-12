import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Money } from "@/components/ar/page-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { feeLabelsQuery, invoicesQuery, meQuery, taxFilingsQuery } from "@/lib/queries";
import { feeLabel, feeLabelMap } from "@/lib/fee-labels";
import { comparePeriod, formatDate, periodMonthLabel, rocYear, TAX_GROUPS, taxLines, taxSummary, todayISO, type FeeItems, type SortDirection } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/taxes")({
  head: () => ({
    meta: [
      { title: "稅額明細 · 帳房" },
      { name: "description", content: "每一期營業稅、營所稅、暫繳、扣繳、二代健保與股利二代的明細、合計與繳費狀態。" },
      { property: "og:title", content: "稅額明細 · 帳房" },
      { property: "og:description", content: "每一期稅額明細、合計與繳費狀態。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(taxFilingsQuery),
      context.queryClient.ensureQueryData(feeLabelsQuery),
    ]),
  component: TaxesPage,
});

const periodKey = (y: number | null, m: number | null, p: string | null) => `${y ?? ""}|${m ?? 0}|${p ?? ""}`;

function TaxesPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: filings } = useSuspenseQuery(taxFilingsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: labelRows } = useSuspenseQuery(feeLabelsQuery);
  const labelMap = feeLabelMap(labelRows);
  const qc = useQueryClient();
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortDirection | null>(null);

  const periods = useMemo(() => {
    const m = new Map<string, { key: string; label: string; sort: number }>();
    for (const inv of invoices) {
      if (!taxLines(inv.items as FeeItems).length) continue;
      const key = periodKey(inv.period_year, inv.period_month, inv.period_label);
      const label = `${inv.period_year ? `${rocYear(inv.period_year)}年 ` : ""}${periodMonthLabel(inv.period_month)}${inv.period_label ? ` · 期別 ${inv.period_label}` : ""}`;
      m.set(key, { key, label, sort: (inv.period_year ?? 0) * 100 + (inv.period_month ?? 0) });
    }
    return [...m.values()].sort((a, b) => b.sort - a.sort);
  }, [invoices]);
  const [period, setPeriod] = useState(periods[0]?.key ?? "all");

  const filingMap = useMemo(() => new Map(filings.map((f) => [`${f.invoice_id}|${f.item}`, f])), [filings]);

  const lines = useMemo(
    () =>
      invoices
        .filter((inv) => period === "all" || periodKey(inv.period_year, inv.period_month, inv.period_label) === period)
        .flatMap((inv) =>
          taxLines(inv.items as FeeItems).map((l) => {
            const f = filingMap.get(`${inv.id}|${l.item}`);
            return { ...l, inv, paid: !!f?.paid, paid_date: f?.paid_date ?? null };
          }),
        ),
    [invoices, period, filingMap],
  );
  const summary = taxSummary(lines);
  const shown = lines.filter(
    (l) => (group === "all" || l.group === group) && (status === "all" || (status === "paid" ? l.paid : !l.paid)),
  );
  /** 期別排序：未排序 → 由新到舊 → 由舊到新。 */
  const ordered = sort
    ? [...shown].sort((a, b) => (sort === "desc" ? -1 : 1) * comparePeriod(a.inv, b.inv))
    : shown;

  const save = useMutation({
    mutationFn: async (v: { invoice_id: string; item: string; paid: boolean; paid_date: string | null }) => {
      if (!me.isAdmin) throw new Error("只有管理員可以登錄繳費");
      const { error } = await supabase.from("tax_filings").upsert(v, { onConflict: "invoice_id,item" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax_filings"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });

  const grand = summary.reduce((s, g) => ({ total: s.total + g.total, paid: s.paid + g.paid }), { total: 0, paid: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="稅額明細" description="每一期的營業稅、營所稅、暫繳、扣繳、二代健保與股利二代，勾選已繳費並填寫繳費日期。" />

      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部期別</SelectItem>
            {periods.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部稅目</SelectItem>
            {TAX_GROUPS.map((g) => <SelectItem key={g.key} value={g.label}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="unpaid">未繳費</SelectItem>
            <SelectItem value="paid">已繳費</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((g) => (
          <div key={g.label} className="ledger-card p-4">
            <p className="text-xs text-muted-foreground">{g.label}</p>
            <Money value={g.total} className="text-lg font-semibold" />
            <p className="mt-1 text-xs text-muted-foreground">未繳 {g.unpaid.toLocaleString("zh-TW")}</p>
          </div>
        ))}
        <div className="ledger-card bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">總和</p>
          <Money value={grand.total} className="text-lg font-semibold" />
          <p className="mt-1 text-xs text-muted-foreground">未繳 {(grand.total - grand.paid).toLocaleString("zh-TW")}</p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="ledger-card px-6 py-16 text-center text-sm text-muted-foreground">這一期沒有稅額資料</div>
      ) : (
        <div className="ledger-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>客戶名稱</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => setSort((s) => (s === null ? "desc" : s === "desc" ? "asc" : null))}
                    aria-label="依期別排序"
                    className={cn(
                      "-ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium transition-colors hover:bg-accent",
                      sort ? "text-primary" : "text-foreground",
                    )}
                  >
                    期別
                    {sort === "asc" ? <ArrowUp className="size-3.5" /> : sort === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                  </button>
                </TableHead>
                <TableHead>稅目</TableHead>
                <TableHead>項目</TableHead>
                <TableHead className="text-right">稅額</TableHead>
                <TableHead>已繳費</TableHead>
                <TableHead>繳費日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((l) => (
                <TableRow key={`${l.inv.id}-${l.item}`}>
                  <TableCell className="font-medium">
                    <Link to="/invoices/$id" params={{ id: l.inv.id }} className="hover:text-primary hover:underline">{l.inv.customer?.name ?? "—"}</Link>
                  </TableCell>
                  <TableCell className="text-sm">{l.inv.period_year ? `${rocYear(l.inv.period_year)}年 ` : ""}{periodMonthLabel(l.inv.period_month)}{l.inv.period_label ? ` · ${l.inv.period_label}` : ""}</TableCell>
                  <TableCell className="text-sm">{l.group}</TableCell>
                  <TableCell className="text-sm">{feeLabel(l.item, labelMap)}</TableCell>
                  <TableCell className="text-right"><Money value={l.amount} /></TableCell>
                  <TableCell>
                    <Checkbox
                      aria-label={`${l.inv.customer?.name ?? ""} ${l.item} 已繳費`}
                      checked={l.paid}
                      disabled={!me.isAdmin}
                      onCheckedChange={(c) =>
                        save.mutate({ invoice_id: l.inv.id, item: l.item, paid: c === true, paid_date: c === true ? l.paid_date ?? todayISO() : null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {me.isAdmin && l.paid ? (
                      <Input
                        type="date"
                        className="h-8 w-40"
                        value={l.paid_date ?? ""}
                        onChange={(e) => save.mutate({ invoice_id: l.inv.id, item: l.item, paid: true, paid_date: e.target.value || null })}
                      />
                    ) : (
                      <span className="tabular text-sm text-muted-foreground">{formatDate(l.paid_date)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
