const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list skills
router.get('/', async (req, res, next) => {
  const { category } = req.query;
  try {
    let query = 'SELECT * FROM skills WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (category) { params.push(category); query += ` AND category = $${params.length}`; }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create skill
router.post('/', validate(z.object({
  name:     z.string().min(1),
  category: z.string().optional(),
  value:    z.number().int().min(0).max(100).optional(),
  target:   z.number().int().min(0).max(100).optional(),
  icon:     z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, category, value, target, icon, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO skills (user_id, name, category, value, target, icon, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, name, category, value || 0, target, icon, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single skill
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM skills WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Skill not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, category, value, target, icon, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE skills SET
        name     = COALESCE($1, name),
        category = COALESCE($2, category),
        value    = COALESCE($3, value),
        target   = COALESCE($4, target),
        icon     = COALESCE($5, icon),
        metadata = COALESCE($6, metadata)
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [name, category, value, target, icon,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Skill not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE skills SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
