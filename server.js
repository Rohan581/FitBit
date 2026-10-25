const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { execSync } = require('child_process');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVER_STARTED_AT = new Date().toISOString();

// Build info — read from env (set during build) or derive from git
let BUILD_SHA = process.env.BUILD_SHA || 'dev';
let BUILD_TIME = process.env.BUILD_TIME || '';
if (BUILD_SHA === 'dev') {
  try { BUILD_SHA = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}
}
if (!BUILD_TIME) {
  try { BUILD_TIME = new Date().toISOString(); } catch {}
}

// Ensure data directory exists
const dataDir = path.dirname(process.env.DATABASE_PATH || './data/earned.db');
fs.mkdirSync(dataDir, { recursive: true });

// Initialize database
initDB();

app.use(cors());
app.use(express.json());

// Version endpoint — must never be cached
app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ sha: BUILD_SHA, builtAt: BUILD_TIME, startedAt: SERVER_STARTED_AT });
});

// API routes — safe loader so a broken module degrades instead of crash-looping
function useRoute(path, mod) {
  try {
    app.use(path, require(mod));
  } catch (err) {
    console.error(`[ROUTE FAILED] ${path} (${mod}): ${err.message}`);
    app.use(path, (req, res) => res.status(503).json({ error: `${path} is temporarily unavailable` }));
  }
}

useRoute('/api/foods', './routes/foods');
useRoute('/api/saved-meals', './routes/savedMeals');
useRoute('/api/food-logs', './routes/foodLogs');
useRoute('/api/exercise-logs', './routes/exerciseLogs');
useRoute('/api/sleep-logs', './routes/sleepLogs');
useRoute('/api/weight-logs', './routes/weightLogs');
useRoute('/api/points', './routes/points');
useRoute('/api/goal', './routes/goal');
useRoute('/api/weekly-summary', './routes/weeklySummary');
useRoute('/api/trends', './routes/trends');
useRoute('/api/suggestions', './routes/suggestions');
useRoute('/api/measurements', './routes/measurementLogs');
useRoute('/api/planning', './routes/planning');
useRoute('/api/dashboard', './routes/dashboard');
useRoute('/api/training', './routes/training');
useRoute('/api/rest-days', './routes/restDays');
useRoute('/api/push', './routes/push');
useRoute('/api/bank', './routes/bank');
useRoute('/api/export', './routes/export');
useRoute('/api/recipes', './routes/recipes');
useRoute('/api/steps', './routes/steps');

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, 'client', 'dist');

  // Service worker must not be cached — serve with no-cache headers
  app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Service-Worker-Allowed', '/');
    res.sendFile(path.join(clientDist, 'sw.js'));
  });

  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Earned server up — sha=${BUILD_SHA} builtAt=${BUILD_TIME} port=${PORT}`);
});
