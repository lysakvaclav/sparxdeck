import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/dictionary';
import { SITE } from '@/config/site';

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const pages: Entry[] = [
  // Home
  { path: '', changeFrequency: 'weekly', priority: 0.9 },

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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...locales.flatMap((locale) =>
      pages.map((page) => ({
        url: `${SITE.url}/${locale}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      })),
    ),
  ];
}
