import officeSeal from "@/assets/office-seal.png.asset.json";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OFFICE } from "@/lib/billing";
import { invoicesQuery, meQuery } from "@/lib/queries";
import { feeLabel } from "@/lib/fee-labels";
import { formatDate, formatTWD, itemEntries, outstanding, paidTotal, todayISO, type FeeItems , periodText } from "@/lib/receivables";
import { compareCustomerCode } from "@/lib/customer-sort";

export const Route = createFileRoute("/_authenticated/statement-combined")({
  validateSearch: (s: Record<string, unknown>) => ({ ids: typeof s["ids"] === "string" ? s["ids"] : "" }),
  head: () => ({
    meta: [
      { title: "合併請款單 · 應收帳款管理系統" },
      { name: "description", content: "多家公司帳款合併的可列印請款單。" },
      { property: "og:title", content: "合併請款單 · 應收帳款管理系統" },
      { property: "og:description", content: "多家公司帳款合併的可列印請款單。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(invoicesQuery), context.queryClient.ensureQueryData(meQuery)]),
  component: CombinedStatement,
});

function CombinedStatement() {
  const { ids } = Route.useSearch();
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const set = new Set(ids.split(",").filter(Boolean));
  const picked = invoices.filter((i) => set.has(i.id)).sort((a, b) => compareCustomerCode(a.customer?.customer_code, b.customer?.customer_code, a.customer?.name, b.customer?.name));
  const total = picked.reduce((s, i) => s + outstanding(i), 0);
  const firstName = picked[0]?.customer?.name ?? "";

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-[720px] justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/invoices"))}><ArrowLeft className="h-4 w-4" />返回</Button>
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
            <p>TO：<input className="w-64 bg-transparent outline-none" aria-label="收件人" defaultValue={firstName} /></p>
            <p>FROM：{me.displayName}</p>
          </div>
          <p>DATE：<input className="w-28 bg-transparent outline-none" aria-label="單據日期" defaultValue={formatDate(todayISO())} suppressHydrationWarning /></p>
        </div>
        <p className="mt-6 font-medium">◎ 合併請款明細如下：</p>
        {picked.length === 0 && <p className="mt-4 text-muted-foreground">沒有選取的帳款</p>}
        {picked.map((inv) => {
          const period = periodText(inv);
          const paid = paidTotal(inv);
          const credit = inv.credit_applied ?? 0;
          return (
            <section key={inv.id} className="mt-4 break-inside-avoid">
              <p className="font-semibold">{inv.customer?.customer_code} {inv.customer?.name}{period ? `（${period}）` : ""}</p>
              <table className="w-full">
                <tbody>
                  {itemEntries(inv.items as FeeItems).map((i) => (
                    <tr key={i.name}><td className="py-0.5 pl-6">{feeLabel(i.name)}：</td><td className="text-right font-mono">{formatTWD(i.amount)}</td></tr>
                  ))}
                  {paid > 0 && <tr><td className="py-0.5 pl-6">已收：</td><td className="text-right font-mono">−{formatTWD(paid)}</td></tr>}
                  {credit > 0 && <tr><td className="py-0.5 pl-6">前期溢繳折抵：</td><td className="text-right font-mono">−{formatTWD(credit)}</td></tr>}
                  <tr className="border-t"><td className="py-1 pl-6 font-medium">小計：</td><td className="text-right font-mono font-medium">{formatTWD(outstanding(inv))}</td></tr>
                </tbody>
              </table>
            </section>
          );
        })}
        <div className="mt-4 flex justify-between border-t-2 border-foreground py-2 font-bold"><span>應繳總金額：</span><span className="font-mono">{formatTWD(total)}</span></div>
        <p className="mt-8 text-sm">{OFFICE.note}</p>
        <section className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid">
          <div>
            <p className="font-medium">匯款明細如下：</p>
            <div className="mt-2 pl-6">
              <p>{OFFICE.bank}</p>
              <p>戶　　名：{OFFICE.accountName}</p>
              <p>總行代號：{OFFICE.bankCode}</p>
              <p>帳　　號：{OFFICE.account}</p>
            </div>
          </div>
          <div className="flex h-32 flex-col border border-foreground p-2 text-sm">
            <span>事務所簽章：</span>
            <img src={officeSeal.url} alt="事務所大小章" className="mx-auto mt-1 min-h-0 w-auto max-w-full flex-1 object-contain" />
          </div>
        </section>
      </article>
    </div>
  );
}
