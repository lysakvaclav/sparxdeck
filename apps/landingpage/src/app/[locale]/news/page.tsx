import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "news", dict.pages.news.heading, dict.pages.news.subheading);
}

export default async function NewsPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      title={dict.pages.news.heading}
      subtitle={dict.pages.news.subheading}
    />
  );
}
