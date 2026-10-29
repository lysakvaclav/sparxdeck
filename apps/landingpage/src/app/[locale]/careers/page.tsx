import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";
import { SITE } from "@/config/site";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.pages.careers.heading, dict.pages.careers.subheading);
}

export default async function CareersPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      path="careers"
      title={dict.pages.careers.heading}
      subtitle={dict.pages.careers.subheading}
    >
      <a href={`mailto:${SITE.email}`} className="button button-primary">
        {SITE.email}
        <ArrowRight className="arrow" aria-hidden />
      </a>
    </TextPage>
  );
}
