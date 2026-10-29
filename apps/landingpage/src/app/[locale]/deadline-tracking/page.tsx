import type { Metadata } from "next";
import { FeaturePage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "deadline-tracking", dict.pages.deadlineTracking.heading, dict.pages.deadlineTracking.subheading);
}

export default async function DeadlineTrackingPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return <FeaturePage locale={locale} dict={dict} index={3} />;
}
