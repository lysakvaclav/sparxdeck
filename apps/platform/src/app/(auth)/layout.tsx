import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/app/brand-mark";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { TextLogo } from "@/components/app/text-logo";
import { MARKETING_URL, legalUrl } from "@/lib/site";

/** Faint rings around the form, as on the landing page; they fade out at the middle and edges. */
function Rings() {
  return (
    <svg
      viewBox="0 0 1000 1000"
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 hidden size-[68rem] -translate-x-1/2 -translate-y-1/2 text-muted-foreground [mask-image:radial-gradient(circle,transparent_30%,#000_46%,#000_58%,transparent_72%)] md:block"
    >
      <circle cx="500" cy="500" r="330" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="5 9" />
      <circle cx="500" cy="500" r="400" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="500" cy="500" r="470" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeDasharray="2 8" />
    </svg>
  );
}

/**
 * The sign-in screens in the landing page's look: one centred column with the
 * mark, the page's heading and form, pill buttons; the logo leads to the website.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <div className="brand relative isolate flex min-h-dvh flex-col overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
      {/* A soft light from the top. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,color-mix(in_srgb,var(--foreground)_6%,transparent),transparent)]"
      />
      <Rings />

      <header className="flex items-center justify-between">
        <a
          href={`${MARKETING_URL}/${locale}`}
          aria-label="SparxDeck"
          className="flex min-h-11 items-center text-foreground"
        >
          <TextLogo className="h-6" />
        </a>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-background shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)]">
              <BrandMark className="size-7" />
            </span>
          </div>
          {children}
        </div>
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
