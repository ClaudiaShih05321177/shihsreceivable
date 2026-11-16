import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ar/page-header";
import { RocDateInput } from "@/components/ar/roc-date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeBankDate, txnFingerprint } from "@/lib/bank-parse";
import { bankTransactionsQuery, invoicesQuery, meQuery } from "@/lib/queries";
import { allocatePayment, openInvoicesOf, suggestMatch, type OpenInvoice, type Suggestion } from "@/lib/reconcile";
import { parseBankStatement, recordBankPayments } from "@/lib/reconcile.functions";
import { formatTWD, outstanding, todayISO } from "@/lib/receivables";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/reconcile")({
  head: () => ({
    meta: [
      { title: "銀行核對 · 應收帳款管理系統" },
      { name: "description", content: "上傳網銀交易明細截圖，自動辨識存入交易並建議配對未收帳款，管理員確認後登錄收款。" },
      { property: "og:title", content: "銀行核對 · 應收帳款管理系統" },
      { property: "og:description", content: "上傳網銀交易明細截圖，自動辨識存入交易並建議配對未收帳款，管理員確認後登錄收款。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(meQuery),
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(bankTransactionsQuery),
    ]),
  component: ReconcilePage,
});

type Row = {
  key: string;
  date: string | null;
  amount: number;
  memo: string;
  suggestion: Suggestion;
  customerId: string | null;
  skip: boolean;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("讀取圖片失敗"));
    reader.readAsDataURL(file);
  });
}

function ReconcilePage() {
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: bankTxns } = useSuspenseQuery(bankTransactionsQuery);
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const today = todayISO();

  const openInvoices = useMemo<OpenInvoice[]>(
    () =>
      invoices
        .map((i) => ({
          id: i.id,
          customerId: i.customer_id,
          customerName: i.customer?.name ?? "",
          outstanding: outstanding(i),
          period_year: i.period_year,
          period_month: i.period_month,
          period_label: i.period_label,
          created_at: i.created_at,
        }))
        .filter((i) => i.outstanding > 0),
    [invoices],
  );
  const customersWithOpen = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of openInvoices) if (!map.has(i.customerId)) map.set(i.customerId, i.customerName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-Hant"));
  }, [openInvoices]);
  const fingerprints = useMemo(() => new Set(bankTxns.map((t) => t.fingerprint)), [bankTxns]);

  if (!me.isAdmin) {
    return (
      <div className="ledger-card p-8 text-center">
        <h1 className="text-xl font-bold">銀行核對</h1>
        <p className="mt-3 text-sm text-muted-foreground">只有管理員可以核對入帳。</p>
      </div>
    );
  }

  async function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, 4);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const loaded = await Promise.all(files.map(async (f) => ({ name: f.name, dataUrl: await readAsDataUrl(f) })));
      setImages((prev) => [...prev, ...loaded].slice(0, 4));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "讀取圖片失敗");
    }
  }

  async function parse() {
    if (images.length === 0) return;
    setParsing(true);
    try {
      const parsed = await parseBankStatement({ data: { images: images.map((i) => i.dataUrl) } });
      if (parsed.length === 0) {
        toast.error("截圖裡找不到存入交易，請換更清楚的截圖");
        return;
      }
      const next: Row[] = parsed.map((t, idx) => {
        const date = normalizeBankDate(t.date, today);
        const amount = Math.round(t.amount);
        const memo = (t.memo ?? "").trim();
        const suggestion = suggestMatch({ amount, memo }, openInvoices);
        const duplicate = fingerprints.has(txnFingerprint(date, amount, memo));
        return {
          key: `${Date.now()}-${idx}`,
          date,
          amount,
          memo,
          suggestion,
          customerId: suggestion.customerId,
          skip: duplicate || suggestion.kind === "none" || suggestion.kind === "ambiguous",
        };
      });
      setRows((prev) => [...prev, ...next]);
      setImages([]);
      toast.success(`辨識到 ${next.length} 筆存入交易，請確認配對結果`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "辨識失敗，請再試一次");
    } finally {
      setParsing(false);
    }
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function confirm() {
    const entries = rows
      .filter((r) => !r.skip && r.customerId)
      .map((r) => {
        const payments =
          r.suggestion.kind === "single" && r.suggestion.customerId === r.customerId && r.suggestion.invoiceIds.length === 1
            ? [{ invoiceId: r.suggestion.invoiceIds[0]!, amount: r.amount }]
            : allocatePayment(r.amount, openInvoicesOf(openInvoices, r.customerId!));
        return { fingerprint: txnFingerprint(r.date, r.amount, r.memo), txnDate: r.date, amount: r.amount, memo: r.memo, payments };
      })
      .filter((e) => e.payments.length > 0);
    if (entries.length === 0) {
      toast.error("沒有要入帳的交易");
      return;
    }
    setConfirming(true);
    try {
      const results = await recordBankPayments({ data: { entries } });
      const done = results.filter((r) => !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      toast.success(`已入帳 ${done} 筆${skipped > 0 ? `，跳過重複 ${skipped} 筆` : ""}`);
      const doneFingerprints = new Set(results.map((r) => r.fingerprint));
      setRows((prev) => prev.filter((r) => !doneFingerprints.has(txnFingerprint(r.date, r.amount, r.memo))));
      await Promise.all([qc.invalidateQueries({ queryKey: ["invoices"] }), qc.invalidateQueries({ queryKey: ["bank_transactions"] })]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "入帳失敗，請再試一次");
    } finally {
      setConfirming(false);
    }
  }

  const readyCount = rows.filter((r) => !r.skip && r.customerId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="智能核對"
        title="銀行核對"
        description="上傳網銀交易明細截圖，系統自動辨識存入交易並建議配對未收帳款，確認後才登錄收款。"
      />

      <section className="ledger-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm hover:bg-accent">
            <ImagePlus className="size-4" />
            選擇截圖（最多 4 張）
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
          </label>
          <Button onClick={parse} disabled={parsing || images.length === 0}>
            {parsing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> 辨識中…
              </>
            ) : (
              "開始辨識"
            )}
          </Button>
        </div>
        {images.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {images.map((img) => (
              <div key={img.name} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-24 rounded-md border border-border object-cover" />
                <button
                  type="button"
                  aria-label={`移除 ${img.name}`}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  onClick={() => setImages((prev) => prev.filter((i) => i.name !== img.name))}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="ledger-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              共 {rows.length} 筆交易，{readyCount} 筆待入帳
            </p>
            <Button onClick={confirm} disabled={confirming || readyCount === 0}>
              {confirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> 入帳中…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> 確認入帳（{readyCount} 筆）
                </>
              )}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">交易日期</th>
                  <th className="py-2 pr-3 font-medium">金額</th>
                  <th className="py-2 pr-3 font-medium">匯款人／摘要</th>
                  <th className="py-2 pr-3 font-medium">配對客戶</th>
                  <th className="py-2 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const fp = txnFingerprint(row.date, row.amount, row.memo);
                  const duplicate = fingerprints.has(fp);
                  return (
                    <tr key={row.key} className={cn("border-b border-border/60", (row.skip || duplicate) && "opacity-60")}>
                      <td className="py-2 pr-3">
                        <RocDateInput value={row.date ?? ""} onChange={(v) => updateRow(row.key, { date: v || null })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={row.amount || ""}
                          onChange={(e) => updateRow(row.key, { amount: Math.round(Number(e.target.value) || 0) })}
                          className="tabular w-28"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={row.memo} onChange={(e) => updateRow(row.key, { memo: e.target.value })} className="w-40" />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          aria-label="配對客戶"
                          value={duplicate || row.skip ? "__skip" : (row.customerId ?? "__skip")}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(row.key, v === "__skip" ? { skip: true, customerId: null } : { skip: false, customerId: v });
                          }}
                          disabled={duplicate}
                          className="w-52 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="__skip">略過（不入帳）</option>
                          {row.suggestion.customerId && (
                            <option value={row.suggestion.customerId}>
                              建議：{customersWithOpen.find(([id]) => id === row.suggestion.customerId)?.[1] ?? ""}
                            </option>
                          )}
                          {customersWithOpen
                            .filter(([id]) => id !== row.suggestion.customerId)
                            .map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="py-2 text-xs">
                        {duplicate ? (
                          <span className="text-warning">已入帳過（重複）</span>
                        ) : (
                          <span className={cn(row.suggestion.kind === "none" || row.suggestion.kind === "ambiguous" ? "text-warning" : "text-muted-foreground")}>
                            {row.suggestion.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            同一客戶有多筆未收帳款時，金額會由舊到新逐筆填入；多付的部分會記為溢收，下一期自動折抵。入帳金額合計：
            {formatTWD(rows.filter((r) => !r.skip && r.customerId).reduce((sum, r) => sum + r.amount, 0))}
          </p>
        </section>
      )}
    </div>
  );
}
