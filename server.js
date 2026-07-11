const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.dirname(process.env.DATABASE_PATH || './data/earned.db');
fs.mkdirSync(dataDir, { recursive: true });

// Initialize database
initDB();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/foods', require('./routes/foods'));
app.use('/api/saved-meals', require('./routes/savedMeals'));
app.use('/api/food-logs', require('./routes/foodLogs'));
app.use('/api/exercise-logs', require('./routes/exerciseLogs'));
app.use('/api/sleep-logs', require('./routes/sleepLogs'));
app.use('/api/weight-logs', require('./routes/weightLogs'));
app.use('/api/points', require('./routes/points'));
app.use('/api/goal', require('./routes/goal'));
app.use('/api/weekly-summary', require('./routes/weeklySummary'));
app.use('/api/trends', require('./routes/trends'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Earned server running on port ${PORT}`);
});
