import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { InvoiceFormDialog } from "@/components/ar/invoice-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { factoryRegistrationsQuery, filingsQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { latestPeriodProgress, outstanding, rocYear, todayISO } from "@/lib/receivables";
import { projectOutstanding } from "@/lib/factory";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "總覽 · 應收帳款管理系統" },
      { name: "description", content: "應收帳款總覽：本期收款進度、應收餘額、本月收款、工商與勤豐待收。" },
      { property: "og:title", content: "總覽 · 應收帳款管理系統" },
      { property: "og:description", content: "應收帳款總覽：本期收款進度、應收餘額、本月收款、工商與勤豐待收。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(invoicesQuery), context.queryClient.ensureQueryData(filingsQuery), context.queryClient.ensureQueryData(factoryRegistrationsQuery)]),
  component: Dashboard,
});

function Dashboard() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: factory } = useSuspenseQuery(factoryRegistrationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const today = todayISO();
  const month = today.slice(0, 7);
  const open = invoices.filter((i) => outstanding(i) > 0);
  const collectedThisMonth = invoices.reduce(
    (s, i) => s + i.payments.filter((p) => p.paid_date.startsWith(month)).reduce((a, p) => a + Number(p.amount), 0),
    0,
  );
  const progress = latestPeriodProgress(invoices);
  const filingInvoiceIds = new Set(filings.map((f) => f.invoice_id).filter(Boolean));
  const filingOpen = invoices.filter((i) => filingInvoiceIds.has(i.id) && outstanding(i) > 0);
  const factoryOpen = factory.filter((r) => r.stage === "核准結案" && projectOutstanding(r) > 0);
  const [y = 0, m = 0, d = 0] = today.split("-").map(Number);

  return (
    <>
      <PageHeader
        eyebrow={`民國 ${rocYear(y)} 年 ${m} 月 ${d} 日`}
        title={`${me.displayName}，您好`}
        description="事務所收款工作看板"
        actions={<InvoiceFormDialog trigger={<Button><Plus /> 新增應收帳款</Button>} />}
      />

      {progress && (
        <section className="ledger-card mb-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">本期收款進度 · {progress.label}</h2>
            <span className="text-2xl font-semibold text-success tabular">{progress.percent}%</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">開立（{progress.count} 筆）</p><Money value={progress.billed} className="font-semibold" /></div>
            <div><p className="text-xs text-muted-foreground">已收</p><Money value={progress.collected} className="font-semibold text-success" /></div>
            <div><p className="text-xs text-muted-foreground">待收</p><Money value={progress.open} className="font-semibold text-overdue" /></div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Stat label="事務所應收餘額" value={open.reduce((s, i) => s + outstanding(i), 0)} sub={`${open.length} 筆未收清`} tone="ink" />
        <Stat label="本月已收款" value={collectedThisMonth} sub={`${m} 月`} tone="success" />
        <Stat label="工商立帳待收" value={filingOpen.reduce((s, i) => s + outstanding(i), 0)} sub={`${filingOpen.length} 筆`} tone="warning" />
        <Stat label="勤豐結案待收" value={factoryOpen.reduce((s, r) => s + projectOutstanding(r), 0)} sub={`${factoryOpen.length} 件`} tone="overdue" />
      </section>
    </>
  );
}

const toneClass = {
  ink: "bg-ink-gradient text-sidebar-foreground border-transparent",
  overdue: "",
  warning: "",
  success: "",
} as const;
const valueClass = { ink: "text-sidebar-foreground", overdue: "text-overdue", warning: "text-warning-foreground", success: "text-success" } as const;

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: keyof typeof toneClass }) {
  return (
    <div className={`ledger-card p-5 animate-rise ${toneClass[tone]}`}>
      <p className={`text-xs tracking-wider ${tone === "ink" ? "text-sidebar-foreground/70" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${valueClass[tone]}`}>
        <span className="mr-1 text-sm opacity-70">NT$</span>
        <Money value={value} />
      </p>
      <p className={`mt-1 text-xs ${tone === "ink" ? "text-sidebar-foreground/60" : "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}
