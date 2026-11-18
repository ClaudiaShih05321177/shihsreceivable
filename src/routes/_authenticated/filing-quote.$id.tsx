import officeSealLarge from "@/assets/office-seal-large.png.asset.json";
import officeSealSmall from "@/assets/office-seal-small-v3.png.asset.json";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/receivables";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { OFFICE } from "@/lib/billing";
import { filingReceiptAmount } from "@/lib/filing-receipt";
import { filingName } from "@/lib/filings";
import { filingServiceFeesQuery, filingsQuery, meQuery } from "@/lib/queries";
import { formatTWD } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/filing-quote/$id")({
  head: () => ({ meta: [
    { title: "工商報價單 · 應收帳款管理系統" },
    { name: "description", content: "工商案件報價單，供管理員列印及儲存PDF。" },
    { property: "og:title", content: "工商報價單 · 應收帳款管理系統" },
    { property: "og:description", content: "工商案件報價單，列工商代辦費並蓋事務所大小章。" },
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
  component: QuoteAccess,
});

function QuoteAccess() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isAdmin) return <div className="p-8 text-center"><p>只有管理員可以開立工商報價單。</p><Button variant="outline" asChild className="mt-4"><Link to="/filings"><ArrowLeft />返回工商進度</Link></Button></div>;
  return <FilingQuote />;
}

function FilingQuote() {
  const { id } = Route.useParams();
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: fees } = useSuspenseQuery(filingServiceFeesQuery);
  const [date, setDate] = useState(() => todayISO());
  const filing = filings.find((f) => f.id === id);
  if (!filing) return null;
  const amount = filingReceiptAmount({ service_fee: fees[id] ?? 0 });
  return <main className="min-h-screen bg-muted/40 px-4 py-6 print:bg-background print:p-0">
    <div className="mx-auto mb-4 flex max-w-[720px] flex-wrap justify-between gap-2 print:hidden">
      <Button variant="outline" asChild><Link to="/filings"><ArrowLeft />返回</Link></Button>
      <Button onClick={() => window.print()}><Printer />列印 / 存成 PDF</Button>
    </div>
    <article className="mx-auto max-w-[720px] bg-card px-6 py-10 leading-7 shadow sm:px-10 print:max-w-none print:p-6 print:shadow-none">
      <header className="text-center">
        <h1 className="font-serif text-xl font-bold sm:text-2xl">{OFFICE.name}</h1>
        <p className="mt-2 text-sm">{OFFICE.address}</p><p className="text-sm">{OFFICE.phone}</p>
        <h2 className="my-6 text-2xl font-bold">報價單</h2>
      </header>
      <div className="space-y-3 border-y border-foreground py-4">
        <p className="break-words">客戶名稱：{filingName(filing)}</p>
        <p>案件類型：{filing.case_type}{filing.change_detail ? `（${filing.change_detail}）` : ""}</p>
        <div className="flex flex-wrap items-center gap-2"><label htmlFor="quote-date">報價日期：</label><RocDateInput id="quote-date" value={date} onChange={setDate} className="w-36 border-0 bg-transparent shadow-none print:p-0" /></div>
      </div>
      <table className="mt-6 w-full text-left">
        <thead><tr className="border-b border-border"><th className="py-2 font-medium">項目</th><th className="py-2 text-right font-medium">金額</th></tr></thead>
        <tbody><tr><td className="py-4">工商代辦費</td><td className="py-4 text-right font-mono">{formatTWD(amount)}</td></tr></tbody>
        <tfoot><tr className="border-t border-foreground font-bold"><td className="py-3">合計</td><td className="py-3 text-right font-mono">{formatTWD(amount)}</td></tr></tfoot>
      </table>
      <div className="mt-10 grid grid-cols-2 gap-6 text-sm break-inside-avoid">
        <div className="h-40 border border-foreground p-2">客戶簽章確認</div>
        <div className="flex h-40 flex-col border border-foreground p-2"><span>事務所簽章</span><div className="mt-2 flex items-end justify-center gap-2"><img src={officeSealLarge.url} alt="事務所大章" className="block shrink-0 object-contain" style={{ width: "2.62cm", height: "2.62cm", maxWidth: "none" }} /><img src={officeSealSmall.url} alt="事務所小章" className="block shrink-0 object-contain" style={{ width: "1.35cm", height: "1.27cm", maxWidth: "none" }} /></div></div>
      </div>
    </article>
  </main>;
}