import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { canRetireCustomer } from "@/lib/customer-retirement";
import { customersQuery, filingsQuery, invoicesQuery, meQuery } from "@/lib/queries";

export function CustomerRetirementDialog({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: filings } = useSuspenseQuery(filingsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const customer = customers.find((c) => c.id === customerId);
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("archive_cancelled_customer", { _customer_id: customerId });
      if (error) throw error;
    },
    onSuccess: async () => {
      setDismissed(true);
      onClose();
      await qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("已從客戶名單移除，歷史帳務已保留");
      navigate({ to: "/invoices" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "移除失敗"),
  });
  return <AlertDialog open={!dismissed && !!customer && canRetireCustomer(me.isAdmin, customerId, invoices, filings)} onOpenChange={(o) => { if (!o) { setDismissed(true); onClose(); } }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>是否刪除客戶資料？</AlertDialogTitle>
        <AlertDialogDescription>「{customer?.customer_code} {customer?.name}」的註銷案件已結案，所有帳款已收清。確認後會從客戶名單移除，歷史帳款與收款紀錄仍保留。</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <Button variant="outline" disabled={remove.isPending} onClick={() => { setDismissed(true); onClose(); }}>保留客戶</Button>
        <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? "移除中…" : "確認移除客戶"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}