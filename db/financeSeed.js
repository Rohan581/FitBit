/**
 * Finance module seed data.
 * Idempotent — safe to run on every startup via INSERT OR IGNORE.
 */

function seedFinanceData(db) {
  // ── Categories ──────────────────────────────────────────────
  const catInsert = db.prepare(`
    INSERT OR IGNORE INTO fin_categories (name, color_token, icon, monthly_budget, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const CATEGORIES = [
    ['Groceries',         '--gro', 'shopping-cart',      0, 1],
    ['Dining & delivery', '--din', 'utensils-crossed',   0, 2],
    ['Travel',            '--tra', 'plane',              0, 3],
    ['Fuel',              '--fue', 'fuel',               0, 4],
    ['Shopping',          '--sho', 'shopping-bag',       0, 5],
    ['Utilities',         '--uti', 'zap',                0, 6],
    ['Entertainment',     '--ent', 'clapperboard',       0, 7],
    ['Health',            '--hea', 'heart-pulse',        0, 8],
    ['Rent & home',       '--ren', 'home',               0, 9],
    ['Other',             '--oth', 'circle-ellipsis',    0, 10],
  ];

  db.transaction(() => {
    for (const c of CATEGORIES) catInsert.run(...c);
  })();

  // ── Payment methods ─────────────────────────────────────────
  const pmInsert = db.prepare(`
    INSERT OR IGNORE INTO fin_payment_methods (name, kind, color_var, short_name, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const PAYMENT_METHODS = [
    ['HDFC Regalia Gold',       'credit_card', '--regalia', 'Regalia Gold', 1],
    ['HDFC Swiggy',             'credit_card', '--swiggy',  'Swiggy',       2],
    ['SBI Elite',               'credit_card', '--sbie',    'SBI Elite',    3],
    ['HDFC Tata Neu Rupay',     'credit_card', '--tneu',    'Tata Neu',     4],
    ['HDFC Pixel Rupay',        'credit_card', '--pixel',   'Pixel',        5],
    ['ICICI Sapphiro',          'credit_card', '--sapp',    'Sapphiro',     6],
    ['ICICI Amazon Pay',        'credit_card', '--azn',     'Amazon Pay',   7],
    ['Amex Platinum Travel',    'credit_card', '--amex',    'Amex Travel',  8],
    ['UPI',                     'upi',         '--fin',     'UPI',          9],
    ['Cash',                    'cash',        '--oth',     'Cash',         10],
  ];

  db.transaction(() => {
    for (const p of PAYMENT_METHODS) pmInsert.run(...p);
  })();

  // ── Card rules (only 2 known rules) ──────────────────────────
  const ruleInsert = db.prepare(`
    INSERT OR IGNORE INTO fin_card_rules (payment_method_id, category_or_merchant, multiplier_text, note, priority)
    SELECT pm.id, ?, ?, ?, ?
    FROM fin_payment_methods pm WHERE pm.name = ?
    AND NOT EXISTS (
      SELECT 1 FROM fin_card_rules cr WHERE cr.payment_method_id = pm.id AND cr.category_or_merchant = ?
    )
  `);

  ruleInsert.run('Amazon vouchers via Gyftr', '5X', 'Buy Amazon vouchers through Gyftr SmartBuy', 1, 'HDFC Regalia Gold', 'Amazon vouchers via Gyftr');
  ruleInsert.run('ShopWise', '3X', 'Earn 3X MR points via ShopWise portal', 1, 'Amex Platinum Travel', 'ShopWise');

  // ── Merchant → category mappings ────────────────────────────
  const mapInsert = db.prepare(`
    INSERT OR IGNORE INTO fin_merchant_category_map (merchant_pattern, category_id)
    SELECT ?, c.id FROM fin_categories c WHERE c.name = ?
  `);

  const MERCHANT_MAPS = [
    // Dining & delivery
    ['SWIGGY', 'Dining & delivery'], ['ZOMATO', 'Dining & delivery'],
    // Groceries
    ['BLINKIT', 'Groceries'], ['ZEPTO', 'Groceries'], ['INSTAMART', 'Groceries'],
    ['BIGBASKET', 'Groceries'], ['DMART', 'Groceries'],
    // Travel
    ['UBER', 'Travel'], ['OLA', 'Travel'], ['IRCTC', 'Travel'], ['INDIGO', 'Travel'],
    // Shopping
    ['AMAZON', 'Shopping'], ['FLIPKART', 'Shopping'], ['MYNTRA', 'Shopping'],
    // Utilities
    ['JIO', 'Utilities'], ['AIRTEL', 'Utilities'], ['BESCOM', 'Utilities'],
    // Entertainment
    ['BOOKMYSHOW', 'Entertainment'], ['NETFLIX', 'Entertainment'], ['SPOTIFY', 'Entertainment'],
    // Health
    ['APOLLO', 'Health'], ['PHARMEASY', 'Health'], ['PRACTO', 'Health'],
    // Fuel
    ['HPCL', 'Fuel'], ['IOCL', 'Fuel'], ['BPCL', 'Fuel'], ['SHELL', 'Fuel'],
  ];

  db.transaction(() => {
    for (const [pattern, cat] of MERCHANT_MAPS) mapInsert.run(pattern, cat);
  })();

  // ── Settings singleton ──────────────────────────────────────
  db.prepare('INSERT OR IGNORE INTO fin_settings (id) VALUES (1)').run();
}

module.exports = { seedFinanceData };
