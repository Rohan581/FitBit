const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => req('GET', '/dashboard'),

  // Foods
  searchFoods: (q, categories) => req('GET', `/foods?${new URLSearchParams({ ...(q && { q }), ...(categories && { categories }) })}`),
  getRecents: (categories) => req('GET', `/foods/recents?${new URLSearchParams({ ...(categories && { categories }) })}`),
  getFavorites: (categories) => req('GET', `/foods/favorites?${new URLSearchParams({ ...(categories && { categories }) })}`),
  addCustomFood: (food) => req('POST', '/foods', food),
  updateFood: (id, food) => req('PUT', `/foods/${id}`, food),
  toggleFavorite: (id) => req('PATCH', `/foods/${id}/favorite`),
  deleteFood: (id) => req('DELETE', `/foods/${id}`),

  // Saved meals
  getSavedMeals: () => req('GET', '/saved-meals'),
  createSavedMeal: (meal) => req('POST', '/saved-meals', meal),
  recomputeSavedMeal: (id) => req('PUT', `/saved-meals/${id}/recompute`),
  deleteSavedMeal: (id) => req('DELETE', `/saved-meals/${id}`),

  // Food logs
  getFoodLogs: (date) => req('GET', `/food-logs?${new URLSearchParams({ ...(date && { date }) })}`),
  logFood: (entry) => req('POST', '/food-logs', entry),
  copyYesterday: (meal_type, date) => req('POST', '/food-logs/copy-yesterday', { meal_type, ...(date && { date }) }),
  deleteFoodLog: (id) => req('DELETE', `/food-logs/${id}`),

  // Exercise logs
  getExerciseLogs: (date) => req('GET', `/exercise-logs?${new URLSearchParams({ ...(date && { date }) })}`),
  logExercise: (entry) => req('POST', '/exercise-logs', entry),
  deleteExerciseLog: (id) => req('DELETE', `/exercise-logs/${id}`),

  // Sleep logs
  getSleepLog: (date) => req('GET', `/sleep-logs?${new URLSearchParams({ ...(date && { date }) })}`),
  logSleep: (entry) => req('POST', '/sleep-logs', entry),
  deleteSleepLog: (id) => req('DELETE', `/sleep-logs/${id}`),

  // Weight logs
  getWeightLogs: (limit) => req('GET', `/weight-logs?${new URLSearchParams({ ...(limit && { limit }) })}`),
  getWeightToday: () => req('GET', '/weight-logs/today'),
  getRollingAvg: () => req('GET', '/weight-logs/rolling-average'),
  logWeight: (entry) => req('POST', '/weight-logs', entry),
  deleteWeightLog: (id) => req('DELETE', `/weight-logs/${id}`),

  // Water
  getWater: (date) => req('GET', `/water?${new URLSearchParams({ ...(date && { date }) })}`),
  addWater: (date) => req('POST', '/water/add', { ...(date && { date }) }),
  removeWater: (date) => req('POST', '/water/remove', { ...(date && { date }) }),

  // Points
  getDailyPoints: (date) => req('GET', `/points/daily?${new URLSearchParams({ ...(date && { date }) })}`),
  getWeeklyPoints: (weekStart) => req('GET', `/points/weekly?${new URLSearchParams({ ...(weekStart && { weekStart }) })}`),

  // Weekly summary
  getWeeklySummary: (weekStart) => req('GET', `/weekly-summary?${new URLSearchParams({ ...(weekStart && { weekStart }) })}`),
  redeemTreat: (weekStart) => req('POST', '/weekly-summary/redeem', { weekStart }),

  // Goal
  getGoal: () => req('GET', '/goal'),
  updateGoal: (data) => req('PUT', '/goal', data),
  recalculateMacros: () => req('POST', '/goal/recalculate'),

  // Suggestions
  getSuggestions: (date, force) => req('GET', `/suggestions?${new URLSearchParams({ ...(date && { date }), ...(force && { force: 'true' }) })}`),

  // Trends
  getWeightTrend: (days) => req('GET', `/trends/weight?${new URLSearchParams({ ...(days && { days }) })}`),
  getMacroTrend: (days) => req('GET', `/trends/macros?${new URLSearchParams({ ...(days && { days }) })}`),
  getPointsTrend: (weeks) => req('GET', `/trends/points?${new URLSearchParams({ ...(weeks && { weeks }) })}`),
  getHistoryDay: (date) => req('GET', `/trends/history/${date}`),
};
