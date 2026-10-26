import Link from "next/link";
import type { IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href: string;
  /** Handles the click in the page instead (a view switched without the server). */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export type PageHeaderProps = {
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
 * Page header: coloured app icon, the path ("Section / Page") ending in the bold
 * page title, optional application menus below, actions on the right.
 * Server pages use PageHeader, client views ClientPageHeader; both draw this.
 */
export function PageHeaderView({
  title,
  breadcrumbs,
  icon: Icon,
  iconClassName,
  meta,
  actions,
  menus = false,
  toolbar,
  breadcrumbsLabel,
}: PageHeaderProps & { breadcrumbsLabel: string }) {
  return (
    <>
      <header className="relative z-10 shrink-0 border-b border-border bg-background">
        <div className="flex min-h-[50px] flex-wrap items-center gap-x-2.5 gap-y-1.5 px-[15px] py-1.5">
          {Icon && <Icon size={20} className={cn("text-muted-foreground", iconClassName)} />}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav
                  aria-label={breadcrumbsLabel}
                  className="max-w-[45%] min-w-0 shrink-[10] sm:max-w-none"
                >
                  <ol className="flex min-w-0 items-center gap-1.5">
                    {breadcrumbs.map((crumb, index) => (
                      <li
                        key={crumb.href}
                        // Phones keep only the parent, so the title (e.g. a label number) fits.
                        className={cn(
                          "flex min-w-0 shrink items-center gap-1.5",
                          index < breadcrumbs.length - 1 && "hidden sm:flex",
                        )}
                      >
                        <Link
                          href={crumb.href}
                          onClick={crumb.onClick}
                          className="truncate text-ui font-medium text-foreground/75 hover:text-foreground pointer-coarse:block pointer-coarse:leading-[44px]"
                        >
                          {crumb.label}
                        </Link>
                        <span aria-hidden className="text-subtle">
                          /
                        </span>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <h1 className="min-w-0 truncate text-ui-lg font-semibold tracking-tight">{title}</h1>
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
