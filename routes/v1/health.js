const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list health logs
router.get('/', async (req, res, next) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM health_logs WHERE user_id = $1 ORDER BY log_date DESC LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — upsert by log_date
router.post('/', validate(z.object({
  log_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood:         z.number().int().min(1).max(10).optional(),
  energy:       z.number().int().min(1).max(10).optional(),
  sleep_hours:  z.number().min(0).max(24).optional(),
  sleep_quality: z.number().int().min(1).max(5).optional(),
  weight_kg:    z.number().positive().optional(),
  notes:        z.string().optional(),
  metadata:     z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { log_date, mood, energy, sleep_hours, sleep_quality, weight_kg, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO health_logs (user_id, log_date, mood, energy, sleep_hours, sleep_quality, weight_kg, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         mood          = EXCLUDED.mood,
         energy        = EXCLUDED.energy,
         sleep_hours   = EXCLUDED.sleep_hours,
         sleep_quality = EXCLUDED.sleep_quality,
         weight_kg     = EXCLUDED.weight_kg,
         notes         = EXCLUDED.notes,
         metadata      = EXCLUDED.metadata
       RETURNING *`,
      [req.user.id, log_date, mood, energy, sleep_hours, sleep_quality, weight_kg, notes,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:date — get by date
router.get('/:date', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM health_logs WHERE user_id = $1 AND log_date = $2',
      [req.user.id, req.params.date]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Health log not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:date — update by date
router.patch('/:date', async (req, res, next) => {
  const { mood, energy, sleep_hours, sleep_quality, weight_kg, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE health_logs SET
        mood          = COALESCE($1, mood),
        energy        = COALESCE($2, energy),
        sleep_hours   = COALESCE($3, sleep_hours),
        sleep_quality = COALESCE($4, sleep_quality),
        weight_kg     = COALESCE($5, weight_kg),
        notes         = COALESCE($6, notes),
        metadata      = COALESCE($7, metadata)
       WHERE user_id = $8 AND log_date = $9 RETURNING *`,
      [mood, energy, sleep_hours, sleep_quality, weight_kg, notes,
       metadata ? JSON.stringify(metadata) : null,
       req.user.id, req.params.date]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Health log not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
