const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, getMondayIST, daysAgoIST } = require('../dateUtils');

// GET /api/planning
router.get('/', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  if (!goal) return res.json({ error: 'No goal configured' });

  const today = todayIST();
  const allWeights = db.prepare('SELECT * FROM weight_logs ORDER BY date ASC').all();

  if (allWeights.length < 7) {
    return res.json({ insufficient_data: true, message: 'Need at least 7 weight entries to show planning data.' });
  }

  // Compute 7-day rolling averages
  const rollingAvgs = allWeights.map((w, i) => {
    const window = allWeights.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, x) => s + x.weight_kg, 0) / window.length;
    return { date: w.date, avg: Math.round(avg * 100) / 100 };
  });

  const latestAvg = rollingAvgs[rollingAvgs.length - 1].avg;
  const startWeight = goal.start_weight_kg || 90;
  const goalWeight = goal.goal_weight_kg || 80;
  const goalDate = goal.goal_date || goal.target_date;
  const startDate = goal.start_date;

  if (!startDate) {
    return res.json({ insufficient_data: true, message: 'Start date not set in goal.' });
  }

  // --- Required vs actual rate ---
  let required_rate = null;
  let actual_rate = null;
  let behind_pace_suggestion = null;
  let consecutive_behind_weeks = 0;

  if (goalDate) {
    const todayMs = new Date(today + 'T12:00:00Z').getTime();
    const goalMs = new Date(goalDate + 'T12:00:00Z').getTime();
    const weeksRemaining = Math.max(0.5, (goalMs - todayMs) / (7 * 86400000));
    const kgRemaining = latestAvg - goalWeight;
    required_rate = kgRemaining > 0 ? Math.round((kgRemaining / weeksRemaining) * 100) / 100 : 0;
  }

  // Actual rate: weight change over last 4 weeks from rolling averages
  const fourWeeksAgo = daysAgoIST(28);
  const fourWeekAvgs = rollingAvgs.filter(r => r.date >= fourWeeksAgo);
  if (fourWeekAvgs.length >= 7) {
    const startAvg = fourWeekAvgs[0].avg;
    const endAvg = fourWeekAvgs[fourWeekAvgs.length - 1].avg;
    const weeksSpanned = Math.max(1, (
      new Date(fourWeekAvgs[fourWeekAvgs.length - 1].date + 'T12:00:00Z') -
      new Date(fourWeekAvgs[0].date + 'T12:00:00Z')
    ) / (7 * 86400000));
    actual_rate = Math.round(((startAvg - endAvg) / weeksSpanned) * 100) / 100;
  }

  // Behind-pace check: if actual lags required by >20% for 2 consecutive weeks
  if (required_rate > 0 && actual_rate !== null) {
    // Check last 2 weeks
    for (let w = 0; w < 2; w++) {
      const weekEnd = daysAgoIST(w * 7);
      const weekStart = daysAgoIST((w + 2) * 7);
      const weekAvgs = rollingAvgs.filter(r => r.date >= weekStart && r.date <= weekEnd);
      if (weekAvgs.length >= 3) {
        const ws = weekAvgs[0].avg;
        const we = weekAvgs[weekAvgs.length - 1].avg;
        const span = Math.max(1, (new Date(weekAvgs[weekAvgs.length - 1].date + 'T12:00:00Z') - new Date(weekAvgs[0].date + 'T12:00:00Z')) / (7 * 86400000));
        const rate = (ws - we) / span;
        if (rate < required_rate * 0.8) consecutive_behind_weeks++;
      }
    }
    if (consecutive_behind_weeks >= 2 && actual_rate < required_rate * 0.8) {
      const dailyGap = Math.round(((required_rate - actual_rate) * 7700) / 7);
      behind_pace_suggestion = `You're behind pace. The gap is about ${dailyGap} calories a day.`;
    }
  }

  // --- Pace verdict ---
  const startMs = new Date(startDate + 'T12:00:00Z').getTime();
  const todayMs = new Date(today + 'T12:00:00Z').getTime();
  const daysSinceStart = (todayMs - startMs) / (1000 * 60 * 60 * 24);

  const weeklyLossRate = startWeight * 0.006;
  const expectedWeightToday = startWeight - (weeklyLossRate * daysSinceStart / 7);
  const gap = latestAvg - expectedWeightToday;

  let pace_verdict, pace_label;
  if (gap <= -0.5) { pace_verdict = 'ahead'; pace_label = 'Ahead of pace'; }
  else if (gap <= 0.5) { pace_verdict = 'on_track'; pace_label = 'On track'; }
  else if (gap <= 1.5) { pace_verdict = 'slightly_behind'; pace_label = 'Slightly behind'; }
  else { pace_verdict = 'behind'; pace_label = 'Behind pace'; }

  // --- This week's target weight ---
  const mondayStr = getMondayIST(today);
  const sundayMs = new Date(mondayStr + 'T12:00:00Z').getTime() + 6 * 86400000;
  const daysToSunday = (sundayMs - startMs) / (1000 * 60 * 60 * 24);
  const weekTargetWeight = Math.round((startWeight - (weeklyLossRate * daysToSunday / 7)) * 100) / 100;

  // --- Projected finish date ---
  let projected_finish = null;
  let projection_available = false;

  const weeklyAvgs = [];
  const seenWeeks = new Set();
  for (const ra of rollingAvgs) {
    const week = getMondayIST(ra.date);
    if (!seenWeeks.has(week)) {
      seenWeeks.add(week);
      const weekEntries = rollingAvgs.filter(r => getMondayIST(r.date) === week);
      weeklyAvgs.push({ week, avg: weekEntries[weekEntries.length - 1].avg });
    }
  }

  if (weeklyAvgs.length >= 3) {
    projection_available = true;

    // Exclude maintenance period weeks from regression
    const regressionData = weeklyAvgs.filter(w => {
      if (!goal.maintenance_start || !goal.maintenance_end) return true;
      // Exclude if the week overlaps maintenance
      const weekEnd = new Date(w.week + 'T12:00:00Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      return !(w.week >= goal.maintenance_start && w.week <= goal.maintenance_end) &&
             !(weekEndStr >= goal.maintenance_start && weekEndStr <= goal.maintenance_end);
    });

    if (regressionData.length >= 3) {
      const n = regressionData.length;
      const xVals = regressionData.map((_, i) => i);
      const yVals = regressionData.map(w => w.avg);
      const xMean = xVals.reduce((s, x) => s + x, 0) / n;
      const yMean = yVals.reduce((s, y) => s + y, 0) / n;
      const num = xVals.reduce((s, x, i) => s + (x - xMean) * (yVals[i] - yMean), 0);
      const den = xVals.reduce((s, x) => s + (x - xMean) ** 2, 0);
      const slope = den !== 0 ? num / den : 0;

      if (slope < 0) {
        const weeksToGoal = (latestAvg - goalWeight) / Math.abs(slope);
        const finishDate = new Date(todayMs + weeksToGoal * 7 * 86400000);

        let plausible = true;
        if (goalDate) {
          const targetMs = new Date(goalDate + 'T12:00:00Z').getTime();
          const plannedDurationMs = targetMs - startMs;
          const projectedDurationMs = finishDate.getTime() - startMs;
          if (projectedDurationMs > plannedDurationMs * 2) plausible = false;
        }

        projected_finish = plausible ? finishDate.toISOString().split('T')[0] : 'implausible';
      } else {
        projected_finish = 'not_losing';
      }
    }
  }

  // --- Diagnostics when behind ---
  let diagnostic = null;
  if (pace_verdict === 'slightly_behind' || pace_verdict === 'behind') {
    diagnostic = computeDiagnostic(db, goal, today);
  }

  // --- Milestone countdown ---
  const milestones = db.prepare('SELECT * FROM milestones ORDER BY weight_kg_threshold DESC').all();
  const nextMilestone = milestones.find(m => !m.achieved_date && latestAvg > m.weight_kg_threshold);
  let milestone_countdown = null;
  if (nextMilestone) {
    let target_date_str = null;
    if (weeklyLossRate > 0) {
      const weeksToMilestone = (startWeight - nextMilestone.weight_kg_threshold) / weeklyLossRate;
      const milestoneDate = new Date(startMs + weeksToMilestone * 7 * 86400000);
      target_date_str = milestoneDate.toISOString().split('T')[0];
    }
    milestone_countdown = {
      weight: nextMilestone.weight_kg_threshold,
      kg_remaining: Math.round((latestAvg - nextMilestone.weight_kg_threshold) * 10) / 10,
      target_date: target_date_str,
    };
  }

  // --- Waist context ---
  let waist_context = null;
  const threeWeeksAgo = daysAgoIST(21);
  const recentMeasurements = db.prepare(
    'SELECT waist_cm, date FROM measurement_logs WHERE date >= ? ORDER BY date ASC'
  ).all(threeWeeksAgo);

  if (recentMeasurements.length >= 2) {
    const firstWaist = recentMeasurements[0].waist_cm;
    const lastWaist = recentMeasurements[recentMeasurements.length - 1].waist_cm;
    const waistChange = Math.round((lastWaist - firstWaist) * 10) / 10;

    if (pace_verdict === 'on_track' || pace_verdict === 'slightly_behind') {
      if (waistChange < -0.5) {
        waist_context = `Waist is down ${Math.abs(waistChange)} cm over recent measurements — fat loss is happening even if the scale is slow.`;
      } else if (waistChange > 0.5 && (pace_verdict === 'ahead' || pace_verdict === 'on_track')) {
        waist_context = `Weight is moving but waist is up ${waistChange} cm — check if the loss is mostly water or muscle. Keep protein high.`;
      }
    } else if (pace_verdict === 'ahead' && waistChange < -1) {
      waist_context = `Waist is also down ${Math.abs(waistChange)} cm — excellent all-round progress.`;
    }
  }

  // --- Waist goal ---
  let waist_goal = null;
  if (goal.waist_goal_cm && goalDate) {
    const allMeasurements = db.prepare('SELECT waist_cm, date FROM measurement_logs ORDER BY date ASC').all();
    if (allMeasurements.length >= 2) {
      // Weekly averages of waist measurements
      const latest4 = allMeasurements.slice(-4);
      const currentWaistAvg = Math.round(latest4.reduce((s, m) => s + m.waist_cm, 0) / latest4.length * 10) / 10;
      waist_goal = {
        target_cm: goal.waist_goal_cm,
        current_avg_cm: currentWaistAvg,
        target_date: goalDate,
        remaining_cm: Math.round((currentWaistAvg - goal.waist_goal_cm) * 10) / 10,
      };
    }
  }

  res.json({
    pace_verdict,
    pace_label,
    gap_kg: Math.round(gap * 10) / 10,
    latest_avg: latestAvg,
    expected_weight: Math.round(expectedWeightToday * 100) / 100,
    week_target_weight: weekTargetWeight,
    projected_finish,
    projection_available,
    diagnostic,
    milestone_countdown,
    goal_weight: goalWeight,
    start_weight: startWeight,
    start_date: startDate,
    target_date: goal.target_date,
    goal_date: goalDate,
    waist_context,
    waist_goal,
    required_rate,
    actual_rate,
    behind_pace_suggestion,
  });
});

function computeDiagnostic(db, goal, today) {
  const baseCalTarget = goal.current_calorie_target || 2240;
  const proTarget = goal.current_protein_target_g || 180;
  const reduction = goal.rest_day_reduction || 150;

  const twoWeeksAgo = daysAgoIST(14);
  const foodDays = db.prepare(`
    SELECT date, SUM(calories) as total_cal, SUM(protein_g) as total_pro
    FROM food_logs WHERE date >= ? GROUP BY date
  `).all(twoWeeksAgo);

  const restDayDates = new Set(
    db.prepare('SELECT date FROM rest_days WHERE date >= ?').all(twoWeeksAgo).map(r => r.date)
  );
  let calTarget = baseCalTarget;
  if (foodDays.length > 0) {
    const totalTarget = foodDays.reduce((s, d) => {
      return s + (restDayDates.has(d.date) ? baseCalTarget - reduction : baseCalTarget);
    }, 0);
    calTarget = totalTarget / foodDays.length;
  }

  const allDates = [];
  const d = new Date(twoWeeksAgo + 'T12:00:00Z');
  const todayDate = new Date(today + 'T12:00:00Z');
  while (d <= todayDate) {
    allDates.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const loggedDates = new Set(foodDays.map(f => f.date));
  const unloggedDays = allDates.filter(d => !loggedDates.has(d)).length;

  const exerciseDays = db.prepare(`
    SELECT COUNT(DISTINCT date) as cnt FROM exercise_logs WHERE date >= ?
  `).get(twoWeeksAgo);
  const trainingDays = exerciseDays?.cnt || 0;

  const avgCal = foodDays.length > 0
    ? Math.round(foodDays.reduce((s, f) => s + f.total_cal, 0) / foodDays.length)
    : 0;
  const avgPro = foodDays.length > 0
    ? Math.round(foodDays.reduce((s, f) => s + f.total_pro, 0) / foodDays.length)
    : 0;

  if (unloggedDays >= 5) {
    return { cause: 'logging_gaps', message: `${unloggedDays} of the last 14 days have no food logged. Incomplete logging makes it hard to spot patterns.` };
  }
  if (avgCal > calTarget * 1.05) {
    return { cause: 'calories_above_target', message: `Your last 14 days averaged ${avgCal} kcal against a ${Math.round(calTarget)} target.` };
  }
  if (trainingDays < 4) {
    return { cause: 'low_training', message: `${trainingDays} training sessions in the last 14 days. Aim for 4+ sessions per week to maintain pace.` };
  }
  if (avgPro < proTarget * 0.8) {
    return { cause: 'low_protein', message: `Protein averaged ${avgPro}g/day (target ${Math.round(proTarget)}g). Low protein can slow fat loss and increase muscle loss.` };
  }
  return { cause: 'no_clear_cause', message: 'No single clear cause identified from logged data. Normal weight fluctuations can take 2-3 weeks to wash out.' };
}

module.exports = router;
