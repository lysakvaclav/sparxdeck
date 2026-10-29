import type { Metadata } from "next";
import { FeaturePage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { dict } = await pageLocale(params);
  return pageMetadata(dict.pages.equipmentRegister.heading, dict.pages.equipmentRegister.subheading);
}

export default async function EquipmentRegisterPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return <FeaturePage locale={locale} dict={dict} index={0} />;
}
