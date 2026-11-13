import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/ar/page-header";
import { AddMemberDialog, ResetPasswordDialog } from "@/components/ar/member-dialogs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, teamQuery, type AppRole } from "@/lib/queries";
import { formatDate } from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/_shell/team")({
  head: () => ({
    meta: [
      { title: "團隊成員 · 帳房" },
      { name: "description", content: "管理可使用應收帳款系統的團隊成員，核准新成員加入。" },
      { property: "og:title", content: "團隊成員 · 帳房" },
      { property: "og:description", content: "管理可使用應收帳款系統的團隊成員，核准新成員加入。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.canManageTeam) await context.queryClient.ensureQueryData(teamQuery);
  },
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.canManageTeam) return <PageHeader title="無權限存取" description="只有管理員可以管理團隊成員。" />;
  return <TeamManagement />;
}

function TeamManagement() {
  const { data: team } = useSuspenseQuery(teamQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      if (!me.canManageTeam) throw new Error("只有管理員可以管理權限");
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已更新權限");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role?: AppRole }) => {
      if (!me.canManageTeam) throw new Error("只有管理員可以管理權限");
      let q = supabase.from("user_roles").delete().eq("user_id", userId);
      if (role) q = q.eq("role", role);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已更新權限");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const demote = useMutation({
    mutationFn: async (userId: string) => {
      if (!me.canManageTeam) throw new Error("只有管理員可以管理權限");
      const row = team.find((m) => m.id === userId);
      if (row && !row.roles.includes("member")) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
        if (error) throw error;
      }
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已更新權限");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失敗"),
  });

  const pending = team.filter((m) => m.roles.length === 0);
  const members = team.filter((m) => m.roles.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="權限"
        title="團隊成員"
        description={me.isAdmin ? "由管理員建立成員帳號，同仁第一次登入時需變更密碼。" : "只有管理員可以新增或移除成員。"}
      />
      {me.isAdmin && <div className="mb-6 flex justify-end"><AddMemberDialog /></div>}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">待核准 <span className="tabular text-sm text-muted-foreground">{pending.length}</span></h2>
          <div className="ledger-card divide-y divide-border border-warning/50">
            {pending.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.display_name}</p>
                  <p className="text-xs text-muted-foreground">{m.email} · 註冊於 {formatDate(m.created_at.slice(0, 10))}</p>
                </div>
                {me.isAdmin && (
                  <Button size="sm" onClick={() => grant.mutate({ userId: m.id, role: "member" })} disabled={grant.isPending}>
                    核准加入
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-bold">成員 <span className="tabular text-sm text-muted-foreground">{members.length}</span></h2>
        <div className="ledger-card divide-y divide-border">
          {members.map((m) => {
            const isAdmin = m.roles.includes("admin");
            const isSelf = m.id === me.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.display_name}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">（您）</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                {me.isAdmin ? (
                  <StaffCodeInput userId={m.id} value={m.staff_code ?? ""} />
                ) : m.staff_code ? <span className="text-xs">專員代號 {m.staff_code}</span> : null}
                <span className={`rounded-full px-2.5 py-0.5 text-xs ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {isAdmin ? "管理員" : "使用者"}
                </span>
                {me.isAdmin && !isSelf && (
                  <div className="flex gap-1">
                    <ResetPasswordDialog userId={m.id} name={m.display_name ?? m.email ?? ""} />
                    {isAdmin ? (
                      <Button size="sm" variant="ghost" onClick={() => demote.mutate(m.id)}>取消管理員</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => grant.mutate({ userId: m.id, role: "admin" })}>設為管理員</Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`移除 ${m.display_name} 的使用權限？`)) revoke.mutate({ userId: m.id });
                      }}
                    >
                      移除
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function StaffCodeInput({ userId, value }: { userId: string; value: string }) {
  const qc = useQueryClient();
  const save = async (code: string) => {
    if (code.trim().toUpperCase() === value) return;
    const { error } = await supabase.rpc("set_staff_code", { _user_id: userId, _code: code });
    if (error) { toast.error("儲存失敗"); return; }
    toast.success("已更新專員代號");
    qc.invalidateQueries();
  };
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      專員代號
      <input
        defaultValue={value}
        maxLength={4}
        placeholder="如 AC"
        className="w-16 rounded border border-input bg-background px-2 py-1 uppercase text-foreground"
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}
