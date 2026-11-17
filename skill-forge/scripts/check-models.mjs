/**
 * Checks every provider's model ladder against its live catalogue.
 *
 * Model ids are retired without notice: `xingchen-agi/xing4.0-29b-a4b:free`
 * disappeared from OpenRouter and kept burning a fallback attempt until someone
 * read the error. This script turns that silent rot into an explicit failure.
 *
 * OpenRouter needs no key to read the catalogue. Groq does, so its check is
 * skipped when GROQ_API_KEY is unset.
 *
 * Usage: node scripts/check-models.mjs
 * Exit code 1 when an id in a ladder no longer exists.
 */
import { PROVIDERS, REASONING_EFFORT } from '../src/lib/providers.ts';

async function openrouterCatalogue() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();
  return new Map(data.map((m) => [m.id, m]));
}

async function groqCatalogue(key) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();
  return new Map(data.map((m) => [m.id, m]));
}

let missing = 0;

for (const provider of PROVIDERS) {
  const key = (provider.apiKey() ?? '').trim();
  console.log(`\n${provider.label}`);

  let catalogue;
  try {
    if (provider.id === 'openrouter') {
      catalogue = await openrouterCatalogue();
    } else if (key) {
      catalogue = await groqCatalogue(key);
    } else {
      console.log('  skipped: no GROQ_API_KEY set');
      continue;
    }
  } catch (err) {
    console.error(`  cannot read the catalogue: ${err.message}`);
    missing += 1;
    continue;
  }

  for (const id of provider.models()) {
    if (catalogue.has(id)) {
      console.log(`  ok       ${id}`);
    } else {
      console.error(`  MISSING  ${id}`);
      missing += 1;
    }
  }
}

console.log(`\nReasoning effort sent to OpenRouter: ${REASONING_EFFORT || '(field omitted)'}`);
if (missing > 0) {
  console.error(`\n${missing} model(s) no longer exist: update the ladder in src/lib/providers.ts.`);
  process.exit(1);
}
console.log('\nEvery model in every ladder exists.');
