import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { extractPdfText, extractTextFromContent, decodeLiteralString } from '../src/lib/pdf';

/**
 * PDF extraction is the one input a text-only reader used to refuse. These tests
 * build a real (if minimal) PDF on the fly, both uncompressed and with a
 * FlateDecode content stream, so the inflate path is exercised for real.
 */

function pdfWith(contentStream: string, compress: boolean): Uint8Array {
  const contentBytes = new Uint8Array(Buffer.from(contentStream, 'latin1'));
  const streamData = compress ? new Uint8Array(deflateSync(contentBytes)) : contentBytes;
  const filter = compress ? ' /Filter /FlateDecode' : '';
  const header = '%PDF-1.4\n';
  const obj = `1 0 obj\n<< /Length ${streamData.length}${filter} >>\nstream\n`;
  const tail = '\nendstream\nendobj\n%%EOF\n';
  const head = Buffer.from(header + obj, 'latin1');
  const foot = Buffer.from(tail, 'latin1');
  const out = new Uint8Array(head.length + streamData.length + foot.length);
  out.set(head, 0);
  out.set(streamData, head.length);
  out.set(foot, head.length + streamData.length);
  return out;
}

const CONTENT = `BT
/F1 12 Tf
14 TL
72 720 Td
(Company procedure) Tj
T*
(1. Open the ticket in the tracker.) Tj
T*
(2. Reproduce the failure on staging.) Tj
T*
(3. Attach the log to the ticket.) Tj
ET`;

test('decodifica le stringhe letterali con gli escape', () => {
  assert.equal(decodeLiteralString('a\\nb'), 'a\nb');
  assert.equal(decodeLiteralString('paren \\(x\\)'), 'paren (x)');
  assert.equal(decodeLiteralString('\\101\\102'), 'AB');
});

test('estrae il testo dagli operatori del content stream', () => {
  const text = extractTextFromContent(CONTENT);
  assert.match(text, /Company procedure/);
  assert.match(text, /Open the ticket/);
  assert.match(text, /Reproduce the failure/);
  // T* deve produrre un a capo, non una riga unica.
  assert.ok(text.split('\n').length >= 4);
});

test('estrae il testo da un PDF non compresso', async () => {
  const result = await extractPdfText(pdfWith(CONTENT, false));
  assert.equal(result.ok, true, result.error);
  assert.match(result.text, /Company procedure/);
  assert.match(result.text, /Attach the log/);
});

test('estrae il testo da un PDF con stream FlateDecode', async () => {
  const result = await extractPdfText(pdfWith(CONTENT, true));
  assert.equal(result.ok, true, result.error);
  assert.match(result.text, /Company procedure/);
  assert.equal(result.inflated, 1);
});

test('rifiuta un file che non e un PDF', async () => {
  const result = await extractPdfText(new Uint8Array(Buffer.from('just text', 'latin1')));
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /Not a PDF/);
});

test('un PDF senza testo leggibile lo dice, invece di restituire rumore', async () => {
  const empty = pdfWith('BT /F1 12 Tf ET', false);
  const result = await extractPdfText(empty);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /almost no readable text|scan/);
});
