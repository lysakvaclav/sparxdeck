"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// The last resort when even the root layout fails: no translations or styles
// are available here, so it is plain and in both languages.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="cs">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#182026",
          background: "#f5f8fa",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            Něco se pokazilo · Something went wrong
          </h1>
          <p style={{ margin: "0 0 16px", color: "#5c7080" }}>
            Zkuste stránku načíst znovu. · Please reload the page.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5c7080" }}>
              {error.digest}
            </p>
          )}
          {/* A full reload on purpose: the app around this page failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#137cbd" }}>
            SparxDeck
          </a>
        </div>
      </body>
    </html>
  );
}
