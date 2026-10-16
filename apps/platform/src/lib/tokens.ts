import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe. Used in invitation links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 hex digest. Must match encode(digest(token, 'sha256'), 'hex') in the
 * database functions, which look invitations up by hash.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
