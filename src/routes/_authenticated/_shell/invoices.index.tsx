import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { BatchInvoiceDialog } from "@/components/ar/batch-invoice-dialog";
import { InvoiceFormDialog } from "@/components/ar/invoice-form-dialog";
import { InvoiceTable } from "@/components/ar/invoice-table";
import { PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customersQuery, invoicesQuery } from "@/lib/queries";
import { formatTWD, invoiceStatus, outstanding, STATUS_LABEL, type InvoiceStatus } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/invoices/")({
  head: () => ({
    meta: [
      { title: "應收帳款 · 應收帳款管理系統" },
      { name: "description", content: "所有應收帳款清單，依狀態、會計專員與客戶篩選。" },
      { property: "og:title", content: "應收帳款 · 應收帳款管理系統" },
      { property: "og:description", content: "所有應收帳款清單，依狀態、會計專員與客戶篩選。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(invoicesQuery), context.queryClient.ensureQueryData(customersQuery)]),
  component: InvoicesPage,
});

const FILTERS: ("open" | "all" | InvoiceStatus)[] = ["open", "overdue", "due_soon", "partial", "unpaid", "paid", "all"];
const FILTER_LABEL = { open: "未收清", all: "全部", ...STATUS_LABEL } as const;

function InvoicesPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [staff, setStaff] = useState("all");
  const [q, setQ] = useState("");

  const staffById = useMemo(() => new Map(customers.map((c) => [c.id, c.staff_code ?? ""])), [customers]);
  const staffCodes = [...new Set(customers.map((c) => c.staff_code).filter(Boolean))].sort() as string[];

  const counts = useMemo(() => {
    const c: Record<string, number> & { open: number } = { all: invoices.length, open: 0 };
    for (const inv of invoices) {
      const s = invoiceStatus(inv);
      c[s] = (c[s] ?? 0) + 1;
      if (s !== "paid") c.open++;
    }
    return c;
  }, [invoices]);

  const rows = invoices.filter((inv) => {
    const s = invoiceStatus(inv);
    if (filter === "open" && s === "paid") return false;
    if (filter !== "open" && filter !== "all" && s !== filter) return false;
    if (staff !== "all" && staffById.get(inv.customer_id) !== staff) return false;
    if (q) {
      const hay = `${inv.customer?.name ?? ""} ${inv.invoice_no} ${inv.period_label ?? ""} ${inv.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const total = rows.reduce((s, i) => s + outstanding(i), 0);

  return (
    <>
      <PageHeader
        eyebrow="總帳"
        title="應收帳款"
        description={`共 ${rows.length} 筆，應收餘額 ${formatTWD(total)}`}
        actions={<><BatchInvoiceDialog /><InvoiceFormDialog trigger={<Button><Plus /> 新增應收帳款</Button>} /></>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
            )}
          >
            {FILTER_LABEL[f]} <span className="tabular ml-1 text-xs opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜尋客戶名稱、期別、備註…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card pl-9" />
        </div>
        {staffCodes.length > 0 && (
          <Select value={staff} onValueChange={setStaff}>
            <SelectTrigger className="bg-card sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部會計專員</SelectItem>
              {staffCodes.map((s) => <SelectItem key={s} value={s}>會計專員 {s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <InvoiceTable invoices={rows} />
    </>
  );
}
