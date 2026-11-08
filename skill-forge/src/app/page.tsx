import { Landing } from '@/components/Landing';
import { publicUserCount } from '@/lib/users-db';
import { featuredSkills } from '@/lib/creator-db';

// Per request: the count comes from D1, bound on the Worker only at runtime.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // The count is read server-side, so it is in the HTML: a crawler sees it
  // without running JavaScript. `undefined` (missing binding) hides it.
  // The canonical URL and the RSS autodiscovery come from the root layout.
  const [userCount, featured] = await Promise.all([
    publicUserCount(),
    featuredSkills(3).catch(() => []),
  ]);

  return <Landing userCount={userCount} featured={featured} />;
}
