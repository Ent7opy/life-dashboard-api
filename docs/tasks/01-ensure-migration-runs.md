# Task 01: Ensure Migration Runs Correctly

## Description
The Railway deployment includes a `postdeploy` hook (`npm run migrate`) that should create database tables and insert a default user. Verify that migration runs without errors and tables are created.

## Acceptance Criteria
- [ ] Migration script (`scripts/migrate.js`) runs successfully during Railway deploy.
- [ ] All tables (`users`, `university_path`, `tasks`, `progress`, `reading_list`, `weekly_review`) exist in PostgreSQL.
- [ ] Default user (`id = 00000000‑0000‑0000‑0000‑000000000000`) is inserted.
- [ ] Triggers and indexes are created.
- [ ] No duplicate migration errors on subsequent deploys.

## Steps
1. Check Railway logs for `postdeploy` output (look for "Migration completed successfully").
2. If migration fails, examine error message and fix (common issues: missing `DATABASE_URL`, syntax errors in SQL).
3. Connect to PostgreSQL directly via `railway run psql` and list tables (`\dt`).
4. Verify default user exists: `SELECT * FROM users;`
5. If migration didn't run, run manually: `railway run npm run migrate`.
6. Update `railway.json` if needed (e.g., ensure `postdeploy` command is correct).

## Notes
- Migration is idempotent (uses `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`).
- The script uses `dotenv`; ensure `DATABASE_URL` is set in Railway environment.
- If migration still fails, consider adding a `pre‑deploy` script to wait for PostgreSQL to be ready.

## References
- [Migration script](https://github.com/Ent7opy/life-dashboard-api/blob/main/scripts/migrate.js)
- [Schema SQL](https://github.com/Ent7opy/life-dashboard-api/blob/main/schema.sql)
- [Railway postdeploy docs](https://docs.railway.app/deploy/post‑deploy)