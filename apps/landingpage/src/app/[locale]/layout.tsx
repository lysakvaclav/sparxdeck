import { notFound } from "next/navigation";
import { isLocale, isRtl, locales } from "@/i18n/dictionary";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      {children}
    </div>
  );
}
