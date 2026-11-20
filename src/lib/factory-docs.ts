/** 勤豐工商顧問 報價單／請款單內容（依使用者提供之 Excel 範本）。 */
import { contractTotal, depositDue, depositTaxSplit, extraFees, issuesInvoice, netQuote, TAX_RATE, type ProjectArLike } from "./factory";

export const KINFENG = {
  name: "勤豐工商顧問有限公司",
  taxId: "53407393",
  address: "新竹市東區民生路193號6樓之3",
  phone: "(03)5321177",
  fax: "(03)5325488",
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
    "付款條件:訂單確認後預付顧問費之50%，結案後付尾款及規費。請於請款後30日內付款。",
  ],
};

export const INVOICE_STAGES = ["訂金", "尾款", "全額"] as const;
export type InvoiceStage = (typeof INVOICE_STAGES)[number];

export type DocLine = { label: string; amount: number };
export type DocSummary = { consulting: number; discount: number; subtotal: number; lines: DocLine[]; total: number };

const n = (v: unknown) => Math.round(Number(v) || 0);
/** 不開發票時稅額為 0，單據上不列營業稅。 */
const taxLine = (tax: number): DocLine[] => (tax ? [{ label: `營業稅(${TAX_RATE * 100}%)`, amount: tax }] : []);

/** 不開發票的案子沒有發票金額可標，小計就只寫「小計」。 */
export const subtotalLabel = (s: DocSummary): string => (s.lines.some((l) => l.label.startsWith("營業稅")) ? "小計(發票金額)" : "小計");

/** 報價單：顧問費（未稅）＋營業稅5%（開發票才有）＋規費＋其他費用。 */
export function quoteSummary(r: ProjectArLike): DocSummary {
  const q = netQuote(r);
  const tax = issuesInvoice(r.invoice_type) ? contractTotal(q, r.invoice_type) - q : 0;
  const lines: DocLine[] = [...taxLine(tax), { label: "規費(收據)", amount: n(r.government_fee) }];
  if (n(r.other_fee)) lines.push({ label: "其他費用", amount: n(r.other_fee) });
  for (const x of extraFees(r.extra_fees)) lines.push(x);
  return { consulting: n(r.quote_amount), discount: n(r.quote_amount) - q, subtotal: q, lines, total: lines.reduce((s, l) => s + l.amount, q) };
}

/**
 * 請款單：訂金＝訂金發票金額；尾款＝尾款發票（折扣後報價−訂金發票未稅，另計稅）＋規費＋其他費用；全額＝不扣簽約金。
 * 不開發票時不加營業稅，簽約金以訂金收款扣除。
 */
export function invoiceSummary(r: ProjectArLike, stage: InvoiceStage): DocSummary {
  const inv = issuesInvoice(r.invoice_type);
  if (stage === "訂金") {
    const base = inv ? n(r.deposit_invoice_amount) : n(r.deposit_received_amount);
    const tax = inv ? depositTaxSplit(base).tax : 0;
    const lines: DocLine[] = taxLine(tax);
    return { consulting: base, discount: 0, subtotal: base, lines, total: base + tax };
  }
  const q = netQuote(r);
  if (stage === "尾款") {
    // 訂金與尾款分開開發票：顧問費直接列尾款發票未稅金額＝折扣後報價−訂金發票未稅。
    const base = Math.max(0, q - (inv ? n(r.deposit_invoice_amount) : n(r.deposit_received_amount)));
    const incl = inv ? Math.max(0, contractTotal(q, r.invoice_type) - depositDue(r.deposit_invoice_amount, r.invoice_type)) : base;
    const lines: DocLine[] = taxLine(incl - base);
    lines.push({ label: "規費(收據)", amount: n(r.government_fee) });
    if (n(r.other_fee)) lines.push({ label: "其他費用", amount: n(r.other_fee) });
    for (const x of extraFees(r.extra_fees)) lines.push(x);
    return { consulting: base, discount: 0, subtotal: base, lines, total: lines.reduce((s, l) => s + l.amount, base) };
  }
  const tax = inv ? contractTotal(q, r.invoice_type) - q : 0;
  const lines: DocLine[] = taxLine(tax);
  lines.push({ label: "規費(收據)", amount: n(r.government_fee) });
  if (n(r.other_fee)) lines.push({ label: "其他費用", amount: n(r.other_fee) });
  for (const x of extraFees(r.extra_fees)) lines.push(x);
  return { consulting: n(r.quote_amount), discount: n(r.quote_amount) - q, subtotal: q, lines, total: lines.reduce((s, l) => s + l.amount, q) };
}

/** 案件是否有訂金（有訂金才在報價單註記會開立預付發票及請款單）。 */
export function hasDeposit(r: ProjectArLike): boolean {
  return issuesInvoice(r.invoice_type) ? n(r.deposit_invoice_amount) > 0 : n(r.deposit_received_amount) > 0;
}

/** 報價條款切換設定（存於 factory_registrations.quote_terms）。 */
export const ENV_TERM_OPTIONS = ["包含環判", "免跑環保", "客戶自辦環保", "只跑環保"] as const;
export const PAYMENT_TERM_OPTIONS = ["預付50%＋尾款", "全額結案付清", "自訂"] as const;
export type QuoteTermsConfig = {
  env: (typeof ENV_TERM_OPTIONS)[number];
  park: boolean;
  sciencePark: boolean;
  payment: (typeof PAYMENT_TERM_OPTIONS)[number];
  customPayment: string;
  extra: string[];
};
const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
export function readQuoteTerms(v: unknown, envMode?: string | null): QuoteTermsConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const envDefault = envMode === "免跑環保" ? "免跑環保" : envMode === "客戶自辦環保" ? "客戶自辦環保" : envMode === "只跑環保" ? "只跑環保" : "包含環判";
  return {
    env: pick(o["env"], ENV_TERM_OPTIONS, envDefault),
    park: o["park"] === true,
    sciencePark: o["sciencePark"] === true,
    payment: pick(o["payment"], PAYMENT_TERM_OPTIONS, "預付50%＋尾款"),
    customPayment: typeof o["customPayment"] === "string" ? o["customPayment"] : "",
    extra: Array.isArray(o["extra"]) ? o["extra"].map(String).filter((x) => x.trim()) : [],
  };
}
export function buildQuoteTerms(c: QuoteTermsConfig): string[] {
  const t: string[] = [];
  if (c.env === "包含環判") t.push("以上報價包含環保判定申請，若所有項目為非公告事業即可申請工廠登記。", "若環保局環判函認定貴廠為公告事業，需做相關其他環保設置，再依相關內容另行報價。");
  else if (c.env === "只跑環保") t.push("以上報價僅包含環保判定申請，不含工廠登記送件及其他主管機關審查。", "若環保局環判函認定貴廠為公告事業，需做相關其他環保設置，再依相關內容另行報價。");
  else if (c.env === "客戶自辦環保") t.push("本案環保手續由貴廠自行辦理，本報價不含環保送件及相關規費。");
  if (c.park) t.push("若貴廠位於產業園區內，本報價不含污水納管或聯接證明申請。");
  if (c.sciencePark) t.push("若貴廠位於科學園區內，本報價不含污水納管、用水計畫書、用電計畫書及污染總量預估。");
  if (c.env === "只跑環保") {
    t.push("上述報價不包含各項規費，如產生其他規費將實報實銷。");
    if (c.payment === "自訂" && c.customPayment.trim()) t.push(`付款條件:${c.customPayment.trim()}`);
    else t.push("付款條件:結案後付款。請於請款後30日內付款。");
    return [...t, ...c.extra];
  }
  t.push("上述報價僅包含工商科規費，其他各類主管機關規費或發票將實報實銷(如土地分區、溼地查詢、醫療器材商執照規費或廢清書規費等)。");
  if (c.payment === "預付50%＋尾款") t.push("付款條件:訂單確認後預付顧問費之50%，結案後付尾款及規費。請於請款後30日內付款。");
  else if (c.payment === "全額結案付清") t.push("付款條件:結案後一次付清顧問費及規費。請於請款後30日內付款。");
  else if (c.customPayment.trim()) t.push(`付款條件:${c.customPayment.trim()}`);
  return [...t, ...c.extra];
}
