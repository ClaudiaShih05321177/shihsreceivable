import { FEE_ITEMS } from "@/lib/receivables";

/**
 * 費用欄位的顯示名稱（由使用者決定）。
 * 沒有列在裡面的欄位，顯示名稱就是欄位代碼本身。
 * 要改名或增減欄位，在對話中說即可。
 */
export const FEE_LABELS: Record<string, string> = {
  營業稅: "營業稅/印花稅",
  文具: "文具費",
  結算: "結算費",
  工商: "工商代辦費",
  "22-1申報": "22-1申報費",
  印章: "代刻印章",
  "2代A-B": "二代健保-公司A-B",
  "2代-4X獎金": "二代健保-四倍獎金",
  租金2代: "二代健保-租金",
  個人2代: "二代健保-個人",
  租金扣繳: "扣繳-租金",
  薪資扣繳: "扣繳-薪資",
  勞務扣繳: "扣繳-勞務",
  其他扣繳: "扣繳-其他",
  未加徵: "加徵5%營所稅",
  暫繳: "暫繳稅額",
  股利2代: "二代健保-股利",
};

/** 不出現在費用項目裡的欄位；已經填過金額的仍會顯示，不會漏帳。 */
export const HIDDEN_FEE_ITEMS: readonly string[] = ["前期餘額"];

/** 顯示名稱：預設名稱 > 欄位代碼；自訂「其他：說明」項目顯示說明文字。 */
export function feeLabel(key: string): string {
  const k = key.startsWith("其他：") ? key.slice(3) : key;
  return FEE_LABELS[k] ?? k;
}

export function isFeeHidden(key: string): boolean {
  return HIDDEN_FEE_ITEMS.includes(key);
}

/** 表單要顯示的費用欄位：隱藏的欄位只有在已經填了金額時才出現。 */
export function visibleFeeItems(
  { showAll, common, hasValue }: { showAll: boolean; common: readonly string[]; hasValue: (key: string) => boolean },
): string[] {
  return FEE_ITEMS.filter((k) => (isFeeHidden(k) ? hasValue(k) : showAll || common.includes(k) || hasValue(k)));
}

/** 沒有被隱藏的費用欄位數量。 */
export function feeItemCount(): number {
  return FEE_ITEMS.filter((k) => !isFeeHidden(k)).length;
}
