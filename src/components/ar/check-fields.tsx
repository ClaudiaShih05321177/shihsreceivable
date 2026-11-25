import { RocDateInput } from "@/components/ar/roc-date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CheckInfo = { bank: string; branch: string; account: string; no: string; due: string };
export const EMPTY_CHECK: CheckInfo = { bank: "", branch: "", account: "", no: "", due: "" };

/** Check columns for a payment row; cleared unless the method is 支票. */
export function checkRow(method: string, c: CheckInfo) {
  const on = method === "支票";
  if (!on) return {};
  const v = (x: string) => (on && x.trim() ? x.trim() : null);
  return { check_bank: v(c.bank), check_branch: v(c.branch), check_account: v(c.account), check_no: v(c.no), check_due_date: on && c.due ? c.due : null };
}

export function CheckFields({ value: c, onChange }: { value: CheckInfo; onChange: (c: CheckInfo) => void }) {
  const set = (k: keyof CheckInfo) => (v: string) => onChange({ ...c, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3">
      <div className="space-y-1.5"><Label htmlFor="ck-bank">銀行</Label><Input id="ck-bank" value={c.bank} onChange={(e) => set("bank")(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="ck-branch">分行</Label><Input id="ck-branch" value={c.branch} onChange={(e) => set("branch")(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="ck-acc">帳號</Label><Input id="ck-acc" value={c.account} onChange={(e) => set("account")(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="ck-no">支票號碼</Label><Input id="ck-no" value={c.no} onChange={(e) => set("no")(e.target.value)} /></div>
      <div className="col-span-2 space-y-1.5"><Label htmlFor="ck-due">支票到期日</Label><RocDateInput id="ck-due" value={c.due} onChange={set("due")} /></div>
    </div>
  );
}

/** Readable message from any thrown value (Error, database error object, or string). */
export function errorText(e: unknown, fallback = "儲存失敗") {
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.details, o.hint].filter((x) => typeof x === "string" && x.trim());
    if (parts.length) return parts.join("：");
  }
  return fallback;
}
