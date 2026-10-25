#!/usr/bin/env node
// Fetch /api/version from production and print deploy info
const url = process.argv[2] || process.env.PRODUCTION_URL;
if (!url) {
  console.error('Usage: npm run verify -- <production-url>');
  console.error('   or: PRODUCTION_URL=https://... npm run verify');
  process.exit(1);
}

const base = url.replace(/\/+$/, '');
fetch(`${base}/api/version`)
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(v => {
    console.log(`\n  Deployed SHA:  ${v.sha}`);
    console.log(`  Built at:     ${v.builtAt}`);
    console.log(`  Server up:    ${v.startedAt}\n`);
  })
  .catch(e => { console.error('Verify failed:', e.message); process.exit(1); });
