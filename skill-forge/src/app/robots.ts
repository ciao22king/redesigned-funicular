import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await siteBase();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Personal areas and the API make no sense for search engines.
        disallow: ['/api/', '/dashboard', '/create/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
