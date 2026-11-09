import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  extensionOf,
  formatBytes,
  isAllowedExtension,
  isPdf,
  uploadRulesLabel,
  validateFile,
  validateFileBatch,
} from '../src/lib/uploads';

test('l estensione si legge in minuscolo', () => {
  assert.equal(extensionOf('README.MD'), '.md');
  assert.equal(extensionOf('notes.txt'), '.txt');
  assert.equal(extensionOf('Makefile'), '');
  assert.equal(extensionOf('.gitignore'), '');
});

test('le estensioni di testo sono ammesse', () => {
  for (const name of ['a.md', 'b.txt', 'c.json', 'd.yaml', 'e.ts', 'f.py', 'g.sql']) {
    assert.equal(isAllowedExtension(name), true, name);
  }
});

test('binari e archivi sono rifiutati per estensione', () => {
  for (const name of ['a.exe', 'b.zip', 'c.png', 'e.sh.bin', 'noext']) {
    assert.equal(isAllowedExtension(name), false, name);
  }
});

test('pdf e trascrizioni sono ammessi per estensione', () => {
  for (const name of ['doc.pdf', 'call.srt', 'call.vtt']) {
    assert.equal(isAllowedExtension(name), true, name);
  }
  assert.equal(isPdf('doc.pdf'), true);
  assert.equal(isPdf('doc.PDF'), true);
  assert.equal(isPdf('doc.md'), false);
});

test('un file troppo grande e rifiutato con il limite leggibile', () => {
  const check = validateFile({ name: 'big.md', size: MAX_FILE_BYTES + 1 });
  assert.equal(check.ok, false);
  assert.match(check.error ?? '', /limit per file/);
});

test('un file di dimensione al limite passa', () => {
  assert.equal(validateFile({ name: 'ok.md', size: MAX_FILE_BYTES }).ok, true);
});

test('il numero di file e limitato', () => {
  const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.md`, size: 10 }));
  const check = validateFileBatch(files);
  assert.equal(check.ok, false);
  assert.match(check.error ?? '', new RegExp(String(MAX_FILES)));
});

test('la dimensione combinata e limitata', () => {
  const each = Math.ceil(MAX_TOTAL_BYTES / 4) + 1;
  const files = Array.from({ length: 4 }, (_, i) => ({ name: `f${i}.md`, size: each }));
  const check = validateFileBatch(files);
  assert.equal(check.ok, false);
  assert.match(check.error ?? '', /combined limit/);
});

test('un lotto valido passa', () => {
  assert.equal(validateFileBatch([{ name: 'a.md', size: 100 }, { name: 'b.txt', size: 200 }]).ok, true);
});

test('le dimensioni si mostrano in unita leggibili', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
});

test('accettazione ed etichetta derivano dalle stesse costanti', () => {
  assert.match(ACCEPT_ATTRIBUTE, /\.md/);
  assert.match(uploadRulesLabel(), new RegExp(String(MAX_FILES)));
  assert.match(uploadRulesLabel(), /KB/);
});
