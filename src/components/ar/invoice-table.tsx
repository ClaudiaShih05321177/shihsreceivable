import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, HandCoins } from "lucide-react";
import { useState } from "react";

import { PaymentFormDialog } from "@/components/ar/payment-form-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ar/status-badge";
import { Money } from "@/components/ar/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { meQuery, type Invoice } from "@/lib/queries";
import {
  daysOverdue,
  formatDate,
  invoiceStatus,
  lastPaidDate,
  outstanding,
  overpaid,
  periodMonthLabel,
  rocYear,
  sortByPeriod,
  type SortDirection,
} from "@/lib/receivables";
import { cn } from "@/lib/utils";

/** 月份/期別的排序狀態：未排序 → 由新到舊 → 由舊到新。 */
type PeriodSort = SortDirection | null;

const nextSort = (s: PeriodSort): PeriodSort => (s === null ? "desc" : s === "desc" ? "asc" : null);

export function InvoiceTable({ invoices, showCustomer = true }: { invoices: Invoice[]; showCustomer?: boolean }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const [sort, setSort] = useState<PeriodSort>(null);
  const rows = sort ? sortByPeriod(invoices, sort) : invoices;

  if (invoices.length === 0) {
    return (
      <div className="ledger-card ledger-lines px-6 py-16 text-center text-sm text-muted-foreground">
        <p>目前沒有符合的帳款</p>
      </div>
    );
  }
  return (
    <div className="ledger-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {showCustomer && <TableHead>客戶名稱</TableHead>}
            <TableHead>
              <button
                type="button"
                onClick={() => setSort(nextSort)}
                aria-label="依月份/期別排序"
                className={cn(
                  "-ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium transition-colors hover:bg-accent",
                  sort ? "text-primary" : "text-foreground",
                )}
              >
                月份 / 期別
                {sort === "asc" ? <ArrowUp className="size-3.5" /> : sort === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
              </button>
            </TableHead>
            <TableHead className="text-right">應收帳款</TableHead>
            <TableHead className="text-right">應收餘額</TableHead>
            <TableHead>到期日</TableHead>
            <TableHead>收款日期</TableHead>
            <TableHead>狀態</TableHead>
            {me.canRecordPayment && <TableHead className="text-right">銷帳</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const status = invoiceStatus(inv);
            const late = daysOverdue(inv);
            const balance = outstanding(inv);
            return (
              <TableRow key={inv.id} className="group">
                {showCustomer && (
                  <TableCell className="font-medium">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="group-hover:text-primary group-hover:underline">
                      {inv.customer?.name ?? "—"}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Link to="/invoices/$id" params={{ id: inv.id }} className="block">
                    <span className="text-sm">{inv.period_year ? `${rocYear(inv.period_year)}年 ` : ""}{periodMonthLabel(inv.period_month)}</span>
                    {inv.period_label && <span className="ml-2 text-xs text-muted-foreground">期別 {inv.period_label}</span>}
                  </Link>
                </TableCell>
                <TableCell className="text-right"><Money value={Number(inv.amount)} /></TableCell>
                <TableCell className="text-right font-semibold">
                  {overpaid(inv) > 0 ? (
                    <span className="text-warning-foreground">溢收 <Money value={overpaid(inv)} /></span>
                  ) : (
                    <Money value={outstanding(inv)} className={status === "overdue" ? "text-overdue" : ""} />
                  )}
                  {(inv.credit_applied ?? 0) > 0 && <span className="block text-xs font-normal text-muted-foreground">溢繳折抵 <Money value={inv.credit_applied ?? 0} /></span>}
                  {(inv.credit_used ?? 0) > 0 && <span className="block text-xs font-normal text-muted-foreground">已折抵後期 <Money value={inv.credit_used ?? 0} /></span>}
                </TableCell>
                <TableCell className="tabular text-sm">
                  {formatDate(inv.due_date)}
                  {status === "overdue" && <span className="ml-1.5 text-xs text-overdue">逾 {late} 天</span>}
                </TableCell>
                <TableCell className="tabular text-sm text-muted-foreground">{formatDate(lastPaidDate(inv))}</TableCell>
                <TableCell><StatusBadge status={status} /></TableCell>
                {me.canRecordPayment && <TableCell className="text-right">
                  {balance > 0 ? (
                    <PaymentFormDialog
                      invoiceId={inv.id}
                      balance={balance}
                      trigger={<Button size="sm" variant="outline"><HandCoins /> 登錄收款</Button>}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">已收訖</span>
                  )}
                </TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
