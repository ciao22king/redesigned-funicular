import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';
import { listSkillRefs } from '@/lib/marketplace-db';

// Per request: the skills come from D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteBase();
  const lastModified = new Date();
  const routes = ['', '/marketplace', '/terms', '/privacy', '/cookie'];

  const staticEntries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));

  // One indexable page per published skill. If D1 is unreachable, we still
  // return the static pages instead of failing the whole sitemap.
  let skillEntries: MetadataRoute.Sitemap = [];
  try {
    const refs = await listSkillRefs();
    skillEntries = refs.map((r) => ({
      url: `${base}/s/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    skillEntries = [];
  }

  return [...staticEntries, ...skillEntries];
}
