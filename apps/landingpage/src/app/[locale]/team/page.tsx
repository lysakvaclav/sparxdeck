import type { Metadata } from "next";
import { TextPage, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "team", dict.pages.team.heading, dict.pages.team.subheading);
}

const TEAM = [
  {
    name: "Václav Lysák",
    role: "Co-Founder & CEO",
    linkedin: "https://www.linkedin.com/in/v%C3%A1clav-lys%C3%A1k-327835385/",
  },
];

export default async function TeamPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  return (
    <TextPage
      locale={locale}
      dict={dict}
      title={dict.pages.team.heading}
      subtitle={dict.pages.team.subheading}
    >
      <ul className="max-w-3xl border-t border-line">
        {TEAM.map((person) => (
          <li key={person.name} className="flex items-center justify-between gap-6 border-b border-line py-6">
            <div>
              <p className="text-lg font-medium text-strong">{person.name}</p>
              <p className="text-sm text-muted">{person.role}</p>
            </div>
            <a
              href={person.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${person.name} LinkedIn`}
              className="flex h-11 w-11 items-center justify-center border border-line-strong text-strong transition-colors hover:bg-surface"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </TextPage>
  );
}
