const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — list workouts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM workouts WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY workout_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create workout
router.post('/', validate(z.object({
  type:         z.enum(['strength','cardio','flexibility','sport','walk','other']),
  workout_date: z.string().optional(),
  name:         z.string().optional(),
  duration_min: z.number().int().positive().optional(),
  calories:     z.number().int().positive().optional(),
  notes:        z.string().optional(),
  metadata:     z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { type, workout_date, name, duration_min, calories, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO workouts (user_id, type, workout_date, name, duration_min, calories, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, type, workout_date || null, name, duration_min, calories, notes,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single workout with sets
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workouts WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workout not found' });
    const { rows: sets } = await pool.query(
      'SELECT * FROM workout_sets WHERE workout_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...rows[0], sets });
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { type, workout_date, name, duration_min, calories, notes, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE workouts SET
        type         = COALESCE($1, type),
        workout_date = COALESCE($2, workout_date),
        name         = COALESCE($3, name),
        duration_min = COALESCE($4, duration_min),
        calories     = COALESCE($5, calories),
        notes        = COALESCE($6, notes),
        metadata     = COALESCE($7, metadata)
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [type, workout_date, name, duration_min, calories, notes,
       metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workout not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete (cascades to sets)
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE workouts SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/sets — list sets
router.get('/:id/sets', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workout_sets WHERE workout_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

const setSchema = z.array(z.object({
  exercise:     z.string().min(1),
  sets:         z.number().int().positive().optional(),
  reps:         z.number().int().positive().optional(),
  weight_kg:    z.number().positive().optional(),
  duration_sec: z.number().int().positive().optional(),
  distance_m:   z.number().int().positive().optional(),
  notes:        z.string().optional(),
  sort_order:   z.number().int().optional(),
}));

// PUT /:id/sets — replace all sets
router.put('/:id/sets', validate(setSchema), async (req, res, next) => {
  const sets = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM workout_sets WHERE workout_id = $1', [req.params.id]);
    const inserted = [];
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      const { rows } = await client.query(
        `INSERT INTO workout_sets (workout_id, exercise, sets, reps, weight_kg, duration_sec, distance_m, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.params.id, s.exercise, s.sets, s.reps, s.weight_kg, s.duration_sec,
         s.distance_m, s.notes, s.sort_order !== undefined ? s.sort_order : i]
      );
      inserted.push(rows[0]);
    }
    await client.query('COMMIT');
    res.json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
