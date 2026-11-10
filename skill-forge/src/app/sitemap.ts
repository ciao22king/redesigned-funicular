import type { MetadataRoute } from 'next';
import { siteBase } from '@/lib/site-url';
import { listSkillRefs, tagCounts, categoryCounts } from '@/lib/marketplace-db';
import { listIndexableCreators } from '@/lib/profile-db';
import { aggregateTags } from '@/lib/marketplace';
import { CATEGORIES, skillPath } from '@/lib/skill-page';

// Per request: the skills come from D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteBase();
  const lastModified = new Date();
  const routes = [
    '',
    '/demo',
    '/pre-program',
    '/marketplace',
    '/skills',
    '/creators',
    '/tags',
    '/use-cases',
    '/changelog',
    '/terms',
    '/privacy',
    '/security',
    '/cookie',
  ];

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
  let categoryEntries: MetadataRoute.Sitemap = [];
  try {
    const [refs, tags, owners, cats] = await Promise.all([
      listSkillRefs(),
      tagCounts().then((rows) => aggregateTags(rows)),
      listIndexableCreators(),
      categoryCounts().catch(() => []),
    ]);

    skillEntries = refs
      .filter((r) => r.id.includes('/'))
      .map((r) => {
        const [owner, slug] = r.id.split('/');
        return {
          url: `${base}${skillPath(owner, slug)}`,
          lastModified: r.updated_at ? new Date(r.updated_at) : lastModified,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        };
      });

    tagEntries = tags.map((t) => ({
      url: `${base}/tags/${t.tag}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    }));

    authorEntries = owners.map((o) => ({
      url: `${base}/creators/${o.login}`,
      lastModified: o.updatedAt ? new Date(o.updatedAt) : lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

    const usedCategories = new Set(cats.filter((c) => c.count > 0).map((c) => c.category));
    categoryEntries = CATEGORIES.filter((c) => usedCategories.has(c)).map((c) => ({
      url: `${base}/skills/category/${c}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    }));
  } catch {
    skillEntries = [];
    tagEntries = [];
    authorEntries = [];
    categoryEntries = [];
  }

  return [...staticEntries, ...skillEntries, ...tagEntries, ...categoryEntries, ...authorEntries];
}
