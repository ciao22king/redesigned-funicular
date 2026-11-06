#!/usr/bin/env node
/**
 * Verifica rapida prima di un push: controlla che le variabili
 * d'ambiente che il build non può ricavare da sé siano presenti.
 *
 *   node scripts/check-env.mjs
 *
 * Non blocca nulla, avvisa soltanto.
 */
import { readFileSync, existsSync } from 'node:fs';

const required = [
  ['GITHUB_ID', 'Client ID della OAuth App GitHub'],
  ['GITHUB_SECRET', 'Client Secret della OAuth App GitHub'],
  ['NEXTAUTH_SECRET', 'openssl rand -base64 32'],
  ['NEXTAUTH_URL', 'http://localhost:3000 oppure l\'URL del Worker'],
  ['OPENROUTER_API_KEY', 'Chiave OpenRouter sk-or-v1-...'],
];

let env = { ...process.env };

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

let missing = 0;
for (const [key, hint] of required) {
  if (env[key]) {
    console.log(`  ok    ${key}`);
  } else {
    console.log(`  manca ${key}  ->  ${hint}`);
    missing++;
  }
}

if (missing > 0) {
  console.log(`\n${missing} variabili mancanti. In locale usa .env.local, in produzione i secret GitHub.`);
  process.exit(1);
}

console.log('\nTutte le variabili sono presenti.');