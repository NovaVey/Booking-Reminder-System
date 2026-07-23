const cron = require('node-cron');
const { Resend } = require('resend');
const pool = require('../db/pool');

// If RESEND_API_KEY isn't set, reminders just log to the console (the
// original stretch-goal placeholder behavior) instead of actually sending.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.REMINDER_FROM_EMAIL || 'reminders@resend.dev';

async function sendReminder(reminder) {
  const message = `Hi ${reminder.client_name}, reminder for ${reminder.service} on ${reminder.appointment_at}`;

  if (!resend) {
    console.log(`[REMINDER] Would send to ${reminder.client_email}: ${message}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: reminder.client_email,
    subject: `Appointment reminder: ${reminder.service}`,
    text: message,
  });

  if (error) {
    throw new Error(error.message || 'Resend API error');
  }

  console.log(`[REMINDER] Sent email to ${reminder.client_email} for reminder ${reminder.reminder_id}`);
}

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

    let sentCount = 0;

    for (const reminder of result.rows) {
      if (!reminder.client_email) {
        console.warn(`[REMINDER] Skipping reminder ${reminder.reminder_id}: client has no email on file`);
        await pool.query(
          'UPDATE reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1',
          [reminder.reminder_id]
        );
        continue;
      }

      try {
        await sendReminder(reminder);
        await pool.query(
          'UPDATE reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1',
          [reminder.reminder_id]
        );
        sentCount++;
      } catch (err) {
        // Leave sent=false so it's retried on the next cron tick.
        console.error(`[REMINDER] Failed to send reminder ${reminder.reminder_id}:`, err.message || err);
      }
    }

    if (sentCount > 0) {
      console.log(`[REMINDER] Processed ${sentCount} reminder(s).`);
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
