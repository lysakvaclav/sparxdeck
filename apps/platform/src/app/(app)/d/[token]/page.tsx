import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/auth";
import { normalizeToken } from "@/lib/devices";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("labels.scan");
  return { title: t("notFoundTitle") };
}

type Props = { params: Promise<{ token: string }> };

/**
 * Where a scanned label lands. Signed-out visitors were sent to sign in and back
 * (proxy). A device of the user's organization opens; anything else (a typo,
 * a deleted device, another company's label) gets the same "not found", so a
 * label never reveals whether it exists elsewhere.
 */
export default async function ScanPage({ params }: Props) {
  await requireMembership();
  const token = normalizeToken((await params).token);
  if (token) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("devices")
      .select("id")
      .eq("public_token", token)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) redirect(`/devices/${data.id}`);
  }
  notFound();
}
