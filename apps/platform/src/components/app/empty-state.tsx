import type { IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Blueprint "non-ideal state": muted icon, title, short description, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: IconComponent;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <Icon size={48} className="text-[#a7b6c2] dark:text-[#5c7080]" />
      <h2 className="mt-4 text-ui-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-ui text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
