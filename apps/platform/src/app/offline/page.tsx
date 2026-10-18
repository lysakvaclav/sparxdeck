import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OfflineIcon } from "@/components/icons";
import { OfflineList } from "./offline-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("metaTitle") };
}

/**
 * Shown by the service worker for any page the phone can't load without a
 * signal: the inspections saved in this phone, which open without one. It reads
 * only the phone's own data, so it needs no sign-in.
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-[50px] shrink-0 items-center gap-2.5 bg-[#293742] px-[15px] text-white">
        <span className="text-ui-lg font-semibold">SparxDeck</span>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-[15px] p-2.5 sm:p-5">
        <div className="flex items-start gap-2.5">
          <OfflineIcon size={20} className="mt-0.5 shrink-0 text-warning-text" />
          <div className="space-y-1">
            <h1 className="text-ui-lg font-semibold">{t("title")}</h1>
            <p className="text-ui text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        <OfflineList />
      </main>
    </div>
  );
}
