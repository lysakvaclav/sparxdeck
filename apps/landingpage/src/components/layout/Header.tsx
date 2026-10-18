"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { TextLogo } from "@/components/ui/text-logo";
import { TextScramble } from "@/components/ui/text-scramble";
import type { HeaderDictionary, Locale } from "@/i18n/dictionary";
import { SITE } from "@/config/site";

interface HeaderProps {
  locale: Locale;
  dict: HeaderDictionary;
}

export function Header({ locale, dict }: HeaderProps) {
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <div className="mx-auto max-w-[96rem] px-4 pt-2 md:px-6 md:pt-3 lg:px-8 lg:pt-4">
        <div
          className="rounded-lg bg-background/60 shadow-sm backdrop-blur-2xl backdrop-saturate-150"
          onMouseLeave={() => setIsCompanyOpen(false)}
        >
          <div className="flex h-14 items-center justify-between gap-2 px-5 md:h-16 md:px-8 lg:px-10">
            <a
              href={`/${locale}#hero`}
              className="flex items-center text-[var(--color-text-strong)]"
              aria-label={`${SITE.name} home`}
            >
              {/* The narrowest phones get only the mark, so the menu still fits beside it. */}
              <TextLogo className="h-[17px] max-[374px]:aspect-square sm:h-6 md:h-7" />
            </a>

            <nav className="hidden items-center gap-4 md:flex">
              <button
                type="button"
                onMouseEnter={() => setIsCompanyOpen(true)}
                onClick={() => setIsCompanyOpen((open) => !open)}
                onFocus={() => setIsCompanyOpen(true)}
                className={`nav-link flex items-center gap-1 text-sm font-medium ${
                  isCompanyOpen
                    ? "text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                <span>{dict.company}</span>
                <span className="text-lg leading-none transition-transform duration-200">
                  {isCompanyOpen ? "−" : "+"}
                </span>
              </button>

              <div className="ml-2 flex items-center gap-3">
                <a
                  href={SITE.loginUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case"
                >
                  <span>{dict.signIn}</span>
                </a>
                <a
                  href={SITE.signupUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case"
                >
                  <span>{dict.getStarted}</span>
                </a>
                <a
                  href={SITE.bookingUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case"
                >
                  <span>{dict.bookDemo}</span>
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <LanguageSwitcher locale={locale} />
            </nav>

            {/* Mobile header: company button + language switcher + hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setIsCompanyOpen((open) => !open)}
                className={`nav-link flex items-center gap-1 text-sm font-medium ${
                  isCompanyOpen
                    ? "text-[var(--color-text-strong)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
                }`}
              >
                <span>{dict.company}</span>
                <span className="text-lg leading-none transition-transform duration-200">
                  {isCompanyOpen ? "−" : "+"}
                </span>
              </button>

              <LanguageSwitcher locale={locale} />

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="button-font flex h-8 w-8 items-center justify-center text-[var(--color-text-strong)]"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="h-4 w-4" aria-hidden />
                ) : (
                  <Menu className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {/* Mobile navigation drawer */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-[var(--color-border)] px-5 pb-4 pt-3">
              <div className="flex flex-col gap-2">
                <a
                  href={SITE.loginUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case justify-between"
                >
                  <span>{dict.signIn}</span>
                </a>
                <a
                  href={SITE.signupUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case justify-between"
                >
                  <span>{dict.getStarted}</span>
                </a>
                <a
                  href={SITE.bookingUrl}
                  className="button-font btn btn-compact btn-square btn-header normal-case justify-between"
                >
                  <span>{dict.bookDemo}</span>
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          )}

          <div
            className={
              "overflow-hidden transition-all duration-300 ease-in-out " +
              (isCompanyOpen
                ? "max-h-[480px] opacity-100"
                : "max-h-0 opacity-0 pointer-events-none")
            }
            aria-hidden={!isCompanyOpen}
          >
            <div className="px-5 pb-5 pt-4 md:px-8 md:pb-6 md:pt-5 lg:px-10">
              <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4 text-sm text-[var(--color-text-main)]">
                  <div>
                    <TextScramble
                      as="p"
                      duration={0.4}
                      className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                      trigger={isCompanyOpen}
                    >
                      {dict.megaContactLabel}
                    </TextScramble>
                    <a
                      href={`mailto:${SITE.email}`}
                      className="mt-1 inline-block text-sm text-[var(--color-text-strong)] hover:underline"
                    >
                      {SITE.email}
                    </a>
                  </div>
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
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <TextScramble
                    as="p"
                    duration={0.4}
                    className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                    trigger={isCompanyOpen}
                  >
                    {dict.company}
                  </TextScramble>
                  <ul className="space-y-1">
                    <li>
                      <a
                        href={`/${locale}/mission`}
                        className="flex items-center gap-1 text-[var(--color-text-strong)] hover:translate-x-0.5 transition-transform"
                      >
                        <span className="text-base leading-none">+</span>
                        <span>{dict.mission}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href={`/${locale}/team`}
                        className="flex items-center gap-1 text-[var(--color-text-strong)] hover:translate-x-0.5 transition-transform"
                      >
                        <span className="text-base leading-none">+</span>
                        <span>{dict.team}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href={`/${locale}/news`}
                        className="flex items-center gap-1 text-[var(--color-text-strong)] hover:translate-x-0.5 transition-transform"
                      >
                        <span className="text-base leading-none">+</span>
                        <span>{dict.newsroom}</span>
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 text-sm">
                  <TextScramble
                    as="p"
                    duration={0.4}
                    className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
                    trigger={isCompanyOpen}
                  >
                    {dict.workWithUs}
                  </TextScramble>
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href={`/${locale}/careers`}
                        className="flex items-center gap-1 text-[var(--color-text-strong)] hover:translate-x-0.5 transition-transform"
                      >
                        <span className="text-base leading-none">+</span>
                        <span>{dict.careers}</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
