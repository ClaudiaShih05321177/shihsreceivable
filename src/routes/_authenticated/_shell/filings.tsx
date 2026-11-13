import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FilingFormDialog } from "@/components/ar/filing-form-dialog";
import { PageHeader, Money } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { FILING_STAGES, routeHasAuthority, routeHasTaxBureau, feeItemsTotal, filingBillingPeriod, filingInvoiceItems, filingName, mergeFeeItems, nextStage, suspendsCustomerOnClose } from "@/lib/filings";
import { customersQuery, filingServiceFeesQuery, filingsQuery, meQuery, type Filing } from "@/lib/queries";
import { formatDate, scheduledCustomerFees, todayISO } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/filings")({
  head: () => ({
    meta: [
      { title: "工商進度 · 應收帳款管理系統" },
      { name: "description", content: "工商登記案件進度表：預查、主管機關、國稅局、結案，結案時一鍵立帳到應收帳款。" },
      { property: "og:title", content: "工商進度 · 應收帳款管理系統" },
      { property: "og:description", content: "工商登記案件進度與立帳。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(filingsQuery), context.queryClient.ensureQueryData(customersQuery)]),
  component: FilingsPage,
});

function FilingsPage() {
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: fees } = useQuery({ ...filingServiceFeesQuery, enabled: me.isAdmin });
  const qc = useQueryClient();
  const [stage, setStage] = useState<string>("open");

  const counts = Object.fromEntries(FILING_STAGES.map((s) => [s, filings.filter((f) => f.stage === s).length]));
  const openCount = filings.filter((f) => f.stage !== "結案").length;
  const rows = filings.filter((f) => (stage === "all" ? true : stage === "open" ? f.stage !== "結案" : f.stage === stage));

  // 停復業登記結案：客戶收費狀態一併改為停業。
  const suspendCustomer = async (filing: Filing, stage: string) => {
    if (!filing.customer_id || !suspendsCustomerOnClose(filing.case_type, stage)) return;
    const { error } = await supabase.from("customers").update({ billing_type: "停業" }).eq("id", filing.customer_id);
    if (error) throw error;
    toast.success("客戶收費狀態已改為停業");
  };

  const advance = useMutation({
    mutationFn: async (filing: Filing) => {
      const next = nextStage(filing.stage, filing.route);
      const patch = {
        stage: next,
        filed_date: next === "送件" && !filing.filed_date ? todayISO() : filing.filed_date,
        approved_date: next === "核准" && !filing.approved_date ? todayISO() : filing.approved_date,
        tax_filed_date: next === "國稅局送件" && !filing.tax_filed_date ? todayISO() : filing.tax_filed_date,
        tax_approved_date: next === "國稅局核准" && !filing.tax_approved_date ? todayISO() : filing.tax_approved_date,
      };
      const { error } = await supabase.from("filings").update(patch).eq("id", filing.id);
      if (error) throw error;
      await suspendCustomer(filing, next);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["filings"] }); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const bill = useMutation({
    mutationFn: async (filing: Filing) => {
      if (!filing.customer_id) throw new Error("新設立案件請先建立客戶資料，並在編輯案件中選擇該客戶");
      const customerId = filing.customer_id;
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) throw new Error("找不到客戶資料");
      const add = filingInvoiceItems({ ...filing, service_fee: fees?.[filing.id] ?? 0 });
      if (feeItemsTotal(add) <= 0) throw new Error("工商費用皆為 0，無法立帳");
      const { year, month } = filingBillingPeriod(filing.tax_approved_date ?? filing.approved_date ?? todayISO());
      // 工商帳款併入該客戶同期（雙月）記帳費帳單；沒有就連同記帳費新建一筆。
      const { data: existing, error: findError } = await supabase
        .from("invoices").select("id, items").eq("customer_id", customerId).eq("period_year", year).eq("period_month", month)
        .order("created_at").limit(1);
      if (findError) throw findError;
      let invoiceId: string;
      if (existing?.[0]) {
        const items = mergeFeeItems(existing[0].items as Record<string, number>, add);
        const { error: upError } = await supabase.from("invoices").update({ items, amount: feeItemsTotal(items) }).eq("id", existing[0].id);
        if (upError) throw upError;
        invoiceId = existing[0].id;
      } else {
        const base = Object.fromEntries(Object.entries(scheduledCustomerFees(customer, month, "batch")).filter(([, v]) => Number(v) > 0));
        const items = mergeFeeItems(base, add);
        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .insert({ customer_id: customerId, amount: feeItemsTotal(items), items, issue_date: todayISO(), period_year: year, period_month: month, description: `記帳費＋工商${filing.case_type}` })
          .select("id")
          .single();
        if (invError) throw invError;
        invoiceId = invoice.id;
      }
      const { error } = await supabase.from("filings").update({ stage: "結案", invoice_id: invoiceId }).eq("id", filing.id);
      if (error) throw error;
      await suspendCustomer(filing, "結案");
    },
    onSuccess: () => {
      toast.success("已結案，工商費用已併入當期記帳費帳款");
      qc.invalidateQueries({ queryKey: ["filings"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "立帳失敗"),
  });

  const remove = useMutation({
    mutationFn: async (filing: Filing) => {
      const { error } = await supabase.from("filings").delete().eq("id", filing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("案件已刪除");
      qc.invalidateQueries({ queryKey: ["filings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "刪除失敗"),
  });

  const filterBtn = (key: string, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setStage(key)}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        stage === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
      )}
    >
      {label} <span className="tabular ml-1 text-xs opacity-70">{count}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        eyebrow="工商登記"
        title="工商進度表"
        description={`進行中 ${openCount} 件；結案立帳時，工商費用併入該客戶當期（雙月）記帳費帳款一起收。`}
        actions={<FilingFormDialog trigger={<Button><Plus /> 新增案件</Button>} />}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {filterBtn("open", "進行中", openCount)}
        {FILING_STAGES.map((s) => filterBtn(s, s, counts[s] ?? 0))}
        {filterBtn("all", "全部", filings.length)}
      </div>
      <div className="ledger-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>客戶名稱</TableHead>
              <TableHead>案件類型</TableHead>
              <TableHead>階段</TableHead>
              <TableHead>流程</TableHead>
              <TableHead>主管機關 送件／核准</TableHead>
              <TableHead>特許 送件／核准</TableHead>
              <TableHead>國稅局 送件／核准</TableHead>
              {me.isAdmin && <TableHead className="text-right">代辦費</TableHead>}
              <TableHead className="text-right">代墊規費</TableHead>
              <TableHead className="text-right">印章</TableHead>
              {me.isAdmin && <TableHead>應收帳款</TableHead>}
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">尚無案件</TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{filingName(f)}</TableCell>
                <TableCell className="text-sm">{f.case_type}{f.change_detail ? `（${f.change_detail}）` : ""}</TableCell>
                <TableCell>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    f.stage === "結案" ? "bg-primary/10 text-primary" : f.stage.includes("核准") ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                  )}>
                    {f.stage}
                  </span>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{f.route}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{routeHasAuthority(f.route) ? `${formatDate(f.filed_date)}／${formatDate(f.approved_date)}` : "—"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{f.special_authority ? `${f.special_authority} ${formatDate(f.special_filed_date)}／${formatDate(f.special_approved_date)}` : "—"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{routeHasTaxBureau(f.route) ? `${formatDate(f.tax_filed_date)}／${formatDate(f.tax_approved_date)}` : "—"}</TableCell>
                {me.isAdmin && <TableCell className="text-right"><Money value={fees?.[f.id] ?? 0} /></TableCell>}
                <TableCell className="text-right"><Money value={Number(f.advance_fee)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(f.stamp_fee)} /></TableCell>
                {me.isAdmin && <TableCell className="text-sm">
                  {f.invoice_id ? (
                    <Link to="/invoices/$id" params={{ id: f.invoice_id }} className="text-primary hover:underline">查看帳款</Link>
                  ) : "—"}
                </TableCell>}
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {me.isAdmin && f.stage !== "結案" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => advance.mutate(f)} disabled={advance.isPending} aria-label={`${filingName(f)} 推進到${nextStage(f.stage, f.route)}`}>
                          <ArrowRight className="size-3.5" /> {nextStage(f.stage, f.route)}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => bill.mutate(f)} disabled={bill.isPending} aria-label={`${filingName(f)} 結案立帳`}>
                          <Receipt className="size-3.5" /> 結案立帳
                        </Button>
                      </>
                    )}
                    {me.isAdmin && (
                      <FilingFormDialog
                        filing={f}
                        trigger={<Button variant="ghost" size="icon" aria-label={`編輯 ${filingName(f)}`}><Pencil className="size-3.5" /></Button>}
                      />
                    )}
                    {me.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`刪除 ${filingName(f)}`}
                        onClick={() => { if (window.confirm(`確定刪除「${filingName(f)}」的${f.case_type}案件？`)) remove.mutate(f); }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
