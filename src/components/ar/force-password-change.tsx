import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BrandMark } from "@/components/ar/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completePasswordChange } from "@/lib/team.functions";

export function ForcePasswordChange() {
  const qc = useQueryClient();
  const complete = useServerFn(completePasswordChange);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("新密碼至少 8 個字元"); return; }
    if (pw !== pw2) { toast.error("兩次輸入的密碼不一致"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(/different|same/i.test(error.message) ? "新密碼不可與初始密碼相同" : "變更失敗");
      await complete();
      await supabase.auth.refreshSession();
      toast.success("密碼已更新");
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "變更失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="ledger-card w-full max-w-sm space-y-4 p-6">
        <BrandMark />
        <h1 className="text-2xl font-bold">首次登入請設定新密碼</h1>
        <p className="text-sm text-muted-foreground">為了帳號安全，請先將管理員給您的初始密碼改成您自己的密碼。</p>
        <div className="space-y-1.5">
          <Label htmlFor="pw">新密碼</Label>
          <Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">再輸入一次</Label>
          <Input id="pw2" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "處理中…" : "設定新密碼"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>登出</Button>
      </form>
    </div>
  );
}
