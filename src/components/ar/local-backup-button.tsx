import { useState } from "react";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "customers", "invoices", "payments", "tax_filings", "filings",
  "factory_customers", "factory_registrations", "bank_transactions",
  "fee_labels", "profiles", "user_roles",
] as const;

// 只有管理員能透過 RPC 讀取的欄位，不能直接 select *
const CUSTOMER_COLS =
  "id,name,tax_id,contact_person,phone,email,address,notes,created_by,created_at,updated_at,customer_code,billing_type,bookkeeping_fee,stationery_fee,settlement_fee,suspended_period,staff_code,archived_at,last_change_year,remitter_aliases";
const FILING_COLS =
  "id,customer_id,case_type,stage,filed_date,approved_date,advance_fee,invoice_id,notes,created_by,created_at,updated_at,company_name,route,tax_filed_date,tax_approved_date,stamp_fee,customer_code,special_authority,special_filed_date,special_approved_date,change_detail,suspended_period,extra_fees";

async function fetchAll(table: string, cols: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase.from(table as never) as any)
      .select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}：${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function buildBackup() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    const cols = t === "customers" ? CUSTOMER_COLS : t === "filings" ? FILING_COLS : "*";
    tables[t] = await fetchAll(t, cols);
  }
  const rates = await (supabase.rpc as any)("customer_bonus_rates", {});
  if (!rates.error && Array.isArray(rates.data)) {
    const m = new Map(rates.data.map((r: any) => [r.customer_id, r.annual_extra_rate]));
    for (const c of tables["customers"] ?? []) c["annual_extra_rate"] = m.get(c["id"]) ?? null;
  }
  const fees = await (supabase.rpc as any)("filing_service_fees");
  if (!fees.error && Array.isArray(fees.data)) {
    const m = new Map(fees.data.map((r: any) => [r.filing_id, r.service_fee]));
    for (const f of tables["filings"] ?? []) f["service_fee"] = m.get(f["id"]) ?? null;
  }
  return { exported_at: new Date().toISOString(), tables };
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** 側邊選單的一鍵備份：匯出所有資料表為 JSON 並直接下載（管理員）。 */
export function LocalBackupNavItem() {
  const [busy, setBusy] = useState(false);
  async function click() {
    setBusy(true);
    try {
      const backup = await buildBackup();
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      download(JSON.stringify(backup, null, 2), `ar_backup_${stamp}.json`);
      const total = Object.values(backup.tables).reduce((s, r) => s + r.length, 0);
      toast.success(`備份完成，共 ${total} 筆資料`);
    } catch (e) {
      toast.error(e instanceof Error ? `備份失敗：${e.message}` : "備份失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground disabled:opacity-60"
    >
      <DatabaseBackup className="size-4" />
      {busy ? "備份中…" : "一鍵備份"}
    </button>
  );
}
