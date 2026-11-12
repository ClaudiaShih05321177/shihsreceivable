import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OFFICE, priorBalance } from "@/lib/billing";
import { customersQuery, invoiceQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { formatDate, formatTWD, itemEntries, rocYear, todayISO, vatDue, type FeeItems } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/statement/$id")({
  head: () => ({
    meta: [
      { title: "請款單 · 帳房" },
      { name: "description", content: "可列印的客戶請款單，含費用明細、前期未收餘額與匯款帳號。" },
      { property: "og:title", content: "請款單 · 帳房" },
      { property: "og:description", content: "可列印的客戶請款單。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const [inv] = await Promise.all([
      context.queryClient.ensureQueryData(invoiceQuery(params.id)),
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(customersQuery),
      context.queryClient.ensureQueryData(meQuery),
    ]);
    if (!inv) throw notFound();
  },
  component: StatementPage,
});

function StatementPage() {
  const { id } = Route.useParams();
  const { data: inv } = useSuspenseQuery(invoiceQuery(id));
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  if (!inv) return null;
  const customer = customers.find((c) => c.id === inv.customer_id);
  const items = itemEntries(inv.items as FeeItems);
  const prior = priorBalance(inv, invoices);
  const total = Number(inv.amount) + prior;
  const period = `${inv.period_year ? `${rocYear(inv.period_year)}年` : ""}${inv.period_label ? `${inv.period_label}月` : ""}`;

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-[720px] justify-end print:hidden">
        <Button onClick={() => window.print()}><Printer /> 列印 / 存成 PDF</Button>
      </div>
      <article className="mx-auto max-w-[720px] bg-card p-10 text-[15px] leading-7 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="font-serif text-2xl font-bold tracking-wider">{OFFICE.name}</h1>
          <p className="mt-2">{OFFICE.address}</p>
          <p>{OFFICE.phone}</p>
        </header>
        <div className="mt-6 flex justify-between border-b border-foreground pb-2">
          <div>
            <p>TO：{customer?.name ?? "—"}</p>
            <p>FROM：{me.displayName}</p>
          </div>
          <p>DATE：{formatDate(todayISO())}</p>
        </div>
        <p className="mt-6 font-medium">◎ 本期{period ? `（${period}）` : ""}請款明細如下：</p>
        <table className="mt-3 w-full">
          <tbody>
            {items.map((i) => (
              <tr key={i.name}><td className="py-1 pl-6">{period ? `${period}` : ""}{i.name}：</td><td className="text-right font-mono">{formatTWD(i.amount)}</td></tr>
            ))}
            {prior > 0 && <tr><td className="py-1 pl-6">前期未收餘額：</td><td className="text-right font-mono">{formatTWD(prior)}</td></tr>}
            <tr className="border-t border-foreground font-bold"><td className="py-2">總計本期應收款項：</td><td className="text-right font-mono">{formatTWD(total)}</td></tr>
          </tbody>
        </table>
        {inv.vat_output != null && (() => {
          const v = vatDue(Number(inv.vat_output), Number(inv.vat_input ?? 0), Number(inv.vat_prior_credit ?? 0));
          return (
            <section className="mt-4 border border-foreground p-3">
              <p className="font-medium">◎ 本期營業稅計算：</p>
              <div className="mt-1 grid grid-cols-2 gap-x-6 pl-6 sm:grid-cols-3">
                <p>銷項稅額：<span className="font-mono">{formatTWD(Number(inv.vat_output))}</span></p>
                <p>進項稅額：<span className="font-mono">{formatTWD(Number(inv.vat_input ?? 0))}</span></p>
                <p>上期留抵：<span className="font-mono">{formatTWD(Number(inv.vat_prior_credit ?? 0))}</span></p>
                <p className="font-bold">應納稅額：<span className="font-mono">{formatTWD(v.due)}</span></p>
                <p>本期留抵：<span className="font-mono">{formatTWD(v.carry)}</span></p>
              </div>
            </section>
          );
        })()}
        {inv.due_date && <p className="mt-2 text-right">※請於 {formatDate(inv.due_date)} 以前繳納，謝謝！</p>}
        <p className="mt-10 text-sm">{OFFICE.note}</p>
        <section className="mt-6">
          <p className="font-medium">匯款明細如下：</p>
          <div className="mt-2 pl-6">
            <p>{OFFICE.bank}</p>
            <p>戶　　名：{OFFICE.accountName}</p>
            <p>總行代號：{OFFICE.bankCode}</p>
            <p>帳　　號：{OFFICE.account}</p>
          </div>
        </section>
      </article>
    </div>
  );
}
