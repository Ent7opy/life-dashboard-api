const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');


// GET /due — overdue keep_in_touch contacts
router.get('/due', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM contacts
       WHERE user_id = $1 AND archived_at IS NULL AND keep_in_touch_freq IS NOT NULL
         AND (
           last_contact IS NULL
           OR (keep_in_touch_freq = 'weekly'    AND last_contact < NOW() - INTERVAL '7 days')
           OR (keep_in_touch_freq = 'monthly'   AND last_contact < NOW() - INTERVAL '30 days')
           OR (keep_in_touch_freq = 'quarterly' AND last_contact < NOW() - INTERVAL '90 days')
         )
       ORDER BY last_contact ASC NULLS FIRST`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET / — list contacts
router.get('/', async (req, res, next) => {
  const { relationship } = req.query;
  try {
    let query = 'SELECT * FROM contacts WHERE user_id = $1 AND archived_at IS NULL';
    const params = [req.user.id];
    if (relationship) { params.push(relationship); query += ` AND relationship = $${params.length}`; }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create contact
router.post('/', validate(z.object({
  name:               z.string().min(1),
  relationship:       z.string().optional(),
  email:              z.string().email().optional(),
  phone:              z.string().optional(),
  location:           z.string().optional(),
  birthday:           z.string().optional(),
  avatar_url:         z.string().url().optional(),
  notes:              z.string().optional(),
  keep_in_touch_freq: z.string().optional(),
  metadata:           z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { name, relationship, email, phone, location, birthday,
          avatar_url, notes, keep_in_touch_freq, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO contacts (user_id, name, relationship, email, phone, location, birthday,
        avatar_url, notes, keep_in_touch_freq, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, name, relationship, email, phone, location, birthday,
       avatar_url, notes, keep_in_touch_freq,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single contact
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { name, relationship, email, phone, location, birthday,
          avatar_url, notes, keep_in_touch_freq, last_contact, metadata } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE contacts SET
        name               = COALESCE($1, name),
        relationship       = COALESCE($2, relationship),
        email              = COALESCE($3, email),
        phone              = COALESCE($4, phone),
        location           = COALESCE($5, location),
        birthday           = COALESCE($6, birthday),
        avatar_url         = COALESCE($7, avatar_url),
        notes              = COALESCE($8, notes),
        keep_in_touch_freq = COALESCE($9, keep_in_touch_freq),
        last_contact       = COALESCE($10, last_contact),
        metadata           = COALESCE($11, metadata)
       WHERE id = $12 AND user_id = $13 RETURNING *`,
      [name, relationship, email, phone, location, birthday, avatar_url, notes,
       keep_in_touch_freq, last_contact, metadata ? JSON.stringify(metadata) : null,
       req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE contacts SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:id/interactions — list interactions
router.get('/:id/interactions', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM interactions WHERE contact_id = $1 AND user_id = $2
       ORDER BY date DESC`,
      [req.params.id, req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /:id/interactions — log interaction, update last_contact
router.post('/:id/interactions', validate(z.object({
  type:     z.enum(['message','call','meeting','email','social','other']),
  date:     z.string().optional(),
  summary:  z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})), async (req, res, next) => {
  const { type, date, summary, metadata } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO interactions (user_id, contact_id, type, date, summary, metadata)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, req.params.id, type, date || null, summary,
       metadata ? JSON.stringify(metadata) : '{}']
    );
    await client.query(
      `UPDATE contacts SET last_contact = CURRENT_DATE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
