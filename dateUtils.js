// Shared date utility — all dates in this app use IST (Asia/Kolkata, UTC+5:30)
// Single-user app, fixed timezone assumption.

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getMondayIST(dateStr) {
  // Parse the YYYY-MM-DD date and find Monday of that week
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function getDaysOfWeek(mondayStr) {
  const days = [];
  const d = new Date(mondayStr + 'T12:00:00Z');
  for (let i = 0; i < 7; i++) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

function daysAgoIST(n) {
  const now = new Date();
  // Shift to IST
  const ist = new Date(now.getTime() + 330 * 60000);
  ist.setUTCDate(ist.getUTCDate() - n);
  return ist.toISOString().split('T')[0];
}

module.exports = { todayIST, getMondayIST, getDaysOfWeek, daysAgoIST };
