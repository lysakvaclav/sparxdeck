/**
 * Returns `next` only if it is a same-origin path, otherwise the fallback.
 * Prevents open redirects such as ?next=//evil.example or ?next=https://evil.example.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
