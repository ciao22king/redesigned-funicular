import { permanentRedirect } from 'next/navigation';
import { skillPath } from '@/lib/skill-page';

export const runtime = 'nodejs';

interface Params {
  owner: string;
  slug: string;
}

/**
 * The old skill URL.
 *
 * Skill pages moved from `/s/<owner>/<slug>` to `/skills/<owner>/<slug>` when
 * they gained a category, a version history and related skills. This route stays
 * so every link already shared keeps working: it forwards to the new address
 * instead of answering 404.
 *
 * The move is permanent (308), not temporary: search engines should transfer the
 * old URL's signals to the new one and drop the old address from results.
 */
export default async function LegacySkillRedirect({ params }: { params: Promise<Params> }) {
  const { owner, slug } = await params;
  permanentRedirect(skillPath(owner, slug));
}

