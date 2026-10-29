"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { TextLogo } from "@/components/ui/text-logo";
import { TextScramble } from "@/components/ui/text-scramble";
import type { HeaderDictionary, Locale } from "@/i18n/dictionary";
import { SITE } from "@/config/site";

interface HeaderProps {
  locale: Locale;
  dict: HeaderDictionary;
}

/** A small heading in a menu that scrambles into place each time the menu opens. */
function MenuHeading({ children, open }: { children: string; open: boolean }) {
  return (
    <TextScramble as="p" duration={0.4} trigger={open} className="text-xs font-medium text-muted">
      {children}
    </TextScramble>
  );
}

/**
 * The site's header: a floating, rounded, see-through bar with the logo, the
 * Company menu, the sign-in, demo and sign-up buttons and the language. It
 * gets its frame once the page scrolls, and a denser one while a menu is open.
 */
export function Header({ locale, dict }: HeaderProps) {
  const [companyOpen, setCompanyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!companyOpen && !mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCompanyOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [companyOpen, mobileOpen]);

  // A click right after the pointer opened the menu is the same intent: it stays open.
  const hoveredAt = useRef(0);

  const groups = [
    {
      heading: dict.company,
      links: [
        { href: `/${locale}/mission`, label: dict.mission },
        { href: `/${locale}/about`, label: SITE.name },
        { href: `/${locale}/team`, label: dict.team },
        { href: `/${locale}/news`, label: dict.newsroom },
      ],
    },
    { heading: dict.workWithUs, links: [{ href: `/${locale}/careers`, label: dict.careers }] },
  ];
  const social = [
    { href: SITE.social.linkedin, label: "LinkedIn" },
    { href: SITE.social.x, label: "X" },
  ].flatMap((item) => (item.href ? [{ href: item.href, label: item.label }] : []));

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-[96rem] px-2 pt-2 md:px-4 md:pt-3 lg:px-6">
        <div
          onMouseLeave={() => setCompanyOpen(false)}
          className={`rounded-2xl border backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,background-color,box-shadow] duration-300 ${
            companyOpen || mobileOpen
              ? "border-line/80 bg-background/90 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.35)]"
              : scrolled
                ? "border-line/80 bg-background/55 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]"
                : "border-transparent bg-background/20"
          }`}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
            <div className="flex items-center gap-6">
              <a href={`/${locale}`} className="flex min-h-11 items-center text-strong" aria-label={SITE.name}>
                {/* The narrowest phones get only the mark, so the menu still fits beside it. */}
                <TextLogo className="h-[18px] max-[374px]:aspect-square sm:h-6" />
              </a>
              <nav className="hidden items-center lg:flex" aria-label={SITE.name}>
                <button
                  type="button"
                  aria-expanded={companyOpen}
                  aria-controls="header-company"
                  onClick={(event) => {
                    const justHovered = event.timeStamp - hoveredAt.current < 400;
                    setCompanyOpen((open) => !open || justHovered);
                  }}
                  onMouseEnter={(event) => {
                    if (companyOpen) return;
                    hoveredAt.current = event.timeStamp;
                    setCompanyOpen(true);
                  }}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${
                    companyOpen ? "text-strong" : "text-muted hover:text-strong"
                  }`}
                >
                  {dict.company}
                  <span aria-hidden className="w-2.5 text-center text-base leading-none">
                    {companyOpen ? "−" : "+"}
                  </span>
                </button>
              </nav>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <a href={SITE.loginUrl} className="btn btn-compact btn-header button-font">
                {dict.signIn}
              </a>
              <a href={SITE.bookingUrl} className="btn btn-compact btn-header button-font">
                {dict.bookDemo}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
              <a href={SITE.signupUrl} className="btn btn-compact btn-header btn-filled button-font">
                {dict.getStarted}
              </a>
              <LanguageSwitcher locale={locale} />
            </div>

            <div className="flex items-center gap-1.5 lg:hidden">
              <LanguageSwitcher locale={locale} />
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-strong"
                aria-label={dict.company}
                aria-expanded={mobileOpen}
                aria-controls="header-mobile"
              >
                {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>

          {/* The Company menu on a computer: it unfolds under the bar. */}
          <div
            id="header-company"
            inert={!companyOpen}
            className={`hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-out lg:block ${
              companyOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="mx-6 grid grid-cols-[1.2fr_1fr_1fr] gap-8 border-t border-line pb-6 pt-5">
              <div className="space-y-3">
                <MenuHeading open={companyOpen}>{dict.megaContactLabel}</MenuHeading>
                <a href={`mailto:${SITE.email}`} className="block text-sm text-strong hover:underline">
                  {SITE.email}
                </a>
                {social.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {social.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-compact btn-header button-font"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {groups.map((group) => (
                <div key={group.heading} className="space-y-3">
                  <MenuHeading open={companyOpen}>{group.heading}</MenuHeading>
                  <ul className="space-y-1">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="inline-flex items-center gap-1.5 py-1 text-sm text-main transition-[color,transform] hover:translate-x-0.5 hover:text-strong rtl:hover:-translate-x-0.5"
                        >
                          <span aria-hidden className="text-muted">
                            +
                          </span>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Phones and tablets */}
          {mobileOpen && (
            <div
              id="header-mobile"
              className="mx-4 max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-line pb-5 pt-4 lg:hidden"
            >
              {groups.map((group) => (
                <div key={group.heading} className="mb-5">
                  <MenuHeading open={mobileOpen}>{group.heading}</MenuHeading>
                  <ul className="mt-1">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="flex min-h-11 items-center text-base text-strong">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mb-5">
                <MenuHeading open={mobileOpen}>{dict.megaContactLabel}</MenuHeading>
                <a href={`mailto:${SITE.email}`} className="flex min-h-11 items-center text-base text-strong">
                  {SITE.email}
                </a>
              </div>
              <div className="grid gap-2">
                <a href={SITE.signupUrl} className="button button-primary">
                  {dict.getStarted}
                </a>
                <a href={SITE.loginUrl} className="button button-secondary">
                  {dict.signIn}
                </a>
                <a href={SITE.bookingUrl} className="button button-secondary">
                  {dict.bookDemo}
                  <ArrowUpRight aria-hidden />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
