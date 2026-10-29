import type { Metadata } from "next";
import { FeaturePage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "field-inspections", dict.pages.fieldInspections.heading, dict.pages.fieldInspections.subheading);
}

export default async function FieldInspectionsPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return <FeaturePage locale={locale} dict={dict} index={1} />;
}
