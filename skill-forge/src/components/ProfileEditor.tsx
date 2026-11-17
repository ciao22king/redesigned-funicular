'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SOCIALS, PROFILE_LIMITS, avatarFor, displayNameFor, type ProfileInput } from '@/lib/profile';

interface ProfileResponse {
  login?: string;
  editable?: ProfileInput;
  profile?: { displayName: string; bio: string; avatarUrl: string };
  error?: string;
}

const EMPTY: ProfileInput = {
  displayName: '',
  bio: '',
  avatarUrl: '',
  x: '',
  linkedin: '',
  youtube: '',
  website: '',
  newsletter: '',
};

/**
 * The profile editor, in the dashboard.
 *
 * It reads and writes `/api/me/profile`, which is scoped to the signed-in
 * login: a person only ever edits their own profile. The public link is shown
 * next to the form so the effect is obvious, and a small preview reflects the
 * name and avatar as they are typed.
 */
export function ProfileEditor() {
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [login, setLogin] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/profile')
      .then(async (r) => {
        const data = (await r.json()) as ProfileResponse;
        if (!r.ok) throw new Error(data.error ?? 'Could not load your profile.');
        setLogin(data.login ?? '');
        setForm({ ...EMPTY, ...(data.editable ?? {}) });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  function field(key: keyof ProfileInput) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as ProfileResponse;
      if (!res.ok) throw new Error(data.error ?? 'The profile could not be saved.');
      setForm({ ...EMPTY, ...(data.editable ?? {}) });
      setNotice('Profile saved. It is live on your public page.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  const name = displayNameFor(login || 'you', { displayName: form.displayName ?? '' });
  const avatar = avatarFor(login || 'github', { avatarUrl: form.avatarUrl ?? '' });

  return (
    <section className="rounded-2xl border border-[--line] bg-[--surface-raised] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[--ink]">Public profile</h2>
        {login && (
          <Link
            href={`/creators/${login}`}
            className="text-sm text-[--accent] underline underline-offset-2"
          >
            View your public page →
          </Link>
        )}
      </div>

      <p className="mt-2 max-w-prose text-sm text-[--ink-muted]">
        This is what people see on your creator page. Everything is optional:
        leave a field empty and we fall back to your GitHub name and avatar.
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-[--ink-muted]">Loading...</p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full border border-[--line] bg-[--surface-sunken]"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-[--ink]">{name}</p>
              <p className="truncate text-xs text-[--ink-muted]">@{login || 'github'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <Field label="Display name" hint={`${PROFILE_LIMITS.displayName} characters max`}>
              <input
                type="text"
                value={form.displayName ?? ''}
                onChange={field('displayName')}
                maxLength={PROFILE_LIMITS.displayName}
                className="w-full rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
                placeholder={login}
              />
            </Field>

            <Field label="Bio" hint={`${PROFILE_LIMITS.bio} characters max`}>
              <textarea
                value={form.bio ?? ''}
                onChange={field('bio')}
                rows={3}
                maxLength={PROFILE_LIMITS.bio}
                className="w-full resize-y rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
                placeholder="What you build, in a sentence or two."
              />
            </Field>

            <Field label="Avatar URL" hint="Leave empty to use your GitHub avatar">
              <input
                type="url"
                value={form.avatarUrl ?? ''}
                onChange={field('avatarUrl')}
                className="w-full rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
                placeholder="https://..."
              />
            </Field>

            <div className="hairline my-1" />

            <p className="text-xs font-medium uppercase tracking-wider text-[--ink-muted]">
              Links
            </p>
            {SOCIALS.map((s) => (
              <Field
                key={s.key}
                label={s.label}
                hint={s.base ? `Handle or full URL` : 'A domain or a full URL'}
              >
                <input
                  type="text"
                  value={(form[s.key] as string | undefined) ?? ''}
                  onChange={field(s.key)}
                  className="w-full rounded-lg border border-[--line] bg-[--surface-sunken] px-3 py-2 text-sm text-[--ink] outline-none focus:border-[--accent]"
                  placeholder={s.base ? `@yourhandle` : 'https://...'}
                />
              </Field>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-[--accent] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save profile'}
            </button>
          </div>

          {notice && <p className="mt-3 text-sm text-[--accent]">{notice}</p>}
          {error && <p className="mt-3 text-sm text-[oklch(45%_0.14_28)]">{error}</p>}
        </>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-[--ink]">{label}</span>
        {hint && <span className="text-[11px] text-[--ink-muted]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
