import { Landing } from '@/components/Landing';
import { featuredSkills } from '@/lib/creator-db';

// Per request: the featured skills come from D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // The featured skills are read server-side, so they are in the HTML: a crawler
  // sees them without running JavaScript. The canonical URL and the RSS
  // autodiscovery come from the root layout.
  const featured = await featuredSkills(3).catch(() => []);

  return <Landing featured={featured} />;
}
