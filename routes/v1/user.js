const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET / — get user row
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH / — partial update user
router.patch('/', validate(z.object({
  display_name: z.string().optional(),
  timezone:     z.string().optional(),
  theme:        z.string().optional(),
  settings:     z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { display_name, timezone, theme, settings } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET
        display_name = COALESCE($1, display_name),
        timezone     = COALESCE($2, timezone),
        theme        = COALESCE($3, theme),
        settings     = COALESCE($4, settings)
       WHERE id = $5 RETURNING *`,
      [display_name, timezone, theme, settings ? JSON.stringify(settings) : null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
