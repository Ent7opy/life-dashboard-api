const router = require('express').Router();
const { pool } = require('../../db/pool');


// GET / — full text search across multiple tables
router.get('/', async (req, res, next) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'q parameter is required' });
  }
  const like = `%${q.trim()}%`;

  try {
    const [
      notes, resources, contacts, projects, goals, media, skills, hobbies
    ] = await Promise.all([
      pool.query(
        `SELECT id, 'note' AS type, COALESCE(title, LEFT(body, 60)) AS title, LEFT(body, 120) AS snippet
         FROM notes WHERE user_id = $1 AND archived_at IS NULL AND (title ILIKE $2 OR body ILIKE $2)
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'resource' AS type, title, COALESCE(author, '') AS snippet
         FROM resources WHERE user_id = $1 AND archived_at IS NULL AND (title ILIKE $2 OR author ILIKE $2)
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'contact' AS type, name AS title, COALESCE(relationship, '') AS snippet
         FROM contacts WHERE user_id = $1 AND archived_at IS NULL AND name ILIKE $2
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'project' AS type, name AS title, COALESCE(description, '') AS snippet
         FROM projects WHERE user_id = $1 AND archived_at IS NULL AND (name ILIKE $2 OR description ILIKE $2)
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'goal' AS type, title, COALESCE(description, '') AS snippet
         FROM goals WHERE user_id = $1 AND archived_at IS NULL AND title ILIKE $2
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'media' AS type, title, COALESCE(creator, '') AS snippet
         FROM media_items WHERE user_id = $1 AND archived_at IS NULL AND title ILIKE $2
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'skill' AS type, name AS title, COALESCE(category, '') AS snippet
         FROM skills WHERE user_id = $1 AND archived_at IS NULL AND name ILIKE $2
         LIMIT 10`, [req.user.id, like]),
      pool.query(
        `SELECT id, 'hobby' AS type, name AS title, COALESCE(description, '') AS snippet
         FROM hobbies WHERE user_id = $1 AND archived_at IS NULL AND name ILIKE $2
         LIMIT 10`, [req.user.id, like]),
    ]);

    const results = [
      ...notes.rows,
      ...resources.rows,
      ...contacts.rows,
      ...projects.rows,
      ...goals.rows,
      ...media.rows,
      ...skills.rows,
      ...hobbies.rows,
    ];

    res.json({ query: q, results });
  } catch (err) { next(err); }
});

module.exports = router;
