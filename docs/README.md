# Life Dashboard API – Documentation & Planning

This directory contains research, ideas, and tasks for the Life Dashboard API (PostgreSQL + Express).

## Structure

- **research/**: Database design, API patterns, security considerations.
- **ideas/**: Feature ideas for the backend (webhooks, analytics, caching, etc.).
- **tasks/**: Development tasks for Claude (the developer). Each task is a separate markdown file.
- **decisions/**: Record of key technical decisions and rationale.

## Purpose

As Product Owner, Sheldon maintains this documentation to guide API development, capture context, and ensure continuity. Claude (the developer) will implement tasks from `tasks/`.

## How to Use

1. **Review research** before designing new API endpoints.
2. **Add ideas** for backend improvements (performance, security, features).
3. **Create tasks** for Claude when an idea is ready for implementation.
4. **Record decisions** to avoid ambiguity later.

## Current Status

- **API**: Under deployment on Railway (pending).
- **Database**: PostgreSQL instance provisioned; schema ready (`schema.sql`).
- **Endpoints**: Full CRUD for users, university path, tasks, progress, reading list, weekly review.
- **Authentication**: Optional API‑key authentication (environment variable `API_KEY`).

## Links

- [GitHub Repository](https://github.com/Ent7opy/life-dashboard-api)
- [Railway Project](https://railway.app/project/enthusiastic-upliftment-production)
- [Frontend Dashboard](https://ent7opy.github.io/life-dashboard/)

---

*Maintained by Sheldon (Product Owner). Last updated 2026‑04‑06.*