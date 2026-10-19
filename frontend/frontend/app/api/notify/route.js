import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  adminNewReportEmail,
  reportReceivedEmail,
  statusChangedEmail,
  welcomeEmail,
} from '@/lib/email-templates';

export const runtime = 'nodejs';

// Pasted dashboard values often carry quotes or a trailing newline.
const clean = (v) => String(v || '').trim().replace(/^["']|["']$/g, '');

function authorized(request) {
  const expected = clean(process.env.NOTIFY_SECRET);
  const given = clean(request.headers.get('x-notify-secret'));
  const expectedBytes = Buffer.from(expected || '');
  const givenBytes = Buffer.from(given);
  if (!expected || givenBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(givenBytes, expectedBytes);
}

// Health check: which email settings this deployment can see (never their values).
export async function GET() {
  return NextResponse.json({
    NOTIFY_SECRET: Boolean(clean(process.env.NOTIFY_SECRET)),
    RESEND_API_KEY: Boolean(clean(process.env.RESEND_API_KEY)),
    MAIL_FROM: Boolean(clean(process.env.MAIL_FROM)),
    APP_URL: Boolean(clean(process.env.APP_URL)),
  });
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ sent: false, detail: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const to = payload?.to;
  const report = payload?.report;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ sent: false, detail: 'Invalid payload' }, { status: 400 });
  }

  const appUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
  // UI logo hosted in the R2 bucket (sent by the backend); falls back to /public/email/ui-logo.png.
  const logoUrl = /^https:\/\//.test(payload.logo_url || '') ? payload.logo_url : process.env.EMAIL_LOGO_URL;
  let email;
  if (payload.event === 'report_received') {
    if (!report?.id) {
      return NextResponse.json({ sent: false, detail: 'Invalid report payload' }, { status: 400 });
    }
    email = reportReceivedEmail(report, appUrl, logoUrl);
  } else if (payload.event === 'status_changed') {
    if (!report?.id || !payload.new_status) {
      return NextResponse.json({ sent: false, detail: 'Invalid status update payload' }, { status: 400 });
    }
    email = statusChangedEmail(report, { newStatus: payload.new_status, oldStatus: payload.old_status, note: payload.note }, appUrl, logoUrl);
  } else if (payload.event === 'user_registered') {
    if (!payload.user?.full_name) {
      return NextResponse.json({ sent: false, detail: 'Invalid user payload' }, { status: 400 });
    }
    email = welcomeEmail(payload.user, appUrl, logoUrl);
  } else if (payload.event === 'new_report_admin') {
    if (!report?.id) {
      return NextResponse.json({ sent: false, detail: 'Invalid report payload' }, { status: 400 });
    }
    email = adminNewReportEmail(report, appUrl, logoUrl);
  } else {
    return NextResponse.json({ sent: false, detail: `Unknown event "${payload.event}"` }, { status: 400 });
  }

  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.MAIL_FROM);
  if (!apiKey || !from) {
    return NextResponse.json(
      { sent: false, detail: 'RESEND_API_KEY and MAIL_FROM must be configured' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Resend email send failed:', result);
      return NextResponse.json(
        { sent: false, detail: result.message || 'Resend rejected the email' },
        { status: 502 },
      );
    }
    return NextResponse.json({ sent: true, messageId: result.id });
  } catch (error) {
    console.error('Resend request failed:', error);
    return NextResponse.json({ sent: false, detail: 'Could not reach Resend' }, { status: 502 });
  }
}
