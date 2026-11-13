import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { BrandMark } from "@/components/ar/brand";
import { GoogleButton } from "@/components/ar/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登入 · 應收帳款管理系統" },
      { name: "description", content: "登入，與團隊一起管理應收帳款、到期日與收款紀錄。" },
      { property: "og:title", content: "登入 · 應收帳款管理系統" },
      { property: "og:description", content: "登入，與團隊一起管理應收帳款、到期日與收款紀錄。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name || undefined } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else setSentTo(email);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg.includes("Invalid login") ? "電子郵件或密碼不正確" : msg);
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("登入失敗，請再試一次");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8">
            <BrandMark />
          </div>
          {sentTo ? (
            <div className="ledger-card p-6">
              <h1 className="text-2xl font-bold">請確認您的信箱</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                我們已寄送確認信到 <span className="font-medium text-foreground">{sentTo}</span>
                ，點擊信中連結即可完成註冊。
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => { setSentTo(null); setMode("signin"); }}>
                返回登入
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{mode === "signin" ? "登入" : "建立帳號"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin" ? "請輸入帳號密碼。" : "第一位註冊者將成為管理員，其他成員需經管理員核准。"}
              </p>

              <div className="mt-8 space-y-3">
                <GoogleButton onClick={() => social("google")} />
                <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>
                  Continue with Lovable
                </button>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />或使用電子郵件<span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">姓名</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="王小明" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">電子郵件</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">密碼</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "處理中…" : mode === "signin" ? "登入" : "註冊"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">帳號由管理員建立，如需使用請洽管理員。</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
