import Image from "next/image";
import type { Locale } from "@/i18n/dictionary";

// Screenshots of the platform, made by apps/platform/e2e/landing-screens.mjs
// into public/screens/<cs|en>/<light|dark>/<name>.webp. The platform speaks
// Czech and English: Czech pages show Czech pictures, the rest English ones.
// Both themes are in the page; the site's theme shows one of them.

export type ShotName =
  | "dashboard"
  | "devices"
  | "check"
  | "protocol"
  | "calendar"
  | "defects"
  | "map"
  | "route"
  | "today";

const DESKTOP = { width: 2000, height: 1250 };
const PHONE = { width: 780, height: 1688 };

function Picture({
  name,
  locale,
  alt,
  size,
  priority,
  sizes,
}: {
  name: ShotName;
  locale: Locale;
  alt: string;
  size: { width: number; height: number };
  priority?: boolean;
  sizes: string;
}) {
  const lang = locale === "cs" ? "cs" : "en";
  const common = {
    width: size.width,
    height: size.height,
    sizes,
    priority,
    // Already sized and compressed WebP files: served as they are.
    unoptimized: true,
    className: "block h-auto w-full",
  } as const;
  return (
    <>
      <Image {...common} src={`/screens/${lang}/light/${name}.webp`} alt={alt} className={`${common.className} dark:hidden`} />
      <Image {...common} src={`/screens/${lang}/dark/${name}.webp`} alt={alt} className={`${common.className} hidden dark:block`} />
    </>
  );
}

/** A desktop screenshot in a thin window frame. */
export function DesktopShot({
  name,
  locale,
  alt,
  priority,
  className = "",
}: {
  name: ShotName;
  locale: Locale;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`shot ${className}`}>
      <div className="shot-bar" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <Picture name={name} locale={locale} alt={alt} size={DESKTOP} priority={priority} sizes="(min-width: 1216px) 1150px, 100vw" />
    </figure>
  );
}

/** A phone screenshot in a phone. */
export function PhoneShot({
  name,
  locale,
  alt,
  priority,
  className = "",
}: {
  name: ShotName;
  locale: Locale;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`phone ${className}`}>
      <Picture name={name} locale={locale} alt={alt} size={PHONE} priority={priority} sizes="(min-width: 768px) 300px, 60vw" />
    </figure>
  );
}
