const router = require('express').Router();
const { pool } = require('../../db/pool');
const { validate } = require('../../middleware/validate');
const { z } = require('zod');

const UID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

// GET / — list tasks with filters
router.get('/', async (req, res, next) => {
  const { status, project_id, due } = req.query;
  try {
    let query = 'SELECT * FROM tasks WHERE user_id = $1 AND archived_at IS NULL';
    const params = [UID];
    if (status)     { params.push(status);     query += ` AND status = $${params.length}`; }
    if (project_id) { params.push(project_id); query += ` AND project_id = $${params.length}`; }
    if (due === 'today') {
      query += ` AND due_date = CURRENT_DATE`;
    } else if (due === 'week') {
      query += ` AND due_date <= CURRENT_DATE + 7`;
    }
    query += ' ORDER BY priority DESC, due_date ASC NULLS LAST, created_at';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST / — create task
router.post('/', validate(z.object({
  title:      z.string().optional(),
  label:      z.string().optional(),
  status:     z.string().optional(),
  priority:   z.number().int().min(1).max(4).optional(),
  due_date:   z.string().optional(),
  notes:      z.string().optional(),
  project_id: z.string().uuid().optional(),
  goal_id:    z.string().uuid().optional(),
  parent_id:  z.string().uuid().optional(),
  recurrence: z.string().optional(),
  phase_id:   z.string().optional(),
  category:   z.string().optional(),
}).refine(d => d.title || d.label, { message: 'title or label required' })),
async (req, res, next) => {
  const { title, label, status, priority, due_date, notes, project_id, goal_id,
          parent_id, recurrence, phase_id, category } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, label, title, status, priority, due_date, notes,
        project_id, goal_id, parent_id, recurrence, phase_id, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [UID, label || title, title || label, status || 'todo', priority || 2,
       due_date, notes, project_id, goal_id, parent_id, recurrence, phase_id, category]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — single task
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2 AND archived_at IS NULL',
      [req.params.id, UID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id — partial update
router.patch('/:id', async (req, res, next) => {
  const { title, label, status, priority, completed, due_date, notes,
          project_id, goal_id } = req.body;
  try {
    // If marking done, set completed_at if not already set
    const completedAtClause = status === 'done'
      ? ', completed_at = COALESCE(completed_at, NOW())'
      : '';
    const { rows } = await pool.query(
      `UPDATE tasks SET
        title      = COALESCE($1, title),
        label      = COALESCE($2, label),
        status     = COALESCE($3, status),
        priority   = COALESCE($4, priority),
        completed  = COALESCE($5, completed),
        due_date   = COALESCE($6, due_date),
        notes      = COALESCE($7, notes),
        project_id = COALESCE($8, project_id),
        goal_id    = COALESCE($9, goal_id)
        ${completedAtClause}
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [title, label, status, priority, completed, due_date, notes,
       project_id, goal_id, req.params.id, UID]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE tasks SET archived_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, UID]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
