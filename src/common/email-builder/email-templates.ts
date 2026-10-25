import { buildMasterEmailLayout, MasterEmailLayoutOptions } from './email-layout';
import { getSynlioLogoUrl, SYNLIO_LOGO_URL, SYNLIO_LOGO_DATA_URI } from './email-tokens';

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

/**
 * Alert email template (used for Ticket, Task, and Project updates).
 * Matches Tab 1 of the frontend Email Preview exactly.
 */
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
      breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;">${parts[0].trim()} &nbsp;<span style="color:#94a3b8;font-weight:normal;">/</span>&nbsp; <span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">${parts.slice(1).join('/').trim()}</span></div>`;
    } else {
      breadcrumbHtml = `<div class="breadcrumb" style="font-size:12px;font-weight:500;color:#64748b;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;"><span class="breadcrumb-item" style="color:#0284c7;font-weight:600;">${breadcrumb}</span></div>`;
    }
  }

  let actorRowHtml = '';
  if (actorName || actionSentence) {
    const avatarHtml = actorProfilePicUrl
      ? `<img class="avatar" src="${actorProfilePicUrl}" alt="${actorName}" width="28" height="28" style="display:block;border-radius:50%;object-fit:cover;"/>`
      : `<span class="avatar user-avatar-initials" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;background-color:#0ea5e9;color:#ffffff;font-size:11px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;text-align:center;line-height:28px;">${actorInitials}</span>`;

    const rawSentence = actionSentence || `<strong>${actorName}</strong> updated this project`;
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
    descriptionHtml = `<p class="ticket-desc" style="font-size:13.5px;color:#334155;line-height:1.6;margin:0 0 14px 0;font-family:'Plus Jakarta Sans',sans-serif;">${description}</p>`;
  }

  let metaHtml = '';
  if (metaRows && metaRows.length > 0) {
    const rowsHtml = metaRows.map((row) => {
      return `<tr class="meta-row"><td class="meta-label" valign="middle" style="white-space:nowrap;font-size:13px;font-weight:500;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 12px 12px 24px;vertical-align:middle;text-align:left;border-bottom:1px solid #e2e8f0;">${row.label}</td><td class="meta-value" valign="middle" style="white-space:nowrap;font-size:13px;color:#0f172a;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 24px 12px 12px;vertical-align:middle;text-align:right;border-bottom:1px solid #e2e8f0;">${row.valueHtml}</td></tr>`;
    }).join('');

    metaHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="meta" style="background-color:#ffffff;border-collapse:collapse;width:100%;border-top:1px solid #e2e8f0;mso-table-lspace:0pt;mso-table-rspace:0pt;">${rowsHtml}</table>`;
  }

  const hasMeta = Boolean(metaRows && metaRows.length > 0);
  const ctaClass = hasMeta ? 'cta' : 'cta cta-standalone';
  const ctaInlineBorder = hasMeta ? 'border-top:none;' : 'border-top:1px solid #e2e8f0;';

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
                  <span class="cta-btn-text" style="color:#ffffff !important;text-decoration:none !important;font-weight:600;display:inline-block;border:none !important;">${ctaLabel}</span>&nbsp;<span class="cta-btn-arrow" style="color:#ffffff !important;text-decoration:none !important;font-size:14px;font-weight:bold;line-height:1;display:inline-block;vertical-align:middle;border:none !important;">&#8599;</span>
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
      <h1 class="ticket-title" style="margin:0 0 10px 0;font-size:19px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">${title}</h1>
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

// ─────────────────────────────────────────────────────────────────────────── //
//  Standardized Auth Templates: Verification Code & Password Reset
// ─────────────────────────────────────────────────────────────────────────── //

export interface VerificationEmailOptions {
  verificationCode: string;
  expiryMinutes?: number;
}

/**
 * Verification Code Email Template.
 * Matches Tab 2 of frontend Email Preview exactly.
 */
export function buildVerificationEmailHtml(options: VerificationEmailOptions): string {
  const { verificationCode, expiryMinutes = 15 } = options;

  const bodyHtml = `
    <div class="hero" style="background-color:#ffffff;padding:28px 32px 36px;">
      <h1 class="ticket-title" style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">Verify your email address</h1>
      <p style="font-size:14px;color:#334155;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 12px 0;" class="ticket-desc">
        Thanks for signing up for Synlio! Enter the verification code below to confirm your account and get started.
      </p>
      <p style="font-size:13px;color:#64748b;font-style:italic;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 16px 0;">
        If you did not request this email, you can safely ignore it.
      </p>

      <p style="font-size:14px;color:#334155;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 24px 0;" class="ticket-desc">
        This code will expire in <strong style="color:#0f172a;font-weight:600;" class="actor-text">${expiryMinutes} minutes</strong>
      </p>

      <!-- OTP Digits Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;text-align:center;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td class="code-box" style="background-color:#f8fafc;border-radius:8px;padding:16px 36px;text-align:center;">
            <span class="code-text" style="font-family:'DM Mono',SFMono-Regular,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;display:inline-block;">${verificationCode}</span>
          </td>
        </tr>
      </table>
    </div>
  `;

  return buildMasterEmailLayout({
    title: 'Verify your email address',
    bodyHtml,
  });
}

export interface PasswordResetEmailOptions {
  firstName?: string;
  resetLink: string;
  expiryHours?: number;
}

/**
 * Password Reset Email Template.
 * Matches Tab 3 of frontend Email Preview exactly.
 */
export function buildPasswordResetEmailHtml(options: PasswordResetEmailOptions): string {
  const { resetLink, expiryHours = 1 } = options;

  const bodyHtml = `
    <div class="hero" style="background-color:#ffffff;padding:28px 32px 36px;">
      <h1 class="ticket-title" style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#0f172a;line-height:1.35;letter-spacing:-0.01em;font-family:'Plus Jakarta Sans',sans-serif;">Reset your password</h1>
      <p style="font-size:14px;color:#334155;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 12px 0;" class="ticket-desc">
        We received a request to reset the password for your Synlio account. Click the button below to choose a new password.
      </p>
      <p style="font-size:13px;color:#64748b;font-style:italic;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 16px 0;">
        If you did not request this email, you can safely ignore it.
      </p>

      <p style="font-size:14px;color:#334155;line-height:1.6;font-family:'Plus Jakarta Sans',sans-serif;margin:0 0 24px 0;" class="ticket-desc">
        This link will expire in <strong style="color:#0f172a;font-weight:600;" class="actor-text">${expiryHours} hour${expiryHours > 1 ? 's' : ''}</strong>
      </p>

      <!-- Bulletproof CTA Button (Table + inline styles for Outlook, Gmail, Apple Mail) -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 24px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
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
      <div class="fallback-box" style="border-radius:8px;padding:14px 16px;margin-top:24px;text-align:left;background-color:transparent;">
        <span style="display:block;font-size:13px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;margin-bottom:6px;" class="fallback-label">
          If the button doesn't work, click the link below:
        </span>
        <span style="display:block;font-size:13px;color:#0284c7;word-break:break-all;font-family:'Plus Jakarta Sans',sans-serif;line-height:1.5;" class="fallback-url">
          <a href="${resetLink}" target="_blank" style="color:#0284c7;text-decoration:none;" class="fallback-link">${resetLink}</a>
        </span>
      </div>
    </div>
  `;

  return buildMasterEmailLayout({
    title: 'Reset your password',
    bodyHtml,
  });
}
