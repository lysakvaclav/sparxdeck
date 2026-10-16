import { getLocale, getTranslations } from "next-intl/server";
import { AuthVisual } from "@/components/app/auth-visual";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { Wordmark } from "@/components/app/wordmark";
import { legalUrl } from "@/lib/site";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <div className="brand grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-10">
        <header className="flex items-center justify-between">
          <Wordmark />
          <LanguageSwitcher />
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SparxDeck</span>
          <a className="hover:text-foreground" href={legalUrl(locale, "privacy-policy")}>
            {t("privacyPolicy")}
          </a>
          <a className="hover:text-foreground" href={legalUrl(locale, "terms-of-use")}>
            {t("terms")}
          </a>
        </footer>
      </div>

      <aside className="hidden p-3 lg:block">
        <AuthVisual tagline={t("tagline")} />
      </aside>
    </div>
  );
}
