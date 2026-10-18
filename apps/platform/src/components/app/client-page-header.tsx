"use client";

import { useTranslations } from "next-intl";
import { PageHeaderView, type PageHeaderProps } from "./page-header-view";

/** The page header for views a client component switches (same look as PageHeader). */
export function ClientPageHeader(props: PageHeaderProps) {
  const t = useTranslations("common");
  return <PageHeaderView {...props} breadcrumbsLabel={t("breadcrumbs")} />;
}
