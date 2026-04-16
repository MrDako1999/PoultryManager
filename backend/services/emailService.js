const FROM = process.env.EMAIL_FROM || 'no-reply@poultrymanager.io';

function isEnabled() {
  return !!process.env.SENDGRID_API_KEY || !!process.env.POSTMARK_API_KEY;
}

async function sendViaProvider({ to, subject, text, html }) {
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: FROM },
          subject,
          content: [
            { type: 'text/plain', value: text },
            ...(html ? [{ type: 'text/html', value: html }] : []),
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[emailService] SendGrid failed', res.status, body);
      }
    } catch (err) {
      console.error('[emailService] SendGrid error', err);
    }
    return;
  }

  if (process.env.POSTMARK_API_KEY) {
    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY,
        },
        body: JSON.stringify({
          From: FROM,
          To: to,
          Subject: subject,
          TextBody: text,
          HtmlBody: html,
          MessageStream: 'outbound',
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[emailService] Postmark failed', res.status, body);
      }
    } catch (err) {
      console.error('[emailService] Postmark error', err);
    }
  }
}

export async function sendCredentials(user, tempPassword, opts = {}) {
  const appName = opts.appName || 'PoultryManager.io';
  const ownerName = opts.ownerName || 'your account owner';
  const to = user?.email;
  if (!to) return;

  const subject = `${appName} — your account credentials`;
  const text = [
    `Hi ${user.firstName || ''},`,
    '',
    `${ownerName} has added you to ${appName}.`,
    '',
    `Email:    ${to}`,
    `Password: ${tempPassword}`,
    '',
    `Please sign in and change your password on first use.`,
    '',
    `Sign in: https://app.poultrymanager.io/login`,
  ].join('\n');

  const html = `
    <p>Hi ${user.firstName || ''},</p>
    <p><strong>${ownerName}</strong> has added you to <strong>${appName}</strong>.</p>
    <p><strong>Email:</strong> ${to}<br/>
       <strong>Password:</strong> <code>${tempPassword}</code></p>
    <p>Please sign in and change your password on first use.</p>
    <p><a href="https://app.poultrymanager.io/login">Sign in to ${appName}</a></p>
  `;

  if (!isEnabled()) {
    console.info('[emailService] email delivery disabled; logging instead:');
    console.info(`[emailService] to=${to}`);
    console.info(`[emailService] subject=${subject}`);
    console.info(`[emailService] body:\n${text}`);
    return;
  }

  await sendViaProvider({ to, subject, text, html });
}
