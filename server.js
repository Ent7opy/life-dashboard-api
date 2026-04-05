const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('Unexpected database error', err));

// Middleware
app.use(cors());
app.use(express.json());

// Simple API key authentication (optional)
const API_KEY = process.env.API_KEY;
const authenticate = (req, res, next) => {
  if (!API_KEY) return next(); // no auth required
  const provided = req.headers['x-api-key'];
  if (provided === API_KEY) return next();
  res.status(401).json({ error: 'Invalid API key' });
};
app.use(authenticate);

// Helper to get user ID (single user for now)
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

// Routes
app.get('/api/user', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, theme_preference, settings FROM users WHERE id = $1',
      [DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/user', async (req, res) => {
  const { theme_preference, settings } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users 
       SET theme_preference = COALESCE($1, theme_preference),
           settings = COALESCE($2, settings)
       WHERE id = $3
       RETURNING id, theme_preference, settings`,
      [theme_preference, settings, DEFAULT_USER_ID]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// University path
app.get('/api/path', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM university_path WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/path', async (req, res) => {
  const { selected_path, selected_university_name, start_year, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO university_path 
        (user_id, selected_path, selected_university_name, start_year, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         selected_path = EXCLUDED.selected_path,
         selected_university_name = EXCLUDED.selected_university_name,
         start_year = EXCLUDED.start_year,
         notes = EXCLUDED.notes
       RETURNING *`,
      [DEFAULT_USER_ID, selected_path, selected_university_name, start_year, notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { label, due_date, phase_id, category } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, label, due_date, phase_id, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [DEFAULT_USER_ID, label, due_date, phase_id, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { label, completed, due_date, phase_id, category } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tasks 
       SET label = COALESCE($1, label),
           completed = COALESCE($2, completed),
           due_date = COALESCE($3, due_date),
           phase_id = COALESCE($4, phase_id),
           category = COALESCE($5, category)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [label, completed, due_date, phase_id, category, id, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, DEFAULT_USER_ID]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Progress
app.get('/api/progress', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category_id, value FROM progress WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    // Convert to object { category_id: value }
    const progress = {};
    result.rows.forEach(row => progress[row.category_id] = row.value);
    res.json(progress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/progress', async (req, res) => {
  const { category_id, value } = req.body;
  if (typeof category_id !== 'string' || typeof value !== 'number') {
    return res.status(400).json({ error: 'category_id and value are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO progress (user_id, category_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category_id) DO UPDATE SET
         value = EXCLUDED.value
       RETURNING *`,
      [DEFAULT_USER_ID, category_id, value]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reading list
app.get('/api/reading', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reading_list WHERE user_id = $1 ORDER BY created_at',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/reading', async (req, res) => {
  const { book_id, status, started_at, completed_at, rating, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO reading_list (user_id, book_id, status, started_at, completed_at, rating, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [DEFAULT_USER_ID, book_id, status, started_at, completed_at, rating, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/reading/:id', async (req, res) => {
  const { id } = req.params;
  const { status, started_at, completed_at, rating, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reading_list 
       SET status = COALESCE($1, status),
           started_at = COALESCE($2, started_at),
           completed_at = COALESCE($3, completed_at),
           rating = COALESCE($4, rating),
           notes = COALESCE($5, notes)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [status, started_at, completed_at, rating, notes, id, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Weekly review
app.get('/api/weekly-review', async (req, res) => {
  const { limit = 30 } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM weekly_review 
       WHERE user_id = $1 
       ORDER BY entry_date DESC
       LIMIT $2`,
      [DEFAULT_USER_ID, limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/weekly-review', async (req, res) => {
  const { entry_date, hours, reflection, goals } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO weekly_review (user_id, entry_date, hours, reflection, goals)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         hours = EXCLUDED.hours,
         reflection = EXCLUDED.reflection,
         goals = EXCLUDED.goals
       RETURNING *`,
      [DEFAULT_USER_ID, entry_date, hours, reflection, goals]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ name: 'Life Dashboard API', version: '0.1.0', status: 'ok' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});