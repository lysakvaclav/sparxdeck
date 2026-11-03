import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Cta } from "@/components/home/Closing";
import { PageHero, pageLocale, pageMetadata, type PageParams } from "@/components/site/Pages";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE } from "@/config/site";

// The public description of SparxDeck MCP: how to connect, what the
// assistant can do (tool names as the server lists them) and how it is kept
// safe. Texts in src/i18n/mcp/<language>.ts.

/** Tool names per group, in the order of the dictionary's readGroups and writeGroups. */
const READ_TOOLS = [
  ["get_overview", "list_due"],
  ["list_sites", "get_site", "list_customers", "get_customer"],
  ["list_devices", "get_device"],
  ["list_inspections", "get_inspection", "get_inspection_summary"],
  ["list_defects", "get_defect", "get_calendar"],
  ["search", "fetch", "list_members", "list_device_types"],
];
const WRITE_TOOLS = [
  ["create_defect", "update_defect", "comment_defect", "resolve_defect"],
  ["schedule_visit", "reschedule_visit"],
  ["add_note"],
];

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { locale, dict } = await pageLocale(params);
  return pageMetadata(locale, "mcp", dict.mcp.title, dict.mcp.subtitle);
}

function Tools({ title, labels, tools }: { title: string; labels: string[]; tools: string[][] }) {
  return (
    <div>
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <dl className="mt-5 space-y-5">
        {labels.map((label, index) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-2 flex flex-wrap gap-2" dir="ltr">
              {(tools[index] ?? []).map((tool) => (
                <code key={tool} className="rounded-full border border-line px-3 py-1 text-[0.8125rem] text-strong">
                  {tool}
                </code>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-relaxed text-main">
          <Check className="mt-1 size-4 shrink-0 text-strong" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function McpPage({ params }: { params: PageParams }) {
  const { locale, dict } = await pageLocale(params);
  const m = dict.mcp;
  const address = `${SITE.appUrl}/api/mcp`;

  return (
    <SiteShell locale={locale} dict={dict}>
      <PageHero title={m.title} subtitle={m.subtitle} />

      <section className="border-t border-line">
        <div className="container-site grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-20">
          <p className="max-w-xl text-lg leading-relaxed text-main md:text-xl">{m.intro}</p>
          <div>
            <h2 className="text-3xl leading-tight md:text-4xl">{m.connectTitle}</h2>
            <p className="mt-6 text-sm text-muted">{m.address}</p>
            <p
              className="mt-2 rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-sm break-all text-strong select-all"
              dir="ltr"
            >
              {address}
            </p>
            <ol className="mt-8 space-y-4">
              {m.steps.map((step, index) => (
                <li key={step} className="flex gap-4 text-base leading-relaxed text-main">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm text-strong">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-muted">{m.note}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="mcp-tools">
        <div className="container-site py-16 md:py-24">
          <h2 id="mcp-tools" className="text-3xl leading-tight md:text-5xl">
            {m.toolsTitle}
          </h2>
          <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Tools title={m.readTitle} labels={m.readGroups} tools={READ_TOOLS} />
            <div>
              <Tools title={m.writeTitle} labels={m.writeGroups} tools={WRITE_TOOLS} />
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted">{m.writeBody}</p>
            </div>
          </div>
          <p className="mt-12 max-w-3xl text-base leading-relaxed text-muted">{m.extras}</p>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="mcp-security">
        <div className="container-site py-16 md:py-24">
          <h2 id="mcp-security" className="text-3xl leading-tight md:text-5xl">
            {m.securityTitle}
          </h2>
          <div className="mt-12">
            <Checklist items={m.security} />
          </div>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="mcp-technical">
        <div className="container-site py-16 md:py-24">
          <h2 id="mcp-technical" className="text-3xl leading-tight md:text-4xl">
            {m.technicalTitle}
          </h2>
          <div className="mt-10">
            <Checklist items={m.technical} />
          </div>
        </div>
      </section>

      <Cta dict={dict.home} />
    </SiteShell>
  );
}
