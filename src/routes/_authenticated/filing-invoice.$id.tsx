import officeSealLarge from "@/assets/office-seal-large.png.asset.json";
import officeSealSmall from "@/assets/office-seal-small-fixed.png.asset.json";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/receivables";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { OFFICE } from "@/lib/billing";
import { filingReceiptAmount } from "@/lib/filing-receipt";
import { filingExtraFees, filingName } from "@/lib/filings";
import { filingServiceFeesQuery, filingsQuery, meQuery } from "@/lib/queries";
import { formatTWD } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/filing-invoice/$id")({
  head: () => ({ meta: [
    { title: "工商請款單 · 應收帳款管理系統" },
    { name: "description", content: "工商案件請款單，列出代辦費、規費與代刻印章等全部費用。" },
    { property: "og:title", content: "工商請款單 · 應收帳款管理系統" },
    { property: "og:description", content: "工商案件請款單，列全部費用與匯款資料。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  loader: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.isAdmin) return;
    const [filings] = await Promise.all([
      context.queryClient.ensureQueryData(filingsQuery),
      context.queryClient.ensureQueryData(filingServiceFeesQuery),
    ]);
    if (!filings.some((f) => f.id === params.id)) throw notFound();
  },
  component: InvoiceAccess,
});

function InvoiceAccess() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isAdmin) return <div className="p-8 text-center"><p>只有管理員可以開立工商請款單。</p><Button variant="outline" asChild className="mt-4"><Link to="/filings"><ArrowLeft />返回工商進度</Link></Button></div>;
  return <FilingInvoice />;
}

function FilingInvoice() {
  const { id } = Route.useParams();
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: fees } = useSuspenseQuery(filingServiceFeesQuery);
  const [date, setDate] = useState(() => todayISO());
  const filing = filings.find((f) => f.id === id);
  if (!filing) return null;
  const rows = [
    { label: "工商代辦費", amount: filingReceiptAmount({ service_fee: fees[id] ?? 0 }) },
    { label: "代墊規費", amount: Number(filing.advance_fee) || 0 },
    ...filingExtraFees(filing.extra_fees),
    { label: "代刻印章", amount: Number(filing.stamp_fee) || 0 },
  ].filter((r) => r.amount);
  const amount = rows.reduce((t, r) => t + r.amount, 0);
  return <main className="min-h-screen bg-muted/40 px-4 py-6 print:bg-background print:p-0">
    <div className="mx-auto mb-4 flex max-w-[720px] flex-wrap justify-between gap-2 print:hidden">
      <Button variant="outline" asChild><Link to="/filings"><ArrowLeft />返回</Link></Button>
      <Button onClick={() => window.print()}><Printer />列印 / 存成 PDF</Button>
    </div>
    <article className="mx-auto max-w-[720px] bg-card px-6 py-10 leading-7 shadow sm:px-10 print:max-w-none print:p-6 print:shadow-none">
      <header className="text-center">
        <h1 className="font-serif text-xl font-bold sm:text-2xl">{OFFICE.name}</h1>
        <p className="mt-2 text-sm">{OFFICE.address}</p><p className="text-sm">{OFFICE.phone}</p>
        <h2 className="my-6 text-2xl font-bold">請款單</h2>
      </header>
      <div className="space-y-3 border-y border-foreground py-4">
        <p className="break-words">客戶名稱：{filingName(filing)}</p>
        <p>案件類型：{filing.case_type}{filing.change_detail ? `（${filing.change_detail}）` : ""}</p>
        <div className="flex flex-wrap items-center gap-2"><label htmlFor="invoice-date">請款日期：</label><RocDateInput id="invoice-date" value={date} onChange={setDate} className="w-36 border-0 bg-transparent shadow-none print:p-0" /></div>
      </div>
      <table className="mt-6 w-full text-left">
        <thead><tr className="border-b border-border"><th className="py-2 font-medium">項目</th><th className="py-2 text-right font-medium">金額</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td className="py-3">{r.label}</td><td className="py-3 text-right font-mono">{formatTWD(r.amount)}</td></tr>)}</tbody>
        <tfoot><tr className="border-t border-foreground font-bold"><td className="py-3">合計</td><td className="py-3 text-right font-mono">{formatTWD(amount)}</td></tr></tfoot>
      </table>
      <div className="mt-10 flex flex-wrap items-start justify-between gap-6 text-sm break-inside-avoid">
        <div className="space-y-1"><p>匯款銀行：{OFFICE.bank}（{OFFICE.bankCode}）</p><p className="whitespace-nowrap">戶　　名：{OFFICE.accountName}</p><p>帳　　號：{OFFICE.account}</p></div>
        <div className="flex h-40 w-56 flex-col border border-foreground p-2"><span>事務所簽章</span><div className="mt-2 flex items-end justify-center gap-2"><img src={officeSealLarge.url} alt="事務所大章" className="block shrink-0 object-contain" style={{ width: "2.62cm", height: "2.62cm", maxWidth: "none" }} /><img src={officeSealSmall.url} alt="事務所小章" className="block shrink-0 object-contain" style={{ width: "1.21cm", height: "1.21cm", maxWidth: "none" }} /></div></div>
      </div>
    </article>
  </main>;
}