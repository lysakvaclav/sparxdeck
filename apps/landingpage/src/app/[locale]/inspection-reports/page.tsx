import type { Metadata } from "next";
import { FeaturePage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.pages.inspectionReports.heading, dict.pages.inspectionReports.subheading);
}

export default async function InspectionReportsPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return <FeaturePage locale={locale} dict={dict} index={2} />;
}
