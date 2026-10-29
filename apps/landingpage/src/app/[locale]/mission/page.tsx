import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.pages.mission.heading, dict.pages.mission.subheading);
}

export default async function MissionPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      path="mission"
      eyebrow={dict.footer.companyHeading}
      title={dict.pages.mission.heading}
      subtitle={dict.pages.mission.subheading}
      paragraphs={dict.pages.mission.body}
    />
  );
}
