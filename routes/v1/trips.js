const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list trips
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM trips WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY start_date DESC NULLS LAST`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create trip
router.post('/', validate(z.object({
  name:       z.string().min(1),
  start_date: z.string().optional(),
  end_date:   z.string().optional(),
  status:     z.enum(['planning','booked','active','completed','cancelled']).optional(),
  budget:     z.number().positive().optional(),
  currency:   z.string().optional(),
  notes:      z.string().optional(),
  metadata:   z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, start_date, end_date, status, budget, currency, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (user_id, name, start_date, end_date, status, budget, currency, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, name, start_date, end_date, status || 'planning', budget,
       currency || 'EUR', notes, metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single trip with places
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' });
    const { rows: places } = await pool.query(
      `SELECT p.*, tp.sort_order FROM places p
       JOIN trip_places tp ON tp.place_id = p.id
       WHERE tp.trip_id = $1
       ORDER BY tp.sort_order`,
      [req.params.id]
    );
    res.json({ ...rows[0], places });
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, start_date, end_date, status, budget, currency, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE trips SET
        name       = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date   = COALESCE($3, end_date),
        status     = COALESCE($4, status),
        budget     = COALESCE($5, budget),
        currency   = COALESCE($6, currency),
        notes      = COALESCE($7, notes),
        metadata   = COALESCE($8, metadata)
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [name, start_date, end_date, status, budget, currency, notes,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE trips SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /:id/places — add place to trip
router.post('/:id/places', validate(z.object({
  place_id:   z.string().uuid(),
  sort_order: z.number().int().optional(),
})), async (req, res, next) => {
  const { place_id, sort_order } = req.body;
  try {
    await pool.query(
      `INSERT INTO trip_places (trip_id, place_id, sort_order)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.params.id, place_id, sort_order || 0]
    );
    res.status(201).json({ trip_id: req.params.id, place_id });
  } catch (err) { next(err); }
});

// DELETE /:id/places/:placeId — remove place from trip
router.delete('/:id/places/:placeId', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM trip_places WHERE trip_id = $1 AND place_id = $2',
      [req.params.id, req.params.placeId]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
