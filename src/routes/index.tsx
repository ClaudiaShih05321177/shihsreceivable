import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BellRing, BarChart3, CalendarClock, Users } from "lucide-react";
import { useEffect } from "react";

import { BrandMark } from "@/components/ar/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "帳房 · 團隊應收帳款管理" },
      { name: "description", content: "記錄帳款與到期日、付款日期，自動逾期提醒，並以報表掌握收款狀況。" },
      { property: "og:title", content: "帳房 · 團隊應收帳款管理" },
      { property: "og:description", content: "記錄帳款與到期日、付款日期，自動逾期提醒，並以報表掌握收款狀況。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: CalendarClock, title: "到期與付款日期", body: "每筆帳款的開立、到期、收款日一目了然。" },
  { icon: BellRing, title: "逾期提醒", body: "逾期與七日內到期的帳款自動標示。" },
  { icon: Users, title: "客戶名冊", body: "統編、聯絡人與未收餘額集中管理。" },
  { icon: BarChart3, title: "統計報表", body: "月度開立與收款趨勢、帳齡分析。" },
];

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-ink-gradient text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark />
        <Button asChild variant="outline" className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Link to="/auth">登入</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-28">
        <div className="max-w-2xl animate-rise">
          <p className="text-sm tracking-[0.3em] text-sidebar-primary">應收帳款管理</p>
          <h1 className="mt-4 text-5xl font-black leading-tight md:text-6xl">
            誰欠多少、何時到期，
            <br />
            一本帳全掌握。
          </h1>
          <p className="mt-6 max-w-lg text-lg text-sidebar-foreground/70">
            為團隊打造的應收帳款簿。記錄每筆帳款與收款日期，逾期自動提醒。
          </p>
          <Button asChild size="lg" className="mt-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Link to="/auth">開始使用</Link>
          </Button>
        </div>
        <div className="mt-24 grid gap-px overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="bg-sidebar p-6">
              <f.icon className="size-5 text-sidebar-primary" />
              <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm text-sidebar-foreground/65">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
