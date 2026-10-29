import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/dictionary';
import { languagesOf, pageUrl } from '@/lib/seo';

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

/** When the pages' content last changed (a fixed date: "now" on every build would say nothing). */
const LAST_MODIFIED = new Date('2026-10-29');

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.flatMap((page) => {
    const languages = languagesOf(page.path);
    return locales.map((locale) => ({
      url: pageUrl(locale, page.path),
      lastModified: LAST_MODIFIED,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
