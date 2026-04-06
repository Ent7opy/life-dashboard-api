const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');

const UID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

// GET / — list all tags
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tags WHERE user_id = $1 ORDER BY name', [UID]);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create tag
router.post('/', validate(z.object({
  name:  z.string().min(1),
  color: z.string().optional(),
})), async (req, res, next) => {
  const { name, color } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tags (user_id, name, color) VALUES ($1,$2,$3) RETURNING *`,
      [UID, name, color]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — update tag
router.patch('/:id', validate(z.object({
  name:  z.string().min(1).optional(),
  color: z.string().optional(),
})), async (req, res, next) => {
  const { name, color } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tags SET name = COALESCE($1, name), color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name, color, req.params.id, UID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tag not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — hard delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tags WHERE id = $1 AND user_id = $2', [req.params.id, UID]);
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/entities — entity_tags rows for this tag
router.get('/:id/entities', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM entity_tags WHERE tag_id = $1',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
