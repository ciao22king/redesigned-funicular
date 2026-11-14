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
        disallow: ['/api/', '/dashboard', '/create/', '/admin'],
      },
      // AI crawlers are explicitly welcome: the site is public content and the
      // goal is to be found, quoted and linked by assistants. `llms.txt` is the
      // map they read.
      {
        userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'],
        allow: '/',
        disallow: ['/api/', '/dashboard', '/create/', '/admin'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
