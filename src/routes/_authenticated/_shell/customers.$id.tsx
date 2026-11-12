import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CustomerFormDialog } from "@/components/ar/customer-form-dialog";
import { InvoiceFormDialog } from "@/components/ar/invoice-form-dialog";
import { InvoiceTable } from "@/components/ar/invoice-table";
import { PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { customerQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { formatTWD, invoiceStatus, outstanding } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/customers/$id")({
  head: () => ({
    meta: [
      { title: "客戶明細 · 帳房" },
      { name: "description", content: "客戶基本資料、收費設定與所有應收帳款紀錄。" },
      { property: "og:title", content: "客戶明細 · 帳房" },
      { property: "og:description", content: "客戶基本資料、收費設定與所有應收帳款紀錄。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const [c] = await Promise.all([
      context.queryClient.ensureQueryData(customerQuery(params.id)),
      context.queryClient.ensureQueryData(invoicesQuery),
    ]);
    if (!c) throw notFound();
  },
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <p className="text-muted-foreground">找不到這位客戶</p>
      <Link to="/customers" className="mt-4 inline-block text-primary hover:underline">回到客戶資料</Link>
    </div>
  ),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { data: customer } = useSuspenseQuery(customerQuery(id));
  const { data: allInvoices } = useSuspenseQuery(invoicesQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const remove = useMutation({
    mutationFn: async () => {
      if (!me.canDelete) throw new Error("只有管理員可以刪除資料");
      const { data, error } = await supabase.from("customers").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("未能刪除客戶，請確認權限");
    },
    onSuccess: () => {
      toast.success("已刪除客戶");
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate({ to: "/customers" });
    },
    onError: () => toast.error("此客戶仍有帳款紀錄，請先刪除帳款後再刪除客戶"),
  });

  if (!customer) return null;
  const invoices = allInvoices.filter((i) => i.customer_id === id).sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  const balance = invoices.reduce((s, i) => s + outstanding(i), 0);
  const overdue = invoices.filter((i) => invoiceStatus(i) === "overdue").reduce((s, i) => s + outstanding(i), 0);

  const info: [string, string | null][] = [
    ["客戶ID", customer.customer_code],
    ["統一編號", customer.tax_id],
    ["收費狀態", customer.billing_type],
    ["記帳費", formatTWD(Number(customer.bookkeeping_fee))],
    ["文具費", formatTWD(Number(customer.stationery_fee))],
    ["結算費", formatTWD(Number(customer.settlement_fee))],
    ["會計專員工ID", customer.staff_code],
    ["停業期間", customer.suspended_period],
    ["聯絡人", customer.contact_person],
    ["電話", customer.phone],
    ["電子郵件", customer.email],
    ["地址", customer.address],
  ];

  return (
    <>
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> 客戶資料
      </Link>
      <PageHeader
        eyebrow="客戶"
        title={customer.name}
        description={`應收餘額 ${formatTWD(balance)}${overdue > 0 ? ` · 逾期 ${formatTWD(overdue)}` : ""}`}
        actions={
          <>
            <InvoiceFormDialog customerId={customer.id} trigger={<Button><Plus /> 新增應收帳款</Button>} />
            <CustomerFormDialog customer={customer} trigger={<Button variant="outline"><Pencil /> 編輯</Button>} />
            {me.canDelete && <Button
              variant="ghost"
              size="icon"
              aria-label="刪除客戶"
              onClick={() => {
                if (confirm(`刪除客戶「${customer.name}」？`)) remove.mutate();
              }}
            >
              <Trash2 />
            </Button>}
          </>
        }
      />
      <section className="ledger-card mb-8 grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {info.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
          </div>
        ))}
        {customer.notes && (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-muted-foreground">備註</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{customer.notes}</p>
          </div>
        )}
      </section>
      <h2 className="mb-3 text-xl font-bold">帳款紀錄</h2>
      <InvoiceTable invoices={invoices} showCustomer={false} />
    </>
  );
}
