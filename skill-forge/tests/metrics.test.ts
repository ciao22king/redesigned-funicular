import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDropoff,
  conversionRate,
  filterClientAssertable,
  formatPercent,
  FUNNEL_STEPS,
  isMetricEvent,
  MAX_DURATION_MS,
  metricDay,
  METRIC_EVENTS,
  normalizeBatch,
  normalizeMetric,
  summarizeMetrics,
  CLIENT_ASSERTABLE_EVENTS,
} from '../src/lib/metrics';

test('tutti gli eventi noti sono accettati', () => {
  for (const event of METRIC_EVENTS) {
    assert.equal(isMetricEvent(event), true, event);
  }
});

test('un evento sconosciuto viene rifiutato', () => {
  assert.equal(isMetricEvent('teleport'), false);
  assert.equal(normalizeMetric({ event: 'teleport' }), null);
});

test('la giornata e in UTC, YYYY-MM-DD', () => {
  // 23:30 UTC del 5 resta il 5, anche se in un fuso a est e gia il 6.
  assert.equal(metricDay(new Date('2026-11-05T23:30:00Z')), '2026-11-05');
  assert.equal(metricDay(new Date('2026-11-05T00:00:00Z')), '2026-11-05');
});

test('il target viene sanitizzato', () => {
  const m = normalizeMetric({ event: 'download', target: '<b>owner/slug</b>' });
  assert.ok(!m?.target.includes('<'));
});

test('la durata e limitata e solo per l evento di timing', () => {
  const timing = normalizeMetric({ event: 'generation_ms', value: 5000 });
  assert.equal(timing?.totalMs, 5000);

  const huge = normalizeMetric({ event: 'generation_ms', value: 99_999_999 });
  assert.equal(huge?.totalMs, MAX_DURATION_MS);

  const notTiming = normalizeMetric({ event: 'visit', value: 5000 });
  assert.equal(notTiming?.totalMs, 0);
});

test('un batch unisce gli eventi duplicati', () => {
  const batch = normalizeBatch([
    { event: 'visit' },
    { event: 'visit' },
    { event: 'download', target: 'a/b' },
  ]);
  const visit = batch.find((m) => m.event === 'visit');
  assert.equal(visit?.count, 2);
  assert.equal(batch.length, 2);
});

test('un batch scarta gli eventi sconosciuti', () => {
  const batch = normalizeBatch([{ event: 'visit' }, { event: 'nope' }]);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].event, 'visit');
});

test('conversionRate gestisce il denominatore zero', () => {
  assert.equal(conversionRate(0, 0), 0);
  assert.equal(conversionRate(5, 10), 0.5);
  assert.equal(conversionRate(20, 10), 1);
});

test('formatPercent ha un decimale', () => {
  assert.equal(formatPercent(0.1234), '12.3%');
});

test('il drop-off mostra dove si perde gente', () => {
  const rows = computeDropoff({
    funnel_start: 100,
    funnel_material: 80,
    funnel_submit: 60,
    funnel_result: 55,
    funnel_download: 30,
    funnel_publish: 5,
  });
  assert.equal(rows.length, FUNNEL_STEPS.length);
  assert.equal(rows[0].count, 100);
  assert.equal(rows[0].dropFromPrevious, 0);
  // Tra material (80) e submit (60) se ne perdono 20.
  assert.equal(rows[2].dropFromPrevious, 20);
  assert.equal(rows[5].shareOfStart, 0.05);
});

test('il drop-off con dati mancanti non produce NaN', () => {
  const rows = computeDropoff({});
  for (const row of rows) {
    assert.equal(Number.isFinite(row.shareOfStart), true);
    assert.equal(row.dropFromPrevious, 0);
  }
});

test('il riepilogo calcola la conversione visita-generazione', () => {
  const summary = summarizeMetrics({
    events: { visit: 200, generate: 50, download: 20, publish: 4 },
    generationMs: 60_000,
    generationSamples: 20,
  });
  assert.equal(summary.visits, 200);
  assert.equal(summary.generations, 50);
  assert.equal(summary.visitToGeneration, 0.25);
  assert.equal(summary.averageGenerationMs, 3000);
});

test('il riepilogo senza dati non divide per zero', () => {
  const summary = summarizeMetrics({ events: {}, generationMs: 0, generationSamples: 0 });
  assert.equal(summary.visitToGeneration, 0);
  assert.equal(summary.averageGenerationMs, 0);
});

test('gli eventi di esito non sono asseribili dal client', () => {
  // Regressione: dal beacon anonimo si poteva gonfiare qualsiasi contatore,
  // perche' anche `download`/`publish`/`generate` erano accettati.
  for (const event of ['download', 'publish', 'generate', 'demo_generate']) {
    assert.equal(CLIENT_ASSERTABLE_EVENTS.includes(event as never), false, `${event} non deve essere asseribile`);
  }
  for (const event of ['visit', 'returning', 'funnel_download', 'generation_ms']) {
    assert.equal(CLIENT_ASSERTABLE_EVENTS.includes(event as never), true, `${event} deve essere asseribile`);
  }
});

test('il filtro scarta un download anonimo ma tiene le visite', () => {
  const batch = normalizeBatch([
    { event: 'download', target: 'attacker/skill' },
    { event: 'visit', target: 'attacker/skill' },
    { event: 'publish', target: 'attacker/skill' },
    { event: 'funnel_download' },
  ]);
  const kept = filterClientAssertable(batch).map((m) => m.event).sort();
  assert.deepEqual(kept, ['funnel_download', 'visit']);
});
