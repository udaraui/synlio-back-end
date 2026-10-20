import { buildMasterEmailStyles } from './email-styles';
import { getSynlioLogoUrl } from './email-tokens';

export interface MasterEmailLayoutOptions {
  title: string;
  eventBadge?: string;
  bodyHtml: string;
  footerTextHtml?: string;
}

/**
 * Master layout shell that wraps all Synlio emails.
 * Matches synlio-front-end Email Preview UI exactly:
 * - Deep navy header (#0b1329 light, #050b17 dark) with Synlio logo & brand text
 * - Dark mode card body is pure black (#000000)
 * - Primary CTA buttons & avatar initials are black (#000000) in dark mode
 * - Date badges show red border and red calendar icon ONLY IF OVERDUE
 * - Responsive single-row layout for desktop (600px) and stacked layout for mobile (<=480px)
 */
export function buildMasterEmailLayout(options: MasterEmailLayoutOptions): string {
  const { title, bodyHtml, footerTextHtml } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>${title} — Synlio</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>
  <style>
    ${buildMasterEmailStyles()}
  </style>
</head>
<body bgcolor="#f1f5f9" style="margin:0;padding:32px 16px;background-color:#f1f5f9;color:#0f172a;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer centering table for email client canvas -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="outer-table" bgcolor="#f1f5f9" style="width:100%;table-layout:fixed;border-collapse:collapse;background-color:#f1f5f9;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td align="center" valign="top" style="padding:0;">
        <!-- Card Container (max-width 600px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff" class="wrapper email-card" style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <!-- Header -->
          <tr>
            <td bgcolor="#0b1329" class="header" style="background-color:#0b1329;background-image:linear-gradient(#0b1329,#0b1329);padding:18px 28px;border-bottom:1px solid #0b1329;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <img class="brand-icon" src="${getSynlioLogoUrl()}" alt="Synlio" width="28" height="28" style="display:block;width:28px;height:28px;object-fit:contain;border:0;outline:none;"/>
                  </td>
                  <td valign="middle">
                    <span class="brand-name" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:600;color:#f8fafc;letter-spacing:0.05em;line-height:28px;">Synlio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:0;">
              ${bodyHtml}
            </td>
          </tr>
        </table>

        <!-- Email Client Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:600px;margin:24px auto 0;text-align:center;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td align="center" class="footer" style="padding:0 16px 8px;text-align:center;">
              ${footerTextHtml || `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8;font-family:'Plus Jakarta Sans',sans-serif;">&copy; ${new Date().getFullYear()} Synlio. All rights reserved.</p>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
