import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

interface Params {
  owner: string;
}

/**
 * The old author URL.
 *
 * Author pages moved to `/creators/[username]` when profiles gained avatars,
 * bios, badges and links. This route stays so every link already shared keeps
 * working: it forwards to the new address instead of answering 404.
 */
export default async function AuthorRedirect({ params }: { params: Promise<Params> }) {
  const { owner } = await params;
  redirect(`/creators/${owner}`);
}
