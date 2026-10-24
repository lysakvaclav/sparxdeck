import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

// The installable app (home screen on the phone, a window on the desktop). The
// browser fetches it without cookies, so the language follows Accept-Language.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("pwa");
  return {
    name: "SparxDeck",
    short_name: "SparxDeck",
    description: t("description"),
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0f1b2d",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: t("shortcuts.inspection"),
        url: "/inspections/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: t("shortcuts.defect"),
        url: "/defects/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
