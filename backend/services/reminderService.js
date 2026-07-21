const cron = require('node-cron');
const pool = require('../db/pool');

async function processDueReminders() {
  try {
    const result = await pool.query(
      `SELECT
         reminders.id AS reminder_id,
         bookings.service,
         bookings.appointment_at,
         clients.name AS client_name,
         clients.email AS client_email
       FROM reminders
       JOIN bookings ON bookings.id = reminders.booking_id
       JOIN clients ON clients.id = bookings.client_id
       WHERE reminders.sent = FALSE
         AND reminders.send_at <= NOW()
         AND bookings.status = 'upcoming'`
    );

    for (const reminder of result.rows) {
      // TODO: wire up real email delivery (e.g. via Resend using RESEND_API_KEY)
      // instead of logging to the console.
      console.log(
        `[REMINDER] Would send to ${reminder.client_email}: Hi ${reminder.client_name}, ` +
        `reminder for ${reminder.service} on ${reminder.appointment_at}`
      );

      await pool.query(
        'UPDATE reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1',
        [reminder.reminder_id]
      );
    }

    if (result.rows.length > 0) {
      console.log(`[REMINDER] Processed ${result.rows.length} reminder(s).`);
    }
  } catch (err) {
    console.error('[REMINDER] Error processing reminders:', err);
  }
}

function startReminderJob() {
  cron.schedule('*/5 * * * *', () => {
    console.log('[REMINDER] Checking for due reminders...');
    processDueReminders();
  });
  console.log('[REMINDER] Reminder job scheduled (every 5 minutes).');
}

module.exports = { startReminderJob };
