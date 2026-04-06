const router = require('express').Router();
const { pool } = require('../../db/pool');


// GET / — aggregated dashboard data
router.get('/', async (req, res, next) => {
  try {
    const [
      journalToday,
      habitsToday,
      healthToday,
      weekReview,
      tasksDue,
      activeProjects,
      activeGoals,
      inboxUnprocessed,
      contactsDue,
      skillsCount,
      resourcesActive,
    ] = await Promise.all([
      // Journal entry for today
      pool.query(
        `SELECT * FROM journal_entries WHERE user_id = $1 AND entry_date = CURRENT_DATE AND archived_at IS NULL`,
        [req.user.id]
      ),
      // Habits with done boolean for today
      pool.query(
        `SELECT h.*, CASE WHEN hl.id IS NOT NULL THEN TRUE ELSE FALSE END AS done
         FROM habits h
         LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.log_date = CURRENT_DATE
         WHERE h.user_id = $1 AND h.active = TRUE AND h.archived_at IS NULL
         ORDER BY h.name`,
        [req.user.id]
      ),
      // Health log for today
      pool.query(
        `SELECT * FROM health_logs WHERE user_id = $1 AND log_date = CURRENT_DATE`,
        [req.user.id]
      ),
      // Weekly review for current week (week_start = most recent Monday)
      pool.query(
        `SELECT * FROM weekly_reviews
         WHERE user_id = $1 AND archived_at IS NULL
           AND week_start = DATE_TRUNC('week', CURRENT_DATE)::DATE`,
        [req.user.id]
      ),
      // Tasks due this week not done
      pool.query(
        `SELECT * FROM tasks
         WHERE user_id = $1 AND archived_at IS NULL
           AND due_date <= CURRENT_DATE
           AND status != 'done'
         ORDER BY due_date ASC, priority DESC`,
        [req.user.id]
      ),
      // Active projects count
      pool.query(
        `SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = 'active' AND archived_at IS NULL`,
        [req.user.id]
      ),
      // Active goals count
      pool.query(
        `SELECT COUNT(*) FROM goals WHERE user_id = $1 AND status = 'active' AND archived_at IS NULL`,
        [req.user.id]
      ),
      // Inbox unprocessed count
      pool.query(
        `SELECT COUNT(*) FROM inbox_items WHERE user_id = $1 AND processed = FALSE AND archived_at IS NULL`,
        [req.user.id]
      ),
      // Overdue contacts count
      pool.query(
        `SELECT COUNT(*) FROM contacts
         WHERE user_id = $1 AND archived_at IS NULL AND keep_in_touch_freq IS NOT NULL
           AND (
             last_contact IS NULL
             OR (keep_in_touch_freq = 'weekly'    AND last_contact < NOW() - INTERVAL '7 days')
             OR (keep_in_touch_freq = 'monthly'   AND last_contact < NOW() - INTERVAL '30 days')
             OR (keep_in_touch_freq = 'quarterly' AND last_contact < NOW() - INTERVAL '90 days')
           )`,
        [req.user.id]
      ),
      // Skills count
      pool.query(
        `SELECT COUNT(*) FROM skills WHERE user_id = $1 AND archived_at IS NULL`,
        [req.user.id]
      ),
      // Active resources count
      pool.query(
        `SELECT COUNT(*) FROM resources WHERE user_id = $1 AND status = 'active' AND archived_at IS NULL`,
        [req.user.id]
      ),
    ]);

    res.json({
      today: {
        journal: journalToday.rows[0] || null,
        habits:  habitsToday.rows,
        health:  healthToday.rows[0] || null,
      },
      week: {
        review:       weekReview.rows[0] || null,
        tasks_due:    tasksDue.rows,
        hours_logged: weekReview.rows[0]?.hours_logged || 0,
      },
      snapshot: {
        active_projects:    parseInt(activeProjects.rows[0].count),
        active_goals:       parseInt(activeGoals.rows[0].count),
        inbox_unprocessed:  parseInt(inboxUnprocessed.rows[0].count),
        contacts_due:       parseInt(contactsDue.rows[0].count),
        skills_count:       parseInt(skillsCount.rows[0].count),
        resources_active:   parseInt(resourcesActive.rows[0].count),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
