require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db/pool');
const { optionalAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errors');
const v1Router = require('./routes/v1');

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth);

// ── Root + Health ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({ name: 'Life OS API', version: '1.0.0', status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Legacy routes (v0) ─────────────────────────────────────────
// Kept for backwards compatibility with existing frontend hooks

app.get('/api/user', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [DEFAULT_USER_ID]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.put('/api/user', async (req, res, next) => {
  const { theme_preference, settings } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET theme_preference = COALESCE($1, theme_preference), settings = COALESCE($2, settings) WHERE id = $3 RETURNING *`,
      [theme_preference, settings ? JSON.stringify(settings) : null, DEFAULT_USER_ID]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.get('/api/tasks', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at', [DEFAULT_USER_ID]);
    res.json(rows);
  } catch (err) { next(err); }
});

app.post('/api/tasks', async (req, res, next) => {
  const { label, due_date, phase_id, category } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, label, due_date, phase_id, category) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [DEFAULT_USER_ID, label, due_date, phase_id, category]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  const { label, completed, due_date, phase_id, category } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET label=COALESCE($1,label), completed=COALESCE($2,completed), due_date=COALESCE($3,due_date), phase_id=COALESCE($4,phase_id), category=COALESCE($5,category) WHERE id=$6 AND user_id=$7 RETURNING *`,
      [label, completed, due_date, phase_id, category, req.params.id, DEFAULT_USER_ID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, DEFAULT_USER_ID]);
    res.status(204).send();
  } catch (err) { next(err); }
});

app.get('/api/progress', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT category_id, value FROM progress WHERE user_id=$1', [DEFAULT_USER_ID]);
    const result = {};
    rows.forEach(r => result[r.category_id] = r.value);
    res.json(result);
  } catch (err) { next(err); }
});

app.put('/api/progress', async (req, res, next) => {
  const { category_id, value } = req.body;
  if (typeof category_id !== 'string' || typeof value !== 'number') {
    return res.status(400).json({ error: 'category_id and value are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO progress (user_id,category_id,value) VALUES ($1,$2,$3) ON CONFLICT (user_id,category_id) DO UPDATE SET value=EXCLUDED.value RETURNING *`,
      [DEFAULT_USER_ID, category_id, value]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.get('/api/reading', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reading_list WHERE user_id=$1 ORDER BY created_at', [DEFAULT_USER_ID]);
    res.json(rows);
  } catch (err) { next(err); }
});

app.post('/api/reading', async (req, res, next) => {
  const { book_id, status, started_at, completed_at, rating, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO reading_list (user_id,book_id,status,started_at,completed_at,rating,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [DEFAULT_USER_ID, book_id, status, started_at, completed_at, rating, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

app.put('/api/reading/:id', async (req, res, next) => {
  const { status, started_at, completed_at, rating, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE reading_list SET status=COALESCE($1,status), started_at=COALESCE($2,started_at), completed_at=COALESCE($3,completed_at), rating=COALESCE($4,rating), notes=COALESCE($5,notes) WHERE id=$6 AND user_id=$7 RETURNING *`,
      [status, started_at, completed_at, rating, notes, req.params.id, DEFAULT_USER_ID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reading entry not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.get('/api/weekly-review', async (req, res, next) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM weekly_review WHERE user_id=$1 ORDER BY entry_date DESC LIMIT $2`,
      [DEFAULT_USER_ID, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

app.post('/api/weekly-review', async (req, res, next) => {
  const { entry_date, hours, reflection, goals } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO weekly_review (user_id,entry_date,hours,reflection,goals) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,entry_date) DO UPDATE SET hours=EXCLUDED.hours, reflection=EXCLUDED.reflection, goals=EXCLUDED.goals RETURNING *`,
      [DEFAULT_USER_ID, entry_date, hours, reflection, goals ? JSON.stringify(goals) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

app.get('/api/path', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM university_path WHERE user_id=$1', [DEFAULT_USER_ID]);
    res.json(rows[0] || {});
  } catch (err) { next(err); }
});

// ── v1 routes ──────────────────────────────────────────────────
app.use('/api/v1', v1Router);

// ── Error handler ──────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => console.log(`Life OS API running on :${PORT}`));
