const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list media items
router.get('/', async (req, res, next) => {
  const { type, status } = req.query;
  try {
    let query = 'SELECT * FROM media_items WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (type)   { params.push(type);   query += ` AND type = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create media item
router.post('/', validate(z.object({
  type:        z.enum(['movie','show','album','song','podcast','game','documentary','other']),
  title:       z.string().min(1),
  creator:     z.string().optional(),
  year:        z.number().int().optional(),
  cover_url:   z.string().url().optional(),
  url:         z.string().url().optional(),
  status:      z.enum(['backlog','watching','completed','abandoned','reference']).optional(),
  rating:      z.number().int().min(1).max(5).optional(),
  review:      z.string().optional(),
  started_at:  z.string().optional(),
  completed_at: z.string().optional(),
  progress:    z.record(z.unknown()).optional(),
  metadata:    z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { type, title, creator, year, cover_url, url, status, rating, review,
          started_at, completed_at, progress, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO media_items (user_id, type, title, creator, year, cover_url, url,
        status, rating, review, started_at, completed_at, progress, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.id, type, title, creator, year, cover_url, url, status || 'backlog',
       rating, review, started_at, completed_at,
       progress ? JSON.stringify(progress) : '{}',
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single item
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM media_items WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Media item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { type, title, creator, year, cover_url, url, status, rating, review,
          started_at, completed_at, progress, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE media_items SET
        type         = COALESCE($1, type),
        title        = COALESCE($2, title),
        creator      = COALESCE($3, creator),
        year         = COALESCE($4, year),
        cover_url    = COALESCE($5, cover_url),
        url          = COALESCE($6, url),
        status       = COALESCE($7, status),
        rating       = COALESCE($8, rating),
        review       = COALESCE($9, review),
        started_at   = COALESCE($10, started_at),
        completed_at = COALESCE($11, completed_at),
        progress     = COALESCE($12, progress),
        metadata     = COALESCE($13, metadata)
       WHERE id = $14 AND user_id = $15 RETURNING *`,
      [type, title, creator, year, cover_url, url, status, rating, review,
       started_at, completed_at,
       progress ? JSON.stringify(progress) : null,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Media item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE media_items SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
