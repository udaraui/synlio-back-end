import { buildMasterEmailLayout, MasterEmailLayoutOptions } from './email-layout';
import { getSynlioLogoUrl, SYNLIO_LOGO_URL, SYNLIO_LOGO_DATA_URI } from './email-tokens';
import { escapeHtml, buildDateChip } from './email-components';

export type { MasterEmailLayoutOptions };
export { buildMasterEmailLayout, getSynlioLogoUrl, SYNLIO_LOGO_URL, SYNLIO_LOGO_DATA_URI };

export interface EmailTemplateOptions {
  eventBadge?: string;
  breadcrumb?: string;
  title: string;
  actorInitials?: string;
  actorName?: string;
  actionSentence?: string;
  description?: string;
  customDetailBlockHtml?: string;
  metaRows?: { label: string; valueHtml: string }[];
  ctaUrl?: string;
  ctaLabel?: string;
  ctaSubTextHtml?: string;
  actorProfilePicUrl?: string | null;
}

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const {
    eventBadge,
    breadcrumb,
    title,
    actorInitials = 'JD',
    actorName = 'John Doe',
    actionSentence,
    description,
    customDetailBlockHtml,
    metaRows,
    ctaUrl,
    ctaLabel = 'View in Synlio',
    ctaSubTextHtml,
    actorProfilePicUrl,
  } = options;

  let breadcrumbHtml = '';
  if (breadcrumb) {
    const parts = breadcrumb.split('/');
    if (parts.length > 1) {
      breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;">${escapeHtml(parts[0].trim())} &nbsp;<span style="color:#94a3b8;font-weight:normal;">/</span>&nbsp; <span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">${escapeHtml(parts.slice(1).join('/').trim())}</span></div>`;
    } else {
      breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;"><span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">${escapeHtml(breadcrumb)}</span></div>`;
    }
  }

  let actorRowHtml = '';
  if (actorName || actionSentence) {
    const safeActorName = escapeHtml(actorName);
    const safeInitials = escapeHtml(actorInitials);
    const avatarHtml = actorProfilePicUrl
      ? `<img class="avatar" src="${escapeHtml(actorProfilePicUrl)}" alt="${safeActorName}" width="28" height="28" style="display:block;border-radius:50%;object-fit:cover;"/>`
      : `<span class="avatar user-avatar-initials" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;background-color:#0ea5e9;color:#ffffff;font-size:11px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;text-align:center;line-height:28px;">${safeInitials}</span>`;

    const rawSentence = actionSentence || `<strong>${safeActorName}</strong> updated this project`;
    const sentence = rawSentence.replace(
      /<strong(\b[^>]*)>/gi,
      '<strong$1 class="actor-name" style="color:#0f172a;font-weight:600;">'
    );

    actorRowHtml = `
      <div class="actor-row" style="margin-top:10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td valign="middle" style="padding-right:10px;vertical-align:middle;">${avatarHtml}</td>
            <td valign="middle" style="vertical-align:middle;"><div class="actor-text" style="font-size:13px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;line-height:1.5;">${sentence}</div></td>
          </tr>
        </table>
      </div>
    `;
  }

  let descriptionHtml = '';
  if (description) {
    descriptionHtml = `<p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0 0 14px 0;font-family:'Plus Jakarta Sans',sans-serif;">${escapeHtml(description)}</p>`;
  }

  let metaHtml = '';
  if (metaRows && metaRows.length > 0) {
    const rowsHtml = metaRows.map((row, index) => {
      const isLast = index === metaRows.length - 1;
      const borderBottom = isLast ? 'border-bottom:none;' : 'border-bottom:1px solid rgba(0,0,0,0.08);';
      const lastClass = isLast ? ' meta-row-last' : '';
      return `<tr class="meta-row${lastClass}"><td class="meta-label" valign="middle" style="white-space:nowrap;font-size:13px;font-weight:500;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 12px 12px 24px;vertical-align:middle;text-align:left;${borderBottom}">${escapeHtml(row.label)}</td><td class="meta-value" valign="middle" style="white-space:nowrap;font-size:13px;color:#0f172a;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 24px 12px 12px;vertical-align:middle;text-align:right;${borderBottom}">${row.valueHtml}</td></tr>`;
    }).join('');

    metaHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="meta" style="background-color:#ffffff;border-collapse:collapse;width:100%;border-top:1px solid rgba(0,0,0,0.08);mso-table-lspace:0pt;mso-table-rspace:0pt;">${rowsHtml}</table>`;
  }

  const hasMeta = Boolean(metaRows && metaRows.length > 0);
  const ctaClass = hasMeta ? 'cta' : 'cta cta-standalone';
  const ctaInlineBorder = 'border-top:1px solid rgba(0,0,0,0.08);';

  let ctaHtml = '';
  if (ctaUrl) {
    ctaHtml = `
      <div class="${ctaClass}" style="background-color:#ffffff;padding:24px 28px 28px;text-align:center;${ctaInlineBorder}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td align="center" bgcolor="#0ea5e9" class="cta-btn-cell" style="background-color:#0ea5e9;background-image:linear-gradient(#0ea5e9,#0ea5e9);border-radius:6px;mso-padding-alt:10px 24px;border:none;">
              <a href="${ctaUrl}" target="_blank" class="cta-btn" style="display:inline-block;background-color:#0ea5e9;background-image:linear-gradient(#0ea5e9,#0ea5e9);color:#ffffff !important;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:6px;text-decoration:none !important;border:none !important;outline:none !important;line-height:1.4;-webkit-text-size-adjust:none;box-shadow:0 1px 3px rgba(14,165,233,0.3);">
                <!--[if mso]><i style="letter-spacing: 24px; mso-font-width: -100%;" hidden>&nbsp;</i><![endif]-->
                <font color="#ffffff" class="cta-btn-font" style="color:#ffffff !important;text-decoration:none !important;border:none !important;">
                  <span class="cta-btn-text" style="color:#ffffff !important;text-decoration:none !important;font-weight:600;display:inline-block;border:none !important;">${escapeHtml(ctaLabel)}</span>
                </font>
                <!--[if mso]><i style="letter-spacing: 24px; mso-font-width: -100%" hidden>&nbsp;</i><![endif]-->
              </a>
            </td>
          </tr>
        </table>
        ${ctaSubTextHtml ? `<p class="cta-sub" style="margin-top:12px;font-size:12px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;">${ctaSubTextHtml}</p>` : ''}
      </div>
    `;
  } else {
    ctaHtml = `<div style="padding-bottom: 20px;"></div>`;
  }

  const bodyHtml = `
    <div class="hero" style="background-color:#ffffff;padding:24px 28px 20px;">
      ${breadcrumbHtml}
      <h1 class="ticket-title" style="margin:0 0 10px 0;font-size:19px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">${escapeHtml(title)}</h1>
      ${descriptionHtml}
      ${actorRowHtml}
      ${customDetailBlockHtml || ''}
    </div>
    ${metaHtml}
    ${ctaHtml}
  `;

  return buildMasterEmailLayout({
    title,
    eventBadge,
    bodyHtml,
  });
}

export interface VerificationEmailOptions {
  verificationCode: string;
  expiryMinutes?: number;
}

export function buildVerificationEmailHtml(options: VerificationEmailOptions): string {
  const { verificationCode, expiryMinutes = 15 } = options;

  const breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;"><span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">Security / Email Verification</span></div>`;

  const bodyHtml = `
    <div class="hero" style="background-color:#ffffff;padding:24px 28px 20px;">
      ${breadcrumbHtml}
      <h1 class="ticket-title" style="margin:0 0 10px 0;font-size:19px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">Verify your email address</h1>
      <p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0 0 14px 0;font-family:'Plus Jakarta Sans',sans-serif;">
        Thanks for signing up for Synlio! Enter the verification code below to confirm your account and get started.
      </p>
      <p class="disclaimer-text" style="font-size:13px;color:#64748b;font-style:italic;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 14px 0;">
        If you did not request this email, you can safely ignore it.
      </p>
      <p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0;font-family:'Plus Jakarta Sans',sans-serif;">
        This code will expire in <strong style="color:#0f172a;font-weight:600;" class="actor-text actor-name">${expiryMinutes} minutes</strong>.
      </p>
    </div>
    <div class="cta" style="background-color:#ffffff;padding:24px 28px 28px;text-align:center;border-top:1px solid rgba(0,0,0,0.08);">
      <!-- OTP Digits Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;text-align:center;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td class="code-box" style="background-color:#f8fafc;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:16px 36px;text-align:center;">
            <span class="code-text" style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;display:inline-block;">${verificationCode}</span>
          </td>
        </tr>
      </table>
      <p class="cta-sub" style="margin-top:14px;font-size:12px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;">
        Enter this code on the verification screen to complete your registration.
      </p>
    </div>
  `;

  return buildMasterEmailLayout({
    title: 'Verify your email address',
    eventBadge: 'Verification',
    bodyHtml,
  });
}

export interface PasswordResetEmailOptions {
  firstName?: string;
  resetLink: string;
  expiryHours?: number;
}

export function buildPasswordResetEmailHtml(options: PasswordResetEmailOptions): string {
  const { resetLink, expiryHours = 1 } = options;

  const breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;"><span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">Security / Password Reset</span></div>`;

  const bodyHtml = `
    <div class="hero" style="background-color:#ffffff;padding:24px 28px 20px;">
      ${breadcrumbHtml}
      <h1 class="ticket-title" style="margin:0 0 10px 0;font-size:19px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">Reset your password</h1>
      <p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0 0 14px 0;font-family:'Plus Jakarta Sans',sans-serif;">
        We received a request to reset the password for your Synlio account. Click the button below to choose a new password.
      </p>
      <p class="disclaimer-text" style="font-size:13px;color:#64748b;font-style:italic;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 14px 0;">
        If you did not request this email, you can safely ignore it.
      </p>
      <p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0;font-family:'Plus Jakarta Sans',sans-serif;">
        This link will expire in <strong style="color:#0f172a;font-weight:600;" class="actor-text actor-name">${expiryHours} hour${expiryHours > 1 ? 's' : ''}</strong>.
      </p>
    </div>
    <div class="cta" style="background-color:#ffffff;padding:24px 28px 28px;text-align:center;border-top:1px solid rgba(0,0,0,0.08);">
      <!-- Bulletproof CTA Button (Table + inline styles for Outlook, Gmail, Apple Mail) -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td align="center" bgcolor="#0ea5e9" class="cta-btn-cell" style="background-color:#0ea5e9;background-image:linear-gradient(#0ea5e9,#0ea5e9);border-radius:6px;mso-padding-alt:10px 24px;border:none;">
            <a href="${resetLink}" target="_blank" class="cta-btn" style="display:inline-block;background-color:#0ea5e9;background-image:linear-gradient(#0ea5e9,#0ea5e9);color:#ffffff !important;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:6px;text-decoration:none !important;border:none !important;outline:none !important;line-height:1.4;-webkit-text-size-adjust:none;box-shadow:0 1px 3px rgba(14,165,233,0.3);">
              <!--[if mso]><i style="letter-spacing: 24px; mso-font-width: -100%;" hidden>&nbsp;</i><![endif]-->
              <font color="#ffffff" class="cta-btn-font" style="color:#ffffff !important;text-decoration:none !important;border:none !important;">
                <span class="cta-btn-text" style="color:#ffffff !important;text-decoration:none !important;font-weight:600;display:inline-block;border:none !important;">Reset Password</span>&nbsp;<span class="cta-btn-arrow" style="color:#ffffff !important;text-decoration:none !important;font-size:14px;font-weight:bold;line-height:1;display:inline-block;vertical-align:middle;border:none !important;">&#8599;</span>
              </font>
              <!--[if mso]><i style="letter-spacing: 24px; mso-font-width: -100%" hidden>&nbsp;</i><![endif]-->
            </a>
          </td>
        </tr>
      </table>

      <!-- Fallback URL Card -->
      <div class="fallback-box" style="border:1px solid rgba(0,0,0,0.08);background-color:#f8fafc;border-radius:8px;padding:12px 16px;margin-top:20px;text-align:left;">
        <span class="fallback-label" style="display:block;font-size:12px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;margin-bottom:4px;">
          If the button doesn't work, copy and paste this link into your browser:
        </span>
        <span class="fallback-url" style="display:block;font-size:12px;color:#0284c7;word-break:break-all;font-family:'DM Mono',SFMono-Regular,Consolas,monospace;line-height:1.5;">
          <a href="${resetLink}" target="_blank" style="color:#0284c7;text-decoration:none;" class="fallback-link">${resetLink}</a>
        </span>
      </div>
    </div>
  `;

  return buildMasterEmailLayout({
    title: 'Reset your password',
    eventBadge: 'Password Reset',
    bodyHtml,
  });
}

export interface PulseVerificationEmailOptions {
  actorName: string;
  actorInitials?: string;
  actorProfilePicUrl?: string | null;
  message?: string;
  reviewUrl: string;
  weekRange?: string;
  totalLoggedHours?: string | number;
}

/**
 * Pulse Verification / Snapshot Review Email Template.
 * Used when an employee forwards or submits their weekly pulse snapshot for verification/review.
 */
export function buildPulseVerificationEmailHtml(options: PulseVerificationEmailOptions): string {
  const {
    actorName,
    actorInitials,
    actorProfilePicUrl,
    message = 'Hi, please review and approve this weekly pulse snapshot.',
    reviewUrl,
    weekRange,
    totalLoggedHours,
  } = options;

  const safeMessage = message
    ? `<div class="callout-box" style="padding:16px;border-radius:0 8px 8px 0;color:#334155;font-size:14px;line-height:1.6;font-style:italic;margin-top:14px;">${escapeHtml(message)}</div>`
    : '';

  const metaRows: Array<{ label: string; valueHtml: string }> = [];
  if (weekRange) {
    metaRows.push({
      label: 'Timeline',
      valueHtml: buildDateChip(weekRange),
    });
  }
  if (totalLoggedHours) {
    metaRows.push({
      label: 'Logged Hours',
      valueHtml: `<span style="font-size:13px;font-weight:600;color:#0f172a;" class="actor-text actor-name">${escapeHtml(String(totalLoggedHours))}</span>`,
    });
  }

  return buildEmailHtml({
    eventBadge: 'Pulse Snapshot',
    breadcrumb: 'Weekly Pulse',
    title: 'Pulse Snapshot Forwarded',
    actorName,
    actorInitials,
    actorProfilePicUrl,
    actionSentence: `<strong>${escapeHtml(actorName)}</strong> requested your review`,
    customDetailBlockHtml: safeMessage,
    metaRows: metaRows.length > 0 ? metaRows : undefined,
    ctaUrl: reviewUrl,
    ctaLabel: 'Review Snapshot',
  });
}
