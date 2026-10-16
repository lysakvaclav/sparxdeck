"use client";

import type { HeroDictionary } from "@/i18n/dictionary";
import { SITE } from "@/config/site";
import { useTheme } from "next-themes";
import { ParticleDrift } from "@/components/ui/particle-drift";

export function HeroSection({ dict }: { dict: HeroDictionary }) {
  const { resolvedTheme } = useTheme();

  return (
    <section
      id="hero"
      className="relative flex items-center overflow-hidden pb-6 sm:pb-8 lg:pb-10 w-full min-h-[90vh] md:min-h-[100vh] lg:min-h-[110vh] -mt-16 sm:-mt-20 md:-mt-20 lg:-mt-24"
      aria-labelledby="hero-heading"
    >
      {/* Particle drift, full-bleed. Masked lighter behind the headline so the text stays crisp. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <ParticleDrift
          dark={resolvedTheme === "dark"}
          className="absolute inset-0 animate-[hero-fade-in_1.2s_ease-out_both] [mask-image:radial-gradient(ellipse_70%_60%_at_32%_52%,rgba(0,0,0,0.25)_0%,#000_75%)]"
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--background)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-16 md:px-8 md:pt-20 lg:px-12">
        <div className="mx-auto max-w-3xl space-y-4 text-left">
          <h1
            id="hero-heading"
            className="display-font whitespace-pre-line text-balance text-[3.4rem] leading-tight tracking-tight sm:text-[4.2rem] lg:text-[5rem]"
            style={{
              backgroundImage: "var(--gradient-heading)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {dict.heading}
          </h1>
          <p className="mx-auto max-w-3xl text-sm text-[var(--color-text-muted)] sm:text-base">
            {dict.body}
          </p>
          <div className="mt-6 flex flex-nowrap items-center gap-2">
            <a
              href={SITE.signupUrl}
              className="button-font btn btn-solid-dark btn-rounded-md btn-hover-together h-10 px-1 gap-0 text-white whitespace-nowrap text-xs sm:text-sm"
            >
              <span className="label">{dict.primaryCta}</span>
              <span className="arrow" aria-hidden>
                →
              </span>
            </a>
            <a
              href="#how-it-works"
              className="button-font btn btn-outline-soft btn-rounded-md btn-outline-hover-light btn-hover-together h-10 px-1 gap-0 whitespace-nowrap text-xs sm:text-sm"
            >
              <span className="label">{dict.secondaryCta}</span>
              <span className="arrow" aria-hidden>
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
