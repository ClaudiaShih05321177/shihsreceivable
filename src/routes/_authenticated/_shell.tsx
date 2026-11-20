import { createFileRoute, Navigate, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { canSeePage } from "@/lib/permissions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { AppShell, PendingApproval } from "@/components/ar/app-shell";
import { meQuery } from "@/lib/queries";
import { ForcePasswordChange } from "@/components/ar/force-password-change";
import { useCompany } from "@/hooks/use-company";
import { FACTORY_COMPANY } from "@/lib/factory";

export const Route = createFileRoute("/_authenticated/_shell")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ShellLayout,
});

function ShellLayout() {
  const { data: me } = useSuspenseQuery(meQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [company] = useCompany();
  // 勤豐模式下進系統，直接開啟工廠登記進度。
  useEffect(() => {
    if (me.isAdmin && company === FACTORY_COMPANY && pathname === "/dashboard") {
      navigate({ to: "/factory", replace: true });
    }
  }, [me.isAdmin, company, pathname, navigate]);
  if (me.mustChangePassword) return <ForcePasswordChange />;
  if (!me.isMember) return <PendingApproval email={me.email} />;
  if (!canSeePage(me.isAdmin, pathname, me.staffCode)) return <Navigate to="/invoices" replace />;
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  );
}
