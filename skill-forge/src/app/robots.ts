import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await siteBase();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le aree personali e le API non hanno senso per i motori di ricerca.
        disallow: ['/api/', '/dashboard', '/create/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
