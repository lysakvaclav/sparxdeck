import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.footer.privacyPolicy, dict.legal.privacy.subheading);
}

export default async function PrivacyPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      title={dict.footer.privacyPolicy}
      subtitle={dict.legal.privacy.subheading}
      paragraphs={dict.legal.privacy.body}
    />
  );
}
