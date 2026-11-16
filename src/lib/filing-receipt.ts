/** Receipt includes this case's service fee only, independent of billing/payment stage. */
export function filingReceiptAmount(filing: { service_fee?: number | string | null; advance_fee?: number; stamp_fee?: number }): number {
  return Math.max(0, Number(filing.service_fee) || 0);
}