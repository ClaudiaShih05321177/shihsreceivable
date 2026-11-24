import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "member";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("只有管理員可以執行此操作");
}

function checkPassword(pw: string) {
  if (typeof pw !== "string" || pw.length < 8) throw new Error("初始密碼至少 8 個字元");
}

/** 管理員建立成員帳號：直接啟用、指派身分，並要求首次登入變更密碼。 */
export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { name: string; email: string; password: string; role: Role }) => {
    const email = String(d.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email 格式不正確");
    checkPassword(d.password);
    if (d.role !== "admin" && d.role !== "member") throw new Error("身分不正確");
    return { name: String(d.name ?? "").trim().slice(0, 50), email, password: d.password, role: d.role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.name || undefined },
      app_metadata: { must_change_password: true },
    });
    if (error || !created.user) {
      const msg = error?.message ?? "";
      throw new Error(/already|registered|exists/i.test(msg) ? "此 Email 已有帳號" : "建立帳號失敗");
    }
    const uid = created.user.id;
    if (data.name) await supabaseAdmin.from("profiles").update({ display_name: data.name }).eq("id", uid);
    // 觸發器可能已給首位使用者角色；確保身分正確
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const roles = data.role === "admin" ? ["admin", "member"] : ["member"];
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert(roles.map((role) => ({ user_id: uid, role: role as Role })));
    if (rErr) throw new Error("指派身分失敗");
    return { id: uid };
  });

/** 管理員重設成員密碼，並要求下次登入變更。 */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; password: string }) => {
    checkPassword(d.password);
    return { userId: String(d.userId), password: d.password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("無法重設自己的密碼");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      app_metadata: { must_change_password: true },
    });
    if (error) throw new Error("重設密碼失敗");
    return { ok: true };
  });

/** 使用者變更密碼後清除「需變更密碼」標記。 */
export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { must_change_password: false },
    });
    if (error) throw new Error("更新失敗");
    return { ok: true };
  });

/** 首次登入（必須變更密碼）時由伺服端設定新密碼並清除標記。 */
export const changeInitialPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { password: string }) => {
    if (typeof d?.password !== "string" || d.password.length < 8) throw new Error("新密碼至少 8 個字元");
    return { password: d.password };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: gErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (gErr || !u.user) throw new Error("找不到帳號");
    if (!u.user.app_metadata?.["must_change_password"]) throw new Error("此帳號不需要變更初始密碼");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
      app_metadata: { must_change_password: false },
    });
    if (error) {
      const m = error.message ?? "";
      if (/weak|pwned|leaked|compromised/i.test(m)) throw new Error("此密碼太常見或曾外洩，請換一組");
      if (/same|different/i.test(m)) throw new Error("新密碼不可與初始密碼相同");
      throw new Error("變更失敗");
    }
    return { email: u.user.email ?? "" };
  });
