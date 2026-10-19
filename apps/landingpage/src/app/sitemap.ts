import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/dictionary';
import { SITE } from '@/config/site';

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const pages: Entry[] = [
  // Home
  { path: '', changeFrequency: 'weekly', priority: 1 },

  // Product pages
  { path: '/equipment-register', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/field-inspections', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/inspection-reports', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/deadline-tracking', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/defect-tracking', changeFrequency: 'monthly', priority: 0.6 },

  // Company pages
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/mission', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/team', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/news', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/careers', changeFrequency: 'monthly', priority: 0.4 },

  // Legal pages
  { path: '/terms-of-use', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.2 },
];

/** Every language's URL of one page, for that page's hreflang cluster (reciprocal, with x-default). */
function languagesOf(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = `${SITE.url}/${locale}${path}`;
  // "/" redirects here, so it's the address search results should show for an
  // unmatched language rather than any one locale's own page.
  languages['x-default'] = `${SITE.url}/${defaultLocale}${path}`;
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return pages.flatMap((page) => {
    const languages = languagesOf(page.path);
    return locales.map((locale) => ({
      url: languages[locale]!,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
