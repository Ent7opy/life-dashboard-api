const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list notes
router.get('/', async (req, res, next) => {
  const { entity_type, entity_id, pinned } = req.query;
  try {
    let query = 'SELECT * FROM notes WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (entity_type) { params.push(entity_type); query += ` AND entity_type = $${params.length}`; }
    if (entity_id)   { params.push(entity_id);   query += ` AND entity_id = $${params.length}`; }
    if (pinned !== undefined) { params.push(pinned === 'true'); query += ` AND pinned = $${params.length}`; }
    query += ' ORDER BY pinned DESC, updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create note
router.post('/', validate(z.object({
  title:       z.string().optional(),
  body:        z.string().optional(),
  format:      z.enum(['markdown','plain','richtext']).optional(),
  entity_type: z.string().optional(),
  entity_id:   z.string().uuid().optional(),
  pinned:      z.boolean().optional(),
  metadata:    z.record(z.unknown()).optional(),
}).refine(d => d.title || d.body, { message: 'title or body required' })),
async (req, res, next) => {
  const { title, body, format, entity_type, entity_id, pinned, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (user_id, title, body, format, entity_type, entity_id, pinned, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, title, body, format || 'markdown', entity_type, entity_id, pinned || false,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single note
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { title, body, format, entity_type, entity_id, pinned, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE notes SET
        title       = COALESCE($1, title),
        body        = COALESCE($2, body),
        format      = COALESCE($3, format),
        entity_type = COALESCE($4, entity_type),
        entity_id   = COALESCE($5, entity_id),
        pinned      = COALESCE($6, pinned),
        metadata    = COALESCE($7, metadata)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [title, body, format, entity_type, entity_id, pinned,
       metadata ? JSON.stringify(metadata) : null, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notes SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
