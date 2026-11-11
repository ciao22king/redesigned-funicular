/**
 * Checks the model ladder against the live OpenRouter catalogue.
 *
 * Free model ids are retired without notice: `xingchen-agi/xing4.0-29b-a4b:free`
 * disappeared and kept burning a fallback attempt until someone read the error
 * message. This script turns that silent rot into an explicit failure, and
 * reports which models make reasoning mandatory (they reject effort "none").
 *
 * Usage: node scripts/check-models.mjs
 * Exit code 1 when an id in the ladder no longer exists.
 */
import { MODELS, REASONING_EFFORT } from '../src/lib/ai.ts';

const CATALOGUE = 'https://openrouter.ai/api/v1/models';

const res = await fetch(CATALOGUE);
if (!res.ok) {
  console.error(`Cannot read the OpenRouter catalogue: HTTP ${res.status}`);
  process.exit(1);
}

const { data } = await res.json();
const byId = new Map(data.map((m) => [m.id, m]));

let missing = 0;
console.log(`Reasoning effort sent: ${REASONING_EFFORT || '(field omitted)'}\n`);
for (const id of MODELS) {
  const model = byId.get(id);
  if (!model) {
    console.error(`MISSING  ${id}`);
    missing += 1;
    continue;
  }
  const reasoning = model.reasoning ?? {};
  const notes = [
    reasoning.mandatory ? 'reasoning mandatory' : '',
    (model.supported_parameters ?? []).includes('reasoning') ? 'reasoning' : 'no reasoning',
  ].filter(Boolean);
  console.log(`ok       ${id}  [${notes.join(', ')}]`);
}

if (missing > 0) {
  console.error(`\n${missing} model(s) in the ladder no longer exist: update MODELS in src/lib/ai.ts.`);
  process.exit(1);
}
console.log('\nEvery model in the ladder exists.');
