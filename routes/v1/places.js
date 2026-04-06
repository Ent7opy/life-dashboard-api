const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list places
router.get('/', async (req, res, next) => {
  const { status } = req.query;
  try {
    let query = 'SELECT * FROM places WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create place
router.post('/', validate(z.object({
  name:       z.string().min(1),
  country:    z.string().min(1),
  city:       z.string().optional(),
  type:       z.enum(['city','country','region','landmark','venue','other']).optional(),
  status:     z.enum(['wishlist','visited','lived']).optional(),
  visited_at: z.string().optional(),
  lat:        z.number().optional(),
  lng:        z.number().optional(),
  notes:      z.string().optional(),
  rating:     z.number().int().min(1).max(5).optional(),
  metadata:   z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, country, city, type, status, visited_at, lat, lng, notes, rating, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO places (user_id, name, country, city, type, status, visited_at, lat, lng, notes, rating, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, name, country, city, type || 'city', status || 'wishlist',
       visited_at, lat, lng, notes, rating,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, country, city, type, status, visited_at, lat, lng, notes, rating, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE places SET
        name       = COALESCE($1, name),
        country    = COALESCE($2, country),
        city       = COALESCE($3, city),
        type       = COALESCE($4, type),
        status     = COALESCE($5, status),
        visited_at = COALESCE($6, visited_at),
        lat        = COALESCE($7, lat),
        lng        = COALESCE($8, lng),
        notes      = COALESCE($9, notes),
        rating     = COALESCE($10, rating),
        metadata   = COALESCE($11, metadata)
       WHERE id = $12 AND user_id = $13 RETURNING *`,
      [name, country, city, type, status, visited_at, lat, lng, notes, rating,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Place not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE places SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
