import { staffFromCode, isNonTaxCustomerCode } from "@/lib/filings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { CustomerFormDialog } from "@/components/ar/customer-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customersQuery, invoicesQuery } from "@/lib/queries";
import { compareCustomerCode } from "@/lib/customer-sort";
import { invoiceStatus, outstanding } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/customers/")({
  head: () => ({
    meta: [
      { title: "客戶資料 · 應收帳款管理系統" },
      { name: "description", content: "客戶名冊：統一編號、收費狀態、記帳費與會計專員，以及各客戶應收餘額。" },
      { property: "og:title", content: "客戶資料 · 應收帳款管理系統" },
      { property: "og:description", content: "客戶名冊：統一編號、收費狀態、記帳費與會計專員，以及各客戶應收餘額。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(customersQuery), context.queryClient.ensureQueryData(invoicesQuery)]),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: allCustomers } = useSuspenseQuery(customersQuery);
  const customers = allCustomers.filter((c) => !isNonTaxCustomerCode(c.customer_code));
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState("all");
  const staffOf = (c: { staff_code: string | null; customer_code: string | null }) =>
    (c.staff_code?.trim().toUpperCase() || staffFromCode(c.customer_code) || "");
  const staffCodes = [...new Set(customers.map(staffOf).filter(Boolean))].sort();

  const stats = new Map<string, { balance: number; overdue: number }>();
  for (const inv of invoices) {
    const s = stats.get(inv.customer_id) ?? { balance: 0, overdue: 0 };
    s.balance += outstanding(inv);
    if (invoiceStatus(inv) === "overdue") s.overdue += outstanding(inv);
    stats.set(inv.customer_id, s);
  }

  const rows = (
    customers.filter((c) => (staff === "all" || staffOf(c) === staff) &&
      `${c.name} ${c.customer_code ?? ""} ${c.tax_id ?? ""} ${c.staff_code ?? ""}`.toLowerCase().includes(q.toLowerCase()),
    )
  ).sort((a, b) => compareCustomerCode(a.customer_code, b.customer_code, a.name, b.name));

  return (
    <>
      <PageHeader
        eyebrow="客戶名冊"
        title="客戶資料"
        description={`共 ${customers.length} 位客戶 · 依客戶代號排序`}
        actions={<CustomerFormDialog trigger={<Button><Plus /> 新增客戶</Button>} />}
      />
      <div className="mb-5 flex flex-wrap gap-2">
      <Select value={staff} onValueChange={setStaff}>
        <SelectTrigger className="w-40 bg-card" aria-label="會計專員"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部專員</SelectItem>
          {staffCodes.map((s) => <SelectItem key={s} value={s}>會計專員 {s}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="relative min-w-48 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜尋客戶名稱、客戶ID、統一編號、會計專員…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card pl-9" />
      </div>
      </div>
      {rows.length === 0 ? (
        <div className="ledger-card ledger-lines px-6 py-16 text-center text-sm text-muted-foreground">
          {customers.length === 0 ? "還沒有客戶，先新增第一位客戶吧。" : "沒有符合的客戶"}
        </div>
      ) : (
        <div className="ledger-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>客戶ID</TableHead>
                <TableHead>客戶名稱</TableHead>
                <TableHead>統一編號</TableHead>
                <TableHead>收費狀態</TableHead>
                <TableHead className="text-right">記帳費</TableHead>
                <TableHead>會計專員</TableHead>
                <TableHead className="text-right">應收餘額</TableHead>
                <TableHead className="text-right">逾期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const s = stats.get(c.id) ?? { balance: 0, overdue: 0 };
                return (
                  <TableRow key={c.id} className="group">
                    <TableCell className="tabular text-sm text-muted-foreground">{c.customer_code ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/customers/$id" params={{ id: c.id }} className="group-hover:text-primary group-hover:underline">{c.name}</Link>
                      {c.suspended_period && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">停業 {c.suspended_period}</span>}
                    </TableCell>
                    <TableCell className="tabular text-sm">{c.tax_id ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c.billing_type}</TableCell>
                    <TableCell className="text-right"><Money value={Number(c.bookkeeping_fee)} /></TableCell>
                    <TableCell className="text-sm">{c.staff_code ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold"><Money value={s.balance} /></TableCell>
                    <TableCell className="text-right">{s.overdue > 0 ? <Money value={s.overdue} className="text-overdue" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
