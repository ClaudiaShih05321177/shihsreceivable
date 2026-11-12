import { Link } from "@tanstack/react-router";

import { StatusBadge } from "@/components/ar/status-badge";
import { Money } from "@/components/ar/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Invoice } from "@/lib/queries";
import { daysOverdue, formatDate, invoiceStatus, lastPaidDate, outstanding, periodMonthLabel, rocYear } from "@/lib/receivables";

export function InvoiceTable({ invoices, showCustomer = true }: { invoices: Invoice[]; showCustomer?: boolean }) {
  if (invoices.length === 0) {
    return <div className="ledger-card ledger-lines px-6 py-16 text-center text-sm text-muted-foreground">目前沒有符合的帳款</div>;
  }
  return (
    <div className="ledger-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {showCustomer && <TableHead>客戶名稱</TableHead>}
            <TableHead>月份 / 期別</TableHead>
            <TableHead className="text-right">應收帳款</TableHead>
            <TableHead className="text-right">應收餘額</TableHead>
            <TableHead>到期日</TableHead>
            <TableHead>收款日期</TableHead>
            <TableHead>狀態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const status = invoiceStatus(inv);
            const late = daysOverdue(inv);
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
                <TableCell className="text-right font-semibold"><Money value={outstanding(inv)} className={status === "overdue" ? "text-overdue" : ""} /></TableCell>
                <TableCell className="tabular text-sm">
                  {formatDate(inv.due_date)}
                  {status === "overdue" && <span className="ml-1.5 text-xs text-overdue">逾 {late} 天</span>}
                </TableCell>
                <TableCell className="tabular text-sm text-muted-foreground">{formatDate(lastPaidDate(inv))}</TableCell>
                <TableCell><StatusBadge status={status} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
