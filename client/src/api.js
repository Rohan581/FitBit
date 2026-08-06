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
  getFood: (id) => req('GET', `/foods/${id}`),
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
  updateFoodLog: (id, data) => req('PUT', `/food-logs/${id}`, data),
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

  // Measurements
  getMeasurement: (date) => req('GET', `/measurements?${new URLSearchParams({ ...(date && { date }) })}`),
  getMeasurementTrend: (days) => req('GET', `/measurements/trend?${new URLSearchParams({ ...(days && { days }) })}`),
  logMeasurement: (data) => req('POST', '/measurements', data),
  deleteMeasurement: (id) => req('DELETE', `/measurements/${id}`),

  // Planning
  getPlanning: () => req('GET', '/planning'),

  // Trends
  getWeightTrend: (days) => req('GET', `/trends/weight?${new URLSearchParams({ ...(days && { days }) })}`),
  getMacroTrend: (days) => req('GET', `/trends/macros?${new URLSearchParams({ ...(days && { days }) })}`),
  getPointsTrend: (weeks) => req('GET', `/trends/points?${new URLSearchParams({ ...(weeks && { weeks }) })}`),
  getHistoryDay: (date) => req('GET', `/trends/history/${date}`),

  // Training
  getTraining: () => req('GET', '/training'),
  setFrequency: (frequency) => req('PUT', '/training/frequency', { frequency }),
  startSession: () => req('POST', '/training/sessions'),
  getSession: (id) => req('GET', `/training/sessions/${id}`),
  logSet: (sessionId, data) => req('POST', `/training/sessions/${sessionId}/sets`, data),
  deleteSet: (sessionId, setId) => req('DELETE', `/training/sessions/${sessionId}/sets/${setId}`),
  completeSession: (sessionId, duration_min) => req('POST', `/training/sessions/${sessionId}/complete`, { duration_min }),
  getExercises: () => req('GET', '/training/exercises'),
  getExercise: (id) => req('GET', `/training/exercises/${id}`),
  getExerciseHistory: (id) => req('GET', `/training/exercises/${id}/history`),
  getVolumeSummary: () => req('GET', '/training/volume'),
  checkDuplicate: (type, date) => req('GET', `/training/check-duplicate?${new URLSearchParams({ type, ...(date && { date }) })}`),

  // Session cardio
  addSessionCardio: (sessionId, data) => req('POST', `/training/sessions/${sessionId}/cardio`, data),
  removeSessionCardio: (sessionId, cardioId) => req('DELETE', `/training/sessions/${sessionId}/cardio/${cardioId}`),
  getSessionCardio: (sessionId) => req('GET', `/training/sessions/${sessionId}/cardio`),

  // Cancel session
  cancelSession: (sessionId) => req('DELETE', `/training/sessions/${sessionId}`),

  // Rest days
  getRestDay: (date) => req('GET', `/rest-days?${new URLSearchParams({ ...(date && { date }) })}`),
  toggleRestDay: (date) => req('POST', '/rest-days/toggle', { date }),

  // ── Finance ──────────────────────────────────────────────────
  getFinanceHome: () => req('GET', '/finance/home'),

  // Transactions
  getTransactions: (params) => req('GET', `/finance/transactions?${new URLSearchParams(params || {})}`),
  addTransaction: (data) => req('POST', '/finance/transactions', data),
  updateTransaction: (id, data) => req('PUT', `/finance/transactions/${id}`, data),
  deleteTransaction: (id) => req('DELETE', `/finance/transactions/${id}`),
  toggleNoSpend: (date) => req('POST', '/finance/transactions/no-spend', { date }),
  getNoSpend: (date) => req('GET', `/finance/transactions/no-spend?${new URLSearchParams({ date })}`),

  // Categories
  getFinCategories: () => req('GET', '/finance/categories'),
  updateCategoryBudget: (id, budget) => req('PUT', `/finance/categories/${id}/budget`, { monthly_budget: budget }),

  // Payment methods
  getPaymentMethods: () => req('GET', '/finance/payment-methods'),
  updatePaymentMethod: (id, data) => req('PUT', `/finance/payment-methods/${id}`, data),

  // Cards
  suggestCard: (q) => req('GET', `/finance/cards/suggest?${new URLSearchParams({ q })}`),
  getCardRules: () => req('GET', '/finance/cards/rules'),
  addCardRule: (data) => req('POST', '/finance/cards/rules', data),
  updateCardRule: (id, data) => req('PUT', `/finance/cards/rules/${id}`, data),
  deleteCardRule: (id) => req('DELETE', `/finance/cards/rules/${id}`),
  getCardBills: () => req('GET', '/finance/cards/bills'),
  addCardBill: (data) => req('POST', '/finance/cards/bills', data),
  payCardBill: (id, data) => req('POST', `/finance/cards/bills/${id}/pay`, data),
  getPointsLedger: () => req('GET', '/finance/cards/points-ledger'),
  addPointsLedgerEntry: (data) => req('POST', '/finance/cards/points-ledger', data),

  // Investments
  getInvestments: (params) => req('GET', `/finance/investments?${new URLSearchParams(params || {})}`),
  addInvestment: (data) => req('POST', '/finance/investments', data),
  updateInvestment: (id, data) => req('PUT', `/finance/investments/${id}`, data),
  deleteInvestment: (id) => req('DELETE', `/finance/investments/${id}`),
  getInvestmentSummary: () => req('GET', '/finance/investments/summary'),

  // Goals
  getFinGoals: () => req('GET', '/finance/goals'),
  addFinGoal: (data) => req('POST', '/finance/goals', data),
  updateFinGoal: (id, data) => req('PUT', `/finance/goals/${id}`, data),
  deleteFinGoal: (id) => req('DELETE', `/finance/goals/${id}`),
  addToGoal: (id, amount) => req('POST', `/finance/goals/${id}/add`, { amount }),

  // Import
  uploadStatement: (data) => req('POST', '/finance/import/upload', data),
  confirmImport: (data) => req('POST', '/finance/import/confirm', data),
  unimportBatch: (batchId) => req('DELETE', `/finance/import/batch/${batchId}`),

  // Settings
  getFinSettings: () => req('GET', '/finance/settings'),
  updateFinSettings: (data) => req('PUT', '/finance/settings', data),
};
