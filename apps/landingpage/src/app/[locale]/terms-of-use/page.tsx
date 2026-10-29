import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.footer.termsOfService, dict.legal.terms.subheading);
}

export default async function TermsPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      path="terms-of-use"
      eyebrow={dict.footer.companyHeading}
      title={dict.footer.termsOfService}
      subtitle={dict.legal.terms.subheading}
      paragraphs={dict.legal.terms.body}
    />
  );
}
