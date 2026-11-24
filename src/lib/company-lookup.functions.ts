import { createServerFn } from "@tanstack/react-start";

const GCIS = "https://data.gcis.nat.gov.tw/od/data/api";
// 公司登記基本資料、商業登記基本資料
const COMPANY = "5F64D864-61CB-4D0D-8AD9-492047CC1EA6";
// 商業登記應用一需同時帶統編與申登機關；應用三只需統編。
const BUSINESS = "7E6AFA72-AD6A-46D3-8681-ED77951D912D";
const BUSINESS_BY_ID = "426D5542-5F05-43EB-83F9-F1300F14E1F1";

async function query(id: string, filter: string) {
  const path = `/${id}?$format=json&$filter=${encodeURIComponent(filter)}&$skip=0&$top=1`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-TW,zh;q=0.9",
  };
  let text = "";
  for (const base of [GCIS, GCIS.replace("https://", "http://")]) {
    try {
      const res = await fetch(base + path, { headers });
      text = (await res.text()).trim();
      if (res.ok && (text === "" || text.startsWith("["))) break;
      console.error("GCIS unexpected response", base, res.status, text.slice(0, 200));
    } catch (e) {
      console.error("GCIS fetch failed", base, e);
    }
    text = "!";
  }
  if (text === "") return null; // 經濟部對查無資料回傳空白
  if (!text.startsWith("[")) throw new Error("經濟部公示資料暫時無法查詢，請稍後再試");
  const rows = JSON.parse(text) as Record<string, unknown>[];
  return rows[0] ?? null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 以統一編號查詢經濟部商工登記公示資料（公司，查無再查商業登記）。 */
export const lookupCompany = createServerFn({ method: "POST" })
  .validator((d: { taxId: string }) => {
    if (!/^\d{8}$/.test(d.taxId)) throw new Error("統一編號應為 8 位數字");
    return d;
  })
  .handler(async ({ data }) => {
    const c = await query(COMPANY, `Business_Accounting_NO eq ${data.taxId}`);
    if (c) return { name: str(c["Company_Name"]), responsible: str(c["Responsible_Name"]), address: str(c["Company_Location"]), status: str(c["Company_Status_Desc"]) };
    const b = await query(BUSINESS_BY_ID, `President_No eq ${data.taxId}`);
    if (b) {
      let responsible = "";
      const agency = str(b["Agency"]);
      if (/^[0-9A-Z]+$/.test(agency)) {
        const d = await query(BUSINESS, `President_No eq ${data.taxId} and Agency eq ${agency}`).catch(() => null);
        responsible = str(d?.["Responsible_Name"]);
      }
      return { name: str(b["Business_Name"]), responsible, address: str(b["Business_Address"]), status: str(b["Business_Current_Status_Desc"]) };
    }
    return null;
  });
