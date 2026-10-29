import { getLocale, getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/app/locale-toggle";
import { TextLogo } from "@/components/app/text-logo";
import { MARKETING_URL, legalUrl } from "@/lib/site";

/**
 * The sign-in screens in the landing page's look: the logo (leading to the
 * website) and the language at the top, one quiet centred column with the
 * heading and form, pill buttons, the legal links at the bottom.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <div className="brand flex min-h-dvh flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <a
          href={`${MARKETING_URL}/${locale}`}
          aria-label="SparxDeck"
          className="flex min-h-11 items-center text-foreground"
        >
          <TextLogo className="h-6" />
        </a>
        <LocaleToggle />
      </header>

      <main className="flex flex-1 items-center justify-center py-14">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>

      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex min-h-11 items-center sm:min-h-0">© {new Date().getFullYear()} SparxDeck</span>
        <a className="flex min-h-11 items-center hover:text-foreground sm:min-h-0" href={legalUrl(locale, "privacy-policy")}>
          {t("privacyPolicy")}
        </a>
        <a className="flex min-h-11 items-center hover:text-foreground sm:min-h-0" href={legalUrl(locale, "terms-of-use")}>
          {t("terms")}
        </a>
      </footer>
    </div>
  );
}
