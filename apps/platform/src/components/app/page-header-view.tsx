import Link from "next/link";
import { ChevronRightIcon, type IconComponent } from "@/components/icons";
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
 * Page header on a white bar: the section icon on a tinted tile, the path to
 * this page in small text over the bold page title, optional application menus
 * below, actions on the right. Server pages use PageHeader, client views
 * ClientPageHeader; both draw this.
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
  const crumbs = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : null;
  return (
    <>
      <header className="relative z-10 shrink-0 bg-background shadow-[0_1px_0_var(--border)]">
        <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          {Icon && (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg bg-current/10 text-muted-foreground max-sm:size-9",
                iconClassName,
              )}
            >
              <Icon size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {crumbs && (
              <nav aria-label={breadcrumbsLabel} className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1">
                  {crumbs.map((crumb, index) => (
                    <li
                      key={crumb.href}
                      // Phones keep only the parent, so the title (e.g. a label number) fits.
                      className={cn(
                        "flex min-w-0 shrink items-center gap-1",
                        index < crumbs.length - 1 && "hidden sm:flex",
                      )}
                    >
                      <Link
                        href={crumb.href}
                        onClick={crumb.onClick}
                        // A 44px touch target that takes only a line of room.
                        className="truncate text-ui-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:-my-3 pointer-coarse:block pointer-coarse:leading-[44px]"
                      >
                        {crumb.label}
                      </Link>
                      {index < crumbs.length - 1 && (
                        <ChevronRightIcon size={12} className="text-subtle rtl:rotate-180" />
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="min-w-0 truncate text-lg leading-7 font-semibold sm:text-xl">
                {title}
              </h1>
              {meta && (
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{meta}</div>
              )}
            </div>
            {menus && <div data-page-menus="" className="-ms-2 flex min-h-5 items-center" />}
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

/** Scrolling page content on the light grey workspace background. */
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
          "mx-auto w-full p-3 pb-8 sm:p-5 lg:p-6",
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
