const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');

const UID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

// GET /logs/today — habits with done boolean for today
router.get('/logs/today', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, CASE WHEN hl.id IS NOT NULL THEN TRUE ELSE FALSE END AS done
       FROM habits h
       LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.log_date = CURRENT_DATE
       WHERE h.user_id = $1 AND h.active = TRUE AND h.archived_at IS NULL
       ORDER BY h.name`,
      [UID]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET / — list active habits
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM habits WHERE user_id = $1 AND active = TRUE AND archived_at IS NULL ORDER BY name`,
      [UID]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create habit
router.post('/', validate(z.object({
  name:         z.string().min(1),
  description:  z.string().optional(),
  frequency:    z.enum(['daily','weekdays','weekends','weekly','custom']).optional(),
  target_count: z.number().int().min(1).optional(),
  color:        z.string().optional(),
  icon:         z.string().optional(),
  goal_id:      z.string().uuid().optional(),
  metadata:     z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, description, frequency, target_count, color, icon, goal_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO habits (user_id, name, description, frequency, target_count, color, icon, goal_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [UID, name, description, frequency || 'daily', target_count || 1,
       color, icon, goal_id, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, description, frequency, target_count, color, icon, active, goal_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE habits SET
        name         = COALESCE($1, name),
        description  = COALESCE($2, description),
        frequency    = COALESCE($3, frequency),
        target_count = COALESCE($4, target_count),
        color        = COALESCE($5, color),
        icon         = COALESCE($6, icon),
        active       = COALESCE($7, active),
        goal_id      = COALESCE($8, goal_id),
        metadata     = COALESCE($9, metadata)
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [name, description, frequency, target_count, color, icon, active, goal_id,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, UID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Habit not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE habits SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, UID]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/logs — list logs for habit
router.get('/:id/logs', async (req, res, next) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM habit_logs WHERE habit_id = $1 AND user_id = $2
       ORDER BY log_date DESC LIMIT $3`,
      [req.params.id, UID, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /:id/logs — log completion
router.post('/:id/logs', validate(z.object({
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count:    z.number().int().min(1).optional(),
  note:     z.string().optional(),
})), async (req, res, next) => {
  const { log_date, count, note } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO habit_logs (habit_id, user_id, log_date, count, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (habit_id, log_date) DO UPDATE SET
         count = EXCLUDED.count,
         note  = EXCLUDED.note
       RETURNING *`,
      [req.params.id, UID, log_date, count || 1, note]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
