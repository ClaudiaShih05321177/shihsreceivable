import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";

import { PaymentFormDialog } from "@/components/ar/payment-form-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ar/status-badge";
import { Money } from "@/components/ar/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { meQuery, type Invoice } from "@/lib/queries";
import { daysOverdue, formatDate, invoiceStatus, lastPaidDate, outstanding, periodMonthLabel, rocYear } from "@/lib/receivables";

export function InvoiceTable({ invoices, showCustomer = true }: { invoices: Invoice[]; showCustomer?: boolean }) {
  const { data: me } = useSuspenseQuery(meQuery);
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
            <TableHead>月份 / 期別</TableHead>
            <TableHead className="text-right">應收帳款</TableHead>
            <TableHead className="text-right">應收餘額</TableHead>
            <TableHead>到期日</TableHead>
            <TableHead>收款日期</TableHead>
            <TableHead>狀態</TableHead>
            {me.canRecordPayment && <TableHead className="text-right">銷帳</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
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
                <TableCell className="text-right font-semibold"><Money value={outstanding(inv)} className={status === "overdue" ? "text-overdue" : ""} /></TableCell>
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
