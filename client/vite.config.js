import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve SHA: build-info.json (written by scripts/write-build-info.js at the
// start of `npm run build`) → env → git → 'dev'. Reading the same file the
// server reads guarantees the client and server SHAs match, which is the whole
// point of the stale-bundle warning.
function resolveSha() {
  try {
    const info = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'build-info.json'), 'utf8'));
    if (info.sha && info.sha !== 'dev') return info.sha;
  } catch {}
  if (process.env.RAILWAY_GIT_COMMIT_SHA) return process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7);
  if (process.env.GIT_COMMIT_SHA) return process.env.GIT_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch {}
  return 'dev';
}
const buildSha = resolveSha();
const buildTime = new Date().toISOString();

// Plugin: stamp the SHA into sw.js after build copies it to dist/
function swVersionPlugin(sha) {
  return {
    name: 'sw-version',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, 'utf-8');
        fs.writeFileSync(swPath, content.replace('__CACHE_VERSION__', sha));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersionPlugin(buildSha)],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
