import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GCIS = "https://data.gcis.nat.gov.tw/od/data/api";
// 公司登記基本資料、商業登記基本資料
const COMPANY = "5F64D864-61CB-4D0D-8AD9-492047CC1EA6";
const BUSINESS = "7E6AFA72-AD6A-46D3-8681-ED77951D912D";

async function query(id: string, field: string, taxId: string) {
  const url = `${GCIS}/${id}?$format=json&$filter=${field}%20eq%20${taxId}&$skip=0&$top=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GCIS ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return null;
  const rows = JSON.parse(text) as Record<string, unknown>[];
  return rows[0] ?? null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 以統一編號查詢經濟部商工登記公示資料（公司，查無再查商業登記）。 */
export const lookupCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taxId: string }) => {
    if (!/^\d{8}$/.test(d.taxId)) throw new Error("統一編號應為 8 位數字");
    return d;
  })
  .handler(async ({ data }) => {
    const c = await query(COMPANY, "Business_Accounting_NO", data.taxId);
    if (c) return { name: str(c["Company_Name"]), responsible: str(c["Responsible_Name"]), address: str(c["Company_Location"]), status: str(c["Company_Status_Desc"]) };
    const b = await query(BUSINESS, "President_No", data.taxId);
    if (b) return { name: str(b["Business_Name"]), responsible: str(b["Responsible_Name"]), address: str(b["Business_Address"]), status: str(b["Business_Current_Status_Desc"]) };
    return null;
  });
