import { FEE_ITEMS } from "@/lib/receivables";

export type FeeLabelRow = { key: string; label: string; hidden: boolean };
export type FeeLabel = { label: string; hidden: boolean };
export type FeeLabelMap = Record<string, FeeLabel>;

/** 費用欄位的預設顯示名稱；在「欄位名稱」裡改名後以資料庫為準。 */
export const DEFAULT_FEE_LABELS: Record<string, string> = {
  文具: "工商代辦費",
  發票: "發票費用",
  結算: "印章代刻",
  工商: "公司2代健保(A-B)\n",
  營所稅: "2代-4倍獎金",
  暫繳: "站ㄐㄧㄠ",
  其他: "個人2代",
  "22-1申報": "租金2代健保\n",
  印章: "租金扣繳",
  印花稅: "薪資扣繳",
  "2代A-B": "勞務扣繳",
};

export function feeLabelMap(rows: readonly FeeLabelRow[]): FeeLabelMap {
  const map: FeeLabelMap = {};
  for (const r of rows) map[r.key] = { label: r.label, hidden: r.hidden };
  return map;
}

/** 顯示名稱：資料庫改名 > 預設名稱 > 欄位代碼。 */
export function feeLabel(key: string, labels?: FeeLabelMap | null): string {
  const override = labels?.[key];
  if (override) return override.label;
  return DEFAULT_FEE_LABELS[key] ?? key;
}

export function isFeeHidden(key: string, labels?: FeeLabelMap | null): boolean {
  return labels?.[key]?.hidden === true;
}

/** 表單要顯示的費用欄位：隱藏的欄位只有在已經填了金額時才出現。 */
export function visibleFeeItems(
  labels: FeeLabelMap | null | undefined,
  { showAll, common, hasValue }: { showAll: boolean; common: readonly string[]; hasValue: (key: string) => boolean },
): string[] {
  return FEE_ITEMS.filter((k) => (isFeeHidden(k, labels) ? hasValue(k) : showAll || common.includes(k) || hasValue(k)));
}

/** 沒有被隱藏的費用欄位數量。 */
export function feeItemCount(labels?: FeeLabelMap | null): number {
  return FEE_ITEMS.filter((k) => !isFeeHidden(k, labels)).length;
}
