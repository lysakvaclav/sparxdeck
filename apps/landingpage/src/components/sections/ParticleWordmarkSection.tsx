"use client";

import { useEffect, useState } from "react";
import { TextParticle } from "@/components/ui/text-particle";
import { useTheme } from "next-themes";
import { SITE } from "@/config/site";

// Rough width of the wordmark in em; used to fit it into the viewport.
const WORDMARK_WIDTH_EM = 5.6;

export function ParticleWordmarkSection() {
  const { theme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const isDark = resolvedTheme === "dark";
  const particleColor = isDark ? "#e5e5e5" : "#000000";

  const [fontSize, setFontSize] = useState(220);

  useEffect(() => {
    const updateFontSize = () => {
      if (typeof window === "undefined") return;
      // Container is max-w-7xl (1280px) with side padding.
      const available = Math.min(window.innerWidth, 1280) - 64;
      setFontSize(Math.min(240, Math.floor(available / WORDMARK_WIDTH_EM)));
    };

    updateFontSize();
    window.addEventListener("resize", updateFontSize);
    return () => window.removeEventListener("resize", updateFontSize);
  }, []);

  return (
    <section
      id="wordmark-particles"
      aria-label={`${SITE.name} particle wordmark`}
      className="w-full bg-[var(--background)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-2 sm:py-3 md:px-8 lg:px-12">
        <div className="relative h-[200px] sm:h-[240px] md:h-[280px] lg:h-[340px]">
          <TextParticle
            text={SITE.name}
            fontSize={fontSize}
            particleColor={particleColor}
            particleSize={1.5}
            particleDensity={5}
            backgroundColor="transparent"
          />
        </div>
      </div>
    </section>
  );
}
