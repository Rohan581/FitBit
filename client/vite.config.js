import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Resolve SHA: Railway env → generic env → git → 'dev'
function resolveSha() {
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
