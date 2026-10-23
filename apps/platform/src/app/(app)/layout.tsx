import type { Viewport } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { OfflineSupport } from "@/components/app/offline-support";
import { RAIL_COOKIE } from "@/components/app/nav-items";
import { requireMembership } from "@/lib/auth";

// The phone's status bar matches the app's dark top bar.
export const viewport: Viewport = { themeColor: "#1f2a37" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { membership, organization } = await requireMembership();
  const railExpanded = (await cookies()).get(RAIL_COOKIE)?.value === "1";

  return (
    <>
      <OfflineSupport userId={membership.user_id} />
      <AppShell
        organizationName={organization.name}
        userName={membership.display_name}
        userEmail={membership.email}
        railExpanded={railExpanded}
      >
        {children}
      </AppShell>
    </>
  );
}
