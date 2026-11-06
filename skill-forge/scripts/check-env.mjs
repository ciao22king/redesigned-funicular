#!/usr/bin/env node
/**
 * Quick check before a push: verify that the environment variables the
 * build cannot derive on its own are present.
 *
 *   node scripts/check-env.mjs
 *
 * It blocks nothing, it only warns.
 */
import { readFileSync, existsSync } from 'node:fs';

const required = [
  ['GITHUB_ID', 'GitHub OAuth App Client ID'],
  ['GITHUB_SECRET', 'GitHub OAuth App Client Secret'],
  ['NEXTAUTH_SECRET', 'openssl rand -base64 32'],
  ['NEXTAUTH_URL', 'http://localhost:3000 or the Worker URL'],
  ['OPENROUTER_API_KEY', 'OpenRouter key sk-or-v1-...'],
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
    console.log(`  missing ${key}  ->  ${hint}`);
    missing++;
  }
}

if (missing > 0) {
  console.log(`\n${missing} variables missing. Locally use .env.local, in production the GitHub secrets.`);
  process.exit(1);
}

console.log('\nAll variables are present.');