import officeSealLarge from "@/assets/office-seal-large.png.asset.json";
import officeSealSmall from "@/assets/office-seal-small.png.asset.json";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OFFICE, priorBalance } from "@/lib/billing";
import { customersQuery, invoiceQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { feeLabel } from "@/lib/fee-labels";
import { formatDate, formatTWD, itemEntries, vatDue, type FeeItems, todayISO , periodText, statementItemPrefix } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/statement/$id")({
  head: () => ({
    meta: [
      { title: "請款單 · 應收帳款管理系統" },
      { name: "description", content: "可列印的客戶請款單，含費用明細、前期未收餘額與匯款帳號。" },
      { property: "og:title", content: "請款單 · 應收帳款管理系統" },
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
  const credit = inv.credit_applied ?? 0;
  const total = Math.max(0, Number(inv.amount) - credit) + prior;
  const period = periodText(inv);

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-[720px] justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/dashboard"))}><ArrowLeft className="h-4 w-4" />返回</Button>
        <Button onClick={() => window.print()}><Printer /> 列印 / 存成 PDF</Button>
      </div>
      <article className="mx-auto max-w-[720px] bg-card p-10 text-base leading-8 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-wider">{OFFICE.name}</h1>
          <p className="mt-2">統一編號：{OFFICE.taxId}　地址：{OFFICE.address}</p>
          <p>{OFFICE.phone}</p>
        </header>
        <div className="mt-6 flex justify-between border-b border-foreground pb-2">
          <div>
            <p>TO：{customer?.name ?? inv.customer?.name ?? "—"}</p>
            <p>FROM：{me.displayName}</p>
          </div>
          <p>DATE：<input className="w-28 bg-transparent outline-none" aria-label="單據日期" defaultValue={formatDate(todayISO())} suppressHydrationWarning /></p>
        </div>
        <p className="mt-6 font-medium">◎ 本期{period ? `（${period}）` : ""}請款明細如下：</p>
        <table className="mt-3 w-full">
          <tbody>
            {items.map((i) => (
              <tr key={i.name}><td className="py-1.5 pl-6"><input aria-label={`${feeLabel(i.name)}項目名稱`} className="w-full bg-transparent outline-none" defaultValue={`${statementItemPrefix(inv, i.name)}${feeLabel(i.name)}：`} /></td><td className="text-right font-mono">{formatTWD(i.amount)}</td></tr>
            ))}
            {prior > 0 && <tr><td className="py-1.5 pl-6">前期未收餘額：</td><td className="text-right font-mono">{formatTWD(prior)}</td></tr>}
            {credit > 0 && <tr><td className="py-1.5 pl-6">前期溢繳折抵：</td><td className="text-right font-mono">−{formatTWD(credit)}</td></tr>}
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
        {inv.notes && <p className="mt-4 whitespace-pre-line">備註：{inv.notes}</p>}
        {inv.due_date && <p className="mt-2 text-right">※請於 {formatDate(inv.due_date)} 以前繳納，謝謝！</p>}
        <p className="mt-10 text-base">{OFFICE.note}</p>
        <section className="mt-6 flex items-stretch gap-4 break-inside-avoid">
          <div className="min-w-0 flex-1">
          <p className="font-medium">匯款明細如下：</p>
          <div className="mt-2 pl-6">
            <p>{OFFICE.bank}</p>
            <p className="whitespace-nowrap">戶　　名：{OFFICE.accountName}</p>
            <p>總行代號：{OFFICE.bankCode}</p>
            <p>帳　　號：{OFFICE.account}</p>
          </div>
          </div>
          <div className="flex w-56 shrink-0 flex-col border border-foreground p-2 text-base">
            <span>事務所簽章：</span>
            <div className="mt-2 flex items-end justify-center gap-2"><img src={officeSealLarge.url} alt="事務所大章" className="block shrink-0 object-contain" style={{ width: "2.4cm", height: "2.4cm", maxWidth: "none" }} /><img src={officeSealSmall.url} alt="事務所小章" className="block shrink-0 object-contain" style={{ width: "1.1cm", height: "1.1cm", maxWidth: "none" }} /></div>
          </div>
        </section>
      </article>
    </div>
  );
}
