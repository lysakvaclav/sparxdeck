import Link from "next/link";
import { LayersIcon } from "@/components/icons";

/** A floor plan as a thumbnail with its name and a short note (floor, devices). */
export function PlanTile({
  href,
  name,
  note,
  imageUrl,
  children,
}: {
  href: string;
  name: string;
  note: string;
  imageUrl: string | null;
  /** Extra controls in the tile's corner (e.g. the order menu). */
  children?: React.ReactNode;
}) {
  return (
    <li className="group relative overflow-hidden rounded-md bg-background shadow-[inset_0_0_0_1px_var(--border)]">
      <Link
        href={href}
        className="block outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
      >
        <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white p-1.5">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <LayersIcon size={20} className="text-subtle" />
          )}
        </span>
        <span className="block px-2.5 py-2 shadow-[inset_0_1px_0_var(--border)]">
          <span className="block truncate pe-8 font-semibold text-link group-hover:underline">
            {name}
          </span>
          <span className="block truncate text-ui-sm text-muted-foreground">{note}</span>
        </span>
      </Link>
      {children && <div className="absolute end-1 bottom-1.5">{children}</div>}
    </li>
  );
}

/** The tile's note: the floor (when it isn't the plan's name) and the device count. */
export function planNote(
  plan: { name: string; locationName: string | null },
  devices: string,
): string {
  return [plan.locationName !== plan.name ? plan.locationName : null, devices]
    .filter(Boolean)
    .join(" · ");
}
