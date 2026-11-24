import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Landmark, Stamp, FileText, FileCheck2, LogOut, Users, UserCog, BadgeDollarSign, Factory, Wallet, ArrowLeftRight } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ar/brand";
import { ChangePasswordDialog } from "@/components/ar/change-password-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invoicesQuery } from "@/lib/queries";
import { invoiceStatus } from "@/lib/receivables";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/use-company";
import { COMPANIES, FACTORY_COMPANY } from "@/lib/factory";
import { canManageFactoryProgress, canSeePage, canUseFactoryCustomers } from "@/lib/permissions";
import { APP_VERSION, buildTimeLabel } from "@/lib/version";

type Me = { displayName: string; email: string; isAdmin: boolean; staffCode?: string | null };

const nav = [
  { to: "/dashboard", label: "總覽", icon: BarChart3 },
  { to: "/invoices", label: "應收帳款", icon: FileText },
  { to: "/reconcile", label: "銀行核對", icon: ArrowLeftRight },
  { to: "/taxes", label: "稅額明細", icon: Landmark },
  { to: "/audits", label: "財稅簽", icon: Stamp },
  { to: "/filings", label: "工商進度", icon: FileCheck2 },
  { to: "/customers", label: "客戶資料", icon: Users },
  { to: "/team", label: "團隊成員", icon: UserCog },
  { to: "/bonuses", label: "會計專員獎金", icon: BadgeDollarSign },
] as const;

const factoryProgress = { to: "/factory", label: "工廠登記進度", icon: Factory } as const;
const factoryReceivables = { to: "/factory-receivables", label: "勤豐應收帳款", icon: Wallet } as const;
const factoryCustomers = { to: "/factory-customers", label: "勤豐客戶資料", icon: Users } as const;

const factoryNav = [
  factoryProgress,
  factoryReceivables,
  factoryCustomers,
  { to: "/team", label: "團隊成員", icon: UserCog },
] as const;

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: invoices } = useQuery(invoicesQuery);
  const [company, setCompany] = useCompany();
  const items = me.isAdmin ? (company === FACTORY_COMPANY ? factoryNav : nav) : canManageFactoryProgress(me) ? [...nav, factoryProgress, factoryCustomers] : canUseFactoryCustomers(me) ? [...nav, factoryCustomers] : nav;
  const overdue = (invoices ?? []).filter((i) => invoiceStatus(i) === "overdue").length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="print:hidden bg-ink-gradient text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between px-5 py-4 md:py-6">
          <BrandMark />
          <div className="flex md:hidden"><ChangePasswordDialog email={me.email} compact />
          <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden" aria-label="登出">
            <LogOut />
          </Button></div>
        </div>
        {me.isAdmin && <div className="px-3 pb-3">
          <select
            aria-label="切換公司"
            value={company}
            onChange={(e) => {
              const c = e.target.value as (typeof COMPANIES)[number];
              setCompany(c);
              navigate({ to: c === FACTORY_COMPANY ? "/factory" : "/dashboard" });
            }}
            className="w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-sidebar-accent-foreground"
          >
            {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>}
        <nav className="flex flex-wrap gap-1 px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {(items as readonly { to: string; label: string; icon: typeof Factory }[]).filter((item) => canSeePage(me.isAdmin, item.to, me.staffCode)).map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to as "/dashboard"}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("size-4", active && "text-sidebar-primary")} />
                {item.label}
                {item.to === "/invoices" && overdue > 0 && (
                  <span className="ml-auto rounded-full bg-overdue px-1.5 text-[11px] font-semibold text-overdue-foreground tabular">{overdue}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-sidebar-border px-5 py-4 md:block">
          <p className="truncate text-sm font-medium">{me.displayName}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{me.isAdmin ? "管理員" : "使用者"} · {me.email}</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary">
            <LogOut className="size-3.5" /> 登出
          </Button>
          <ChangePasswordDialog email={me.email} />
          <p className="mt-3 text-[11px] leading-relaxed text-sidebar-foreground/50">
            版本 v{APP_VERSION}
            <br />
            更新 {buildTimeLabel()}
          </p>
        </div>
        <p className="px-5 pb-3 text-[11px] text-sidebar-foreground/50 md:hidden">
          版本 v{APP_VERSION} · 更新 {buildTimeLabel()}
        </p>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function PendingApproval({ email }: { email: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="ledger-card max-w-md p-8 text-center animate-rise">
        <span className="seal mx-auto grid size-20 place-items-center font-display text-xl font-black text-warning">待核</span>
        <h1 className="mt-6 text-2xl font-bold">等待管理員核准</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          您的帳號 <span className="font-medium text-foreground">{email}</span> 已建立。請通知管理員到「團隊成員」頁面核准後，即可查看與編輯帳款。
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          登出
        </Button>
      </div>
    </div>
  );
}
