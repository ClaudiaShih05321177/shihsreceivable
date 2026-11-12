import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, Money } from "@/components/ar/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bonusesQuery, meQuery } from "@/lib/queries";
import { bonusGroups } from "@/lib/bonuses";
import { rocYear, bookkeepingCollectionMonth, suggestPeriod } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/bonuses")({
  head: () => ({ meta: [
    { title: "記帳員獎金 · 帳房" },
    { name: "description", content: "管理員專用的每期記帳員獎金與客戶費用明細。" },
    { property: "og:title", content: "記帳員獎金 · 帳房" },
    { property: "og:description", content: "每期記帳費合計與記帳員獎金。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.isAdmin) await context.queryClient.fetchQuery(bonusesQuery);
  },
  component: BonusPage,
});
function BonusPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isAdmin) return <PageHeader title="無權限存取" description="只有管理員可以查看記帳員獎金。" />;
  return <BonusLedger />;
}
function BonusLedger() {
  const { data } = useSuspenseQuery(bonusesQuery);
  const now = new Date();
  const initialMonth = bookkeepingCollectionMonth(now.getMonth() + 1);
  const [year, setYear] = useState(String(rocYear(now.getFullYear() + (initialMonth === 13 ? 1 : 0))));
  const [month, setMonth] = useState(String(initialMonth === 13 ? 1 : initialMonth));
  const [staff, setStaff] = useState("all");
  const groups = bonusGroups(data, Number(year) + 1911, Number(month));
  const selected = groups.filter((g) => staff === "all" || g.code === staff);
  return <div className="space-y-6">
    <PageHeader title="記帳員獎金" />
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1"><Label htmlFor="bonus-year">年度（民國）</Label><Input id="bonus-year" className="w-28" type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
      <div className="space-y-1"><Label>收款月份</Label><Select value={month} onValueChange={setMonth}><SelectTrigger className="w-44" aria-label="獎金收款月份"><SelectValue /></SelectTrigger><SelectContent>{[1,3,5,7,9,11].map((m) => <SelectItem key={m} value={String(m)}>{m}月 · {suggestPeriod(m)}期</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>記帳員</Label><Select value={staff} onValueChange={setStaff}><SelectTrigger className="w-40" aria-label="記帳員"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部記帳員</SelectItem>{groups.map((g) => <SelectItem key={g.code} value={g.code}>{g.code}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="ledger-card p-4"><p className="text-sm text-muted-foreground">記帳費合計</p><Money value={selected.reduce((s,g) => s+g.total,0)} className="text-2xl font-semibold" /></div>
      <div className="ledger-card p-4"><p className="text-sm text-muted-foreground">獎金合計</p><Money value={selected.reduce((s,g) => s+g.bonus,0)} className="text-2xl font-semibold text-primary" /></div>
    </div>
    <p className="text-sm text-muted-foreground">獎金＝（每位記帳員記帳費合計－NT$ 200,000）× 30%；未超過門檻為零。</p>
    {selected.map((g) => <section key={g.code} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl">{g.code}</h2><p className="text-sm">記帳費 <Money value={g.total} />　獎金 <Money value={g.bonus} className="font-semibold text-primary" /></p></div>
      <div className="overflow-x-auto border border-border rounded-md"><Table><TableHeader><TableRow><TableHead>客戶名稱</TableHead><TableHead className="text-right">記帳費</TableHead><TableHead className="text-right">結算費</TableHead><TableHead className="text-right">年度加收</TableHead><TableHead className="text-right">應收帳款</TableHead><TableHead className="text-right">應收餘額</TableHead><TableHead className="text-right">營業稅</TableHead></TableRow></TableHeader><TableBody>
        {g.rows.map((r) => <TableRow key={r.id}><TableCell className="whitespace-nowrap">{r.customer_code} · {r.customer_name}</TableCell>{[Number(r.items?.["記帳費"])||0,Number(r.items?.["股利2代"])||0,Number(r.items?.["年度加收"])||0,Number(r.amount),Math.max(0,Number(r.amount)-Number(r.paid_amount)),Number(r.items?.["營業稅"])||0].map((amount,i) => <TableCell key={i} className="text-right whitespace-nowrap"><Money value={amount} /></TableCell>)}</TableRow>)}
        {!g.rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">本期無帳款</TableCell></TableRow>}
      </TableBody></Table></div>
    </section>)}
  </div>;
}