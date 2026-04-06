const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET /weekly — list weekly reviews
router.get('/weekly', async (req, res, next) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 365);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM weekly_reviews WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY week_start DESC LIMIT $2`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /weekly — upsert by week_start
router.post('/weekly', validate(z.object({
  week_start:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours_logged:   z.number().min(0).max(168).optional(),
  reflection:     z.string().optional(),
  wins:           z.array(z.string()).optional(),
  blockers:       z.array(z.string()).optional(),
  next_week_focus: z.array(z.string()).optional(),
  mood_avg:       z.number().min(1).max(10).optional(),
  metadata:       z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { week_start, hours_logged, reflection, wins, blockers, next_week_focus, mood_avg, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO weekly_reviews (user_id, week_start, hours_logged, reflection, wins, blockers, next_week_focus, mood_avg, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, week_start) DO UPDATE SET
         hours_logged    = EXCLUDED.hours_logged,
         reflection      = EXCLUDED.reflection,
         wins            = EXCLUDED.wins,
         blockers        = EXCLUDED.blockers,
         next_week_focus = EXCLUDED.next_week_focus,
         mood_avg        = EXCLUDED.mood_avg,
         metadata        = EXCLUDED.metadata
       RETURNING *`,
      [req.user.id, week_start, hours_logged, reflection, wins, blockers, next_week_focus, mood_avg,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /weekly/:week — get by week_start
router.get('/weekly/:week', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM weekly_reviews WHERE user_id = $1 AND week_start = $2 AND archived_at IS NULL`,
      [req.user.id, req.params.week]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Review not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /weekly/:week — update by week_start
router.patch('/weekly/:week', async (req, res, next) => {
  const { hours_logged, reflection, wins, blockers, next_week_focus, mood_avg, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE weekly_reviews SET
        hours_logged    = COALESCE($1, hours_logged),
        reflection      = COALESCE($2, reflection),
        wins            = COALESCE($3, wins),
        blockers        = COALESCE($4, blockers),
        next_week_focus = COALESCE($5, next_week_focus),
        mood_avg        = COALESCE($6, mood_avg),
        metadata        = COALESCE($7, metadata)
       WHERE user_id = $8 AND week_start = $9 RETURNING *`,
      [hours_logged, reflection, wins, blockers, next_week_focus, mood_avg,
       metadata ? JSON.stringify(metadata) : null,
       req.user.id, req.params.week]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Review not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
