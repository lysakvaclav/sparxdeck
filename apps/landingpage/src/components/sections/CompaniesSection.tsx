import Link from "next/link";
import type { CompaniesDictionary, Locale } from "@/i18n/dictionary";

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      strokeWidth="1"
      stroke="currentColor"
      className={`size-6 text-[var(--color-text-strong)] ${className}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  );
}

function CornerPlusIcons() {
  return (
    <>
      <PlusIcon className="absolute -top-3 -left-3" />
      <PlusIcon className="absolute -top-3 -right-3" />
      <PlusIcon className="absolute -bottom-3 -left-3" />
      <PlusIcon className="absolute -bottom-3 -right-3" />
    </>
  );
}

function BentoCard({
  title,
  description,
  ctaLabel,
  href,
  className = "",
}: {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  className?: string;
}) {
  return (
    <div className={`relative min-h-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 ${className}`}>
      <CornerPlusIcons />
      <div className="relative z-10 space-y-2">
        <h3 className="text-xl font-bold text-[var(--color-text-strong)]">{title}</h3>
        <p className="text-[var(--color-text-main)]">{description}</p>
      </div>
      <div className="relative z-10 pt-4">
        <Link
          href={href}
          className="text-sm text-[var(--color-text-strong)] underline-offset-4 hover:underline"
        >
          {ctaLabel} 
          →
        </Link>
      </div>
    </div>
  );
}

export function CompaniesSection({
  dict,
  locale,
}: {
  dict: CompaniesDictionary;
  locale: Locale;
}) {
  const spans = [
    "lg:col-span-3 lg:row-span-2",
    "lg:col-span-2 lg:row-span-2",
    "lg:col-span-4 lg:row-span-1",
    "lg:col-span-2 lg:row-span-1",
  ];

  const slugs = [
    "equipment-register",
    "field-inspections",
    "inspection-reports",
    "deadline-tracking",
    "defect-tracking",
  ];

  const topCards = dict.cards.slice(0, 4);
  const lastCard = dict.cards[4];
  return (
    <section
      id="problem"
      aria-labelledby="problem-heading"
      className="mx-auto w-full max-w-6xl px-6 md:px-8 lg:px-12"
    >
      <div className="py-14 sm:py-16">
        <div className="grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {topCards.map((c, index) => (
            <BentoCard
              key={c.title}
              title={c.title}
              description={c.description}
              ctaLabel={dict.cardCta}
              href={`/${locale}/${slugs[index]}`}
              className={spans[index] ?? ""}
            />
          ))}
        </div>

        {lastCard && (
          <div className="mt-4 grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <BentoCard
              key={lastCard.title}
              title={lastCard.title}
              description={lastCard.description}
              ctaLabel={dict.cardCta}
              href={`/${locale}/${slugs[4]}`}
              className="lg:col-span-2"
            />

            <div className="lg:col-span-4 ml-auto px-2 text-right flex flex-col justify-center">
              <h2
                id="problem-heading"
                className="display-font mb-2 text-3xl font-bold text-[var(--color-text-strong)] sm:text-4xl md:text-5xl"
              >
                {dict.headingLine1}
                {dict.headingLine2 && (
                  <>
                    <br /> {dict.headingLine2}
                  </>
                )}
              </h2>
              <p className="text-lg text-[var(--color-text-muted)]">{dict.paragraph}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
