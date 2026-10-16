"use client";

import { useTheme } from "next-themes";
import { ParticleDrift } from "@/components/ui/particle-drift";

/** Right-hand panel of the sign-in pages: the landing page's particle drift and tagline. */
export function AuthVisual({ tagline }: { tagline: string }) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card">
      <ParticleDrift
        dark={resolvedTheme === "dark"}
        className="absolute inset-0 animate-in [mask-image:radial-gradient(ellipse_80%_45%_at_30%_88%,rgba(0,0,0,0.2)_0%,#000_80%)] duration-1000 fade-in"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-10 xl:p-12">
        <p className="text-gradient-heading font-display text-4xl leading-[1.05] tracking-tight whitespace-pre-line xl:text-5xl">
          {tagline}
        </p>
      </div>
    </div>
  );
}
