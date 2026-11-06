import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteBase();
  const lastModified = new Date();
  const routes = ['', '/marketplace', '/termini', '/privacy', '/cookie'];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));
}
