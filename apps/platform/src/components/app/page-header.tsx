import { getTranslations } from "next-intl/server";
import { PageHeaderView, type PageHeaderProps } from "./page-header-view";

export { PageBody, type Crumb } from "./page-header-view";

/**
 * Foundry-style page header: coloured app icon, breadcrumb path ending in the
 * bold page title, optional application menus below, actions on the right.
 */
export async function PageHeader(props: PageHeaderProps) {
  const t = await getTranslations("common");
  return <PageHeaderView {...props} breadcrumbsLabel={t("breadcrumbs")} />;
}
