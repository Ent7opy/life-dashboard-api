const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list learning nodes
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM learning_nodes WHERE user_id = $1 AND archived_at IS NULL ORDER BY sort_order`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create node
router.post('/', validate(z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  status:      z.enum(['done','active','future','skipped']).optional(),
  sort_order:  z.number().int().optional(),
  skill_id:    z.string().uuid().optional(),
  resource_id: z.string().uuid().optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { title, description, status, sort_order, skill_id, resource_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO learning_nodes (user_id, title, description, status, sort_order, skill_id, resource_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, title, description, status || 'future', sort_order || 0, skill_id, resource_id,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { title, description, status, sort_order, skill_id, resource_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE learning_nodes SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        status      = COALESCE($3, status),
        sort_order  = COALESCE($4, sort_order),
        skill_id    = COALESCE($5, skill_id),
        resource_id = COALESCE($6, resource_id),
        metadata    = COALESCE($7, metadata)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [title, description, status, sort_order, skill_id, resource_id,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Node not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE learning_nodes SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
