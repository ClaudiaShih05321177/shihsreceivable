import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { InvoiceFormDialog } from "@/components/ar/invoice-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { PaymentFormDialog } from "@/components/ar/payment-form-dialog";
import { StatusBadge } from "@/components/ar/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, invoiceQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { feeLabel } from "@/lib/fee-labels";
import {
  daysOverdue,
  formatDate,
  formatTWD,
  invoiceStatus,
  itemEntries,
  outstanding,
  overpaid,
  paidTotal,
  periodMonthLabel,
  rocYear,
  type FeeItems,
} from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/invoices/$id")({
  head: () => ({
    meta: [
      { title: "帳款明細 · 應收帳款管理系統" },
      { name: "description", content: "單筆應收帳款的費用項目、收款紀錄與應收餘額。" },
      { property: "og:title", content: "帳款明細 · 應收帳款管理系統" },
      { property: "og:description", content: "單筆應收帳款的費用項目、收款紀錄與應收餘額。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const [inv] = await Promise.all([
      context.queryClient.ensureQueryData(invoiceQuery(params.id)),
      context.queryClient.ensureQueryData(customersQuery),
    ]);
    if (!inv) throw notFound();
  },
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <p className="text-muted-foreground">找不到這筆帳款</p>
      <Link to="/invoices" className="mt-4 inline-block text-primary hover:underline">回到應收帳款</Link>
    </div>
  ),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { data: inv } = useSuspenseQuery(invoiceQuery(id));
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const removeInvoice = useMutation({
    mutationFn: async () => {
      if (!me.canDelete) throw new Error("只有管理員可以刪除資料");
      const { data, error } = await supabase.from("invoices").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("未能刪除帳款，請確認權限");
    },
    onSuccess: () => {
      toast.success("已刪除帳款");
      qc.removeQueries({ queryKey: ["invoices", id] });
      qc.invalidateQueries({ queryKey: invoicesQuery.queryKey });
      navigate({ to: "/invoices" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });

  const removePayment = useMutation({
    mutationFn: async (pid: string) => {
      if (!me.canDelete) throw new Error("只有管理員可以刪除收款");
      const { data, error } = await supabase.from("payments").delete().eq("id", pid).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("未能刪除收款，請確認權限");
    },
    onSuccess: () => {
      toast.success("已刪除收款紀錄");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });

  if (!inv) return null;
  const customer = customers.find((c) => c.id === inv.customer_id);
  const status = invoiceStatus(inv);
  const balance = outstanding(inv);
  const over = overpaid(inv);
  const paid = paidTotal(inv);
  const items = itemEntries(inv.items as FeeItems);
  const payments = [...inv.payments].sort((a, b) => a.paid_date.localeCompare(b.paid_date));
  const pct = Number(inv.amount) > 0 ? Math.min(100, Math.round((paid / Number(inv.amount)) * 100)) : 0;

  return (
    <>
      <Link to="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> 應收帳款
      </Link>
      <PageHeader
        eyebrow={`${inv.period_year ? `民國 ${rocYear(inv.period_year)} 年 · ` : ""}${periodMonthLabel(inv.period_month)}${inv.period_label ? ` · 期別 ${inv.period_label}` : ""}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {customer ? (
              <Link to="/customers/$id" params={{ id: customer.id }} className="hover:text-primary">{customer.name}</Link>
            ) : inv.customer?.name ?? "—"}
            <StatusBadge status={status} className="text-sm" />
          </span>
        }
        description={
          <>
            {customer?.billing_type ?? "期收"}
            {customer?.staff_code ? ` · 會計專員 ${customer.staff_code}` : ""}
            {inv.invoice_no ? ` · 單號 ${inv.invoice_no}` : ""}
          </>
        }
        actions={
          <>
            <PaymentFormDialog invoiceId={inv.id} balance={balance} trigger={<Button disabled={balance <= 0}><Plus /> 登錄收款</Button>} />
            <Button variant="outline" asChild><Link to="/statement/$id" params={{ id: inv.id }} target="_blank"><Printer /> 請款單</Link></Button>
            <InvoiceFormDialog invoice={inv} trigger={<Button variant="outline"><Pencil /> 編輯</Button>} />
            {me.canDelete && <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="刪除帳款"><Trash2 /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>刪除這筆帳款？</AlertDialogTitle>
                  <AlertDialogDescription>帳款與其所有收款紀錄都會一併刪除，無法復原。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeInvoice.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">刪除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="ledger-card p-5">
          <p className="text-xs text-muted-foreground">應收帳款</p>
          <p className="mt-2 text-2xl font-semibold">{formatTWD(Number(inv.amount))}</p>
        </div>
        <div className="ledger-card p-5">
          <p className="text-xs text-muted-foreground">已收款</p>
          <p className="mt-2 text-2xl font-semibold text-success">{formatTWD(paid)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className={`ledger-card p-5 ${status === "overdue" ? "border-overdue/50" : ""}`}>
          <p className="text-xs text-muted-foreground">應收餘額</p>
          {over > 0 ? (
            <p className="mt-2 text-2xl font-semibold text-warning-foreground">溢收 {formatTWD(over)}</p>
          ) : (
            <p className={`mt-2 text-2xl font-semibold ${status === "overdue" ? "text-overdue" : ""}`}>{formatTWD(balance)}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            到期日 {formatDate(inv.due_date)}
            {status === "overdue" && <span className="text-overdue"> · 已逾期 {daysOverdue(inv)} 天</span>}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="ledger-card p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">費用項目</h2>
          <dl className="mt-4 divide-y divide-dashed divide-border text-sm">
            {items.map((it) => (
              <div key={it.name} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{feeLabel(it.name)}</dt>
                <dd><Money value={it.amount} /></dd>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-semibold">
              <dt>合計</dt>
              <dd><Money value={Number(inv.amount)} /></dd>
            </div>
            {(inv.credit_applied ?? 0) > 0 && <div className="flex justify-between py-2"><dt>前期溢繳折抵</dt><dd>−<Money value={inv.credit_applied ?? 0} /></dd></div>}
            {(inv.credit_used ?? 0) > 0 && <div className="flex justify-between py-2"><dt>溢繳已折抵後期</dt><dd><Money value={inv.credit_used ?? 0} /></dd></div>}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">開立日期 {formatDate(inv.issue_date)}</p>
          {inv.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{inv.notes}</p>}
        </div>

        <div className="ledger-card p-5 lg:col-span-3">
          <h2 className="text-lg font-bold">收款紀錄</h2>
          {payments.length === 0 ? (
            <p className="ledger-lines mt-4 rounded-md px-4 py-10 text-center text-sm text-muted-foreground">尚未收款</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 font-normal">#</th>
                    <th className="py-2 font-normal">登帳日期</th>
                    <th className="py-2 font-normal">收款日期</th>
                    <th className="py-2 font-normal">支付方式</th>
                    <th className="py-2 text-right font-normal">沖銷金額</th>
                    {me.canDelete && <th />}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} className="border-b border-dashed border-border last:border-0">
                      <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="tabular py-2.5">{formatDate(p.posted_date)}</td>
                      <td className="tabular py-2.5">{formatDate(p.paid_date)}</td>
                      <td className="py-2.5">
                        {p.method ?? "—"}
                        {p.notes && <span className="block text-xs text-muted-foreground">{p.notes}</span>}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        <Money value={Number(p.amount)} />
                        {Number(p.bank_fee) > 0 && <span className="block text-xs font-normal text-muted-foreground">實收 {formatTWD(Number(p.amount) - Number(p.bank_fee))}・匯費 {formatTWD(Number(p.bank_fee))}</span>}
                      </td>
                      {me.canDelete && <td className="py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="刪除收款"
                          onClick={() => {
                            if (confirm("刪除這筆收款紀錄？")) removePayment.mutate(p.id);
                          }}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
