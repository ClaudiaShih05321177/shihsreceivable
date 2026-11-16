import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Pencil, Receipt } from "lucide-react";

import { FactoryFormDialog } from "@/components/ar/factory-form-dialog";
import { Money, PageHeader } from "@/components/ar/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { depositTaxSplit, finalDue, issuesInvoice, projectArStatus, projectOutstanding } from "@/lib/factory";
import { factoryRegistrationsQuery, meQuery } from "@/lib/queries";
import { formatDate } from "@/lib/receivables";

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

function FactoryReceivablesPage() {
  const { data: rows } = useSuspenseQuery(factoryRegistrationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const total = rows.reduce((s, r) => s + projectOutstanding(r), 0);
  return (
    <>
      <PageHeader eyebrow="勤豐工商顧問有限公司" title="應收帳款" description={`未收餘額合計 ${total.toLocaleString("zh-TW")} 元；開發票：報價外加 5%，尾款發票自動補齊；不開發票：報價＋規費＋其他費用全額列入尾款應收。`} />
      <div className="ledger-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>廠名</TableHead><TableHead>申辦項目</TableHead><TableHead>發票</TableHead>
              <TableHead className="text-right">報價金額</TableHead><TableHead className="text-right">訂金發票</TableHead><TableHead className="text-right">訂金收款</TableHead><TableHead>訂金收款日</TableHead>
              <TableHead className="text-right">尾款發票</TableHead><TableHead className="text-right">規費</TableHead><TableHead className="text-right">其他費用</TableHead><TableHead className="text-right">尾款應收</TableHead>
              <TableHead className="text-right">尾款收款</TableHead><TableHead>尾款收款日</TableHead><TableHead className="text-right">未收餘額</TableHead><TableHead>狀態</TableHead><TableHead>備註</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={17} className="py-10 text-center text-sm text-muted-foreground">尚無案件，請先到工廠登記進度新增</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-nowrap">{r.factory_name}</TableCell>
                <TableCell className="text-sm">{r.application_item ?? "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.invoice_type}</TableCell>
                <TableCell className="text-right"><Money value={Number(r.quote_amount)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(r.deposit_invoice_amount)} />{issuesInvoice(r.invoice_type) && Number(r.deposit_invoice_amount) > 0 && <span className="block text-xs text-muted-foreground">＋稅 {depositTaxSplit(r.deposit_invoice_amount).tax.toLocaleString("zh-TW")}＝含稅 {depositTaxSplit(r.deposit_invoice_amount).total.toLocaleString("zh-TW")}</span>}</TableCell>
                <TableCell className="text-right"><Money value={Number(r.deposit_received_amount)} /></TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(r.deposit_received_date)}</TableCell>
                <TableCell className="text-right"><Money value={Number(r.final_invoice_amount)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(r.government_fee)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(r.other_fee)} /></TableCell>
                <TableCell className="text-right font-medium"><Money value={finalDue(r)} /></TableCell>
                <TableCell className="text-right"><Money value={Number(r.final_received_amount)} /></TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatDate(r.final_received_date)}</TableCell>
                <TableCell className="text-right font-semibold"><Money value={projectOutstanding(r)} /></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{projectArStatus(r)}</TableCell>
                <TableCell className="max-w-48 text-sm">{r.ar_notes ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button asChild variant="ghost" size="icon" aria-label={`${r.factory_name} 報價單`}><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "quote", stage: "尾款" }}><FileText className="size-3.5" /></Link></Button>
                  <Button asChild variant="ghost" size="icon" aria-label={`${r.factory_name} 請款單`}><Link to="/factory-doc/$id" params={{ id: r.id }} search={{ type: "invoice", stage: projectArStatus(r) === "訂金待收" ? "訂金" : "尾款" }}><Receipt className="size-3.5" /></Link></Button>
                  {me.isAdmin && <FactoryFormDialog record={r} focus="ar" trigger={<Button variant="ghost" size="icon" aria-label={`編輯 ${r.factory_name} 帳款`}><Pencil className="size-3.5" /></Button>} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
