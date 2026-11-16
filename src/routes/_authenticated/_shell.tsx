import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { canSeePage } from "@/lib/permissions";
import { useSuspenseQuery } from "@tanstack/react-query";

import { AppShell, PendingApproval } from "@/components/ar/app-shell";
import { meQuery } from "@/lib/queries";
import { ForcePasswordChange } from "@/components/ar/force-password-change";

export const Route = createFileRoute("/_authenticated/_shell")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ShellLayout,
});

function ShellLayout() {
  const { data: me } = useSuspenseQuery(meQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (me.mustChangePassword) return <ForcePasswordChange />;
  if (!me.isMember) return <PendingApproval email={me.email} />;
  if (!canSeePage(me.isAdmin, pathname, me.staffCode)) return <Navigate to="/invoices" replace />;
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  );
}
