import kinfengSeal from "@/assets/kinfeng-seal.png.asset.json";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Plus, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { canManageFactoryProgress } from "@/lib/permissions";

import { Button } from "@/components/ui/button";
import { buildQuoteTerms, ENV_TERM_OPTIONS, INVOICE_STAGES, invoiceSummary, KINFENG, PAYMENT_TERM_OPTIONS, quoteSummary, readQuoteTerms, type InvoiceStage, type QuoteTermsConfig } from "@/lib/factory-docs";
import { factoryRegistrationsQuery, meQuery } from "@/lib/queries";
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
    const [rows, me] = await Promise.all([context.queryClient.ensureQueryData(factoryRegistrationsQuery), context.queryClient.ensureQueryData(meQuery)]);
    if (!me.isAdmin) throw redirect({ to: "/factory" });
    if (!rows.find((r) => r.id === params.id)) throw notFound();
  },
  component: FactoryDocPage,
});

const isSummary = (label: string) => label.startsWith("營業稅") || label === "簽約金";

/** 單據上直接打字（只影響本次列印，不存檔）；列印時框線與底色隱藏。 */
const EDIT = "w-full min-w-0 rounded-sm bg-transparent px-0.5 outline-none hover:bg-accent/60 focus:bg-accent/60 focus:ring-1 focus:ring-ring print:bg-transparent print:ring-0";
const Blank = ({ v }: { v?: string | null }) => <input key={v ?? ""} defaultValue={v ?? ""} className={EDIT} />;
const Area = ({ v }: { v: string }) => (
  <span contentEditable suppressContentEditableWarning className="rounded-sm outline-none hover:bg-accent/60 focus:bg-accent/60 focus:ring-1 focus:ring-ring print:bg-transparent print:ring-0">{v}</span>
);

function TermsToolbar({ id, cfg, canEdit }: { id: string; cfg: QuoteTermsConfig; canEdit: boolean }) {
  const qc = useQueryClient();
  const [c, setC] = useState(cfg);
  const [extraDraft, setExtraDraft] = useState("");
  useEffect(() => setC(cfg), [cfg]);
  const save = useMutation({
    mutationFn: async (next: QuoteTermsConfig) => {
      const { error } = await supabase.rpc("set_factory_quote_terms", { _id: id, _terms: next });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("條款已儲存"); qc.invalidateQueries({ queryKey: ["factory_registrations"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "儲存失敗"),
  });
  const update = (patch: Partial<QuoteTermsConfig>) => { const next = { ...c, ...patch }; setC(next); save.mutate(next); };
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`;
  if (!canEdit) return null;
  return (
    <div className="mx-auto mb-4 grid max-w-[760px] gap-2 rounded-md border bg-card p-3 text-sm print:hidden">
      <p className="font-semibold">報價條款設定 <span className="text-xs font-normal text-muted-foreground">（切換即自動儲存{save.isPending ? "…儲存中" : ""}）</span></p>
      <div className="flex flex-wrap items-center gap-2"><span className="w-16 text-muted-foreground">環保</span>{ENV_TERM_OPTIONS.map((o) => <button key={o} type="button" className={chip(c.env === o)} onClick={() => update({ env: o })}>{o}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><span className="w-16 text-muted-foreground">產業園區</span><button type="button" className={chip(c.park)} onClick={() => update({ park: !c.park })}>{c.park ? "✓ 位於產業園區" : "不在產業園區"}</button><span className="ml-2 text-muted-foreground">科學園區</span><button type="button" className={chip(c.sciencePark)} onClick={() => update({ sciencePark: !c.sciencePark })}>{c.sciencePark ? "✓ 位於科學園區" : "不在科學園區"}</button></div>
      <div className="flex flex-wrap items-center gap-2"><span className="w-16 text-muted-foreground">付款條件</span>{PAYMENT_TERM_OPTIONS.map((o) => <button key={o} type="button" className={chip(c.payment === o)} onClick={() => update({ payment: o })}>{o}</button>)}</div>
      {c.payment === "自訂" && <input className="rounded-md border px-2 py-1" placeholder="輸入付款條件後按 Enter 或點別處儲存" value={c.customPayment} onChange={(e) => setC({ ...c, customPayment: e.target.value })} onBlur={() => save.mutate(c)} onKeyDown={(e) => e.key === "Enter" && save.mutate(c)} />}
      <div className="flex flex-wrap items-center gap-2"><span className="w-16 text-muted-foreground">自訂條款</span>
        {c.extra.map((x, i) => <span key={i} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">{x}<button type="button" aria-label="刪除條款" onClick={() => update({ extra: c.extra.filter((_, j) => j !== i) })}><X className="size-3" /></button></span>)}
        <input className="min-w-40 flex-1 rounded-md border px-2 py-1" placeholder="新增一條自訂條款" value={extraDraft} onChange={(e) => setExtraDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && extraDraft.trim()) { update({ extra: [...c.extra, extraDraft.trim()] }); setExtraDraft(""); } }} />
        <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => { if (extraDraft.trim()) { update({ extra: [...c.extra, extraDraft.trim()] }); setExtraDraft(""); } }}><Plus className="size-3" />新增</button>
      </div>
    </div>
  );
}

function FactoryDocPage() {
  const { id } = Route.useParams();
  const { type, stage } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: rows } = useSuspenseQuery(factoryRegistrationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const r = rows.find((x) => x.id === id);
  if (!r) return null;
  const isQuote = type === "quote";
  const s = isQuote ? quoteSummary(r) : invoiceSummary(r, stage);
  const item = r.application_item || "工廠設立登記";
  const owner = r.company_name;
  const cell = "border border-foreground px-2 py-2";
  const termsCfg = readQuoteTerms(r.quote_terms, r.env_mode);
  const terms = buildQuoteTerms(termsCfg);

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-background print:py-0">
      <div className="mx-auto mb-4 flex max-w-[760px] flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/dashboard"))}><ArrowLeft className="h-4 w-4" />返回</Button>
          <Button variant={isQuote ? "default" : "outline"} size="sm" onClick={() => navigate({ search: { type: "quote", stage } })}>報價單</Button>
          <Button variant={!isQuote ? "default" : "outline"} size="sm" onClick={() => navigate({ search: { type: "invoice", stage } })}>請款單</Button>
          {!isQuote && INVOICE_STAGES.map((st) => (
            <Button key={st} variant={stage === st ? "secondary" : "ghost"} size="sm" onClick={() => navigate({ search: { type, stage: st } })}>{st}請款</Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" asChild><a href="https://www.einvoice.nat.gov.tw/" target="_blank" rel="noopener noreferrer"><ExternalLink /> 財政部電子發票平台</a></Button>
          <Button onClick={() => window.print()}><Printer /> 列印 / 存成 PDF</Button>
        </div>
      </div>
      {isQuote && <TermsToolbar id={r.id} cfg={termsCfg} canEdit={canManageFactoryProgress(me)} />}
      <article className="mx-auto max-w-[760px] bg-card p-10 text-base leading-8 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-[0.5em]">{isQuote ? "報價單" : "請款單"}</h1>
          <p className="tracking-widest">{isQuote ? "Quotation" : "INVOICE"}</p>
          <p className="text-lg font-medium">{KINFENG.name}</p>
          <p className="text-base">統一編號：{KINFENG.taxId}　地址：{KINFENG.address}</p>
          <p className="text-base">電話：{KINFENG.phone}　傳真：{KINFENG.fax}</p>
        </header>
        <p className="mt-2 text-right">日期：<input className="w-28 bg-transparent text-right outline-none" aria-label="單據日期" defaultValue={formatDate(todayISO())} suppressHydrationWarning /></p>
        <table className="mt-2 w-full table-fixed border-collapse text-base">
          <colgroup><col style={{ width: "14%" }} /><col style={{ width: "48%" }} /><col style={{ width: "16%" }} /><col style={{ width: "22%" }} /></colgroup>
          <tbody>
            <tr><td className={cell}>業主</td><td className={cell}><Blank v={owner} /></td><td className={`${cell} whitespace-nowrap`}>統一編號</td><td className={cell}><Blank v={r.tax_id} /></td></tr>
            <tr><td className={`${cell} whitespace-nowrap`}>工廠名稱</td><td className={cell} colSpan={3}><Blank v={r.factory_name} /></td></tr>
            <tr><td className={cell}>地址</td><td className={cell} colSpan={3}><Blank v={r.factory_address} /></td></tr>
            <tr><td className={`${cell} whitespace-nowrap`}>{isQuote ? "估價內容" : "請款內容"}</td><td className={cell}><Blank v={`${item}${isQuote ? "案件" : `申請案${stage !== "全額" ? `（${stage}）` : ""}`}`} /></td><td className={`${cell} whitespace-nowrap`}>{isQuote ? "業主接洽人" : "接洽人"}</td><td className={cell}><Blank v={r.contact} /></td></tr>
            {r.po_number ? <tr><td className={`${cell} whitespace-nowrap`}>PO 號碼</td><td className={cell} colSpan={3}><Blank v={r.po_number} /></td></tr> : null}
          </tbody>
        </table>
        <table className="mt-4 w-full border-collapse text-base">
          <thead>
            <tr className="bg-muted/60">{["項次", "品名規格", "數量", "單位", "單價", "總價"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} text-center`}>1</td><td className={cell}>{item}顧問費{!isQuote && stage === "訂金" ? "（預付）" : ""}</td>
              <td className={`${cell} text-center`}>1</td><td className={`${cell} text-center`}>式</td>
              <td className={`${cell} text-right font-mono`}>{formatTWD(s.consulting)}</td><td className={`${cell} text-right font-mono`}>{formatTWD(s.consulting)}</td>
            </tr>
            {s.discount > 0 && <tr><td className={cell} colSpan={5}>專案折扣</td><td className={`${cell} text-right font-mono`}>−{formatTWD(s.discount)}</td></tr>}
            <tr><td className={cell} colSpan={5}>小計(發票金額)</td><td className={`${cell} text-right font-mono`}>{formatTWD(s.subtotal)}</td></tr>
            {s.lines.filter((l) => isSummary(l.label)).map((l, i) => (
              <tr key={`${l.label}-${i}`}><td className={cell} colSpan={5}>{l.label}</td><td className={`${cell} text-right font-mono`}>{l.amount < 0 ? `−${formatTWD(-l.amount)}` : formatTWD(l.amount)}</td></tr>
            ))}
            {s.lines.filter((l) => !isSummary(l.label)).map((l, i) => (
              <tr key={`fee-${l.label}-${i}`}>
                <td className={`${cell} text-center`}>{i + 2}</td><td className={cell}>{l.label}</td>
                <td className={`${cell} text-center`}>1</td><td className={`${cell} text-center`}>式</td>
                <td className={`${cell} text-right font-mono`}>{formatTWD(l.amount)}</td><td className={`${cell} text-right font-mono`}>{formatTWD(l.amount)}</td>
              </tr>
            ))}
            <tr className="font-bold"><td className={cell} colSpan={5}><span className="text-lg">總計新台幣：</span></td><td className={`${cell} text-right font-mono`}>{formatTWD(s.total)}</td></tr>
          </tbody>
        </table>
        {isQuote ? (
          <>
            <ol className="mt-4 list-decimal pl-6 text-base">{terms.map((t) => <li key={t}><Area v={t} /></li>)}</ol>
            <p className="mt-2 text-base">聯絡人：{KINFENG.contact}{termsCfg.payment === "預付50%＋尾款" ? "　　報價單回傳後本司會開立預付金額之發票及請款單" : ""}</p>
            <div className="mt-8 grid grid-cols-2 gap-6 text-base">
              <div className="h-28 border border-foreground p-2">訂購廠商簽章確認</div>
              <div className="flex h-28 flex-col border border-foreground p-2"><span>承辦公司簽章</span><img src={kinfengSeal.url} alt="勤豐工商大小章" className="mx-auto mt-1 min-h-0 w-auto max-w-full flex-1 object-contain" /></div>
            </div>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-6 text-base">
            <div>
              <p className="font-medium">匯款資料：</p>
              <p>{KINFENG.bank}</p>
              <p>戶名：{KINFENG.accountName}</p>
              <p>總行代號：{KINFENG.bankCode}</p>
              <p>帳號：{KINFENG.account}</p>
              <p>支票抬頭請開：{KINFENG.accountName}</p>
              <p>付款條件：發票開立後30日內。</p>
            </div>
            <div className="flex h-32 flex-col border border-foreground p-2"><span>承辦公司簽章</span><img src={kinfengSeal.url} alt="勤豐工商大小章" className="mx-auto mt-1 min-h-0 w-auto max-w-full flex-1 object-contain" /></div>
          </div>
        )}
      </article>
    </div>
  );
}
