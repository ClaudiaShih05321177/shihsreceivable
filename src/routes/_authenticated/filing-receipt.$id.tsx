import receiptSeal from "@/assets/receipt-seal-transparent.png.asset.json";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { OFFICE } from "@/lib/billing";
import { filingReceiptAmount } from "@/lib/filing-receipt";
import { filingName } from "@/lib/filings";
import { customersQuery, filingServiceFeesQuery, filingsQuery, meQuery } from "@/lib/queries";
import { formatTWD } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/filing-receipt/$id")({
  head: () => ({ meta: [
    { title: "工商代辦費收據 · 應收帳款管理系統" },
    { name: "description", content: "工商案件代辦費收據，供管理員開立、列印及儲存PDF。" },
    { property: "og:title", content: "工商代辦費收據 · 應收帳款管理系統" },
    { property: "og:description", content: "工商案件代辦費收據，僅列工商代辦費。" },
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
      context.queryClient.ensureQueryData(customersQuery),
    ]);
    if (!filings.some((f) => f.id === params.id)) throw notFound();
  },
  component: ReceiptAccess,
});

function ReceiptAccess() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isAdmin) return <div className="p-8 text-center"><p>只有管理員可以開立工商代辦費收據。</p><Button variant="outline" asChild className="mt-4"><Link to="/filings"><ArrowLeft />返回工商進度</Link></Button></div>;
  return <FilingReceipt />;
}

function FilingReceipt() {
  const { id } = Route.useParams();
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: fees } = useSuspenseQuery(filingServiceFeesQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const [date, setDate] = useState("");
  const filing = filings.find((f) => f.id === id);
  if (!filing) return null;
  const amount = filingReceiptAmount({ service_fee: fees[id] ?? 0 });
  return <main className="min-h-screen bg-muted/40 px-4 py-6 print:bg-background print:p-0">
    <div className="mx-auto mb-4 flex max-w-[720px] flex-wrap justify-between gap-2 print:hidden">
      <Button variant="outline" asChild><Link to="/filings"><ArrowLeft />返回</Link></Button>
      <Button onClick={() => window.print()}><Printer />列印 / 存成 PDF</Button>
    </div>
    <article className="mx-auto max-w-[720px] bg-card px-6 py-10 text-base leading-8 shadow sm:px-10 print:max-w-none print:p-6 print:shadow-none">
      <header className="text-center">
        <h1 className="font-serif text-xl font-bold sm:text-2xl">{OFFICE.name}</h1>
        <p className="mt-2">統一編號：{OFFICE.taxId}　地址：{OFFICE.address}</p><p>{OFFICE.phone}</p>
        <h2 className="my-6 text-3xl font-bold tracking-[0.5em]">收據</h2>
      </header>
      <div className="space-y-3 border-y border-foreground py-4">
        <p className="break-words">客戶名稱：{filingName(filing)}</p>
        <div className="flex flex-wrap items-center gap-2"><label htmlFor="receipt-tax">統一編號：</label><input id="receipt-tax" defaultValue={(filing.customer_id ? customers.find((c) => c.id === filing.customer_id)?.tax_id : null) ?? ""} className="w-40 rounded bg-transparent px-1 outline-none hover:bg-muted focus:ring-1 focus:ring-ring print:hover:bg-transparent print:ring-0" /></div>
        <p>案件類型：{filing.case_type}{filing.change_detail ? `（${filing.change_detail}）` : ""}</p>
        <div className="flex flex-wrap items-center gap-2"><label htmlFor="receipt-date">收據日期：</label><RocDateInput id="receipt-date" value={date} onChange={setDate} className="w-36 border-0 bg-transparent shadow-none print:p-0" /></div>
      </div>
      <table className="mt-6 w-full text-left">
        <thead><tr className="border-b border-border"><th className="py-2 font-medium">項目</th><th className="py-2 text-right font-medium">金額</th></tr></thead>
        <tbody><tr><td className="py-4">工商代辦費</td><td className="py-4 text-right font-mono">{formatTWD(amount)}</td></tr></tbody>
        <tfoot><tr className="border-t border-foreground text-lg font-bold"><td className="py-3">合計</td><td className="py-3 text-right font-mono">{formatTWD(amount)}</td></tr></tfoot>
      </table>
      <div className="mt-10 flex justify-end"><div className="flex flex-col items-center"><span className="self-start">收款章：</span><img src={receiptSeal.url} alt="事務所收據章" style={{ width: "5.8cm", height: "auto", maxWidth: "none", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} className="mt-1 object-contain" /></div></div>
    </article>
  </main>;
}