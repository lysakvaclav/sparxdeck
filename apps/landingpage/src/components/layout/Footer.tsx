import Link from "next/link";
import { RiLinkedinBoxFill } from "react-icons/ri";
import { FooterThemeToggle } from "@/components/layout/FooterThemeToggle";
import { Wordmark } from "@/components/layout/Wordmark";
import type { ProductLink } from "@/components/site/SiteShell";
import { TextLogo } from "@/components/ui/text-logo";
import { SITE } from "@/config/site";
import type { Dictionary, Locale } from "@/i18n/dictionary";

/**
 * The site's footer: the product and company pages, contact, LinkedIn, the
 * theme, the legal pages and, on larger screens, the logo in particles.
 */
export function Footer({
  locale,
  dict,
  products,
}: {
  locale: Locale;
  dict: Dictionary;
  products: ProductLink[];
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
  const link = "text-sm text-muted transition-colors hover:text-strong";

  return (
    <footer className="border-t border-line bg-background">
      <div className="container-site grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:py-20">
        <div className="space-y-4">
          <Link href={`/${locale}`} aria-label={SITE.name} className="inline-flex min-h-11 items-center text-strong">
            <TextLogo className="h-6" />
          </Link>
          <p className="max-w-xs text-sm text-muted">{dict.home.hero.eyebrow}</p>
          <div className="flex items-center gap-2">
            {SITE.social.linkedin && (
              <a
                href={SITE.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex size-9 items-center justify-center rounded-full border border-line-strong text-muted transition-colors hover:text-strong max-md:size-11"
              >
                <RiLinkedinBoxFill className="size-5" aria-hidden />
              </a>
            )}
            <FooterThemeToggle />
          </div>
        </div>
        <nav aria-label={dict.header.product}>
          <p className="text-sm font-medium text-strong">{dict.header.product}</p>
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
          <p className="text-sm font-medium text-strong">{f.companyHeading}</p>
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
          <p className="text-sm font-medium text-strong">{dict.header.megaContactLabel}</p>
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
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {SITE.name}. {f.allRightsReserved}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={`/${locale}/terms-of-use`} className="hover:text-strong max-md:inline-flex max-md:min-h-11 max-md:items-center">
              {f.termsOfService}
            </Link>
            <Link href={`/${locale}/privacy-policy`} className="hover:text-strong max-md:inline-flex max-md:min-h-11 max-md:items-center">
              {f.privacyPolicy}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-strong max-md:inline-flex max-md:min-h-11 max-md:items-center">
              {f.cookiesSettings}
            </Link>
          </div>
        </div>
      </div>

      {/* The logo in particles, as the last thing on the page (not on phones). */}
      <div className="container-site hidden pb-12 md:block">
        <div className="aspect-[896/149] w-full">
          <Wordmark />
        </div>
      </div>
    </footer>
  );
}
