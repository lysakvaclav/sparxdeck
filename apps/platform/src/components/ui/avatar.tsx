import { cn } from "@/lib/utils";

// White initials on a colour picked from the name: the same person always gets
// the same colour. Every colour keeps 4.5:1 with white text.
const COLORS = [
  "#3a67b0",
  "#177a4d",
  "#b8456b",
  "#c2532a",
  "#6d4fc4",
  "#0f7c8c",
  "#5d6979",
  "#a35a00",
];

/** Up to two initials: first and last word ("Petra Nová" → "PN"). */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toLocaleUpperCase();
}

export function avatarColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

/** A person as a coloured circle with initials; decorative next to their name. */
export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundColor: avatarColor(name),
      }}
    >
      {initials(name)}
    </span>
  );
}
