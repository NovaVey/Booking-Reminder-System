const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

const VALID_STATUSES = ['upcoming', 'completed', 'cancelled', 'no_show'];

const BOOKING_SELECT = `
  SELECT
    bookings.*,
    clients.name AS client_name,
    clients.email AS client_email,
    clients.phone AS client_phone
  FROM bookings
  JOIN clients ON clients.id = bookings.client_id
`;

// GET /api/bookings — all bookings joined with client info, optional ?status= filter
router.get('/', async (req, res) => {
  const { status } = req.query;

  try {
    let query = BOOKING_SELECT;
    const params = [];

    if (status) {
      params.push(status);
      query += ` WHERE bookings.status = $${params.length}`;
    }

    query += ' ORDER BY bookings.appointment_at ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/upcoming — upcoming bookings in the future, limit 20
router.get('/upcoming', async (req, res) => {
  try {
    const result = await pool.query(
      `${BOOKING_SELECT}
       WHERE bookings.status = 'upcoming' AND bookings.appointment_at >= NOW()
       ORDER BY bookings.appointment_at ASC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching upcoming bookings:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming bookings' });
  }
});

// POST /api/bookings — create a booking and schedule a reminder 24h before
router.post('/', async (req, res) => {
  const { client_id, service, appointment_at, duration_minutes, notes } = req.body;

  if (!client_id || !service || !appointment_at) {
    return res.status(400).json({ error: 'client_id, service, and appointment_at are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `INSERT INTO bookings (client_id, service, appointment_at, duration_minutes, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client_id, service, appointment_at, duration_minutes || 60, notes || null]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `INSERT INTO reminders (booking_id, send_at, method)
       VALUES ($1, $2::timestamp - INTERVAL '24 hours', 'email')`,
      [booking.id, appointment_at]
    );

    await client.query('COMMIT');
    res.status(201).json(booking);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// PATCH /api/bookings/:id/status — update a booking's status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

module.exports = router;
