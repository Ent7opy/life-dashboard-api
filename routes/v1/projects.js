const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list projects
router.get('/', async (req, res, next) => {
  const { status } = req.query;
  try {
    let query = 'SELECT * FROM projects WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    query += ' ORDER BY sort_order, created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create project
router.post('/', validate(z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  status:      z.enum(['idea','active','paused','completed','abandoned']).optional(),
  type:        z.string().optional(),
  url:         z.string().url().optional(),
  repo_url:    z.string().url().optional(),
  start_date:  z.string().optional(),
  target_date: z.string().optional(),
  goal_id:     z.string().uuid().optional(),
  sort_order:  z.number().int().optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, description, status, type, url, repo_url, start_date, target_date,
          goal_id, sort_order, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (user_id, name, description, status, type, url, repo_url,
        start_date, target_date, goal_id, sort_order, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, name, description, status || 'active', type, url, repo_url,
       start_date, target_date, goal_id, sort_order || 0,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single project
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, description, status, type, url, repo_url, start_date, target_date,
          completed_at, goal_id, sort_order, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE projects SET
        name         = COALESCE($1, name),
        description  = COALESCE($2, description),
        status       = COALESCE($3, status),
        type         = COALESCE($4, type),
        url          = COALESCE($5, url),
        repo_url     = COALESCE($6, repo_url),
        start_date   = COALESCE($7, start_date),
        target_date  = COALESCE($8, target_date),
        completed_at = COALESCE($9, completed_at),
        goal_id      = COALESCE($10, goal_id),
        sort_order   = COALESCE($11, sort_order),
        metadata     = COALESCE($12, metadata)
       WHERE id = $13 AND user_id = $14 RETURNING *`,
      [name, description, status, type, url, repo_url, start_date, target_date,
       completed_at, goal_id, sort_order,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE projects SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/tasks — tasks for project
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tasks WHERE project_id = $1 AND user_id = $2 AND archived_at IS NULL
       ORDER BY priority DESC, created_at`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
