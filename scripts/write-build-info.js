#!/usr/bin/env node
// Writes build-info.json at build time.
//
// Railway does not reliably expose RAILWAY_GIT_COMMIT_SHA to the *runtime*
// process, and the deploy image has no .git directory, so both the env lookup
// and `git rev-parse` in server.js fell through to 'dev'. Every build since
// v40 has therefore reported sha=dev, which disabled the stale-bundle warning
// the SHA existed to drive.
//
// Resolving at BUILD time and persisting the answer to a file fixes it for
// any host, because the file ships inside the image.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function resolveSha() {
  const envVars = [
    'RAILWAY_GIT_COMMIT_SHA',
    'GIT_COMMIT_SHA',
    'SOURCE_VERSION',          // Heroku
    'VERCEL_GIT_COMMIT_SHA',
    'RENDER_GIT_COMMIT',
    'COMMIT_SHA',
  ];
  for (const k of envVars) {
    if (process.env[k]) return { sha: process.env[k].slice(0, 7), from: k };
  }
  try {
    return { sha: execSync('git rev-parse --short HEAD').toString().trim(), from: 'git' };
  } catch {}
  return { sha: 'dev', from: 'fallback' };
}

const { sha, from } = resolveSha();
const info = { sha, builtAt: new Date().toISOString(), resolvedFrom: from };
const out = path.join(__dirname, '..', 'build-info.json');
fs.writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log(`[build-info] sha=${sha} (from ${from}) builtAt=${info.builtAt}`);
