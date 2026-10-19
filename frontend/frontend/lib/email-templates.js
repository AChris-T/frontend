// Email HTML for Resend notifications. Table-based layout + inline styles
// so it renders consistently in Gmail, Outlook and mobile mail apps.

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const STATUS = {
  reported: { label: 'Reported', color: '#fab219' },
  in_progress: { label: 'In Progress', color: '#2a78d6' },
  fixed: { label: 'Fixed', color: '#0ca30c' },
  rejected: { label: 'Closed', color: '#898781' },
};
const SEVERITY_COLORS = { low: '#0ca30c', medium: '#fab219', high: '#ec835a', critical: '#d03b3b' };
const STATUS_MESSAGES = {
  reported: 'Your report is back in the queue and will be reviewed by the Works & Maintenance team.',
  in_progress: 'Good news — our Works & Maintenance team has started work on this fault.',
  fixed: 'This fault has been repaired. Thank you for helping keep campus roads safe!',
  rejected: 'After review, this report has been closed. See the note below for details.',
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function locationOf(r) {
  if (r.location_name) return r.location_name;
  if (r.road_name && r.road_name !== 'Unnamed Road') return r.road_name;
  return `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`;
}

function shell(preheader, body, appUrl, logoUrl) {
  const logo = logoUrl || `${appUrl}/email/ui-logo.png`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:${FONT};">
<span style="display:none;font-size:1px;color:#eef2f7;max-height:0;overflow:hidden;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(11,18,32,0.10);">
<tr><td style="background:#0b1220;background-image:linear-gradient(135deg,#0b1220 0%,#1c5cab 100%);padding:28px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:52px;height:56px;background:#ffffff;border-radius:12px;text-align:center;vertical-align:middle;">
      <img src="${esc(logo)}" alt="University of Ibadan" width="40" height="45" style="display:block;width:40px;height:45px;margin:5px 6px;border:0;" />
    </td>
    <td style="padding-left:12px;">
      <div style="color:#ffffff;font-size:17px;font-weight:700;">UI Road Monitor</div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">Road infrastructure monitoring &middot; University of Ibadan</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#f7f8fa;border-top:1px solid #e6e8ec;">
  <p style="margin:0;color:#8a8f98;font-size:12px;line-height:1.6;">This is an automated message from
  <a href="${esc(appUrl)}" style="color:#2a78d6;text-decoration:none;">UI Road Monitor</a>. Please don't reply directly to this email.<br/>
  &copy; ${new Date().getFullYear()} UI Road Monitor &mdash; Faculty of Technology, University of Ibadan.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function row(label, value) {
  return `<tr>
<td style="padding:10px 0;color:#8a8f98;font-size:13px;border-bottom:1px solid #eef0f3;">${esc(label)}</td>
<td style="padding:10px 0;color:#0b0b0b;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #eef0f3;">${value}</td>
</tr>`;
}

function pill(label, color) {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color};color:#ffffff;font-size:12px;font-weight:700;">${esc(label)}</span>`;
}

function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>
<td style="border-radius:12px;background:#2a78d6;box-shadow:0 6px 16px rgba(42,120,214,0.35);">
<a href="${esc(url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;">${esc(label)} &rarr;</a>
</td></tr></table>`;
}

function photo(r) {
  if (!r.photo_url || !r.photo_url.startsWith('http')) return '';
  return `<img src="${esc(r.photo_url)}" alt="Reported road fault" width="516" style="display:block;width:100%;max-width:516px;height:auto;max-height:300px;object-fit:cover;border-radius:14px;margin:0 0 24px;border:0;" />`;
}

/** Reported → In Progress → Fixed progress tracker. */
function tracker(status) {
  if (status === 'rejected') return '';
  const steps = ['reported', 'in_progress', 'fixed'];
  const at = steps.indexOf(status);
  const cells = steps.map((s, i) => {
    const done = i <= at;
    const color = done ? STATUS[s].color : '#d5d9e0';
    return `<td align="center" style="width:33%;padding:0 4px;">
      <div style="height:6px;border-radius:6px;background:${color};"></div>
      <div style="margin-top:8px;font-size:11px;font-weight:${i === at ? 700 : 500};color:${done ? '#0b0b0b' : '#8a8f98'};">${STATUS[s].label}</div>
    </td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>${cells}</tr></table>`;
}

function details(r) {
  const sev = (r.severity || '').toLowerCase();
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('Report ID', `#${esc(r.id)}`)}
${row('Fault type', esc(title(r.fault_type === 'analyzing' ? 'Pending AI analysis' : r.fault_type)))}
${row('Severity', sev ? pill(title(sev), SEVERITY_COLORS[sev] || '#898781') : '—')}
${r.confidence ? row('AI confidence', `${Math.round(r.confidence * 100)}%`) : ''}
${row('Location', esc(locationOf(r)))}
${r.address ? row('Address', `<span style="font-weight:500;color:#52514e;">${esc(r.address)}</span>`) : ''}
</table>`;
}

export function reportReceivedEmail(report, appUrl, logoUrl) {
  const body = `
<p style="margin:0 0 6px;color:#2a78d6;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Report received</p>
<h1 style="margin:0 0 10px;color:#0b0b0b;font-size:24px;font-weight:800;line-height:1.25;">Thanks — we've logged your report #${esc(report.id)}</h1>
<p style="margin:0 0 24px;color:#52514e;font-size:15px;line-height:1.6;">Our AI has analysed your submission and the Works &amp; Maintenance team has been notified. We'll email you every time the status changes.</p>
${photo(report)}
${tracker('reported')}
${details(report)}
${button('Track your report', `${appUrl}/dashboard`)}`;
  return {
    subject: `Report #${report.id} received — ${title(report.fault_type === 'analyzing' ? 'road fault' : report.fault_type)} at ${locationOf(report)}`,
    html: shell(`We've logged your road fault report #${report.id}.`, body, appUrl, logoUrl),
    text: `Thanks — we've logged your report #${report.id} (${title(report.fault_type)}, ${report.severity}) at ${locationOf(report)}. We'll email you when the status changes. Track it at ${appUrl}/dashboard`,
  };
}

export function welcomeEmail(user, appUrl, logoUrl) {
  const name = esc(user.full_name);
  const body = `
<p style="margin:0 0 6px;color:#2a78d6;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Welcome</p>
<h1 style="margin:0 0 12px;color:#0b0b0b;font-size:24px;font-weight:800;line-height:1.25;">Welcome to UI Road Monitor, ${name}</h1>
<p style="margin:0 0 24px;color:#52514e;font-size:15px;line-height:1.6;">Thanks for joining our campus road community. You can report road faults, follow progress, and help the University of Ibadan keep its roads safer.</p>
${button('Open your dashboard', `${appUrl}/dashboard`)}`;
  return {
    subject: 'Welcome to UI Road Monitor',
    html: shell('Welcome to UI Road Monitor. Thank you for joining us.', body, appUrl, logoUrl),
    text: `Welcome to UI Road Monitor, ${user.full_name}. You can report road faults and track their progress at ${appUrl}/dashboard`,
  };
}

export function adminNewReportEmail(report, appUrl, logoUrl) {
  const body = `
<p style="margin:0 0 6px;color:#2a78d6;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">New report</p>
<h1 style="margin:0 0 12px;color:#0b0b0b;font-size:24px;font-weight:800;line-height:1.25;">A road fault needs review</h1>
<p style="margin:0 0 24px;color:#52514e;font-size:15px;line-height:1.6;">A new report has been submitted to UI Road Monitor. Review the details and update its status in the admin dashboard.</p>
${photo(report)}
${tracker('reported')}
${details(report)}
${button('Review report', `${appUrl}/admin`)}`;
  return {
    subject: `New road fault report #${report.id} — ${locationOf(report)}`,
    html: shell(`New road fault report #${report.id} is waiting for review.`, body, appUrl, logoUrl),
    text: `New report #${report.id}: ${title(report.fault_type)} (${report.severity}) at ${locationOf(report)}. Review it at ${appUrl}/admin`,
  };
}

export function statusChangedEmail(report, { newStatus, oldStatus, note }, appUrl, logoUrl) {
  const st = STATUS[newStatus] || { label: title(newStatus), color: '#898781' };
  const noteHtml = note ? `
<div style="margin:0 0 24px;padding:16px 18px;background:#f7f8fa;border-radius:14px;border-left:4px solid ${st.color};">
  <p style="margin:0 0 4px;color:#8a8f98;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Note from the team</p>
  <p style="margin:0;color:#0b0b0b;font-size:14px;line-height:1.55;">${esc(note)}</p>
</div>` : '';
  const body = `
<p style="margin:0 0 6px;color:${st.color};font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Status update</p>
<h1 style="margin:0 0 12px;color:#0b0b0b;font-size:24px;font-weight:800;line-height:1.25;">Report #${esc(report.id)} is now ${esc(st.label)}</h1>
<p style="margin:0 0 20px;color:#52514e;font-size:15px;line-height:1.6;">${esc(STATUS_MESSAGES[newStatus] || 'The status of your report has been updated.')}</p>
<p style="margin:0 0 24px;font-size:13px;color:#8a8f98;">${pill((STATUS[oldStatus] || {}).label || title(oldStatus), '#b9bec7')} &nbsp;&rarr;&nbsp; ${pill(st.label, st.color)}</p>
${tracker(newStatus)}
${noteHtml}
${photo(report)}
${details(report)}
${button('View your report', `${appUrl}/dashboard`)}`;
  return {
    subject: `Report #${report.id} is now ${st.label} — UI Road Monitor`,
    html: shell(`Report #${report.id} is now ${st.label}.`, body, appUrl, logoUrl),
    text: `Report #${report.id} (${title(report.fault_type)} at ${locationOf(report)}) is now ${st.label}.${note ? ` Note: ${note}` : ''} View it at ${appUrl}/dashboard`,
  };
}
