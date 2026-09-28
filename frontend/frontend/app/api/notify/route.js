import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { reportReceivedEmail, statusChangedEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

// Called by the FastAPI backend (never the browser) whenever a report is
// submitted or its status changes. Authenticated with a shared secret so it
// can't be abused as an open mail relay.

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function authorized(request) {
  const expected = process.env.NOTIFY_SECRET;
  const given = request.headers.get('x-notify-secret') || '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ sent: false, detail: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const to = payload?.to;
  const report = payload?.report;
  if (!to || !report?.id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ sent: false, detail: 'Invalid payload' }, { status: 400 });
  }

  const transport = getTransporter();
  if (!transport) {
    return NextResponse.json({ sent: false, detail: 'SMTP credentials are not configured' }, { status: 503 });
  }

  const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
  let email;
  if (payload.event === 'report_received') {
    email = reportReceivedEmail(report, appUrl);
  } else if (payload.event === 'status_changed') {
    email = statusChangedEmail(report, { newStatus: payload.new_status, oldStatus: payload.old_status, note: payload.note }, appUrl);
  } else {
    return NextResponse.json({ sent: false, detail: `Unknown event "${payload.event}"` }, { status: 400 });
  }

  const fromAddress = process.env.SMTP_USER || process.env.GMAIL_USER;
  try {
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || `UI Road Monitor <${fromAddress}>`,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return NextResponse.json({ sent: true, messageId: info.messageId });
  } catch (error) {
    console.error('Nodemailer send failed:', error);
    return NextResponse.json({ sent: false, detail: error.message }, { status: 502 });
  }
}
