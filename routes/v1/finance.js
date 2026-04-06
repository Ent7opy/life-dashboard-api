const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// ── ACCOUNTS ──────────────────────────────────────────────────

router.get('/accounts', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM accounts WHERE user_id = $1 AND archived_at IS NULL ORDER BY name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/accounts', validate(z.object({
  name:        z.string().min(1),
  type:        z.enum(['checking','savings','investment','crypto','loan','cash','other']),
  currency:    z.string().optional(),
  balance:     z.number().optional(),
  institution: z.string().optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, type, currency, balance, institution, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO accounts (user_id, name, type, currency, balance, institution, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, name, type, currency || 'EUR', balance || 0, institution,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/accounts/:id', async (req, res, next) => {
  const { name, type, currency, balance, institution, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE accounts SET
        name        = COALESCE($1, name),
        type        = COALESCE($2, type),
        currency    = COALESCE($3, currency),
        balance     = COALESCE($4, balance),
        institution = COALESCE($5, institution),
        metadata    = COALESCE($6, metadata)
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [name, type, currency, balance, institution,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/accounts/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE accounts SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── TRANSACTIONS ──────────────────────────────────────────────

router.get('/transactions', async (req, res, next) => {
  const { account_id, category, type, from, to } = req.query;
  try {
    let query = 'SELECT * FROM transactions WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (account_id) { params.push(account_id); query += ` AND account_id = $${params.length}`; }
    if (category)   { params.push(category);   query += ` AND category = $${params.length}`; }
    if (type)       { params.push(type);        query += ` AND type = $${params.length}`; }
    if (from)       { params.push(from);        query += ` AND txn_date >= $${params.length}`; }
    if (to)         { params.push(to);          query += ` AND txn_date <= $${params.length}`; }
    query += ' ORDER BY txn_date DESC, created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/transactions', validate(z.object({
  account_id:    z.string().uuid(),
  amount:        z.number(),
  type:          z.enum(['income','expense','transfer']),
  currency:      z.string().optional(),
  category:      z.string().optional(),
  subcategory:   z.string().optional(),
  description:   z.string().optional(),
  txn_date:      z.string().optional(),
  to_account_id: z.string().uuid().optional(),
  recurring:     z.boolean().optional(),
  metadata:      z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { account_id, amount, type, currency, category, subcategory, description,
          txn_date, to_account_id, recurring, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO transactions (user_id, account_id, amount, type, currency, category,
        subcategory, description, txn_date, to_account_id, recurring, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, account_id, amount, type, currency || 'EUR', category, subcategory,
       description, txn_date || null, to_account_id, recurring || false,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/transactions/:id', async (req, res, next) => {
  const { amount, type, currency, category, subcategory, description, txn_date,
          to_account_id, recurring, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE transactions SET
        amount        = COALESCE($1, amount),
        type          = COALESCE($2, type),
        currency      = COALESCE($3, currency),
        category      = COALESCE($4, category),
        subcategory   = COALESCE($5, subcategory),
        description   = COALESCE($6, description),
        txn_date      = COALESCE($7, txn_date),
        to_account_id = COALESCE($8, to_account_id),
        recurring     = COALESCE($9, recurring),
        metadata      = COALESCE($10, metadata)
       WHERE id = $11 AND user_id = $12 RETURNING *`,
      [amount, type, currency, category, subcategory, description, txn_date,
       to_account_id, recurring, metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transaction not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE transactions SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── BUDGETS ───────────────────────────────────────────────────

router.get('/budgets', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND active = TRUE ORDER BY category',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.put('/budgets', validate(z.array(z.object({
  category: z.string().min(1),
  amount:   z.number().positive(),
  currency: z.string().optional(),
  period:   z.enum(['weekly','monthly','yearly']).optional(),
}))), async (req, res, next) => {
  const budgets = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const b of budgets) {
      const { rows } = await client.query(
        `INSERT INTO budgets (user_id, category, amount, currency, period)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, category, period) DO UPDATE SET
           amount   = EXCLUDED.amount,
           currency = EXCLUDED.currency,
           active   = TRUE
         RETURNING *`,
        [req.user.id, b.category, b.amount, b.currency || 'EUR', b.period || 'monthly']
      );
      results.push(rows[0]);
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── SUMMARY ───────────────────────────────────────────────────

router.get('/summary', async (req, res, next) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    const { rows } = await pool.query(
      `SELECT
         type,
         category,
         SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1
         AND archived_at IS NULL
         AND TO_CHAR(txn_date, 'YYYY-MM') = $2
       GROUP BY type, category
       ORDER BY type, total DESC`,
      [req.user.id, month]
    );

    let total_income = 0, total_expenses = 0;
    const breakdown = {};
    for (const r of rows) {
      const amt = parseFloat(r.total);
      if (r.type === 'income')  total_income += amt;
      if (r.type === 'expense') total_expenses += amt;
      if (r.category) {
        breakdown[r.category] = (breakdown[r.category] || 0) + amt;
      }
    }

    res.json({
      month,
      total_income,
      total_expenses,
      net: total_income - total_expenses,
      breakdown,
    });
  } catch (err) { next(err); }
});

module.exports = router;
