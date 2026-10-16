import type { GetStartedDictionary } from "@/i18n/dictionary";
import { SITE } from "@/config/site";

export function GetStartedSection({ dict }: { dict: GetStartedDictionary }) {
  return (
    <section id="get-started" className="mt-10 sm:mt-12">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-8 lg:px-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={SITE.signupUrl}
            className="button-font btn btn-grey-solid btn-hover-together btn-notch-tl normal-case block w-full h-24 justify-between px-6 text-left"
          >
            <span className="label text-xl sm:text-2xl">{dict.primaryCta}</span>
            <span className="arrow text-xl sm:text-2xl" aria-hidden>
              →
            </span>
          </a>
          <a
            href={SITE.bookingUrl}
            className="button-font btn btn-solid-dark btn-hover-together btn-notch-tr normal-case block w-full h-24 justify-between px-6 text-left"
          >
            <span className="label text-xl sm:text-2xl">{dict.secondaryCta}</span>
            <span className="arrow text-xl sm:text-2xl" aria-hidden>
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
