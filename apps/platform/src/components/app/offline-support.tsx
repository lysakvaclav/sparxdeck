"use client";

import { useEffect } from "react";
import { checkOwner } from "@/lib/client/offline-store";

/**
 * Work without a signal: registers the service worker (in development as
 * /sw.js?dev, which takes Next.js files from the network first) and drops what
 * another account left in this phone.
 */
export function OfflineSupport({ userId }: { userId: string }) {
  useEffect(() => {
    void checkOwner(userId);
    if (!("serviceWorker" in navigator)) return;
    const script = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev";
    navigator.serviceWorker.register(script, { scope: "/" }).catch(() => {
      // Not supported here (private mode): the app works online as before.
    });
  }, [userId]);
  return null;
}
