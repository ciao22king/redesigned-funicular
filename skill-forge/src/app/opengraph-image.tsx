import { ImageResponse } from 'next/og';

/**
 * Site-wide Open Graph card, generated once at build time.
 *
 * It is a static file convention (not a runtime route): `next build` renders it
 * with Node, so it works on Cloudflare Workers too, where rendering an image on
 * demand from `next/og` can stall the runtime. Every page without its own card
 * — including each `/skills/[owner]/[slug]` skill page — inherits this one, so a
 * shared link shows a real image instead of a bare URL.
 */
export const alt = 'Skill Forge — from scattered notes to complete skills for AI agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f7f1e8 0%, #efe4d6 100%)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 9999,
              background: '#c25a3a',
              display: 'flex',
            }}
          />
          <div style={{ fontSize: 36, fontWeight: 700, color: '#2b211c' }}>Skill Forge</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 5,
              textTransform: 'uppercase',
              color: '#8a7566',
              marginBottom: 22,
            }}
          >
            Skills for AI agents
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#2b211c',
              maxWidth: 1000,
            }}
          >
            From scattered notes to complete skills.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 26,
            color: '#5c4c42',
          }}
        >
          <div>Generate · Publish · Discover</div>
          <div style={{ marginLeft: 'auto', color: '#c25a3a', fontWeight: 600 }}>skill-forge</div>
        </div>
      </div>
    ),
    size,
  );
}
