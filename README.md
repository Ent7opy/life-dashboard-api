# Life Dashboard API

Backend API for the Life Dashboard (PostgreSQL + Express). Provides persistence for university path, tasks, progress, reading list, and weekly review.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
- Create a PostgreSQL database (locally or via Railway).
- Get the connection string (`DATABASE_URL`).

### 3. Configure environment
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

### 4. Run migration
```bash
npm run migrate
```
This creates the necessary tables and inserts a default user.

### 5. Start the server
```bash
npm start
```
For development with auto‑restart:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

## Deployment (Railway)

1. Push this repository to GitHub.
2. Create a new Railway project, connect the GitHub repository.
3. Add a PostgreSQL plugin (Railway will inject `DATABASE_URL`).
4. Set environment variables in the Railway dashboard:
   - `DATABASE_URL` (auto‑injected by PostgreSQL plugin)
   - `API_KEY` (optional, generate a random string)
   - `PORT` (optional, Railway sets `PORT` automatically)
5. Deploy.

**Migrations run automatically** after each deployment via the `postdeploy` hook defined in `railway.json`. No manual steps needed.

If you need to run migrations manually (e.g., after schema changes), you can run:
```bash
railway run npm run migrate
```

## API Endpoints

All endpoints expect JSON request bodies and return JSON responses.

### Authentication (optional)
If `API_KEY` is set in environment, include header:
```
x-api-key: your-api-key
```

### User
- `GET /api/user` – get user preferences
- `PUT /api/user` – update theme preference, settings

### University Path
- `GET /api/path` – get selected path (German, Bulgarian, Hybrid)
- `PUT /api/path` – set path

### Tasks
- `GET /api/tasks` – list all tasks
- `POST /api/tasks` – create a new task
- `PUT /api/tasks/:id` – update a task
- `DELETE /api/tasks/:id` – delete a task

### Progress
- `GET /api/progress` – get progress values per category
- `PUT /api/progress` – update a category’s progress (0‑100)

### Reading List
- `GET /api/reading` – list reading entries
- `POST /api/reading` – add a book
- `PUT /api/reading/:id` – update reading status

### Weekly Review
- `GET /api/weekly-review` – list recent entries (default 30)
- `POST /api/weekly-review` – log a daily review

### Health
- `GET /health` – server status

## Database Schema

See `schema.sql` for table definitions. The database includes:

- `users` – single user (default UUID `00000000‑0000‑0000‑0000‑000000000000`)
- `university_path` – selected path and notes
- `tasks` – customizable tasks with due dates and categories
- `progress` – progress percentages per category
- `reading_list` – book tracking
- `weekly_review` – daily study hours, reflections, goals

## Frontend Integration

In the dashboard (Next.js app), you can replace localStorage calls with API calls. Example:

```javascript
const API_BASE = 'https://your‑api‑url.railway.app';
const API_KEY = 'your‑api‑key';

fetch(`${API_BASE}/api/tasks`, {
  headers: { 'x-api-key': API_KEY }
})
```

A future update will add a configuration panel in the dashboard to set the API endpoint and key.

## Notes

- The API is designed for a single user (the dashboard owner). Multi‑user support can be added later.
- If `API_KEY` is not set, authentication is skipped (development only).
- The migration script creates a default user with a fixed UUID. All data is linked to this user.
- Migrations are idempotent and safe to run multiple times.