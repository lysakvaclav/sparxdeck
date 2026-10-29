import Link from "next/link";
import { FooterThemeToggle } from "@/components/layout/FooterThemeToggle";
import { LocaleFlag } from "@/components/layout/LocaleFlag";
import type { ProductLink } from "@/components/layout/Header";
import { TextLogo } from "@/components/ui/text-logo";
import { SITE } from "@/config/site";
import { languageOptions, type Dictionary, type Locale } from "@/i18n/dictionary";

/**
 * The site's footer: the product and company pages, contact, every language
 * (each link keeps the page), the theme, and the legal pages.
 */
export function Footer({
  locale,
  dict,
  products,
  path,
}: {
  locale: Locale;
  dict: Dictionary;
  products: ProductLink[];
  /** The page without the language ("" for the home page), so a language link stays on it. */
  path: string;
}) {
  const year = new Date().getFullYear();
  const f = dict.footer;
  const company = [
    { href: `/${locale}/mission`, label: f.mission },
    { href: `/${locale}/about`, label: SITE.name },
    { href: `/${locale}/team`, label: f.team },
    { href: `/${locale}/news`, label: f.newsroom },
    { href: `/${locale}/careers`, label: f.careers },
  ];
  const link = "text-sm text-main transition-colors hover:text-strong";

  return (
    <footer className="border-t border-line bg-background">
      <div className="container-site grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:py-16">
        <div className="space-y-4">
          <Link href={`/${locale}`} aria-label={SITE.name} className="inline-block text-strong">
            <TextLogo className="h-6" />
          </Link>
          <p className="max-w-xs text-sm text-muted">{dict.home.hero.eyebrow}</p>
          <FooterThemeToggle />
        </div>
        <nav aria-label={dict.header.product}>
          <p className="eyebrow">{dict.header.product}</p>
          <ul className="mt-4 space-y-2.5">
            {products.map((product) => (
              <li key={product.href}>
                <Link href={product.href} className={link}>
                  {product.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={f.companyHeading}>
          <p className="eyebrow">{f.companyHeading}</p>
          <ul className="mt-4 space-y-2.5">
            {company.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="eyebrow">{dict.header.megaContactLabel}</p>
          <ul className="mt-4 space-y-2.5">
            <li>
              <a href={`mailto:${SITE.email}`} className={link}>
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={SITE.loginUrl} className={link}>
                {dict.header.signIn}
              </a>
            </li>
            <li>
              <a href={SITE.bookingUrl} className={link}>
                {dict.header.bookDemo}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-site py-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Language">
            {languageOptions.map((option) => (
              <li key={option.code}>
                <Link
                  href={`/${option.code}${path ? `/${path}` : ""}`}
                  hrefLang={option.code}
                  lang={option.code}
                  aria-current={option.code === locale ? "true" : undefined}
                  className={`inline-flex min-h-6 items-center gap-1.5 text-xs transition-colors ${
                    option.code === locale ? "text-strong" : "text-muted hover:text-strong"
                  }`}
                >
                  <LocaleFlag code={option.code} />
                  {option.nativeName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {SITE.name}. {f.allRightsReserved}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={`/${locale}/terms-of-use`} className="hover:text-strong">
              {f.termsOfService}
            </Link>
            <Link href={`/${locale}/privacy-policy`} className="hover:text-strong">
              {f.privacyPolicy}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-strong">
              {f.cookiesSettings}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
