import type { Viewport } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { OfflineSupport } from "@/components/app/offline-support";
import { RAIL_COOKIE } from "@/components/app/nav-items";
import { requireMembership } from "@/lib/auth";

// The phone's status bar matches the white top bar (near black in dark mode).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17191d" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { membership, organization } = await requireMembership();
  // The sidebar shows labels unless the user folded it.
  const railExpanded = (await cookies()).get(RAIL_COOKIE)?.value !== "0";

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
