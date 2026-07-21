require('dotenv').config();

// Pin the process to UTC so naive timestamps (no timezone offset) round-trip
// deterministically between the DB and the frontend regardless of host locale.
process.env.TZ = process.env.TZ || 'UTC';

const path = require('path');
const express = require('express');
const cors = require('cors');

const clientsRouter = require('./routes/clients');
const bookingsRouter = require('./routes/bookings');
const { startReminderJob } = require('./services/reminderService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.use('/api/clients', clientsRouter);
app.use('/api/bookings', bookingsRouter);

app.listen(PORT, () => {
  console.log(`Booking & Reminder System server running on port ${PORT}`);
  startReminderJob();
});
