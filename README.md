# Booking & Reminder System

Appointment booking and automated reminder system for small businesses. Manage clients, book appointments, and automatically queue up 24-hour-ahead reminders — built as a portfolio project by Nova Vey Engineering.

## What it does

Small service businesses (salons, clinics, consultants, tutors) need a simple way to track clients, book appointments, and make sure nobody misses a booking. This app provides a lightweight single-page dashboard backed by a Node/Express API and PostgreSQL, with a background job that watches for appointments coming up and fires off reminders 24 hours in advance.

## Features

- **Client management** — add clients and view them all in one list (name, email, phone).
- **Appointment booking** — pick a client, service, date/time, and duration, with optional notes.
- **Automatic reminders** — every booking automatically schedules a reminder for 24 hours before the appointment.
- **Appointment tracking** — filter appointments by status (Upcoming, Completed, Cancelled, No Show), expand a card to view notes or change its status.
- **Scheduled reminder job** — a cron job checks every 5 minutes for due reminders and sends them (console log by default, pluggable into a real email provider).
- **Mobile-friendly UI** — clean white/teal single-page interface with no frontend framework or build step.

## Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Scheduling:** node-cron
- **Frontend:** Vanilla HTML/CSS/JS (single page, no framework)

## Project structure

```
booking-reminder-system/
  backend/
    server.js              # Express app entrypoint
    db/
      pool.js               # PostgreSQL connection pool
      schema.sql             # Table definitions
    routes/
      clients.js             # /api/clients
      bookings.js            # /api/bookings
    services/
      reminderService.js     # cron job that sends due reminders
  frontend/
    public/
      index.html             # Single-page app (Clients / Book / Appointments)
  package.json
  .env.example
  .gitignore
  README.md
```

## Setup

### 1. Prerequisites

- Node.js 18+
- A running PostgreSQL instance

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to point at your PostgreSQL database, and set `API_KEY` to a random secret (e.g. `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) — every `/api/*` request must send this value in an `x-api-key` header, and the server refuses all API requests if it's unset. `RESEND_API_KEY` is optional — see [Email reminders](#email-reminders) below.

### 4. Initialize the database

```bash
npm run db:init
```

This runs `backend/db/schema.sql` against `$DATABASE_URL`, creating the `clients`, `bookings`, and `reminders` tables (safe to re-run — statements use `IF NOT EXISTS`).

### 5. Run the app

```bash
npm run dev    # with nodemon, auto-restarts on changes
# or
npm start       # plain node
```

The server listens on `PORT` (default `3001`) and serves both the API and the frontend at `http://localhost:3001`.

## Deployment (Railway)

The app is a plain Node/Express server with no build step, so Railway's default Nixpacks build (`npm install` then `npm start`) works with no extra config files.

1. On [railway.app](https://railway.app), create a new project and deploy from the `NovaVey/booking-reminder-system` GitHub repo.
2. Set these environment variables in Railway's dashboard:
   - `DATABASE_URL` — a Postgres connection string (e.g. from Supabase: Project Settings → Database → Connection string). The app enables SSL automatically for any non-localhost `DATABASE_URL`.
   - `API_KEY` — a random secret (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
   - `RESEND_API_KEY` / `REMINDER_FROM_EMAIL` — optional, for real email reminders (see [Email reminders](#email-reminders)).
   - Don't set `PORT` — Railway injects its own and the app already reads `process.env.PORT`.
3. If the target database doesn't already have the `clients`/`bookings`/`reminders` tables, run `backend/db/schema.sql` against it once (e.g. `psql "$DATABASE_URL" -f backend/db/schema.sql`, or via your provider's SQL editor) — the statements use `IF NOT EXISTS` so it's safe to run even if some tables already exist.
4. Once deployed, open the Railway-provided URL — the frontend will prompt for the API key on first load (see [Authentication](#authentication)) and store it locally after that.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | List all clients, ordered by name |
| POST | `/api/clients` | Create a client — requires `name`; `email` and `phone` optional |
| GET | `/api/bookings` | List bookings joined with client info, ordered by appointment time; optional `?status=` filter |
| GET | `/api/bookings/upcoming` | List up to 20 upcoming bookings (status `upcoming`, in the future) |
| POST | `/api/bookings` | Create a booking — requires `client_id`, `service`, `appointment_at`; optional `duration_minutes` (default 60) and `notes`. Automatically schedules a reminder 24 hours before the appointment |
| PATCH | `/api/bookings/:id/status` | Update a booking's status — one of `upcoming`, `completed`, `cancelled`, `no_show` |

Every `/api/*` request requires an `x-api-key` header matching `API_KEY` from `.env` (see [Authentication](#authentication) below). `GET /health` is unauthenticated.

## Authentication

All `/api/*` routes are gated behind a single shared secret: set `API_KEY` in `.env`, and every request must include it as an `x-api-key` header, e.g.:

```bash
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/clients
```

If `API_KEY` isn't set, the server refuses every API request with a 500 rather than silently running unauthenticated. The frontend (`frontend/public/index.html`) asks for the key once on first load and stores it in the browser's `localStorage`, attaching it to every API call automatically; if a request comes back `401`, it clears the stored key and asks again.

This is intentionally simple (one shared secret, no per-user accounts) — appropriate for a single-operator tool, not a multi-tenant product.

## Email reminders

Reminders are sent via [Resend](https://resend.com) when `RESEND_API_KEY` is set in `.env`. Without it, reminders just **log to the console** (`[REMINDER] Would send to {email}: ...`) — this keeps the project runnable with zero external dependencies until you're ready to send real email.

To enable real sending: set `RESEND_API_KEY` (and optionally `REMINDER_FROM_EMAIL`, which must be a sender Resend allows for your account) in `.env`. A client with no email on file is skipped rather than retried; a failed send (bad key, Resend outage, etc.) is logged and left unsent so it's retried on the next cron tick.

## How reminders work

1. When a booking is created, a row is inserted into `reminders` with `send_at` set to 24 hours before `appointment_at`.
2. A cron job (`node-cron`, schedule `*/5 * * * *`) runs every 5 minutes and checks for reminders where `sent = FALSE`, `send_at <= NOW()`, and the booking's status is still `upcoming`.
3. Each due reminder is sent (or logged, if `RESEND_API_KEY` isn't set) and then marked `sent = TRUE` with a `sent_at` timestamp so it's never sent twice.

## Known limitations

This is a portfolio-scope project, so a few things are intentionally out of scope:

- **Single shared API key, not per-user accounts.** `/api/*` is gated by one secret in `.env`, not individual logins — fine for a single-operator tool, but there's no concept of multiple users/roles.
- **Single-timezone assumption.** Appointment times are stored as naive timestamps (no timezone) and treated as the business's local wall-clock time throughout — there's no per-user timezone conversion, which is fine for a single-location business but wouldn't be accurate for clients spread across timezones.

## License

MIT
