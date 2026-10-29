import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { FEATURES } from "@/components/home/features";
import type { Dictionary, Locale } from "@/i18n/dictionary";

export type ProductLink = { href: string; label: string; title: string };

/** The feature pages, named as on the home page (for the footer). */
export function productLinks(locale: Locale, dict: Dictionary): ProductLink[] {
  return FEATURES.flatMap((feature, index) =>
    feature.path
      ? [
          {
            href: `/${locale}/${feature.path}`,
            label: dict.home.features[index]!.label,
            title: dict.home.features[index]!.title,
          },
        ]
      : [],
  );
}

/** Every page of the site: the header, the page, the footer. */
export function SiteShell({
  locale,
  dict,
  path,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  /** The page without the language ("" for the home page). */
  path: string;
  children: React.ReactNode;
}) {
  const products = productLinks(locale, dict);
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header locale={locale} dict={dict.header} />
      {/* The header floats over the top of the page (its height at each width). */}
      <main className="-mt-16 flex-1 md:-mt-[4.75rem] lg:-mt-20">{children}</main>
      <Footer locale={locale} dict={dict} products={products} path={path} />
    </div>
  );
}
