import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { AppShell, PendingApproval } from "@/components/ar/app-shell";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_shell")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ShellLayout,
});

function ShellLayout() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isMember) return <PendingApproval email={me.email} />;
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  );
}
