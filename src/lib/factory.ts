/** 勤豐工商顧問有限公司：工廠登記進度與專案應收帳款規則。 */
export const COMPANIES = ["施慶豐記帳及報稅代理人事務所", "勤豐工商顧問有限公司"] as const;
export type Company = (typeof COMPANIES)[number];
export const FACTORY_COMPANY: Company = "勤豐工商顧問有限公司";

export const FACTORY_STAGES = ["送件環保", "環保核准", "送件工商科", "現場會勘", "核准結案"] as const;
export type FactoryStage = (typeof FACTORY_STAGES)[number];

/** 環保：委託代辦、免跑環保、客戶自行跑環保；後兩者直接從送件工商科開始。 */
export const ENV_MODES = ["需跑環保", "免跑環保", "客戶自辦環保"] as const;
export const needsEnv = (mode: string | null | undefined) => mode === "需跑環保";

export function factoryInitialStage(envMode: string): FactoryStage {
  return needsEnv(envMode) ? "送件環保" : "送件工商科";
}

/** 下一階段；現場會勘為選辦，送件工商科之後可選會勘或直接結案（skipInspection）。 */
export function nextFactoryStage(stage: string, skipInspection = false): FactoryStage {
  if (stage === "送件工商科" && skipInspection) return "核准結案";
  const i = FACTORY_STAGES.indexOf(stage as FactoryStage);
  return FACTORY_STAGES[Math.min(Math.max(i, 0) + 1, FACTORY_STAGES.length - 1)]!;
}

type Num = number | string | null | undefined;
const n = (v: Num) => Math.round(Number(v) || 0);
export type ProjectArLike = {
  quote_amount: Num;
  deposit_invoice_amount: Num;
  deposit_received_amount: Num;
  final_invoice_amount: Num;
  government_fee: Num;
  other_fee: Num;
  final_received_amount: Num;
};

/** 尾款應收＝尾款發票金額＋規費＋其他費用。 */
export function finalDue(r: ProjectArLike): number {
  return n(r.final_invoice_amount) + n(r.government_fee) + n(r.other_fee);
}

/** 未收餘額＝（訂金發票−訂金收款）＋（尾款應收−尾款收款）。 */
export function projectOutstanding(r: ProjectArLike): number {
  return n(r.deposit_invoice_amount) - n(r.deposit_received_amount) + finalDue(r) - n(r.final_received_amount);
}

export function projectArStatus(r: ProjectArLike): "未請款" | "訂金待收" | "尾款待收" | "已收清" {
  const billed = n(r.deposit_invoice_amount) + finalDue(r);
  if (billed === 0) return "未請款";
  if (projectOutstanding(r) <= 0) return "已收清";
  if (n(r.deposit_received_amount) < n(r.deposit_invoice_amount)) return "訂金待收";
  return "尾款待收";
}
