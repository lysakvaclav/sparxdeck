"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { TextLogo } from "@/components/ui/text-logo";
import type { HeaderDictionary, Locale } from "@/i18n/dictionary";
import { SITE } from "@/config/site";

export type ProductLink = { href: string; label: string; title: string };

interface HeaderProps {
  locale: Locale;
  dict: HeaderDictionary;
  /** The feature pages, for the Product menu. */
  products: ProductLink[];
}

type Panel = "product" | "company" | null;

/**
 * The site's header: a floating, see-through bar with the logo, the Product
 * and Company menus, the sign-in and sign-up buttons and the language.
 */
export function Header({ locale, dict, products }: HeaderProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!panel && !mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panel, mobileOpen]);

  // A click right after the pointer opened a menu is the same intent: it stays open.
  const hoveredAt = useRef(0);
  const hover = (name: Exclude<Panel, null>, at: number) => {
    hoveredAt.current = at;
    setPanel(name);
  };
  const toggle = (name: Exclude<Panel, null>, at: number) => {
    const justHovered = at - hoveredAt.current < 400;
    setPanel((open) => (open === name && !justHovered ? null : name));
  };
  const company = [
    { href: `/${locale}/mission`, label: dict.mission },
    { href: `/${locale}/about`, label: SITE.name },
    { href: `/${locale}/team`, label: dict.team },
    { href: `/${locale}/news`, label: dict.newsroom },
    { href: `/${locale}/careers`, label: dict.careers },
  ];

  const menuButton = (name: Exclude<Panel, null>, label: string) => (
    <button
      type="button"
      aria-expanded={panel === name}
      aria-controls={`header-${name}`}
      onClick={(event) => toggle(name, event.timeStamp)}
      onMouseEnter={(event) => panel !== name && hover(name, event.timeStamp)}
      className={`flex h-9 items-center gap-1.5 px-2 text-sm transition-colors ${
        panel === name ? "text-strong" : "text-muted hover:text-strong"
      }`}
    >
      {label}
      <span aria-hidden className="w-2.5 text-center text-base leading-none">
        {panel === name ? "−" : "+"}
      </span>
    </button>
  );

  return (
    <header className="sticky top-0 z-40">
      <div
        onMouseLeave={() => setPanel(null)}
        className={`border-b bg-background/60 backdrop-blur-xl backdrop-saturate-150 transition-colors duration-200 ${
          scrolled || panel || mobileOpen ? "border-line bg-background/85" : "border-transparent"
        }`}
      >
        <div className="container-site">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-8">
              <a href={`/${locale}`} className="flex items-center text-strong" aria-label={`${SITE.name}`}>
                {/* The narrowest phones get only the mark, so the menu still fits beside it. */}
                <TextLogo className="h-[18px] max-[374px]:aspect-square sm:h-6" />
              </a>
              <nav className="hidden items-center gap-1 lg:flex" aria-label={SITE.name}>
                {menuButton("product", dict.product)}
                {menuButton("company", dict.company)}
              </nav>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <a href={SITE.bookingUrl} className="px-2 text-sm text-muted transition-colors hover:text-strong">
                {dict.bookDemo}
              </a>
              <span aria-hidden className="mx-2 h-4 w-px bg-line-strong" />
              <a href={SITE.loginUrl} className="px-2 text-sm text-muted transition-colors hover:text-strong">
                {dict.signIn}
              </a>
              <a href={SITE.signupUrl} className="button button-primary button-sm ms-2">
                {dict.getStarted}
              </a>
              <LanguageSwitcher locale={locale} />
            </div>

            <div className="flex items-center gap-1.5 lg:hidden">
              <LanguageSwitcher locale={locale} />
              <button
                type="button"
                onClick={() => setMobileOpen((open) => !open)}
                className="flex h-11 w-11 items-center justify-center text-strong"
                aria-label={`${dict.product}, ${dict.company}`}
                aria-expanded={mobileOpen}
                aria-controls="header-mobile"
              >
                {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>

          {/* Desktop menus */}
          <div
            id="header-product"
            hidden={panel !== "product"}
            className="hidden border-t border-line pb-8 pt-6 lg:block"
          >
            {panel === "product" && (
              <div className="grid grid-cols-5 gap-px bg-line">
                {products.map((product) => (
                  <Link
                    key={product.href}
                    href={product.href}
                    className="group flex flex-col gap-2 bg-background p-4 transition-colors hover:bg-surface"
                  >
                    <span className="text-sm font-medium text-strong">{product.label}</span>
                    <span className="text-sm leading-snug text-muted">{product.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div
            id="header-company"
            hidden={panel !== "company"}
            className="hidden border-t border-line pb-8 pt-6 lg:block"
          >
            {panel === "company" && (
              <div className="grid grid-cols-[1fr_2fr] gap-8">
                <div className="space-y-2">
                  <p className="text-sm text-muted">{dict.megaContactLabel}</p>
                  <a href={`mailto:${SITE.email}`} className="block text-sm text-strong hover:underline">
                    {SITE.email}
                  </a>
                </div>
                <ul className="grid grid-cols-3 gap-x-8 gap-y-1">
                  {company.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="block py-1.5 text-sm text-main hover:text-strong">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Phones and tablets */}
          {mobileOpen && (
            <div id="header-mobile" className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-line pb-5 pt-4 lg:hidden">
              <p className="text-sm text-muted">{dict.product}</p>
              <ul className="mt-2 mb-5">
                {products.map((product) => (
                  <li key={product.href}>
                    <Link href={product.href} className="flex min-h-11 items-center text-base text-strong">
                      {product.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">{dict.company}</p>
              <ul className="mt-2 mb-5">
                {company.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex min-h-11 items-center text-base text-strong">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
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
