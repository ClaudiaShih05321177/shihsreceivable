import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Receipt, Search } from "lucide-react";
import { useState } from "react";

import { FactoryFormDialog } from "@/components/ar/factory-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFactoryClosed, depositDue, finalDue, issuesInvoice, projectArStatus, projectOutstanding } from "@/lib/factory";
import { factoryRegistrationsQuery, meQuery } from "@/lib/queries";
import { formatDate } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/factory-receivables")({
  head: () => ({
    meta: [
      { title: "勤豐應收帳款 · 勤豐工商顧問" },
      { name: "description", content: "勤豐工商顧問專案應收帳款：報價、訂金、尾款、規費與其他費用的請款與收款。" },
      { property: "og:title", content: "勤豐應收帳款 · 勤豐工商顧問" },
      { property: "og:description", content: "專案訂金與尾款收款追蹤。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(factoryRegistrationsQuery),
  component: FactoryReceivablesPage,
});

const EINVOICE_URL = "https://www.einvoice.nat.gov.tw/";

function FactoryReceivablesPage() {
  const { data: rows } = useSuspenseQuery(factoryRegistrationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const [q, setQ] = useState("");
  const [showOpen, setShowOpen] = useState(false);
  const closedCount = rows.filter((r) => r.stage === "核准結案").length;
  const base = rows.filter((r) => (showOpen ? !isFactoryClosed(r.stage) : r.stage === "核准結案"));
  const kw = q.trim().toLowerCase();
  const filtered = kw
    ? base.filter((r) =>
        [r.factory_name, r.company_name, r.tax_id, r.application_item, r.po_number, r.ar_notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(kw)),
      )
    : base;
  const total = filtered.reduce((s, r) => s + projectOutstanding(r), 0);
  return (
    <>
      <PageHeader
        eyebrow="勤豐工商顧問有限公司"
        title="應收帳款"
        description={`未收餘額合計 ${total.toLocaleString("zh-TW")} 元`}
        actions={<Button variant="outline" asChild><a href={EINVOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink /> 財政部電子發票平台</a></Button>}
      />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜尋廠名、公司名稱、統編、申辦項目、PO…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card pl-9" />
      </div>
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={showOpen ? "outline" : "default"} onClick={() => setShowOpen(false)}>已結案 {closedCount}</Button>
        <Button size="sm" variant={showOpen ? "default" : "outline"} onClick={() => setShowOpen(true)}>進行中 {rows.filter((r) => !isFactoryClosed(r.stage)).length}</Button>
      </div>
      <div className="grid gap-3">
        {base.length === 0 && <div className="ledger-card py-10 text-center text-sm text-muted-foreground">{showOpen ? "沒有進行中的案件" : "尚無核准結案的案件"}</div>}
        {false && <div className="ledger-card py-10 text-center text-sm text-muted-foreground">尚無案件，請先到工廠登記進度新增</div>}
        {base.length > 0 && filtered.length === 0 && <div className="ledger-card py-10 text-center text-sm text-muted-foreground">找不到符合「{q}」的案件</div>}
        {filtered.map((r) => {
          const status = projectArStatus(r);
          const left = projectOutstanding(r);
          const name = <span className="font-medium">{r.factory_name}</span>;
          return (
            <div key={r.id} className="ledger-card grid gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {me.isAdmin ? (
                    <FactoryFormDialog record={r} focus="ar" trigger={<button type="button" className="text-left text-primary underline-offset-4 hover:underline" aria-label={`修改 ${r.factory_name} 帳款`}>{name}</button>} />
                  ) : name}
                  <div className="text-xs text-muted-foreground">{[r.application_item, r.invoice_type].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", left <= 0 ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning")}>{status}</span>
                  <div className="mt-1 text-xs text-muted-foreground">未收</div>
                  <div className="text-lg font-semibold"><Money value={left} /></div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <dt className="text-muted-foreground">訂金應收</dt><dd className="text-right"><Money value={depositDue(r.deposit_invoice_amount, r.invoice_type)} /></dd>
                <dt className="text-muted-foreground">訂金已收</dt><dd className="text-right"><Money value={Number(r.deposit_received_amount)} />{r.deposit_received_date && <span className="block text-xs text-muted-foreground">{formatDate(r.deposit_received_date)}</span>}</dd>
                <dt className="text-muted-foreground">尾款應收</dt><dd className="text-right"><Money value={finalDue(r)} /></dd>
                <dt className="text-muted-foreground">尾款已收</dt><dd className="text-right"><Money value={Number(r.final_received_amount)} />{r.final_received_date && <span className="block text-xs text-muted-foreground">{formatDate(r.final_received_date)}</span>}</dd>
              </dl>
              {r.ar_notes && <p className="text-sm text-muted-foreground">{r.ar_notes}</p>}
              {me.isAdmin && (
                <div className="flex flex-wrap gap-1 border-t pt-2">
                  <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "quote", stage: "尾款" }}><FileText className="size-3.5" /> 報價單</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "invoice", stage: status === "訂金待收" ? "訂金" : "尾款" }}><Receipt className="size-3.5" /> 請款單</Link></Button>
                  {issuesInvoice(r.invoice_type) && <Button asChild variant="ghost" size="sm"><a href={EINVOICE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> 開發票</a></Button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
