const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list goals
router.get('/', async (req, res, next) => {
  const { status, timeframe } = req.query;
  try {
    let query = 'SELECT * FROM goals WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (status)    { params.push(status);    query += ` AND status = $${params.length}`; }
    if (timeframe) { params.push(timeframe); query += ` AND timeframe = $${params.length}`; }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create goal
router.post('/', validate(z.object({
  title:          z.string().min(1),
  description:    z.string().optional(),
  type:           z.enum(['outcome','process','project','milestone']).optional(),
  timeframe:      z.enum(['daily','weekly','monthly','quarterly','yearly','lifetime']).optional(),
  status:         z.enum(['active','completed','abandoned','paused']).optional(),
  target_date:    z.string().optional(),
  metric_name:    z.string().optional(),
  metric_target:  z.number().optional(),
  metric_current: z.number().optional(),
  parent_id:      z.string().uuid().optional(),
  metadata:       z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { title, description, type, timeframe, status, target_date, metric_name,
          metric_target, metric_current, parent_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO goals (user_id, title, description, type, timeframe, status, target_date,
        metric_name, metric_target, metric_current, parent_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, title, description, type || 'outcome', timeframe || 'quarterly',
       status || 'active', target_date, metric_name, metric_target,
       metric_current || 0, parent_id, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single goal
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Goal not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { title, description, type, timeframe, status, target_date, metric_name,
          metric_target, metric_current, parent_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE goals SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        type           = COALESCE($3, type),
        timeframe      = COALESCE($4, timeframe),
        status         = COALESCE($5, status),
        target_date    = COALESCE($6, target_date),
        metric_name    = COALESCE($7, metric_name),
        metric_target  = COALESCE($8, metric_target),
        metric_current = COALESCE($9, metric_current),
        parent_id      = COALESCE($10, parent_id),
        metadata       = COALESCE($11, metadata)
       WHERE id = $12 AND user_id = $13 RETURNING *`,
      [title, description, type, timeframe, status, target_date, metric_name,
       metric_target, metric_current, parent_id,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Goal not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE goals SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/children — child goals
router.get('/:id/children', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM goals WHERE parent_id = $1 AND user_id = $2 AND archived_at IS NULL ORDER BY created_at',
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
