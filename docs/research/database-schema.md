# Database Schema Design

## Overview
PostgreSQL schema for the Life Dashboard API. Designed for a single user (owner) with extensibility for multi‑user later.

## Tables

### `users`
- **Purpose**: Store user preferences and authentication (optional API‑key hash).
- **Columns**:
  - `id` (UUID primary key) – default user: `00000000‑0000‑0000‑0000‑000000000000`
  - `created_at`
  - `email` (unique)
  - `api_key_hash` (bcrypt hash of API key; optional)
  - `theme_preference` ('light', 'dark', 'auto')
  - `settings` (JSONB for future flexibility)

### `university_path`
- **Purpose**: Store selected university path (German, Bulgarian, Hybrid).
- **Columns**:
  - `id` (UUID)
  - `user_id` (foreign key)
  - `selected_path` ('german', 'bulgarian', 'hybrid')
  - `selected_university_name`
  - `start_year`
  - `notes`
  - `created_at`, `updated_at`

### `tasks`
- **Purpose**: User‑defined tasks with due dates, categories, and completion status.
- **Columns**:
  - `id` (UUID)
  - `user_id`
  - `label` (text)
  - `completed` (boolean)
  - `due_date` (date)
  - `phase_id` (string, references frontend phase)
  - `category` (string, e.g., 'research', 'language', 'work')
  - `created_at`, `updated_at`

### `progress`
- **Purpose**: Store progress percentages per category (editable rings).
- **Columns**:
  - `user_id`
  - `category_id` (string, e.g., 'research', 'language')
  - `value` (0‑100)
  - `updated_at`
  - **Primary key**: (`user_id`, `category_id`)

### `reading_list`
- **Purpose**: Track reading progress of books.
- **Columns**:
  - `id` (UUID)
  - `user_id`
  - `book_id` (string, matches frontend book ID)
  - `status` ('unread', 'reading', 'completed')
  - `started_at`, `completed_at` (dates)
  - `rating` (1‑5)
  - `notes`
  - `created_at`, `updated_at`

### `weekly_review`
- **Purpose**: Daily study hours, reflections, and goals.
- **Columns**:
  - `id` (UUID)
  - `user_id`
  - `entry_date` (date, unique per user)
  - `hours` (numeric, 0‑24)
  - `reflection` (text)
  - `goals` (JSONB array of strings)
  - `created_at`

## Indexes
- `idx_tasks_user_id`
- `idx_reading_list_user_id`
- `idx_weekly_review_user_id`
- `idx_weekly_review_entry_date`

## Triggers
Automatically update `updated_at` timestamp on `university_path`, `tasks`, `reading_list`.

## Migration
The migration script (`scripts/migrate.js`) creates all tables, triggers, and inserts a default user.

## Future Extensions
- **Multi‑user support**: Add `tenant_id` column, adjust foreign keys.
- **Audit logs**: Table for tracking changes to sensitive data.
- **File attachments**: Store uploaded files (CV, certificates).
- **Notifications**: Store scheduled reminders.

## References
- [Full schema SQL](https://github.com/Ent7opy/life-dashboard-api/blob/main/schema.sql)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)