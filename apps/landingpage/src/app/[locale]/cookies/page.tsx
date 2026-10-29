import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.footer.cookiesSettings, dict.legal.cookies.subheading);
}

export default async function CookiesPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      title={dict.footer.cookiesSettings}
      subtitle={dict.legal.cookies.subheading}
      paragraphs={dict.legal.cookies.body}
    />
  );
}
