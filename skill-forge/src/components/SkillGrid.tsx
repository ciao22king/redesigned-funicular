import { SkillCard } from '@/components/SkillCard';
import { skillCardsFor } from '@/lib/skill-cards';
import type { SkillSummary } from '@/lib/marketplace';

/**
 * Server-rendered grid of skill cards, shared by the index, category, tag and
 * author pages.
 *
 * It is a server component: those pages are about discovery, so the list ships
 * no JavaScript. The card data (author, badges, downloads) is loaded in one
 * batch for the whole page, never per card.
 */
export async function SkillGrid({ skills }: { skills: SkillSummary[] }) {
  const cards = await skillCardsFor(skills);

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <SkillCard key={card.id} skill={card} />
      ))}
    </ul>
  );
}
