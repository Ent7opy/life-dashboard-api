const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list hobbies
router.get('/', async (req, res, next) => {
  const { status } = req.query;
  try {
    let query = 'SELECT * FROM hobbies WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create hobby
router.post('/', validate(z.object({
  name:        z.string().min(1),
  category:    z.string().optional(),
  status:      z.enum(['active','paused','want_to_try','retired']).optional(),
  started_at:  z.string().optional(),
  description: z.string().optional(),
  skill_id:    z.string().uuid().optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, category, status, started_at, description, skill_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO hobbies (user_id, name, category, status, started_at, description, skill_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name, category, status || 'active', started_at, description, skill_id,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single hobby
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM hobbies WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Hobby not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, category, status, started_at, description, skill_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE hobbies SET
        name        = COALESCE($1, name),
        category    = COALESCE($2, category),
        status      = COALESCE($3, status),
        started_at  = COALESCE($4, started_at),
        description = COALESCE($5, description),
        skill_id    = COALESCE($6, skill_id),
        metadata    = COALESCE($7, metadata)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [name, category, status, started_at, description, skill_id,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Hobby not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE hobbies SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/logs — list logs for hobby
router.get('/:id/logs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM hobby_logs WHERE hobby_id = $1 AND user_id = $2
       ORDER BY log_date DESC`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /:id/logs — log session
router.post('/:id/logs', validate(z.object({
  log_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_min: z.number().int().positive().optional(),
  notes:       z.string().optional(),
  rating:      z.number().int().min(1).max(5).optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { log_date, duration_min, notes, rating, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO hobby_logs (hobby_id, user_id, log_date, duration_min, notes, rating, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, req.user.id, log_date, duration_min, notes, rating,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
