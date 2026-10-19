import { permanentRedirect } from "next/navigation";

export default function Home() {
  // Always the same target: a permanent (308) redirect, not a temporary one,
  // so search engines index /cs itself rather than the bare domain.
  permanentRedirect("/cs");
}
