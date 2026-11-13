import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { INVOICE_STAGES, invoiceSummary, KINFENG, quoteSummary, type InvoiceStage } from "@/lib/factory-docs";
import { factoryRegistrationsQuery } from "@/lib/queries";
import { formatDate, formatTWD, todayISO } from "@/lib/receivables";

type DocSearch = { type: "quote" | "invoice"; stage: InvoiceStage };

export const Route = createFileRoute("/_authenticated/factory-doc/$id")({
  validateSearch: (s: Record<string, unknown>): DocSearch => ({
    type: s["type"] === "invoice" ? "invoice" : "quote",
    stage: INVOICE_STAGES.includes(s["stage"] as InvoiceStage) ? (s["stage"] as InvoiceStage) : "尾款",
  }),
  head: () => ({
    meta: [
      { title: "報價單／請款單 · 勤豐工商顧問" },
      { name: "description", content: "勤豐工商顧問工廠登記案件可列印報價單與請款單。" },
      { property: "og:title", content: "報價單／請款單 · 勤豐工商顧問" },
      { property: "og:description", content: "可列印的報價單與請款單。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context, params }) => {
    const rows = await context.queryClient.ensureQueryData(factoryRegistrationsQuery);
    if (!rows.find((r) => r.id === params.id)) throw notFound();
  },
  component: FactoryDocPage,
});

const Blank = ({ v }: { v?: string | null }) => (
  <input defaultValue={v ?? ""} className="w-full min-w-0 bg-transparent outline-none" />
);

function FactoryDocPage() {
  const { id } = Route.useParams();
  const { type, stage } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: rows } = useSuspenseQuery(factoryRegistrationsQuery);
  const r = rows.find((x) => x.id === id);
  if (!r) return null;
  const isQuote = type === "quote";
  const s = isQuote ? quoteSummary(r) : invoiceSummary(r, stage);
  const item = r.application_item || "工廠設立登記";
  const owner = r.company_name || r.factory_name;
  const cell = "border border-foreground px-2 py-1";

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-[760px] flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1">
          <Button variant={isQuote ? "default" : "outline"} size="sm" onClick={() => navigate({ search: { type: "quote", stage } })}>報價單</Button>
          <Button variant={!isQuote ? "default" : "outline"} size="sm" onClick={() => navigate({ search: { type: "invoice", stage } })}>請款單</Button>
          {!isQuote && INVOICE_STAGES.map((st) => (
            <Button key={st} variant={stage === st ? "secondary" : "ghost"} size="sm" onClick={() => navigate({ search: { type, stage: st } })}>{st}請款</Button>
          ))}
        </div>
        <Button onClick={() => window.print()}><Printer /> 列印 / 存成 PDF</Button>
      </div>
      <article className="mx-auto max-w-[760px] bg-card p-10 text-[15px] leading-7 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-[0.5em]">{isQuote ? "報價單" : "請款單"}</h1>
          <p className="tracking-widest">{isQuote ? "Quotation" : "INVOICE"}</p>
          <p className="font-medium">{KINFENG.name}</p>
          <p className="text-sm">統一編號：{KINFENG.taxId}　地址：{KINFENG.address}</p>
          <p className="text-sm">電話：{KINFENG.phone}　傳真：{KINFENG.fax}</p>
        </header>
        <p className="mt-2 text-right">日期：{formatDate(todayISO())}</p>
        <table className="mt-2 w-full table-fixed border-collapse text-sm">
          <colgroup><col style={{ width: "12%" }} /><col style={{ width: "52%" }} /><col style={{ width: "14%" }} /><col style={{ width: "22%" }} /></colgroup>
          <tbody>
            <tr><td className={cell}>業主</td><td className={cell}>{owner}</td><td className={cell}>統一編號</td><td className={cell}>{r.tax_id ?? ""}</td></tr>
            <tr><td className={cell}>地址</td><td className={cell} colSpan={3}><Blank /></td></tr>
            <tr><td className={cell}>{isQuote ? "估價內容" : "請款內容"}</td><td className={cell}>{item}{isQuote ? "案件" : `申請案${stage !== "全額" ? `（${stage}）` : ""}`}</td><td className={cell}>{isQuote ? "業主接洽人" : "接洽人"}</td><td className={cell}>{r.contact ?? ""}</td></tr>
          </tbody>
        </table>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">{["項次", "品名規格", "數量", "單位", "單價", "總價"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} text-center`}>1</td><td className={cell}>{item}顧問費{!isQuote && stage === "訂金" ? "（預付）" : ""}</td>
              <td className={`${cell} text-center`}>1</td><td className={`${cell} text-center`}>式</td>
              <td className={`${cell} text-right font-mono`}>{formatTWD(s.consulting)}</td><td className={`${cell} text-right font-mono`}>{formatTWD(s.consulting)}</td>
            </tr>
            <tr><td className={cell} colSpan={5}>小計(發票金額)</td><td className={`${cell} text-right font-mono`}>{formatTWD(s.subtotal)}</td></tr>
            {s.lines.map((l, i) => (
              <tr key={`${l.label}-${i}`}><td className={cell} colSpan={5}>{l.label}</td><td className={`${cell} text-right font-mono`}>{l.amount < 0 ? `−${formatTWD(-l.amount)}` : formatTWD(l.amount)}</td></tr>
            ))}
            <tr className="font-bold"><td className={cell} colSpan={5}>總計新台幣：</td><td className={`${cell} text-right font-mono`}>{formatTWD(s.total)}</td></tr>
          </tbody>
        </table>
        {isQuote ? (
          <>
            <ol className="mt-4 list-decimal pl-6 text-sm">{KINFENG.quoteTerms.map((t) => <li key={t}>{t}</li>)}</ol>
            <p className="mt-2 text-sm">聯絡人：{KINFENG.contact}　　報價單回傳後本司會開立預付金額之發票及請款單</p>
            <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div className="h-28 border border-foreground p-2">訂購廠商簽章確認</div>
              <div className="h-28 border border-foreground p-2">承辦公司簽章</div>
            </div>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium">匯款資料：</p>
              <p>{KINFENG.bank}</p>
              <p>戶名：{KINFENG.accountName}</p>
              <p>總行代號：{KINFENG.bankCode}</p>
              <p>帳號：{KINFENG.account}</p>
              <p>支票抬頭請開：{KINFENG.accountName}</p>
              <p>付款條件：發票開立後30日內。</p>
            </div>
            <div className="h-32 border border-foreground p-2">承辦公司簽章</div>
          </div>
        )}
      </article>
    </div>
  );
}
