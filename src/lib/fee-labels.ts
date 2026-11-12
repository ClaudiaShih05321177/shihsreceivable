import { FEE_ITEMS } from "@/lib/receivables";

/**
 * 費用欄位的顯示名稱（由使用者決定）。
 * 沒有列在裡面的欄位，顯示名稱就是欄位代碼本身。
 * 要改名或增減欄位，在對話中說即可。
 */
export const FEE_LABELS: Record<string, string> = {
  營業稅: "營業稅/印花稅",
  文具: "工商代辦費",
  結算: "印章代刻",
  工商: "二代健保-公司A-B",
  "22-1申報": "二代健保-租金",
  印章: "扣繳-租金",
  印花稅: "扣繳-薪資",
  "2代A-B": "扣繳-勞務",
  "2代-4X獎金": "二代健保-個人",
  租金2代: "二代健保-員工酬勞",
  個人2代: "二代健保-股利",
  員工酬勞2代: "扣繳-其他",
  租金扣繳: "22-1申報費",
  薪資扣繳: "其他印花稅",
  勞務扣繳: "營所稅",
  其他扣繳: "未加徵營業稅",
  財稅簽證: "22-1申報",
  營所稅: "暫繳稅額",
  未加徵: "年度加收",
  暫繳: "文具費",
  股利2代: "結算費",
  匯費: "其他",
};

/** 不出現在費用項目裡的欄位；已經填過金額的仍會顯示，不會漏帳。 */
export const HIDDEN_FEE_ITEMS: readonly string[] = ["前期餘額"];

/** 顯示名稱：預設名稱 > 欄位代碼。 */
export function feeLabel(key: string): string {
  return FEE_LABELS[key] ?? key;
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
