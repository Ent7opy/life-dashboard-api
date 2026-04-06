const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list entries
router.get('/', async (req, res, next) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM journal_entries WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY entry_date DESC LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create/upsert by entry_date
router.post('/', validate(z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body:       z.string().optional(),
  mood:       z.number().int().min(1).max(10).optional(),
  energy:     z.number().int().min(1).max(10).optional(),
  prompts:    z.record(z.unknown()).optional(),
  metadata:   z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { entry_date, body, mood, energy, prompts, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO journal_entries (user_id, entry_date, body, mood, energy, prompts, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         body     = EXCLUDED.body,
         mood     = EXCLUDED.mood,
         energy   = EXCLUDED.energy,
         prompts  = EXCLUDED.prompts,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [req.user.id, entry_date, body, mood, energy,
       prompts ? JSON.stringify(prompts) : '{}',
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:date — get by date
router.get('/:date', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM journal_entries WHERE user_id = $1 AND entry_date = $2 AND archived_at IS NULL`,
      [req.user.id, req.params.date]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:date — update by date
router.patch('/:date', async (req, res, next) => {
  const { body, mood, energy, prompts, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE journal_entries SET
        body     = COALESCE($1, body),
        mood     = COALESCE($2, mood),
        energy   = COALESCE($3, energy),
        prompts  = COALESCE($4, prompts),
        metadata = COALESCE($5, metadata)
       WHERE user_id = $6 AND entry_date = $7 RETURNING *`,
      [body, mood, energy,
       prompts ? JSON.stringify(prompts) : null,
       metadata ? JSON.stringify(metadata) : null,
       req.user.id, req.params.date]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Entry not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
