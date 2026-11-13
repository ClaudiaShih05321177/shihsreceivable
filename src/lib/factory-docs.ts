/** 勤豐工商顧問 報價單／請款單內容（依使用者提供之 Excel 範本）。 */
import { contractTotal, issuesInvoice, TAX_RATE, type ProjectArLike } from "./factory";

export const KINFENG = {
  name: "勤豐工商顧問有限公司",
  bank: "新竹市第一信用合作社 三民分社",
  accountName: "勤豐工商顧問有限公司",
  bankCode: "130",
  account: "003-001-00006885",
  contact: "施小姐",
  quoteTerms: [
    "以上報價包含環保判定申請，若所有項目為非公告事業即可申請工廠登記。",
    "若環保局環判函認定貴廠為公告事業，需做相關其他環保設置，再依相關內容另行報價。",
    "若貴廠位於產業園區內，本報價不含污水納管或聯接證明申請。",
    "上述報價僅包含工商科規費，其他各類主管機關規費或發票將實報實銷(如土地分區、溼地查詢、醫療器材商執照規費或廢清書規費等)。",
    "付款條件:訂單確認後預付顧問費之50%，結案後付尾款及規費。請於發票開立後30日內付款。",
  ],
};

export const INVOICE_STAGES = ["訂金", "尾款", "全額"] as const;
export type InvoiceStage = (typeof INVOICE_STAGES)[number];

export type DocLine = { label: string; amount: number };
export type DocSummary = { consulting: number; subtotal: number; lines: DocLine[]; total: number };

const n = (v: unknown) => Math.round(Number(v) || 0);

/** 報價單：顧問費（未稅）＋營業稅5%（開發票才有）＋規費＋其他費用。 */
export function quoteSummary(r: ProjectArLike): DocSummary {
  const q = n(r.quote_amount);
  const tax = issuesInvoice(r.invoice_type) ? contractTotal(q, r.invoice_type) - q : 0;
  const lines: DocLine[] = [{ label: `營業稅(${TAX_RATE * 100}%)`, amount: tax }, { label: "規費(收據)", amount: n(r.government_fee) }];
  if (n(r.other_fee)) lines.push({ label: "其他費用", amount: n(r.other_fee) });
  return { consulting: q, subtotal: q, lines, total: lines.reduce((s, l) => s + l.amount, q) };
}

/**
 * 請款單：訂金＝訂金發票金額；尾款＝含稅總額−簽約金＋規費＋其他費用；全額＝不扣簽約金。
 * 不開發票時不加營業稅，簽約金以訂金收款扣除。
 */
export function invoiceSummary(r: ProjectArLike, stage: InvoiceStage): DocSummary {
  const inv = issuesInvoice(r.invoice_type);
  if (stage === "訂金") {
    const dep = inv ? n(r.deposit_invoice_amount) : n(r.deposit_received_amount);
    const base = inv ? Math.round(dep / (1 + TAX_RATE)) : dep;
    const lines: DocLine[] = [{ label: `營業稅(${TAX_RATE * 100}%)`, amount: dep - base }];
    return { consulting: base, subtotal: base, lines, total: dep };
  }
  const q = n(r.quote_amount);
  const tax = inv ? contractTotal(q, r.invoice_type) - q : 0;
  const lines: DocLine[] = [{ label: `營業稅(${TAX_RATE * 100}%)`, amount: tax }];
  if (stage === "尾款") {
    const deposit = inv ? n(r.deposit_invoice_amount) : n(r.deposit_received_amount);
    lines.push({ label: "簽約金", amount: -deposit });
  }
  lines.push({ label: "規費(收據)", amount: n(r.government_fee) });
  if (n(r.other_fee)) lines.push({ label: "其他費用", amount: n(r.other_fee) });
  return { consulting: q, subtotal: q, lines, total: lines.reduce((s, l) => s + l.amount, q) };
}
