import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-gradient-heading font-display text-7xl tracking-tight">404</p>
      <Button asChild variant="outline">
        <Link href="/">{t("back")}</Link>
      </Button>
    </main>
  );
}
