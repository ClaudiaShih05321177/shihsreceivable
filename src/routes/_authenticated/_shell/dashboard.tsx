import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { InvoiceFormDialog } from "@/components/ar/invoice-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { invoicesQuery, meQuery } from "@/lib/queries";
import { agingSummary, daysOverdue, formatDate, formatTWD, invoiceStatus, monthlySeries, outstanding, rocYear, todayISO } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "總覽 · 帳房應收帳款" },
      { name: "description", content: "應收帳款總覽：未收總額、逾期提醒、月度開立與收款、帳齡分析。" },
      { property: "og:title", content: "總覽 · 帳房應收帳款" },
      { property: "og:description", content: "應收帳款總覽：未收總額、逾期提醒、月度開立與收款、帳齡分析。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: Dashboard,
});

const chartConfig = {
  billed: { label: "應收開立", color: "var(--chart-1)" },
  collected: { label: "實際收款", color: "var(--chart-2)" },
} satisfies ChartConfig;

const agingConfig = { amount: { label: "未收金額", color: "var(--chart-3)" } } satisfies ChartConfig;

function Dashboard() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const today = todayISO();
  const open = invoices.filter((i) => outstanding(i) > 0);
  const overdue = open.filter((i) => invoiceStatus(i, today) === "overdue").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueSoon = open.filter((i) => invoiceStatus(i, today) === "due_soon");
  const sum = (list: typeof invoices) => list.reduce((s, i) => s + outstanding(i), 0);
  const month = today.slice(0, 7);
  const collectedThisMonth = invoices.reduce(
    (s, i) => s + i.payments.filter((p) => p.paid_date.startsWith(month)).reduce((a, p) => a + Number(p.amount), 0),
    0,
  );
  const series = monthlySeries(invoices, 6, today);
  const aging = agingSummary(invoices, today);

  const byCustomer = new Map<string, { id: string; name: string; amount: number }>();
  for (const inv of open) {
    if (!inv.customer) continue;
    const row = byCustomer.get(inv.customer.id) ?? { id: inv.customer.id, name: inv.customer.name, amount: 0 };
    row.amount += outstanding(inv);
    byCustomer.set(inv.customer.id, row);
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const [y, m, d] = today.split("-").map(Number);

  return (
    <>
      <PageHeader
        eyebrow={`民國 ${rocYear(y)} 年 ${m} 月 ${d} 日`}
        title={`${me.displayName}，您好`}
        description="今日應收帳款概況"
        actions={<InvoiceFormDialog trigger={<Button><Plus /> 新增應收帳款</Button>} />}
      />

      {(overdue.length > 0 || dueSoon.length > 0) && (
        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          {overdue.length > 0 && (
            <div className="ledger-card border-overdue/40 p-5 animate-rise">
              <div className="flex items-center gap-2 text-overdue">
                <AlertTriangle className="size-5" />
                <h2 className="text-lg font-bold">逾期提醒</h2>
                <span className="ml-auto text-sm">{overdue.length} 筆 · <span className="tabular">{formatTWD(sum(overdue))}</span></span>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {overdue.slice(0, 5).map((inv) => (
                  <li key={inv.id}>
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                      <span className="truncate font-medium">{inv.customer?.name}</span>
                      <span className="shrink-0 text-xs text-overdue">逾期 {daysOverdue(inv, today)} 天</span>
                      <Money value={outstanding(inv)} className="w-24 shrink-0 text-right font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
              {overdue.length > 5 && <Link to="/invoices" className="mt-2 inline-block text-xs text-primary hover:underline">查看全部 {overdue.length} 筆 →</Link>}
            </div>
          )}
          {dueSoon.length > 0 && (
            <div className="ledger-card border-warning/50 p-5 animate-rise">
              <div className="flex items-center gap-2 text-warning-foreground">
                <CalendarClock className="size-5" />
                <h2 className="text-lg font-bold">7 日內到期</h2>
                <span className="ml-auto text-sm">{dueSoon.length} 筆 · <span className="tabular">{formatTWD(sum(dueSoon))}</span></span>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {dueSoon.slice(0, 5).map((inv) => (
                  <li key={inv.id}>
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                      <span className="truncate font-medium">{inv.customer?.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(inv.due_date)} 到期</span>
                      <Money value={outstanding(inv)} className="w-24 shrink-0 text-right font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="應收餘額合計" value={sum(open)} sub={`${open.length} 筆未收清`} tone="ink" />
        <Stat label="逾期金額" value={sum(overdue)} sub={`${overdue.length} 筆`} tone="overdue" />
        <Stat label="7 日內到期" value={sum(dueSoon)} sub={`${dueSoon.length} 筆`} tone="warning" />
        <Stat label="本月已收款" value={collectedThisMonth} sub={`${m} 月`} tone="success" />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-5">
        <div className="ledger-card p-5 lg:col-span-3">
          <h2 className="text-lg font-bold">近六個月 開立與收款</h2>
          <ChartContainer config={chartConfig} className="mt-4 h-64 w-full">
            <BarChart data={series}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v) => (v >= 10000 ? `${v / 10000}萬` : String(v))} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="billed" fill="var(--color-billed)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collected" fill="var(--color-collected)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="ledger-card p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">帳齡分析</h2>
          <ChartContainer config={agingConfig} className="mt-4 h-64 w-full">
            <BarChart data={aging} layout="vertical" margin={{ left: 12 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={96} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={3} />
            </BarChart>
          </ChartContainer>
        </div>
      </section>

      <section className="mt-8 ledger-card p-5">
        <h2 className="text-lg font-bold">未收金額最高的客戶</h2>
        {topCustomers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">目前沒有未收帳款。</p>
        ) : (
          <ol className="mt-4 divide-y divide-border">
            {topCustomers.map((c, i) => (
              <li key={c.id}>
                <Link to="/customers/$id" params={{ id: c.id }} className="flex items-center gap-4 py-3 hover:text-primary">
                  <span className="font-display w-6 text-lg text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <Money value={c.amount} className="font-semibold" />
                </Link>
              </li>
            ))}
          </ol>
        )}
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
