import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Money } from "@/components/ar/page-header";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { invoicesQuery, meQuery, taxFilingsQuery } from "@/lib/queries";
import { feeLabel } from "@/lib/fee-labels";
import { comparePeriod, periodMonths, formatDate, todayISO, periodMonthLabel, rocYear, splitTaxLines, TAX_GROUPS, taxLines, type FeeItems, type SortDirection } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/taxes")({
  head: () => ({
    meta: [
      { title: "稅額明細 · 應收帳款管理系統" },
      { name: "description", content: "每一期營業稅、營所稅、暫繳、扣繳、二代健保與股利二代的明細、合計與繳費狀態。" },
      { property: "og:title", content: "稅額明細 · 應收帳款管理系統" },
      { property: "og:description", content: "每一期稅額明細、合計與繳費狀態。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(taxFilingsQuery),
    ]),
  component: TaxesPage,
});

const codeCollator = new Intl.Collator("zh-Hant", { numeric: true, sensitivity: "base" });
/** 1月收的11-12月屬前一年度。 */
const lineYear = (inv: { period_year: number | null; period_month: number | null }, mo: number) =>
  (inv.period_year ?? 0) - (inv.period_month === 1 && mo >= 11 ? 1 : 0);
const periodKey = (y: number | null, m: number | null, p: string | null) => `${y ?? ""}|${m ?? 0}|${p ?? ""}`;

function TaxesPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: filings } = useSuspenseQuery(taxFilingsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("unpaid");
  const [staff, setStaff] = useState("all");
  const [payDate, setPayDate] = useState("all");
  const [sort, setSort] = useState<SortDirection | null>(null);
  const [q, setQ] = useState("");

  const periods = useMemo(() => {
    const m = new Map<string, { key: string; label: string; sort: number }>();
    for (const inv of invoices) {
      if (!taxLines(inv.items as FeeItems).length) continue;
      const key = periodKey(inv.period_year, inv.period_month, inv.period_label);
      const label = `${inv.period_year ? `${rocYear(inv.period_year)}年 ` : ""}${periodMonthLabel(inv.period_month)}${inv.period_label ? ` · 期別 ${inv.period_label}` : ""}`;
      m.set(key, { key, label, sort: (inv.period_year ?? 0) * 100 + (inv.period_month ?? 0) });
      const ms = periodMonths(inv.period_label);
      if (ms) for (const mo of ms) {
        const y = lineYear(inv, mo);
        m.set(`m|${y}|${mo}`, { key: `m|${y}|${mo}`, label: `單月 ${y ? `${rocYear(y)}年 ` : ""}${mo}月`, sort: y * 100 + mo - 0.5 });
      }
    }
    return [...m.values()].sort((a, b) => b.sort - a.sort);
  }, [invoices]);
  const [period, setPeriod] = useState(periods[0]?.key ?? "all");

  const filingMap = useMemo(() => new Map(filings.map((f) => [`${f.invoice_id}|${f.item}`, f])), [filings]);

  const lines = useMemo(
    () =>
      invoices
        .filter((inv) => period === "all" || period.startsWith("m|") || periodKey(inv.period_year, inv.period_month, inv.period_label) === period)
        .flatMap((inv) =>
          splitTaxLines(inv.items as FeeItems, inv.period_label).filter((l) => {
            if (!period.startsWith("m|")) return true;
            const [, y, mo] = period.split("|");
            return !!l.months?.some((x) => x === Number(mo) && lineYear(inv, x) === Number(y));
          }).map((l) => {
            // 拆月前的舊勾選紀錄（只記項目名稱）仍適用於兩個月。
            const f = filingMap.get(`${inv.id}|${l.key}`) ?? (l.half ? filingMap.get(`${inv.id}|${l.item}`) : undefined);
            return { ...l, inv, paid: !!f?.paid, paid_date: f?.paid_date ?? null };
          }),
        ),
    [invoices, period, filingMap],
  );
  const needle = q.trim().toLowerCase();
  const staffOf = (l: (typeof lines)[number]) => l.inv.customer?.customer_code?.trim().slice(0, 2).toUpperCase() || "未指定";
  const matched = lines.filter(
    (l) =>
      (group === "all" || l.group === group) &&
      (!needle || `${l.inv.customer?.customer_code ?? ""} ${l.inv.customer?.name ?? ""} ${feeLabel(l.item)} ${l.group}`.toLowerCase().includes(needle)),
  );
  // 選了繳費日期時只看該日已繳，不受繳費狀態影響。
  const statusOk = (l: (typeof lines)[number]) =>
    payDate !== "all" ? l.paid_date === payDate : status === "all" || (status === "paid" ? l.paid : !l.paid);
  const shown = matched.filter((l) => statusOk(l) && (staff === "all" || staffOf(l) === staff));
  /** 期別排序：未排序 → 由新到舊 → 由舊到新。 */
  /** 預設依客戶代號排序（沒有代號的排最後）；點期別可改依期別排序。 */
  const byCode = (a: (typeof shown)[number], b: (typeof shown)[number]) => {
    const ca = a.inv.customer?.customer_code?.trim() ?? "";
    const cb = b.inv.customer?.customer_code?.trim() ?? "";
    if (!ca !== !cb) return ca ? -1 : 1;
    return codeCollator.compare(ca, cb) || codeCollator.compare(a.inv.customer?.name ?? "", b.inv.customer?.name ?? "");
  };
  const ordered = [...shown].sort((a, b) =>
    sort ? (sort === "desc" ? -1 : 1) * comparePeriod(a.inv, b.inv) || byCode(a, b) : byCode(a, b) || comparePeriod(a.inv, b.inv),
  );

  const byDate = [...matched.filter((l) => staff === "all" || staffOf(l) === staff).reduce((m, l) => {
    if (!l.paid || !l.paid_date) return m;
    const v = m.get(l.paid_date) ?? { total: 0, count: 0 };
    v.total += l.amount; v.count++;
    return m.set(l.paid_date, v);
  }, new Map<string, { total: number; count: number }>())].sort((a, b) => b[0].localeCompare(a[0]));

  const byStaff = [...matched.reduce((m, l) => {
    const code = staffOf(l);
    const v = m.get(code) ?? { total: 0, paid: 0, count: 0 };
    v.total += l.amount; v.count++; if (l.paid) v.paid += l.amount;
    return m.set(code, v);
  }, new Map<string, { total: number; paid: number; count: number }>())].sort((a, b) => (a[0] === "未指定" ? 1 : b[0] === "未指定" ? -1 : codeCollator.compare(a[0], b[0])));

  const save = useMutation({
    mutationFn: async (v: { invoice_id: string; item: string; paid: boolean; paid_date: string | null }) => {
      if (!me.isAdmin) throw new Error("只有管理員可以登錄繳費");
      const { error } = await supabase.from("tax_filings").upsert(v, { onConflict: "invoice_id,item" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax_filings"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });


  return (
    <div className="space-y-6">
      <PageHeader title="稅額明細" description="每一期的營業稅、營所稅、暫繳、扣繳、二代健保與股利二代，勾選已繳費並填寫繳費日期；租金扣繳、租金二代與公司二代分月各自勾選；期別可選單月。" />

      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋客戶代號、名稱或項目" aria-label="搜尋稅額明細" className="pl-8" />
        </div>
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
        <Select value={staff} onValueChange={setStaff}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部會計專員</SelectItem>
            {byStaff.map(([c, v]) => (
              <SelectItem key={c} value={c}>{c}・應繳 {v.total.toLocaleString("zh-TW")}・待繳 {(v.total - v.paid).toLocaleString("zh-TW")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payDate} onValueChange={setPayDate}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部繳費日期</SelectItem>
            {byDate.map(([d, v]) => (
              <SelectItem key={d} value={d}>{formatDate(d)}・{v.count} 筆・{v.total.toLocaleString("zh-TW")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(() => {
        const base = matched.filter((l) => staff === "all" || staffOf(l) === staff);
        const total = base.reduce((t, l) => t + l.amount, 0);
        const unpaid = base.filter((l) => !l.paid);
        const unpaidSum = unpaid.reduce((t, l) => t + l.amount, 0);
        const f = (n: number) => `NT$ ${n.toLocaleString("zh-TW")}`;
        return (
          <div className="ledger-card flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3 text-sm">
            <span className="font-semibold">{staff === "all" ? "全部專員" : `專員 ${staff}`} 對帳</span>
            <span>已登帳應繳 <b className="font-mono text-base">{f(total)}</b>（{base.length} 筆）</span>
            <span className="text-muted-foreground">已繳 {f(total - unpaidSum)}</span>
            <span className={unpaidSum ? "font-semibold text-destructive" : "text-muted-foreground"}>待繳 {f(unpaidSum)}（{unpaid.length} 筆）</span>
          </div>
        );
      })()}

      {shown.length === 0 ? (
        <div className="ledger-card px-6 py-16 text-center text-sm text-muted-foreground">{needle ? "找不到符合的稅額資料" : "這一期沒有稅額資料"}</div>
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
                <TableRow key={`${l.inv.id}-${l.key}`}>
                                    <TableCell className="font-medium">
                    <Link to="/invoices/$id" params={{ id: l.inv.id }} className="hover:text-primary hover:underline">{l.inv.customer?.customer_code && <span className="mr-2 font-mono text-sm text-muted-foreground">{l.inv.customer.customer_code}</span>}{l.inv.customer?.name ?? "—"}</Link>
                  </TableCell>
                  <TableCell className="text-sm">{l.half && l.months ? `${l.inv.period_year ? `${rocYear(lineYear(l.inv, l.months[0]!))}年 ` : ""}${l.months[0]}月` : <>{l.inv.period_year ? `${rocYear(l.inv.period_year)}年 ` : ""}{periodMonthLabel(l.inv.period_month)}{l.inv.period_label ? ` · ${l.inv.period_label}` : ""}</>}</TableCell>
                  <TableCell className="text-sm">{l.group}</TableCell>
                  <TableCell className="text-sm">{feeLabel(l.item)}{l.half ? <span className="ml-1 text-xs text-muted-foreground">（第{l.half}個月）</span> : null}</TableCell>
                  <TableCell className="text-right"><Money value={l.amount} /></TableCell>
                  <TableCell>
                    <Checkbox
                      aria-label={`${l.inv.customer?.name ?? ""} ${l.item}${l.half ? ` 第${l.half}個月` : ""} 已繳費`}
                      checked={l.paid}
                      disabled={!me.isAdmin}
                      onCheckedChange={(c) =>
                        save.mutate({ invoice_id: l.inv.id, item: l.key, paid: c === true, paid_date: c === true ? l.paid_date ?? todayISO() : null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {me.isAdmin && l.paid ? (
                      <RocDateInput
                        className="h-8 w-32"
                        value={l.paid_date ?? ""}
                        onChange={(v) => save.mutate({ invoice_id: l.inv.id, item: l.key, paid: true, paid_date: v || null })}
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
