const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');
const crypto = require('crypto');

// POST /upload — Parse CSV and match against existing transactions
router.post('/upload', (req, res) => {
  const db = getDB();
  const { csv_text, payment_method_id, column_map } = req.body;

  if (!csv_text || !payment_method_id || !column_map) {
    return res.status(400).json({ error: 'csv_text, payment_method_id, and column_map are required' });
  }

  const lines = csv_text.split('\n').filter(l => l.trim());
  // Skip header row
  const dataLines = lines.slice(1);
  const batch_id = crypto.randomUUID();

  // Load merchant->category mappings
  const merchantMaps = db.prepare('SELECT * FROM fin_merchant_category_map').all();

  const rows = [];

  for (const line of dataLines) {
    // Parse CSV (handle commas in quoted fields)
    const cols = parseCSVLine(line);
    if (cols.length === 0) continue;

    // Extract fields via column_map
    let dateRaw = cols[column_map.date] || '';
    let amount = 0;
    const description = (cols[column_map.description] || '').trim();

    // Handle DD/MM/YYYY date format
    const date = parseDate(dateRaw.trim());
    if (!date) continue;

    // Determine amount from debit/credit columns or single amount column
    if (column_map.debit !== undefined && column_map.credit !== undefined) {
      const debit = parseFloat((cols[column_map.debit] || '').replace(/,/g, '')) || 0;
      const credit = parseFloat((cols[column_map.credit] || '').replace(/,/g, '')) || 0;
      amount = debit || credit;
    } else {
      amount = parseFloat((cols[column_map.amount] || '').replace(/,/g, '')) || 0;
    }

    if (amount === 0) continue;

    // Match against existing manual transactions on same payment method
    let status = 'new';
    let matched_transaction_id = null;

    // Exact match: same amount AND date +/-1 day
    const exactMatch = db.prepare(`
      SELECT id FROM fin_transactions
      WHERE payment_method_id = ? AND amount = ? AND date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
      LIMIT 1
    `).get(payment_method_id, amount, date, date);

    if (exactMatch) {
      status = 'matched';
      matched_transaction_id = exactMatch.id;
    } else {
      // Probable match: amount +/-1% AND date +/-3 days
      const loAmt = amount * 0.99;
      const hiAmt = amount * 1.01;
      const probMatch = db.prepare(`
        SELECT id FROM fin_transactions
        WHERE payment_method_id = ? AND amount BETWEEN ? AND ? AND date BETWEEN date(?, '-3 day') AND date(?, '+3 day')
        LIMIT 1
      `).get(payment_method_id, loAmt, hiAmt, date, date);

      if (probMatch) {
        status = 'probable';
        matched_transaction_id = probMatch.id;
      }
    }

    // Suggest category from merchant map
    let suggested_category_id = null;
    const descUpper = description.toUpperCase();
    for (const m of merchantMaps) {
      if (descUpper.includes(m.merchant_pattern)) {
        suggested_category_id = m.category_id;
        break;
      }
    }

    rows.push({ date, amount, description, status, suggested_category_id, matched_transaction_id });
  }

  res.json({ rows, batch_id });
});

// POST /confirm — Import confirmed rows as transactions
router.post('/confirm', (req, res) => {
  const db = getDB();
  const { batch_id, rows, payment_method_id } = req.body;

  const insertTx = db.prepare(`
    INSERT INTO fin_transactions (date, amount, type, category_id, payment_method_id, merchant, source, import_batch_id)
    VALUES (?, ?, 'expense', ?, ?, ?, 'import', ?)
  `);

  const learnMerchant = db.prepare(`
    INSERT OR IGNORE INTO fin_merchant_category_map (merchant_pattern, category_id)
    VALUES (?, ?)
  `);

  let added = 0;

  const doImport = db.transaction(() => {
    for (const row of rows) {
      if (row.action !== 'add') continue;
      insertTx.run(row.date, row.amount, row.category_id, payment_method_id, row.description || null, batch_id);
      // Learn new merchant -> category mappings
      if (row.description && row.category_id) {
        learnMerchant.run(row.description.toUpperCase(), row.category_id);
      }
      added++;
    }
  });

  doImport();

  res.json({ ok: true, added, batch_id });
});

// DELETE /batch/:batchId — Delete all transactions from an import batch
router.delete('/batch/:batchId', (req, res) => {
  const db = getDB();
  const result = db.prepare('DELETE FROM fin_transactions WHERE import_batch_id = ?').run(req.params.batchId);
  res.json({ ok: true, deleted: result.changes });
});

// --- Helpers ---

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function parseDate(raw) {
  // Try DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  return null;
}

module.exports = router;
