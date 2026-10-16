import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRightIcon, type IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href: string };

type PageHeaderProps = {
  title: string;
  /** Ancestors of this page; the title is the last, bold crumb. */
  breadcrumbs?: Crumb[];
  /** App or object icon, drawn in its colour before the path. */
  icon?: IconComponent;
  /** Colour class of the icon. */
  iconClassName?: string;
  /** Small tags after the title (type, identifiers). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Leaves room for application menus (File, View, Help) that a client page renders into it. */
  menus?: boolean;
  /** A second row under the header, e.g. a Toolbar. */
  toolbar?: React.ReactNode;
};

/**
 * Foundry-style page header: coloured app icon, breadcrumb path ending in the
 * bold page title, optional application menus below, actions on the right.
 */
export async function PageHeader({
  title,
  breadcrumbs,
  icon: Icon,
  iconClassName,
  meta,
  actions,
  menus = false,
  toolbar,
}: PageHeaderProps) {
  const t = await getTranslations("common");
  return (
    <>
      <header className="relative z-10 shrink-0 bg-background shadow-elevation-1">
        <div className="flex min-h-[50px] flex-wrap items-center gap-x-2.5 gap-y-1.5 px-[15px] py-1.5">
          {Icon && <Icon size={20} className={cn("text-muted-foreground", iconClassName)} />}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav
                  aria-label={t("breadcrumbs")}
                  className="max-w-[45%] min-w-0 shrink-[10] sm:max-w-none"
                >
                  <ol className="flex min-w-0 items-center gap-1">
                    {breadcrumbs.map((crumb, index) => (
                      <li
                        key={crumb.href}
                        // Phones keep only the parent, so the title (e.g. a label number) fits.
                        className={cn(
                          "flex min-w-0 shrink items-center gap-1",
                          index < breadcrumbs.length - 1 && "hidden sm:flex",
                        )}
                      >
                        <Link
                          href={crumb.href}
                          className="truncate text-ui text-muted-foreground hover:text-foreground hover:underline pointer-coarse:block pointer-coarse:leading-[44px]"
                        >
                          {crumb.label}
                        </Link>
                        <ChevronRightIcon className="text-subtle rtl:rotate-180" />
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <h1 className="min-w-0 truncate text-ui-lg font-semibold">{title}</h1>
              {meta && (
                <div className="ms-1 hidden shrink-0 items-center gap-1.5 sm:flex">{meta}</div>
              )}
            </div>
            {menus && <div data-page-menus="" className="-ms-[7px] flex min-h-5 items-center" />}
          </div>
          {actions && (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              {actions}
            </div>
          )}
        </div>
      </header>
      {toolbar}
    </>
  );
}

/** Scrolling page content on the light workspace background. */
export function PageBody({
  children,
  width = "wide",
  className,
}: {
  children: React.ReactNode;
  /** "narrow" for forms, "wide" for lists and details. */
  width?: "narrow" | "medium" | "wide";
  className?: string;
}) {
  return (
    <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
      <div
        className={cn(
          "mx-auto w-full p-2.5 pb-8 sm:p-[15px] lg:p-5",
          width === "narrow" && "max-w-3xl",
          width === "medium" && "max-w-5xl",
          width === "wide" && "max-w-[1600px]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
