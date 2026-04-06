const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — unprocessed items
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM inbox_items WHERE user_id = $1 AND processed = FALSE AND archived_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /all — all items including processed
router.get('/all', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM inbox_items WHERE user_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create item
router.post('/', validate(z.object({
  content:  z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { content, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO inbox_items (user_id, content, metadata) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, content, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — update content or processed status
router.patch('/:id', async (req, res, next) => {
  const { content, processed } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE inbox_items SET
        content   = COALESCE($1, content),
        processed = COALESCE($2, processed)
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [content, processed, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /:id/process — mark processed
router.post('/:id/process', async (req, res, next) => {
  const { routed_to, routed_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE inbox_items SET processed = TRUE, routed_to = $1, routed_id = $2
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [routed_to, routed_id, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE inbox_items SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
