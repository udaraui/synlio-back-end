import { EmailTokens } from './email-tokens';

/**
 * Builds the unified, bulletproof cross-platform stylesheet for all email clients:
 * - Apple Mail & WebKit clients via @media (prefers-color-scheme: dark)
 * - Microsoft Outlook Web (OWA / Office 365) via [data-ogsc] and [data-ogsb] attribute selectors
 * - Microsoft Outlook Desktop via .ExternalClass and MsoHyperlink resets
 * - Gmail Web and Mobile Apps via background gradients and table layout resets
 * - Floating preview toolbar classes (.dark, .light, .mobile-view)
 */
export function buildMasterEmailStyles(): string {
  const { light, dark, fontFamily, monoFontFamily } = EmailTokens;

  return `
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: ${light.canvasBg};
      background-color: ${light.canvasBg};
      color: ${light.textPrimary};
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
      padding: 32px 16px;
      margin: 0;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: ${light.cardBg};
      border: 1px solid ${light.cardBorder};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06);
      transition: all 0.2s ease;
    }

    /* ── Header: Synlio Deep Navy ── */
    .header {
      background: ${light.headerBg};
      background-color: ${light.headerBg};
      background-image: linear-gradient(${light.headerBg}, ${light.headerBg});
      border-bottom: 1px solid ${light.headerBorder};
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      display: block;
      object-fit: contain;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
      letter-spacing: 0.05em;
      font-family: ${fontFamily};
    }

    /* ── Hero / Content Shell ── */
    .hero {
      background: ${light.cardBg};
      padding: 24px 32px 20px;
    }
    .breadcrumb {
      font-size: 12px;
      font-weight: 500;
      color: ${light.textMuted};
      margin-bottom: 10px;
      font-family: ${fontFamily};
    }
    .breadcrumb-item {
      color: #0284c7;
      font-weight: 600;
    }
    .ticket-title {
      font-size: 19px;
      font-weight: 600;
      color: ${light.textPrimary};
      line-height: 1.35;
      margin-bottom: 10px;
      letter-spacing: -0.01em;
      font-family: ${fontFamily};
    }
    .ticket-desc {
      font-size: 13.5px;
      color: ${light.textSecondary};
      line-height: 1.6;
      margin-bottom: 14px;
      font-family: ${fontFamily};
    }
    .actor-row {
      margin-top: 10px;
    }
    .actor-text {
      font-size: 13px;
      color: ${light.textMuted};
      font-family: ${fontFamily};
      line-height: 1.5;
    }
    .actor-text strong {
      color: ${light.textPrimary};
      font-weight: 600;
    }
    .avatar, .user-avatar-initials {
      display: inline-block;
      vertical-align: middle;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${light.btnBg};
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      font-family: ${fontFamily};
      text-align: center;
      line-height: 28px;
      object-fit: cover;
    }

    /* ── Meta Table Rows ── */
    .meta {
      background: ${light.cardBg};
      border-top: 1px solid ${light.borderDivider};
      border-collapse: collapse;
      width: 100%;
    }
    .meta-label,
    .meta-value {
      border-bottom: 1px solid ${light.borderDivider};
    }
    .meta tr:last-child > td,
    .meta-row-last > td {
      border-bottom: none !important;
    }
    .meta table,
    .meta table tr,
    .meta table td {
      border: none !important;
      border-bottom: none !important;
    }
    .meta-label {
      width: 120px;
      font-size: 13px;
      font-weight: 500;
      color: ${light.textMuted};
      font-family: ${fontFamily};
      padding: 12px 16px 12px 32px;
      vertical-align: middle;
      text-align: left;
    }
    .meta-value {
      font-size: 13px;
      color: ${light.textPrimary};
      font-weight: 500;
      font-family: ${fontFamily};
      padding: 12px 32px 12px 16px;
      vertical-align: middle;
      text-align: right;
    }

    /* ── Chip Badges: rounded-md (6px) ── */
    .chip {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
      background: ${light.chipBg};
      color: ${light.chipText};
      border: 1px solid ${light.chipBorder};
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      font-family: ${fontFamily};
      vertical-align: middle;
    }
    .chip-muted {
      opacity: 0.6;
      background: #f1f5f9;
      color: ${light.textMuted};
    }
    .chip-dot {
      display: inline-block;
      vertical-align: middle;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 6px;
    }
    .chip-icon {
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
    }
    .chip-text {
      vertical-align: middle;
    }
    .chip-date-alert {
      border: 1px solid #ef4444 !important;
      color: ${light.textPrimary} !important;
      background: transparent !important;
    }
    .user-name {
      color: ${light.textPrimary};
    }
    .co-count {
      color: ${light.textMuted};
    }
    .change-arrow {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1;
      padding: 0 4px;
      vertical-align: middle;
    }

    /* ── Action / CTA Section ── */
    .cta {
      background: ${light.cardBg};
      border-top: 1px solid ${light.borderDivider};
      padding: 24px 32px 28px;
      text-align: center;
    }
    .cta-btn, a.cta-btn, a.cta-btn:visited, a.cta-btn:hover, a.cta-btn:active,
    .x_cta-btn, .x_cta-btn:visited, .x_cta-btn:hover, .x_cta-btn:active,
    a.x_cta-btn, a.x_cta-btn:visited {
      display: inline-block;
      background-color: ${light.btnBg} !important;
      background-image: linear-gradient(${light.btnBg}, ${light.btnBg}) !important;
      color: ${light.btnText} !important;
      text-decoration: none !important;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 24px;
      border-radius: 6px;
      font-family: ${fontFamily};
      box-shadow: 0 1px 3px rgba(14,165,233,0.3);
      mso-padding-alt: 10px 24px;
      vertical-align: middle;
      border: none !important;
      outline: none !important;
    }
    .cta-btn-text, .cta-btn-arrow, .cta-btn-font, .x_cta-btn-text, .x_cta-btn-arrow, .x_cta-btn-font {
      color: ${light.btnText} !important;
      vertical-align: middle;
      text-decoration: none !important;
      border: none !important;
      display: inline-block;
    }
    .cta-btn *, .x_cta-btn * {
      color: ${light.btnText} !important;
      text-decoration: none !important;
      border: none !important;
    }
    span.MsoHyperlink, span.MsoHyperlinkFollowed {
      color: ${light.btnText} !important;
      text-decoration: none !important;
    }
    a.fallback-link, a.fallback-link:visited {
      color: #0284c7 !important;
      text-decoration: none !important;
    }
    .cta-sub {
      margin-top: 12px;
      font-size: 12px;
      color: ${light.textMuted};
      font-family: ${fontFamily};
    }

    /* ── Auth Template Elements ── */
    .code-box {
      background: #f8fafc;
      border: 1px solid ${light.cardBorder};
      border-radius: 8px;
      padding: 16px 36px;
      text-align: center;
      display: inline-block;
    }
    .code-text {
      font-family: ${monoFontFamily};
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 10px;
      color: ${light.textPrimary};
    }
    .fallback-box {
      border: 1px solid ${light.cardBorder};
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 24px;
      text-align: left;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 24px;
      text-align: center;
      padding-bottom: 8px;
    }
    .footer p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.8;
      font-family: ${fontFamily};
      margin: 0;
    }

    /* ── Responsive Mobile Stacking (<= 480px) ────────────────────────── */
    @media only screen and (max-width: 480px) {
      body { padding: 16px 8px !important; }
      .hero { padding: 20px 20px 16px !important; }
      .header { padding: 14px 20px !important; }
      .cta { padding: 16px 20px 24px !important; }
      .meta tr { display: block !important; width: 100% !important; }
      .meta-label {
        display: block !important;
        width: 100% !important;
        padding: 12px 20px 4px 20px !important;
        text-align: left !important;
        font-size: 12px !important;
        font-weight: 600 !important;
      }
      .meta-value {
        display: block !important;
        width: 100% !important;
        padding: 0 20px 12px 20px !important;
        text-align: left !important;
      }
    }

    /* ── Preview Toolbar Toggle Class: .mobile-view ── */
    .mobile-view .hero { padding: 20px 20px 16px !important; }
    .mobile-view .header { padding: 14px 20px !important; }
    .mobile-view .cta { padding: 16px 20px 24px !important; }
    .mobile-view .meta tr { display: block !important; width: 100% !important; }
    .mobile-view .meta-label {
      display: block !important;
      width: 100% !important;
      padding: 12px 20px 4px 20px !important;
      text-align: left !important;
      font-size: 12px !important;
      font-weight: 600 !important;
    }
    .mobile-view .meta-value {
      display: block !important;
      width: 100% !important;
      padding: 0 20px 12px 20px !important;
      text-align: left !important;
    }

    /* ── Dark Mode Overrides (Standard OS prefers-color-scheme) ─────── */
    @media (prefers-color-scheme: dark) {
      body {
        background: #030712 !important;
        background-color: #030712 !important;
        color: ${dark.textPrimary} !important;
      }
      .outer-table {
        background: transparent !important;
        background-color: transparent !important;
      }
      .wrapper, .email-card {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
        border-color: ${dark.cardBorder} !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
      }
      .header {
        background: ${dark.headerBg} !important;
        background-color: ${dark.headerBg} !important;
        background-image: linear-gradient(${dark.headerBg}, ${dark.headerBg}) !important;
        border-bottom: 1px solid ${dark.headerBorder} !important;
      }
      .hero {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
      }
      .meta {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
        border-top-color: ${dark.borderDivider} !important;
      }
      .meta-label, .meta-value {
        border-bottom-color: ${dark.borderDivider} !important;
      }
      .meta tr:last-child > td, .meta-row-last > td {
        border-bottom: none !important;
      }
      .meta table, .meta table tr, .meta table td {
        border: none !important;
        border-bottom: none !important;
      }
      .meta-label {
        color: ${dark.textMuted} !important;
      }
      .meta-value {
        color: #f8fafc !important;
      }
      .ticket-title {
        color: ${dark.textPrimary} !important;
      }
      .ticket-desc {
        color: ${dark.textSecondary} !important;
      }
      .breadcrumb {
        color: ${dark.textMuted} !important;
      }
      .breadcrumb-item {
        color: #38bdf8 !important;
      }
      .actor-text {
        color: ${dark.textMuted} !important;
      }
      .actor-text strong {
        color: ${dark.textPrimary} !important;
      }
      /* Dark mode: button text and arrow must be black */
      .cta {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
        border-top-color: ${dark.borderDivider} !important;
      }
      .cta-btn-cell {
        background-color: ${dark.btnBg} !important;
        background-image: linear-gradient(${dark.btnBg}, ${dark.btnBg}) !important;
      }
      .cta-btn, a.cta-btn, a.cta-btn:visited, a.cta-btn:hover, a.cta-btn:active,
      .x_cta-btn, .x_cta-btn:visited, a.x_cta-btn, a.x_cta-btn:visited {
        background-color: ${dark.btnBg} !important;
        background-image: linear-gradient(${dark.btnBg}, ${dark.btnBg}) !important;
        color: ${dark.btnText} !important;
        text-decoration: none !important;
        border: none !important;
      }
      .cta-btn *, .x_cta-btn *,
      .cta-btn-text, .x_cta-btn-text,
      .cta-btn-arrow, .x_cta-btn-arrow,
      .cta-btn-font, .x_cta-btn-font,
      font[color="#ffffff"] {
        color: ${dark.btnText} !important;
        text-decoration: none !important;
        border: none !important;
      }
      .avatar, .user-avatar-initials {
        color: ${dark.btnText} !important;
      }
      .user-name {
        color: #f8fafc !important;
      }
      .chip {
        background: ${dark.chipBg} !important;
        background-color: ${dark.chipBg} !important;
        color: ${dark.chipText} !important;
        border-color: ${dark.chipBorder} !important;
        box-shadow: none !important;
      }
      .chip-muted {
        opacity: 0.6 !important;
        background: ${dark.chipBg} !important;
        background-color: ${dark.chipBg} !important;
        color: ${dark.textMuted} !important;
      }
      .chip-date-alert {
        border-color: #ef4444 !important;
        color: #f8fafc !important;
        background: transparent !important;
        background-color: transparent !important;
      }
      .code-box {
        background: #070e1c !important;
        background-color: #070e1c !important;
        border-color: ${dark.cardBorder} !important;
      }
      .code-text {
        color: #38bdf8 !important;
      }
      .fallback-box {
        background: #070e1c !important;
        background-color: #070e1c !important;
        border-color: ${dark.cardBorder} !important;
      }
      .fallback-label {
        color: ${dark.textMuted} !important;
      }
      .fallback-url, .fallback-link, a.fallback-link, a.fallback-link:visited {
        color: #38bdf8 !important;
      }
      .footer p {
        color: ${dark.textMuted} !important;
      }
    }

    /* ── Microsoft Outlook Web Dark Mode ([data-ogsc] / [data-ogsb]) ─── */
    [data-ogsb] body, body[data-ogsb],
    [data-ogsb] .outer-table, .outer-table[data-ogsb], .x_outer-table[data-ogsb],
    [data-ogsb="#f1f5f9"] {
      background-color: transparent !important;
      background: transparent !important;
    }

    /* Force pure black card background in Outlook Dark Mode */
    [data-ogsb="#ffffff"],
    .wrapper[data-ogsb], .x_wrapper[data-ogsb], [data-ogsb] .wrapper, [data-ogsb] .x_wrapper,
    .email-card[data-ogsb], .x_email-card[data-ogsb], [data-ogsb] .email-card, [data-ogsb] .x_email-card,
    .hero[data-ogsb], .x_hero[data-ogsb], [data-ogsb] .hero, [data-ogsb] .x_hero,
    .meta[data-ogsb], .x_meta[data-ogsb], [data-ogsb] .meta, [data-ogsb] .x_meta,
    .cta[data-ogsb], .x_cta[data-ogsb], [data-ogsb] .cta, [data-ogsb] .x_cta {
      background-color: ${dark.cardBg} !important;
      background: ${dark.cardBg} !important;
    }

    /* Card borders in Outlook Dark Mode */
    .wrapper[data-ogsc], .x_wrapper[data-ogsc], [data-ogsc] .wrapper, [data-ogsc] .x_wrapper,
    .email-card[data-ogsc], .x_email-card[data-ogsc], [data-ogsc] .email-card, [data-ogsc] .x_email-card,
    .wrapper[data-ogsb], .x_wrapper[data-ogsb], [data-ogsb] .wrapper, [data-ogsb] .x_wrapper {
      border-color: ${dark.cardBorder} !important;
    }

    /* Header in Outlook Dark Mode */
    [data-ogsb="#0b1329"],
    .header[data-ogsb], .x_header[data-ogsb], [data-ogsb] .header, [data-ogsb] .x_header {
      background-color: ${dark.headerBg} !important;
      background: ${dark.headerBg} !important;
      background-image: linear-gradient(${dark.headerBg}, ${dark.headerBg}) !important;
      border-bottom-color: ${dark.headerBorder} !important;
    }
    .header[data-ogsc], .x_header[data-ogsc], [data-ogsc] .header, [data-ogsc] .x_header {
      border-bottom-color: ${dark.headerBorder} !important;
    }

    /* Meta & CTA dividers in Outlook Dark Mode */
    .meta[data-ogsc], .x_meta[data-ogsc], [data-ogsc] .meta, [data-ogsc] .x_meta,
    .cta[data-ogsc], .x_cta[data-ogsc], [data-ogsc] .cta, [data-ogsc] .x_cta {
      border-top-color: ${dark.borderDivider} !important;
    }
    .meta-label[data-ogsc], .x_meta-label[data-ogsc], [data-ogsc] .meta-label, [data-ogsc] .x_meta-label,
    .meta-value[data-ogsc], .x_meta-value[data-ogsc], [data-ogsc] .meta-value, [data-ogsc] .x_meta-value {
      border-bottom-color: ${dark.borderDivider} !important;
    }
    .meta-label[data-ogsc], .x_meta-label[data-ogsc], [data-ogsc] .meta-label, [data-ogsc] .x_meta-label {
      color: ${dark.textMuted} !important;
    }
    .meta-value[data-ogsc], .x_meta-value[data-ogsc], [data-ogsc] .meta-value, [data-ogsc] .x_meta-value {
      color: #f8fafc !important;
    }

    /* Typography in Outlook Dark Mode */
    .ticket-title[data-ogsc], .x_ticket-title[data-ogsc], [data-ogsc] .ticket-title, [data-ogsc] .x_ticket-title {
      color: ${dark.textPrimary} !important;
    }
    .ticket-desc[data-ogsc], .x_ticket-desc[data-ogsc], [data-ogsc] .ticket-desc, [data-ogsc] .x_ticket-desc {
      color: ${dark.textSecondary} !important;
    }
    .breadcrumb[data-ogsc], .x_breadcrumb[data-ogsc], [data-ogsc] .breadcrumb, [data-ogsc] .x_breadcrumb {
      color: ${dark.textMuted} !important;
    }
    .breadcrumb-item[data-ogsc], .x_breadcrumb-item[data-ogsc], [data-ogsc] .breadcrumb-item, [data-ogsc] .x_breadcrumb-item {
      color: #38bdf8 !important;
    }
    .actor-text[data-ogsc], .x_actor-text[data-ogsc], [data-ogsc] .actor-text, [data-ogsc] .x_actor-text {
      color: ${dark.textMuted} !important;
    }
    .actor-text strong, .x_actor-text strong, [data-ogsc] .actor-text strong, [data-ogsc] .x_actor-text strong {
      color: ${dark.textPrimary} !important;
    }

    /* CTA Button in Outlook Dark Mode: Pure Black Text & Arrow */
    .cta-btn-cell[data-ogsb], .x_cta-btn-cell[data-ogsb], [data-ogsb] .cta-btn-cell, [data-ogsb] .x_cta-btn-cell,
    .cta-btn[data-ogsb], .x_cta-btn[data-ogsb], [data-ogsb] .cta-btn, [data-ogsb] .x_cta-btn {
      background-color: ${dark.btnBg} !important;
      background-image: linear-gradient(${dark.btnBg}, ${dark.btnBg}) !important;
    }
    body [data-ogsc] a.cta-btn, body [data-ogsc] a.x_cta-btn,
    div [data-ogsc] a.cta-btn, div [data-ogsc] a.x_cta-btn,
    td [data-ogsc] a.cta-btn, td [data-ogsc] a.x_cta-btn,
    [data-ogsc] .cta-btn, [data-ogsc] .x_cta-btn,
    .cta-btn[data-ogsc], .x_cta-btn[data-ogsc],
    a[data-ogsc].cta-btn, a[data-ogsc].x_cta-btn,
    [data-ogsc] a.cta-btn, [data-ogsc] a.x_cta-btn,
    [data-ogsc] a.cta-btn:visited, [data-ogsc] a.x_cta-btn:visited,
    a.cta-btn[data-ogsc]:visited, a.x_cta-btn[data-ogsc]:visited,
    [data-ogsc] .cta-btn *, [data-ogsc] .x_cta-btn *,
    .cta-btn[data-ogsc] *, .x_cta-btn[data-ogsc] *,
    [data-ogsc] .cta-btn font, [data-ogsc] .x_cta-btn font,
    [data-ogsc] .cta-btn span, [data-ogsc] .x_cta-btn span,
    [data-ogsc] .cta-btn-text, [data-ogsc] .x_cta-btn-text,
    [data-ogsc] .cta-btn-arrow, [data-ogsc] .x_cta-btn-arrow,
    [data-ogsc] .cta-btn-font, [data-ogsc] .x_cta-btn-font,
    [data-ogsc] font[color="#ffffff"] {
      color: ${dark.btnText} !important;
      text-decoration: none !important;
      border: none !important;
      outline: none !important;
    }

    /* Avatars & Chips in Outlook Dark Mode */
    .avatar[data-ogsc], .x_avatar[data-ogsc], [data-ogsc] .avatar, [data-ogsc] .x_avatar,
    .user-avatar-initials[data-ogsc], .x_user-avatar-initials[data-ogsc], [data-ogsc] .user-avatar-initials, [data-ogsc] .x_user-avatar-initials {
      color: ${dark.btnText} !important;
    }
    .user-name[data-ogsc], .x_user-name[data-ogsc], [data-ogsc] .user-name, [data-ogsc] .x_user-name {
      color: #f8fafc !important;
    }
    .chip[data-ogsb], .x_chip[data-ogsb], [data-ogsb] .chip, [data-ogsb] .x_chip,
    .chip-muted[data-ogsb], .x_chip-muted[data-ogsb], [data-ogsb] .chip-muted, [data-ogsb] .x_chip-muted {
      background-color: ${dark.chipBg} !important;
      background: ${dark.chipBg} !important;
    }
    .chip[data-ogsc], .x_chip[data-ogsc], [data-ogsc] .chip, [data-ogsc] .x_chip {
      color: ${dark.chipText} !important;
      border-color: ${dark.chipBorder} !important;
    }
    .chip-muted[data-ogsc], .x_chip-muted[data-ogsc], [data-ogsc] .chip-muted, [data-ogsc] .x_chip-muted {
      color: ${dark.textMuted} !important;
      border-color: ${dark.chipBorder} !important;
    }
    .chip-date-alert[data-ogsc], .x_chip-date-alert[data-ogsc], [data-ogsc] .chip-date-alert, [data-ogsc] .x_chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
    }
    .code-box[data-ogsb], .x_code-box[data-ogsb], [data-ogsb] .code-box, [data-ogsb] .x_code-box {
      background-color: #070e1c !important;
    }
    .code-box[data-ogsc], .x_code-box[data-ogsc], [data-ogsc] .code-box, [data-ogsc] .x_code-box {
      border-color: ${dark.cardBorder} !important;
    }
    .code-text[data-ogsc], .x_code-text[data-ogsc], [data-ogsc] .code-text, [data-ogsc] .x_code-text {
      color: #38bdf8 !important;
    }
    .fallback-box[data-ogsb], .x_fallback-box[data-ogsb], [data-ogsb] .fallback-box, [data-ogsb] .x_fallback-box {
      background-color: #070e1c !important;
    }
    .fallback-box[data-ogsc], .x_fallback-box[data-ogsc], [data-ogsc] .fallback-box, [data-ogsc] .x_fallback-box {
      border-color: ${dark.cardBorder} !important;
    }
    .fallback-label[data-ogsc], .x_fallback-label[data-ogsc], [data-ogsc] .fallback-label, [data-ogsc] .x_fallback-label {
      color: ${dark.textMuted} !important;
    }
    .fallback-url[data-ogsc], .x_fallback-url[data-ogsc], [data-ogsc] .fallback-url, [data-ogsc] .x_fallback-url,
    .fallback-link[data-ogsc], .x_fallback-link[data-ogsc], [data-ogsc] .fallback-link, [data-ogsc] .x_fallback-link {
      color: #38bdf8 !important;
    }
    .footer p[data-ogsc], .x_footer p[data-ogsc], [data-ogsc] .footer p, [data-ogsc] .x_footer p {
      color: ${dark.textMuted} !important;
    }

    /* ── Explicit .dark Styles (For Preview Toolbar) ─────────────────────── */
    body.dark, [data-theme="dark"] body, html.dark body {
      background: #030712 !important;
      color: ${dark.textPrimary} !important;
    }
    body.dark .outer-table, [data-theme="dark"] .outer-table, html.dark .outer-table {
      background: #030712 !important;
      background-color: #030712 !important;
    }
    body.dark .wrapper, [data-theme="dark"] .wrapper, html.dark .wrapper {
      background: ${dark.cardBg} !important;
      border-color: ${dark.cardBorder} !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
    }
    body.dark .header, [data-theme="dark"] .header, html.dark .header {
      background: ${dark.headerBg} !important;
      border-bottom: 1px solid ${dark.headerBorder} !important;
    }
    body.dark .hero, [data-theme="dark"] .hero, html.dark .hero {
      background: ${dark.cardBg} !important;
    }
    body.dark .meta, [data-theme="dark"] .meta, html.dark .meta {
      background: ${dark.cardBg} !important;
      border-top-color: ${dark.borderDivider} !important;
    }
    body.dark .meta-label, [data-theme="dark"] .meta-label, html.dark .meta-label,
    body.dark .meta-value, [data-theme="dark"] .meta-value, html.dark .meta-value {
      border-bottom: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .meta tr:last-child > td, [data-theme="dark"] .meta tr:last-child > td, html.dark .meta tr:last-child > td,
    body.dark .meta-row-last > td, [data-theme="dark"] .meta-row-last > td, html.dark .meta-row-last > td {
      border-bottom: none !important;
    }
    body.dark .meta table, [data-theme="dark"] .meta table, html.dark .meta table,
    body.dark .meta table tr, [data-theme="dark"] .meta table tr, html.dark .meta table tr,
    body.dark .meta table td, [data-theme="dark"] .meta table td, html.dark .meta table td {
      border: none !important;
      border-bottom: none !important;
    }
    body.dark .meta-label, [data-theme="dark"] .meta-label, html.dark .meta-label {
      color: ${dark.textMuted} !important;
    }
    body.dark .meta-value, [data-theme="dark"] .meta-value, html.dark .meta-value {
      color: #f8fafc !important;
    }
    body.dark .ticket-title, [data-theme="dark"] .ticket-title, html.dark .ticket-title {
      color: ${dark.textPrimary} !important;
    }
    body.dark .ticket-desc, [data-theme="dark"] .ticket-desc, html.dark .ticket-desc {
      color: ${dark.textSecondary} !important;
    }
    body.dark .breadcrumb, [data-theme="dark"] .breadcrumb {
      color: ${dark.textMuted} !important;
    }
    body.dark .breadcrumb-item, [data-theme="dark"] .breadcrumb-item {
      color: #38bdf8 !important;
    }
    body.dark .actor-text, [data-theme="dark"] .actor-text, html.dark .actor-text {
      color: ${dark.textMuted} !important;
    }
    body.dark .actor-text strong, [data-theme="dark"] .actor-text strong, html.dark .actor-text strong {
      color: ${dark.textPrimary} !important;
    }
    body.dark .cta, [data-theme="dark"] .cta, html.dark .cta {
      background: ${dark.cardBg} !important;
      border-top-color: ${dark.borderDivider} !important;
    }
    body.dark .cta-btn-cell, [data-theme="dark"] .cta-btn-cell, html.dark .cta-btn-cell {
      background-color: ${dark.btnBg} !important;
    }
    body.dark a.cta-btn, [data-theme="dark"] a.cta-btn, html.dark a.cta-btn,
    body.dark .cta-btn, [data-theme="dark"] .cta-btn, html.dark .cta-btn,
    body.dark .cta-btn *, [data-theme="dark"] .cta-btn *, html.dark .cta-btn *,
    body.dark .cta-btn font, [data-theme="dark"] .cta-btn font, html.dark .cta-btn font,
    body.dark .cta-btn-text, [data-theme="dark"] .cta-btn-text, html.dark .cta-btn-text,
    body.dark .cta-btn-arrow, [data-theme="dark"] .cta-btn-arrow, html.dark .cta-btn-arrow,
    body.dark .cta-btn-font, [data-theme="dark"] .cta-btn-font, html.dark .cta-btn-font {
      color: ${dark.btnText} !important;
      text-decoration: none !important;
      border: none !important;
    }
    body.dark .avatar, [data-theme="dark"] .avatar, html.dark .avatar,
    body.dark .user-avatar-initials, [data-theme="dark"] .user-avatar-initials, html.dark .user-avatar-initials {
      color: ${dark.btnText} !important;
    }
    body.dark .user-name, [data-theme="dark"] .user-name, html.dark .user-name {
      color: #f8fafc !important;
    }
    body.dark .chip, [data-theme="dark"] .chip, html.dark .chip {
      background: ${dark.chipBg} !important;
      color: ${dark.chipText} !important;
      border-color: ${dark.chipBorder} !important;
      box-shadow: none !important;
    }
    body.dark .chip-muted, [data-theme="dark"] .chip-muted, html.dark .chip-muted {
      opacity: 0.6 !important;
      background: ${dark.chipBg} !important;
      color: ${dark.textMuted} !important;
    }
    body.dark .chip-date-alert, [data-theme="dark"] .chip-date-alert, html.dark .chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
      background: transparent !important;
    }
    body.dark .code-box, [data-theme="dark"] .code-box, html.dark .code-box {
      background: #070e1c !important;
      border-color: ${dark.cardBorder} !important;
    }
    body.dark .code-text, [data-theme="dark"] .code-text, html.dark .code-text {
      color: #38bdf8 !important;
    }
    body.dark .fallback-box, [data-theme="dark"] .fallback-box, html.dark .fallback-box {
      background: #070e1c !important;
      border-color: ${dark.cardBorder} !important;
    }
    body.dark .fallback-label, [data-theme="dark"] .fallback-label, html.dark .fallback-label {
      color: ${dark.textMuted} !important;
    }
    body.dark .fallback-url, [data-theme="dark"] .fallback-url, html.dark .fallback-url,
    body.dark .fallback-link, [data-theme="dark"] .fallback-link, html.dark .fallback-link {
      color: #38bdf8 !important;
    }
    body.dark .footer p, [data-theme="dark"] .footer p, html.dark .footer p {
      color: ${dark.textMuted} !important;
    }

    /* ── Explicit .light Styles (For Preview Toolbar) ────────────────────── */
    body.light, [data-theme="light"] body, html.light body {
      background: ${light.canvasBg} !important;
      color: ${light.textPrimary} !important;
    }
    body.light .outer-table, [data-theme="light"] .outer-table, html.light .outer-table {
      background: ${light.canvasBg} !important;
      background-color: ${light.canvasBg} !important;
    }
    body.light .wrapper, [data-theme="light"] .wrapper, html.light .wrapper {
      background: ${light.cardBg} !important;
      border-color: ${light.cardBorder} !important;
      box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06) !important;
    }
    body.light .header, [data-theme="light"] .header, html.light .header {
      background: ${light.headerBg} !important;
      border-bottom: 1px solid ${light.headerBorder} !important;
    }
    body.light .hero, [data-theme="light"] .hero, html.light .hero {
      background: ${light.cardBg} !important;
    }
    body.light .meta, [data-theme="light"] .meta, html.light .meta {
      background: ${light.cardBg} !important;
      border-top-color: ${light.borderDivider} !important;
    }
    body.light .meta-label, [data-theme="light"] .meta-label, html.light .meta-label,
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value {
      border-bottom: 1px solid ${light.borderDivider} !important;
    }
    body.light .meta tr:last-child > td, [data-theme="light"] .meta tr:last-child > td, html.light .meta tr:last-child > td,
    body.light .meta-row-last > td, [data-theme="light"] .meta-row-last > td, html.light .meta-row-last > td {
      border-bottom: none !important;
    }
    body.light .meta table, [data-theme="light"] .meta table, html.light .meta table,
    body.light .meta table tr, [data-theme="light"] .meta table tr, html.light .meta table tr,
    body.light .meta table td, [data-theme="light"] .meta table td, html.light .meta table td {
      border: none !important;
      border-bottom: none !important;
    }
    body.light .meta-label, [data-theme="light"] .meta-label, html.light .meta-label {
      color: ${light.textMuted} !important;
    }
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value {
      color: ${light.textPrimary} !important;
    }
    body.light .ticket-title, [data-theme="light"] .ticket-title, html.light .ticket-title {
      color: ${light.textPrimary} !important;
    }
    body.light .ticket-desc, [data-theme="light"] .ticket-desc, html.light .ticket-desc {
      color: ${light.textSecondary} !important;
    }
    body.light .breadcrumb, [data-theme="light"] .breadcrumb {
      color: ${light.textMuted} !important;
    }
    body.light .breadcrumb-item, [data-theme="light"] .breadcrumb-item {
      color: #0284c7 !important;
    }
    body.light .actor-text, [data-theme="light"] .actor-text, html.light .actor-text {
      color: ${light.textMuted} !important;
    }
    body.light .actor-text strong, [data-theme="light"] .actor-text strong, html.light .actor-text strong {
      color: ${light.textPrimary} !important;
    }
    body.light .cta, [data-theme="light"] .cta, html.light .cta {
      background: ${light.cardBg} !important;
      border-top-color: ${light.borderDivider} !important;
    }
    body.light .cta-btn-cell, [data-theme="light"] .cta-btn-cell, html.light .cta-btn-cell {
      background-color: ${light.btnBg} !important;
    }
    body.light a.cta-btn, [data-theme="light"] a.cta-btn, html.light a.cta-btn,
    body.light .cta-btn, [data-theme="light"] .cta-btn, html.light .cta-btn,
    body.light .cta-btn *, [data-theme="light"] .cta-btn *, html.light .cta-btn *,
    body.light .cta-btn font, [data-theme="light"] .cta-btn font, html.light .cta-btn font,
    body.light .cta-btn-text, [data-theme="light"] .cta-btn-text, html.light .cta-btn-text,
    body.light .cta-btn-arrow, [data-theme="light"] .cta-btn-arrow, html.light .cta-btn-arrow,
    body.light .cta-btn-font, [data-theme="light"] .cta-btn-font, html.light .cta-btn-font {
      color: ${light.btnText} !important;
      stroke: ${light.btnText} !important;
      text-decoration: none !important;
      border: none !important;
    }
    body.light .avatar, [data-theme="light"] .avatar, html.light .avatar,
    body.light .user-avatar-initials, [data-theme="light"] .user-avatar-initials, html.light .user-avatar-initials {
      color: ${light.btnText} !important;
    }
    body.light .user-name, [data-theme="light"] .user-name, html.light .user-name {
      color: ${light.textPrimary} !important;
    }
    body.light .chip, [data-theme="light"] .chip, html.light .chip {
      background: ${light.chipBg} !important;
      color: ${light.chipText} !important;
      border-color: ${light.chipBorder} !important;
    }
    body.light .chip-muted, [data-theme="light"] .chip-muted, html.light .chip-muted {
      opacity: 0.6 !important;
      background: #f1f5f9 !important;
    }
    body.light .chip-date-alert, [data-theme="light"] .chip-date-alert, html.light .chip-date-alert {
      border: 1px solid #ef4444 !important;
      color: ${light.textPrimary} !important;
      background: transparent !important;
    }
    body.light .code-box, [data-theme="light"] .code-box, html.light .code-box {
      background: #f8fafc !important;
      border-color: ${light.cardBorder} !important;
    }
    body.light .code-text, [data-theme="light"] .code-text, html.light .code-text {
      color: ${light.textPrimary} !important;
    }
    body.light .fallback-box, [data-theme="light"] .fallback-box, html.light .fallback-box {
      background: transparent !important;
      border-color: ${light.cardBorder} !important;
    }
    body.light .fallback-label, [data-theme="light"] .fallback-label, html.light .fallback-label {
      color: ${light.textMuted} !important;
    }
    body.light .fallback-url, [data-theme="light"] .fallback-url, html.light .fallback-url,
    body.light .fallback-link, [data-theme="light"] .fallback-link, html.light .fallback-link,
    body.light a.fallback-link, body.light a.fallback-link:visited {
      color: #0284c7 !important;
    }
    body.light .footer p, [data-theme="light"] .footer p, html.light .footer p {
      color: #94a3b8 !important;
    }
  `;
}
