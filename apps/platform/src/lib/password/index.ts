import "server-only";
import type { ErrorCode } from "@/lib/errors";
import { COMMON_PASSWORDS } from "./common-passwords";

// Server-side password policy (NIST SP 800-63B style): length is checked by the
// shared Zod schema; here we reject passwords that are known to be common or that
// contain the user's own e-mail name. Kept on the server so the list isn't shipped
// to the browser.

const common = new Set(COMMON_PASSWORDS.split("\n").filter(Boolean));

export function passwordPolicyError(password: string, email?: string | null): ErrorCode | null {
  const lower = password.toLowerCase();
  if (common.has(lower)) return "passwordTooCommon";

  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "passwordContainsEmail";

  // A single repeated character ("aaaaaaaa") or a plain sequence ("12345678").
  if (/^(.)\1+$/.test(password)) return "passwordTooCommon";
  if ("01234567890123456789".includes(password) || "abcdefghijklmnopqrstuvwxyz".includes(lower)) {
    return "passwordTooCommon";
  }
  return null;
}
