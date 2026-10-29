import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "about", dict.pages.about.heading, dict.pages.about.subheading);
}

export default async function AboutPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      title={dict.pages.about.heading}
      subtitle={dict.pages.about.subheading}
      paragraphs={dict.pages.about.body}
    />
  );
}
