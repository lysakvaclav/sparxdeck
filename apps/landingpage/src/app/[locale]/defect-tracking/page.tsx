import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { getDictionary, locales, shortLabel, type Locale } from "@/i18n/dictionary";
import { FooterThemeToggle } from "@/components/layout/FooterThemeToggle";
import { SITE } from "@/config/site";

const footerLocales = locales;

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      strokeWidth="1"
      stroke="currentColor"
      className={`size-6 text-[var(--color-text-strong)] ${className}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  );
}

function CornerPlusIcons() {
  return (
    <>
      <PlusIcon className="absolute -top-3 -left-3" />
      <PlusIcon className="absolute -top-3 -right-3" />
      <PlusIcon className="absolute -bottom-3 -left-3" />
      <PlusIcon className="absolute -bottom-3 -right-3" />
    </>
  );
}

interface ProgramPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function DefectTrackingPage({
  params,
}: ProgramPageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || "cs") as Locale;
  const dict = getDictionary(locale);
  const content = dict.pages.defectTracking;

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-[var(--background)] via-[var(--background)] to-transparent md:h-64" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 pb-16 pt-10 md:px-8 lg:px-12 md:pt-12 lg:pt-12">
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            aria-label={dict.common.backToHome}
            className="button-font btn btn-compact btn-square btn-header normal-case"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-xs md:gap-4">
            {footerLocales.map((code) => (
              <Link
                key={code}
                href={`/${code}/defect-tracking`}
                className="button-font text-xs md:text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] underline-offset-2 hover:underline"
              >
                {shortLabel(code)}
              </Link>
            ))}
          </div>
        </div>

        <section className="mx-auto w-full max-w-3xl">
          <header className="space-y-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-text-strong)] md:text-4xl">
              {content.heading}
            </h1>
            <p className="max-w-2xl text-base text-[var(--color-text-main)] md:text-lg">
              {content.subheading}
            </p>
          </header>

          <div className="relative mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm md:p-8">
            <ProgressiveBlur
              position="top"
              backgroundColor="var(--color-card)"
              height="120px"
              blurAmount="10px"
            />
            <ProgressiveBlur
              position="bottom"
              backgroundColor="var(--color-card)"
              height="120px"
              blurAmount="10px"
            />
            <CornerPlusIcons />
            <div className="relative z-10 space-y-4 text-sm leading-relaxed text-[var(--color-text-main)] md:text-base">
              {content.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--background)]">
        <div className="mx-auto max-w-6xl px-6 py-8 md:px-8 lg:px-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
              <p>
                © {new Date().getFullYear()} {SITE.name}. {dict.footer.allRightsReserved}
              </p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <Link
                  href={`/${locale}/terms-of-use`}
                  className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
                >
                  {dict.footer.termsOfService}
                </Link>
                <Link
                  href={`/${locale}/privacy-policy`}
                  className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
                >
                  {dict.footer.privacyPolicy}
                </Link>
                <Link
                  href={`/${locale}/cookies`}
                  className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
                >
                  {dict.footer.cookiesSettings}
                </Link>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <FooterThemeToggle />
              <div className="mt-2 flex flex-wrap gap-2">
                {SITE.social.linkedin && (
                  <a
                    href={SITE.social.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button-font flex items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-primary-soft)]"
                  >
                    LinkedIn
                  </a>
                )}
                {SITE.social.x && (
                  <a
                    href={SITE.social.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button-font flex items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-primary-soft)]"
                  >
                    X
                  </a>
                )}
                <a
                  href={`mailto:${SITE.email}`}
                  className="button-font inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] underline-offset-2 hover:underline"
                >
                  {SITE.email}
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
