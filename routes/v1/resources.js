const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list resources
router.get('/', async (req, res, next) => {
  const { type, status } = req.query;
  try {
    let query = 'SELECT * FROM resources WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (type)   { params.push(type);   query += ` AND type = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create resource
router.post('/', validate(z.object({
  type:             z.enum(['book','course','article','video','podcast','paper','other']),
  title:            z.string().min(1),
  author:           z.string().optional(),
  url:              z.string().url().optional(),
  cover_url:        z.string().url().optional(),
  status:           z.enum(['backlog','active','completed','abandoned','reference']).optional(),
  started_at:       z.string().optional(),
  completed_at:     z.string().optional(),
  rating:           z.number().int().min(1).max(5).optional(),
  review:           z.string().optional(),
  progress_current: z.number().int().optional(),
  progress_total:   z.number().int().optional(),
  skill_id:         z.string().uuid().optional(),
  metadata:         z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { type, title, author, url, cover_url, status, started_at, completed_at,
          rating, review, progress_current, progress_total, skill_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO resources (user_id, type, title, author, url, cover_url, status, started_at,
        completed_at, rating, review, progress_current, progress_total, skill_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.id, type, title, author, url, cover_url, status || 'backlog', started_at,
       completed_at, rating, review, progress_current, progress_total, skill_id,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single resource
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM resources WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Resource not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { type, title, author, url, cover_url, status, started_at, completed_at,
          rating, review, progress_current, progress_total, skill_id, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE resources SET
        type             = COALESCE($1, type),
        title            = COALESCE($2, title),
        author           = COALESCE($3, author),
        url              = COALESCE($4, url),
        cover_url        = COALESCE($5, cover_url),
        status           = COALESCE($6, status),
        started_at       = COALESCE($7, started_at),
        completed_at     = COALESCE($8, completed_at),
        rating           = COALESCE($9, rating),
        review           = COALESCE($10, review),
        progress_current = COALESCE($11, progress_current),
        progress_total   = COALESCE($12, progress_total),
        skill_id         = COALESCE($13, skill_id),
        metadata         = COALESCE($14, metadata)
       WHERE id = $15 AND user_id = $16 RETURNING *`,
      [type, title, author, url, cover_url, status, started_at, completed_at,
       rating, review, progress_current, progress_total, skill_id,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Resource not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE resources SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
