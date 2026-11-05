import type { MetadataRoute } from 'next';
import { legal } from '@/lib/legal';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le aree personali e le API non hanno senso per i motori di ricerca.
        disallow: ['/api/', '/dashboard', '/create/'],
      },
    ],
    sitemap: `${legal.siteUrl}/sitemap.xml`,
    host: legal.siteUrl,
  };
}
