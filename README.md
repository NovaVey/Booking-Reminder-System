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

Edit `.env` and set `DATABASE_URL` to point at your PostgreSQL database. `RESEND_API_KEY` is optional — see [Email reminders](#email-reminders) below.

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

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | List all clients, ordered by name |
| POST | `/api/clients` | Create a client — requires `name`; `email` and `phone` optional |
| GET | `/api/bookings` | List bookings joined with client info, ordered by appointment time; optional `?status=` filter |
| GET | `/api/bookings/upcoming` | List up to 20 upcoming bookings (status `upcoming`, in the future) |
| POST | `/api/bookings` | Create a booking — requires `client_id`, `service`, `appointment_at`; optional `duration_minutes` (default 60) and `notes`. Automatically schedules a reminder 24 hours before the appointment |
| PATCH | `/api/bookings/:id/status` | Update a booking's status — one of `upcoming`, `completed`, `cancelled`, `no_show` |

## Email reminders

By default, reminders are **logged to the console** (`[REMINDER] Would send to {email}: ...`) rather than actually emailed — this keeps the project runnable with zero external dependencies. Wiring up real delivery via [Resend](https://resend.com) is a stretch goal: set `RESEND_API_KEY` in `.env` and swap the `console.log` in `backend/services/reminderService.js` for a call to the Resend API (see the `TODO` comment in that file).

## How reminders work

1. When a booking is created, a row is inserted into `reminders` with `send_at` set to 24 hours before `appointment_at`.
2. A cron job (`node-cron`, schedule `*/5 * * * *`) runs every 5 minutes and checks for reminders where `sent = FALSE`, `send_at <= NOW()`, and the booking's status is still `upcoming`.
3. Each due reminder is "sent" (logged) and then marked `sent = TRUE` with a `sent_at` timestamp so it's never sent twice.

## License

MIT
