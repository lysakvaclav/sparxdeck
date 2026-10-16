"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /** For the inline script that sets the theme before the page paints (CSP). */
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      nonce={nonce}
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
