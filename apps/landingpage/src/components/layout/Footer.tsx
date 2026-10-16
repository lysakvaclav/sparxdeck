"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { locales, shortLabel, type FooterDictionary, type Locale } from "@/i18n/dictionary";
import { FooterThemeToggle } from "@/components/layout/FooterThemeToggle";
import { SITE } from "@/config/site";

const footerLocales = locales;

export function Footer({ locale, dict }: { locale: Locale; dict: FooterDictionary }) {
  const year = new Date().getFullYear();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleClick = (code: Locale) => {
    if (!pathname) {
      router.push(`/${code}`);
      return;
    }

    const segments = pathname.split("/").filter(Boolean);
    const rest = segments.slice(1).join("/");
    const target = `/${code}` + (rest ? `/${rest}` : "");

    if (target !== pathname) {
      router.push(target);
    }
  };

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-8 lg:px-12">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Brand block */}
          <div className="space-y-4 text-xs text-[var(--color-text-muted)]">
            <p>
              © {year} {SITE.name}. {dict.allRightsReserved}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              <Link
                href={`/${locale}/terms-of-use`}
                className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
              >
                {dict.termsOfService}
              </Link>
              <Link
                href={`/${locale}/privacy-policy`}
                className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
              >
                {dict.privacyPolicy}
              </Link>
              <Link
                href={`/${locale}/cookies`}
                className="text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
              >
                {dict.cookiesSettings}
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {footerLocales.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLocaleClick(code)}
                  className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text-strong)] hover:underline"
                >
                  {shortLabel(code)}
                </button>
              ))}
            </div>
            <FooterThemeToggle />
            <div className="mt-4 space-y-2">
              {SITE.social.linkedin && (
                <a
                  href={SITE.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-font flex w-full items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-primary-soft)]"
                >
                  LinkedIn
                </a>
              )}
              {SITE.social.x && (
                <a
                  href={SITE.social.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-font flex w-full items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-primary-soft)]"
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

          {/* Company */}
          <div className="space-y-3 text-sm">
            <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-[var(--color-text-strong)]">
              {dict.companyHeading}
            </h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href={`/${locale}/mission`}
                  className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                >
                  {dict.mission}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/team`}
                  className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                >
                  {dict.team}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/news`}
                  className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                >
                  {dict.newsroom}
                </Link>
              </li>
            </ul>
          </div>

          {/* Work with us */}
          <div className="space-y-3 text-sm">
            <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-[var(--color-text-strong)]">
              {dict.workWithUs}
            </h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href={`/${locale}/careers`}
                  className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                >
                  {dict.careers}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
