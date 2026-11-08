import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';
import { listOwners, listSkillRefs, tagCounts } from '@/lib/marketplace-db';
import { aggregateTags } from '@/lib/marketplace';

// Per request: the skills come from D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteBase();
  const lastModified = new Date();
  const routes = ['', '/demo', '/marketplace', '/tags', '/terms', '/privacy', '/cookie'];

  const staticEntries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));

  // One indexable page per published skill, per tag and per author. If D1 is
  // unreachable, we still return the static pages instead of failing the whole
  // sitemap.
  let skillEntries: MetadataRoute.Sitemap = [];
  let tagEntries: MetadataRoute.Sitemap = [];
  let authorEntries: MetadataRoute.Sitemap = [];
  try {
    const [refs, tags, owners] = await Promise.all([
      listSkillRefs(),
      tagCounts().then((rows) => aggregateTags(rows)),
      listOwners(),
    ]);

    skillEntries = refs.map((r) => ({
      url: `${base}/s/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    tagEntries = tags.map((t) => ({
      url: `${base}/tags/${t.tag}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    }));

    authorEntries = owners.map((o) => ({
      url: `${base}/u/${o.owner}`,
      lastModified: o.updated_at ? new Date(o.updated_at) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch {
    skillEntries = [];
    tagEntries = [];
    authorEntries = [];
  }

  return [...staticEntries, ...skillEntries, ...tagEntries, ...authorEntries];
}
