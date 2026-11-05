import type { MetadataRoute } from 'next';
import { legal } from '@/lib/legal';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = legal.siteUrl;
  const lastModified = new Date();
  const routes = ['', '/termini', '/privacy', '/cookie', '/note-legali', '/contatti', '/accessibilita', '/sicurezza'];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));
}
