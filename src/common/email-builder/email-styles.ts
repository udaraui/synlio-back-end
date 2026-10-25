import { EmailTokens } from './email-tokens';

/**
 * Builds the unified, bulletproof cross-platform stylesheet for all email clients:
 * - Apple Mail & WebKit clients via @media (prefers-color-scheme: dark)
 * - Microsoft Outlook Web (OWA / Office 365) via [data-ogsc] and [data-ogsb] attribute selectors
 * - Microsoft Outlook Desktop via .ExternalClass and MsoHyperlink resets
 * - Gmail Web and Mobile Apps via background gradients and table layout resets
 * - Floating preview toolbar classes (.dark, .light, .mobile-view)
 *
 * BORDER STRATEGY (critical for cross-client correctness):
 *  - All border-width + border-style are set via INLINE HTML styles (always rendered)
 *  - Dark mode CSS only changes border-COLOR using border-xxx-color sub-properties with !important
 *  - This prevents !important in <style> from stripping inline borders (an email-client quirk)
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
    .wrapper, .email-card {
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
      /* No border-bottom — header flows into content seamlessly */
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
    .actor-text strong, .actor-name {
      color: ${light.textPrimary} !important;
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
    /* NOTE: borders on .meta, .meta-label, .meta-value are set via INLINE STYLES.
       CSS only provides layout/color, NOT border-width/style (to avoid !important conflicts). */
    .meta {
      background: ${light.cardBg};
      background-color: ${light.cardBg};
      border-collapse: collapse;
      width: 100%;
    }
    .meta table,
    .meta table tr,
    .meta table td {
      border: none !important;
      border-bottom: none !important;
    }
    .meta-row-last td,
    tr.meta-row-last > td {
      border-bottom: none !important;
    }
    .meta-label {
      white-space: nowrap !important;
      width: 1% !important;
      font-size: 13px;
      font-weight: 500;
      color: ${light.textMuted};
      font-family: ${fontFamily};
      padding: 12px 12px 12px 24px;
      vertical-align: middle;
      text-align: left;
    }
    .meta-value {
      white-space: nowrap !important;
      font-size: 13px;
      color: ${light.textPrimary};
      font-weight: 500;
      font-family: ${fontFamily};
      padding: 12px 24px 12px 12px;
      vertical-align: middle;
      text-align: right;
    }

    /* ── Chip Badges: rounded-md (6px) ── */
    table.chip {
      display: inline-table !important;
      vertical-align: middle !important;
      border-collapse: separate !important;
    }
    .chip {
      white-space: nowrap !important;
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
      font-family: ${fontFamily};
      vertical-align: middle;
    }
    td.chip-td {
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
      background: ${light.chipBg};
      color: ${light.chipText};
      border: 1px solid #cbd5e1;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      font-family: ${fontFamily};
      vertical-align: middle;
      white-space: nowrap !important;
    }
    .chip-muted, td.chip-muted, .chip-muted td.chip-td {
      background: #f1f5f9;
      background-color: #f1f5f9;
      color: ${light.textMuted};
    }
    .chip-dot {
      display: inline-block;
      vertical-align: middle;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 6px;
      border: none !important;
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
    /* NOTE: border-top is set via INLINE STYLES on the <div class="cta">.
       CSS only provides background color. This prevents !important from stripping inline borders. */
    .cta {
      background: ${light.cardBg};
      background-color: ${light.cardBg};
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
      text-decoration: underline !important;
    }
    .cta-sub {
      margin-top: 12px;
      font-size: 12px;
      color: ${light.textMuted};
      font-family: ${fontFamily};
    }

    /* ── OTP / Verification Code Box ── */
    .code-box {
      background: #f8fafc;
      background-color: #f8fafc;
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 8px;
      padding: 16px 36px;
      text-align: center;
    }
    .code-text {
      font-family: ${monoFontFamily};
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      color: ${light.textPrimary};
      background: transparent;
    }

    /* ── Fallback URL Box ── */
    .fallback-box {
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 24px;
      text-align: left;
      background: #f8fafc;
      background-color: #f8fafc;
    }
    .fallback-label {
      font-size: 12px;
      color: ${light.textMuted};
      font-family: ${fontFamily};
    }
    .fallback-url, .fallback-link {
      font-size: 12px;
      color: #0284c7;
      word-break: break-all;
      font-family: ${monoFontFamily};
    }
    .disclaimer-text {
      font-size: 13px;
      color: ${light.textMuted};
      font-style: italic;
      line-height: 1.6;
      font-family: ${fontFamily};
    }
    .callout-box {
      padding: 16px;
      background-color: #f8fafc;
      border-left: 4px solid #0ea5e9;
      border-radius: 0 8px 8px 0;
      color: ${light.textSecondary};
      font-size: 14px;
      line-height: 1.6;
      font-style: italic;
      margin-top: 14px;
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

    /* ── Responsive Mobile Layout (<= 480px) ────────────────────────── */
    @media only screen and (max-width: 480px) {
      body { padding: 12px 8px !important; }
      .wrapper { border-radius: 10px !important; }
      .hero { padding: 18px 16px 14px !important; }
      .header { padding: 14px 16px !important; }
      .cta { padding: 18px 16px 22px !important; }
      .meta-label {
        padding: 10px 8px 10px 16px !important;
        font-size: 12px !important;
        width: 1% !important;
        white-space: nowrap !important;
      }
      .meta-value {
        padding: 10px 16px 10px 8px !important;
        font-size: 12px !important;
        text-align: right !important;
        white-space: nowrap !important;
      }
      .ticket-title { font-size: 17px !important; margin-bottom: 8px !important; }
      .ticket-desc { font-size: 13px !important; margin-bottom: 12px !important; }
      .code-box { padding: 12px 20px !important; }
      .code-text { font-size: 26px !important; letter-spacing: 6px !important; }
    }

    /* ── Preview Toolbar Toggle Class: .mobile-view ── */
    .mobile-view .wrapper { border-radius: 10px !important; }
    .mobile-view .hero { padding: 18px 16px 14px !important; }
    .mobile-view .header { padding: 14px 16px !important; }
    .mobile-view .cta { padding: 18px 16px 22px !important; }
    .mobile-view .meta-label {
      padding: 10px 8px 10px 16px !important;
      font-size: 12px !important;
      width: 1% !important;
      white-space: nowrap !important;
    }
    .mobile-view .meta-value {
      padding: 10px 16px 10px 8px !important;
      font-size: 12px !important;
      text-align: right !important;
      white-space: nowrap !important;
    }
    .mobile-view .ticket-title { font-size: 17px !important; margin-bottom: 8px !important; }
    .mobile-view .ticket-desc { font-size: 13px !important; margin-bottom: 12px !important; }
    .mobile-view .code-box { padding: 12px 20px !important; }
    .mobile-view .code-text { font-size: 26px !important; letter-spacing: 6px !important; }

    /* ════════════════════════════════════════════════════════════════════
       DARK MODE OVERRIDES
       Key Rule: Only override background-color and text/border COLORS.
       Never touch border-width or border-style (that breaks inline borders).
       Use border-xxx-color sub-properties to change only the color.
    ════════════════════════════════════════════════════════════════════ */

    /* ── 1. Apple Mail / WebKit: @media (prefers-color-scheme: dark) ── */
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
        /* No border-bottom on header in any mode */
      }
      .hero {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
      }
      /* Meta: change only background + border COLOR (not width/style) */
      .meta {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
        border-top: 1px solid ${dark.borderDivider} !important;
      }
      .meta-label, .meta-value, tr.meta-row > td {
        border-bottom: 1px solid ${dark.borderDivider} !important;
      }
      .meta-row-last td, tr.meta-row-last > td {
        border-bottom: none !important;
      }
      .meta table, .meta table tr, .meta table td {
        border: none !important;
        border-bottom: none !important;
      }
      .meta-label { color: ${dark.textMuted} !important; }
      .meta-value { color: #f8fafc !important; }
      /* CTA: change only background + border COLOR */
      .cta {
        background: ${dark.cardBg} !important;
        background-color: ${dark.cardBg} !important;
        border-top: 1px solid ${dark.borderDivider} !important;
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
      .cta-btn-cell {
        background-color: ${dark.btnBg} !important;
        background-image: linear-gradient(${dark.btnBg}, ${dark.btnBg}) !important;
      }
      /* Typography */
      .ticket-title { color: ${dark.textPrimary} !important; }
      .ticket-desc { color: ${dark.textSecondary} !important; }
      .breadcrumb { color: ${dark.textMuted} !important; }
      .breadcrumb-item { color: #38bdf8 !important; }
      .actor-text { color: ${dark.textMuted} !important; }
      .actor-text strong, .actor-name { color: ${dark.textPrimary} !important; }
      /* Avatars */
      .avatar, .user-avatar-initials { color: ${dark.btnText} !important; }
      .user-name { color: #f8fafc !important; }
      /* Chips */
      .chip, td.chip-td, table.chip {
        background: ${dark.chipBg} !important;
        background-color: ${dark.chipBg} !important;
        background-image: linear-gradient(${dark.chipBg}, ${dark.chipBg}) !important;
        color: ${dark.chipText} !important;
        border-color: ${dark.chipBorder} !important;
        box-shadow: none !important;
      }
      .chip-muted, td.chip-muted, .chip-muted td.chip-td {
        background: ${dark.chipBg} !important;
        background-color: ${dark.chipBg} !important;
        background-image: linear-gradient(${dark.chipBg}, ${dark.chipBg}) !important;
        color: ${dark.textMuted} !important;
      }
      .chip-dot { border: none !important; }
      .chip-date-alert {
        border-color: #ef4444 !important;
        color: #f8fafc !important;
        background: transparent !important;
        background-color: transparent !important;
      }
      /* Code box */
      .code-box {
        background: #070e1c !important;
        background-color: #070e1c !important;
        border: 1px solid ${dark.borderDivider} !important;
      }
      .code-text { color: #38bdf8 !important; }
      /* Fallback */
      .fallback-box {
        background: #070e1c !important;
        background-color: #070e1c !important;
        border: 1px solid ${dark.borderDivider} !important;
      }
      .fallback-label { color: ${dark.textMuted} !important; }
      .fallback-url, .fallback-link, a.fallback-link, a.fallback-link:visited {
        color: #38bdf8 !important;
      }
      .disclaimer-text { color: ${dark.textMuted} !important; }
      .callout-box {
        background-color: #070e1c !important;
        background: #070e1c !important;
        border-left: 4px solid #38bdf8 !important;
        color: ${dark.textSecondary} !important;
      }
      .footer p { color: ${dark.textMuted} !important; }
    }

    /* ── 2. Microsoft Outlook Web Dark Mode ([data-ogsc] / [data-ogsb]) ── */
    /* Outlook's parser silently drops comma-grouped selectors — each rule must be flat. */
    [data-ogsb] body { background-color: transparent !important; background: transparent !important; }
    [data-ogsc] body { background-color: transparent !important; background: transparent !important; }
    [data-ogsb] .outer-table { background-color: transparent !important; background: transparent !important; background-image: none !important; }
    [data-ogsc] .outer-table { background-color: transparent !important; background: transparent !important; background-image: none !important; }

    /* Card */
    [data-ogsb] .wrapper { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-color: ${dark.cardBorder} !important; }
    [data-ogsc] .wrapper { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-color: ${dark.cardBorder} !important; }
    [data-ogsb] .email-card { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-color: ${dark.cardBorder} !important; }
    [data-ogsc] .email-card { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-color: ${dark.cardBorder} !important; }

    /* Hero */
    [data-ogsb] .hero { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; }
    [data-ogsc] .hero { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; }

    /* Header */
    [data-ogsb] .header { background-color: ${dark.headerBg} !important; background: ${dark.headerBg} !important; background-image: linear-gradient(${dark.headerBg},${dark.headerBg}) !important; }
    [data-ogsc] .header { background-color: ${dark.headerBg} !important; background: ${dark.headerBg} !important; background-image: linear-gradient(${dark.headerBg},${dark.headerBg}) !important; }

    /* Meta: background + border in Outlook Dark Mode */
    [data-ogsb] .meta { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .meta { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsb] table.meta { border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] table.meta { border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsb] .meta-label { border-bottom: 1px solid ${dark.borderDivider} !important; color: ${dark.textMuted} !important; }
    [data-ogsc] .meta-label { border-bottom: 1px solid ${dark.borderDivider} !important; color: ${dark.textMuted} !important; }
    [data-ogsb] .meta-value { border-bottom: 1px solid ${dark.borderDivider} !important; color: #f8fafc !important; }
    [data-ogsc] .meta-value { border-bottom: 1px solid ${dark.borderDivider} !important; color: #f8fafc !important; }
    [data-ogsb] tr.meta-row > td { border-bottom: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] tr.meta-row > td { border-bottom: 1px solid ${dark.borderDivider} !important; }
    [data-ogsb] .meta-row-last td, [data-ogsc] .meta-row-last td { border-bottom: none !important; }
    [data-ogsb] .meta table td { border: none !important; }
    [data-ogsc] .meta table td { border: none !important; }

    /* CTA: background + border in Outlook Dark Mode */
    [data-ogsb] .cta { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .cta { background-color: ${dark.cardBg} !important; background: ${dark.cardBg} !important; background-image: linear-gradient(${dark.cardBg},${dark.cardBg}) !important; border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsb] div.cta { border-top: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] div.cta { border-top: 1px solid ${dark.borderDivider} !important; }

    /* CTA Button */
    [data-ogsb] .cta-btn-cell { background-color: ${dark.btnBg} !important; background-image: linear-gradient(${dark.btnBg},${dark.btnBg}) !important; }
    [data-ogsb] .cta-btn { background-color: ${dark.btnBg} !important; background-image: linear-gradient(${dark.btnBg},${dark.btnBg}) !important; }
    [data-ogsc] .cta-btn { background-color: ${dark.btnBg} !important; background-image: linear-gradient(${dark.btnBg},${dark.btnBg}) !important; }
    [data-ogsc] .cta-btn, [data-ogsc] a.cta-btn, [data-ogsc] a.cta-btn:visited,
    [data-ogsc] .cta-btn *, [data-ogsc] .cta-btn font, [data-ogsc] .cta-btn span,
    [data-ogsc] .cta-btn-text, [data-ogsc] .cta-btn-arrow, [data-ogsc] .cta-btn-font,
    [data-ogsc] font[color="#ffffff"] {
      color: ${dark.btnText} !important;
      text-decoration: none !important;
      border: none !important;
    }

    /* Typography in Outlook Dark Mode */
    [data-ogsc] .ticket-title { color: ${dark.textPrimary} !important; }
    [data-ogsc] .ticket-desc { color: ${dark.textSecondary} !important; }
    [data-ogsc] .breadcrumb { color: ${dark.textMuted} !important; }
    [data-ogsc] .breadcrumb-item { color: #38bdf8 !important; }
    [data-ogsc] .actor-text { color: ${dark.textMuted} !important; }
    [data-ogsc] .actor-text strong, [data-ogsb] .actor-text strong,
    [data-ogsc] .actor-name, [data-ogsb] .actor-name { color: ${dark.textPrimary} !important; }

    /* Avatars & Chips in Outlook Dark Mode */
    [data-ogsc] .avatar, [data-ogsc] .user-avatar-initials { color: ${dark.btnText} !important; }
    [data-ogsc] .user-name { color: #f8fafc !important; }

    /* Chips — scoped selectors to avoid hitting .chip-dot */
    [data-ogsb] .chip, [data-ogsc] .chip,
    [data-ogsb] td.chip-td, [data-ogsc] td.chip-td,
    [data-ogsb] table.chip, [data-ogsc] table.chip,
    [data-ogsb] span.chip, [data-ogsc] span.chip {
      background-color: ${dark.chipBg} !important;
      background: ${dark.chipBg} !important;
      background-image: linear-gradient(${dark.chipBg},${dark.chipBg}) !important;
      border-color: ${dark.chipBorder} !important;
      color: ${dark.chipText} !important;
      box-shadow: none !important;
    }
    [data-ogsb] .chip-muted, [data-ogsc] .chip-muted,
    [data-ogsb] td.chip-muted, [data-ogsc] td.chip-muted,
    [data-ogsb] span.chip-muted, [data-ogsc] span.chip-muted {
      background-color: ${dark.chipBg} !important;
      background: ${dark.chipBg} !important;
      background-image: linear-gradient(${dark.chipBg},${dark.chipBg}) !important;
      border-color: ${dark.chipBorder} !important;
      color: ${dark.textMuted} !important;
    }
    [data-ogsb] .chip-dot, [data-ogsc] .chip-dot { border: none !important; }
    [data-ogsb] .chip-date-alert, [data-ogsc] .chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
      background: transparent !important;
    }

    /* Code Box */
    [data-ogsb] .code-box { background-color: #070e1c !important; background: #070e1c !important; background-image: linear-gradient(#070e1c,#070e1c) !important; border: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .code-box { border: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .code-text { color: #38bdf8 !important; }

    /* Fallback Box */
    [data-ogsb] .fallback-box { background-color: #070e1c !important; background: #070e1c !important; background-image: linear-gradient(#070e1c,#070e1c) !important; border: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .fallback-box { border: 1px solid ${dark.borderDivider} !important; }
    [data-ogsc] .fallback-label { color: ${dark.textMuted} !important; }
    [data-ogsc] .fallback-url, [data-ogsc] .fallback-link { color: #38bdf8 !important; }
    [data-ogsc] .disclaimer-text { color: ${dark.textMuted} !important; }
    [data-ogsb] .callout-box { background-color: #070e1c !important; background: #070e1c !important; background-image: linear-gradient(#070e1c,#070e1c) !important; border-left: 4px solid #38bdf8 !important; }
    [data-ogsc] .callout-box { color: ${dark.textSecondary} !important; border-left-color: #38bdf8 !important; }
    [data-ogsc] .footer p { color: ${dark.textMuted} !important; }

    /* ════════════════════════════════════════════════════════════════════
       3. Preview Toolbar Dark/Light classes
       These are only used in the frontend web preview — not in real emails.
       They follow the same "color-only" rule: change border-color, not width/style.
    ════════════════════════════════════════════════════════════════════ */

    /* ── .dark preview class ── */
    body.dark, [data-theme="dark"] body, html.dark body {
      background: #030712 !important;
      color: ${dark.textPrimary} !important;
    }
    body.dark .outer-table, [data-theme="dark"] .outer-table, html.dark .outer-table {
      background: #030712 !important;
      background-color: #030712 !important;
    }
    body.dark .wrapper, [data-theme="dark"] .wrapper, html.dark .wrapper,
    body.dark .email-card, [data-theme="dark"] .email-card, html.dark .email-card {
      background: ${dark.cardBg} !important;
      background-color: ${dark.cardBg} !important;
      border-color: ${dark.cardBorder} !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
    }
    body.dark .header, [data-theme="dark"] .header, html.dark .header {
      background: ${dark.headerBg} !important;
      background-color: ${dark.headerBg} !important;
      background-image: linear-gradient(${dark.headerBg},${dark.headerBg}) !important;
    }
    body.dark .hero, [data-theme="dark"] .hero, html.dark .hero {
      background: ${dark.cardBg} !important;
      background-color: ${dark.cardBg} !important;
    }
    body.dark .meta, [data-theme="dark"] .meta, html.dark .meta {
      background: ${dark.cardBg} !important;
      background-color: ${dark.cardBg} !important;
      border-top: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .meta-label, [data-theme="dark"] .meta-label, html.dark .meta-label,
    body.dark .meta-value, [data-theme="dark"] .meta-value, html.dark .meta-value,
    body.dark tr.meta-row > td, [data-theme="dark"] tr.meta-row > td, html.dark tr.meta-row > td {
      border-bottom: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .meta-row-last td, [data-theme="dark"] .meta-row-last td, html.dark .meta-row-last td {
      border-bottom: none !important;
    }
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
    body.dark .cta, [data-theme="dark"] .cta, html.dark .cta {
      background: ${dark.cardBg} !important;
      background-color: ${dark.cardBg} !important;
      border-top: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .cta-btn-cell, [data-theme="dark"] .cta-btn-cell, html.dark .cta-btn-cell {
      background-color: ${dark.btnBg} !important;
      background-image: linear-gradient(${dark.btnBg},${dark.btnBg}) !important;
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
    body.dark .ticket-title, [data-theme="dark"] .ticket-title, html.dark .ticket-title { color: ${dark.textPrimary} !important; }
    body.dark .ticket-desc, [data-theme="dark"] .ticket-desc, html.dark .ticket-desc { color: ${dark.textSecondary} !important; }
    body.dark .breadcrumb, [data-theme="dark"] .breadcrumb { color: ${dark.textMuted} !important; }
    body.dark .breadcrumb-item, [data-theme="dark"] .breadcrumb-item { color: #38bdf8 !important; }
    body.dark .actor-text, [data-theme="dark"] .actor-text, html.dark .actor-text { color: ${dark.textMuted} !important; }
    body.dark .actor-text strong, [data-theme="dark"] .actor-text strong, html.dark .actor-text strong,
    body.dark .actor-name, [data-theme="dark"] .actor-name, html.dark .actor-name { color: ${dark.textPrimary} !important; }
    body.dark .avatar, [data-theme="dark"] .avatar, html.dark .avatar,
    body.dark .user-avatar-initials, [data-theme="dark"] .user-avatar-initials, html.dark .user-avatar-initials { color: ${dark.btnText} !important; }
    body.dark .user-name, [data-theme="dark"] .user-name, html.dark .user-name { color: #f8fafc !important; }
    body.dark .chip, [data-theme="dark"] .chip, html.dark .chip,
    body.dark td.chip-td, [data-theme="dark"] td.chip-td, html.dark td.chip-td,
    body.dark table.chip, [data-theme="dark"] table.chip, html.dark table.chip {
      background: ${dark.chipBg} !important;
      background-color: ${dark.chipBg} !important;
      background-image: linear-gradient(${dark.chipBg},${dark.chipBg}) !important;
      color: ${dark.chipText} !important;
      border-color: ${dark.chipBorder} !important;
      box-shadow: none !important;
    }
    body.dark .chip-muted, [data-theme="dark"] .chip-muted, html.dark .chip-muted,
    body.dark td.chip-muted, [data-theme="dark"] td.chip-muted, html.dark td.chip-muted {
      background: ${dark.chipBg} !important;
      background-color: ${dark.chipBg} !important;
      background-image: linear-gradient(${dark.chipBg},${dark.chipBg}) !important;
      color: ${dark.textMuted} !important;
    }
    body.dark .chip-dot, [data-theme="dark"] .chip-dot, html.dark .chip-dot { border: none !important; }
    body.dark .chip-date-alert, [data-theme="dark"] .chip-date-alert, html.dark .chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
      background: transparent !important;
    }
    body.dark .code-box, [data-theme="dark"] .code-box, html.dark .code-box {
      background: #070e1c !important;
      background-color: #070e1c !important;
      border: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .code-text, [data-theme="dark"] .code-text, html.dark .code-text { color: #38bdf8 !important; }
    body.dark .fallback-box, [data-theme="dark"] .fallback-box, html.dark .fallback-box {
      background: #070e1c !important;
      background-color: #070e1c !important;
      border: 1px solid ${dark.borderDivider} !important;
    }
    body.dark .fallback-label, [data-theme="dark"] .fallback-label, html.dark .fallback-label { color: ${dark.textMuted} !important; }
    body.dark .fallback-url, [data-theme="dark"] .fallback-url, html.dark .fallback-url,
    body.dark .fallback-link, [data-theme="dark"] .fallback-link, html.dark .fallback-link { color: #38bdf8 !important; }
    body.dark .disclaimer-text, [data-theme="dark"] .disclaimer-text, html.dark .disclaimer-text { color: ${dark.textMuted} !important; }
    body.dark .callout-box, [data-theme="dark"] .callout-box, html.dark .callout-box {
      background-color: #070e1c !important;
      background: #070e1c !important;
      border-left: 4px solid #38bdf8 !important;
      color: ${dark.textSecondary} !important;
    }
    body.dark .footer p, [data-theme="dark"] .footer p, html.dark .footer p { color: ${dark.textMuted} !important; }

    /* ── .light preview class ── */
    body.light, [data-theme="light"] body, html.light body {
      background: ${light.canvasBg} !important;
      color: ${light.textPrimary} !important;
    }
    body.light .outer-table, [data-theme="light"] .outer-table, html.light .outer-table {
      background: ${light.canvasBg} !important;
      background-color: ${light.canvasBg} !important;
    }
    body.light .wrapper, [data-theme="light"] .wrapper, html.light .wrapper,
    body.light .email-card, [data-theme="light"] .email-card, html.light .email-card {
      background: ${light.cardBg} !important;
      background-color: ${light.cardBg} !important;
      border-color: ${light.cardBorder} !important;
      box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06) !important;
    }
    body.light .header, [data-theme="light"] .header, html.light .header {
      background: ${light.headerBg} !important;
      background-color: ${light.headerBg} !important;
      background-image: linear-gradient(${light.headerBg},${light.headerBg}) !important;
    }
    body.light .hero, [data-theme="light"] .hero, html.light .hero {
      background: ${light.cardBg} !important;
      background-color: ${light.cardBg} !important;
    }
    body.light .meta, [data-theme="light"] .meta, html.light .meta {
      background: ${light.cardBg} !important;
      background-color: ${light.cardBg} !important;
      border-top-color: ${light.borderDivider} !important;
    }
    body.light .meta-label, [data-theme="light"] .meta-label, html.light .meta-label,
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value,
    body.light tr.meta-row > td, [data-theme="light"] tr.meta-row > td, html.light tr.meta-row > td {
      border-bottom-color: ${light.borderDivider} !important;
    }
    body.light .meta-row-last td, [data-theme="light"] .meta-row-last td, html.light .meta-row-last td {
      border-bottom: none !important;
    }
    body.light .meta table td, [data-theme="light"] .meta table td, html.light .meta table td {
      border: none !important;
      border-bottom: none !important;
    }
    body.light .meta-label, [data-theme="light"] .meta-label, html.light .meta-label { color: ${light.textMuted} !important; }
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value { color: ${light.textPrimary} !important; }
    body.light .cta, [data-theme="light"] .cta, html.light .cta {
      background: ${light.cardBg} !important;
      background-color: ${light.cardBg} !important;
      border-top-color: ${light.borderDivider} !important;
    }
    body.light .cta-btn-cell, [data-theme="light"] .cta-btn-cell, html.light .cta-btn-cell {
      background-color: ${light.btnBg} !important;
      background-image: linear-gradient(${light.btnBg},${light.btnBg}) !important;
    }
    body.light a.cta-btn, [data-theme="light"] a.cta-btn, html.light a.cta-btn,
    body.light .cta-btn, [data-theme="light"] .cta-btn, html.light .cta-btn,
    body.light .cta-btn *, [data-theme="light"] .cta-btn *, html.light .cta-btn *,
    body.light .cta-btn font, [data-theme="light"] .cta-btn font, html.light .cta-btn font,
    body.light .cta-btn-text, [data-theme="light"] .cta-btn-text, html.light .cta-btn-text,
    body.light .cta-btn-arrow, [data-theme="light"] .cta-btn-arrow, html.light .cta-btn-arrow,
    body.light .cta-btn-font, [data-theme="light"] .cta-btn-font, html.light .cta-btn-font {
      color: ${light.btnText} !important;
      text-decoration: none !important;
      border: none !important;
    }
    body.light .ticket-title, [data-theme="light"] .ticket-title, html.light .ticket-title { color: ${light.textPrimary} !important; }
    body.light .ticket-desc, [data-theme="light"] .ticket-desc, html.light .ticket-desc { color: ${light.textSecondary} !important; }
    body.light .breadcrumb, [data-theme="light"] .breadcrumb { color: ${light.textMuted} !important; }
    body.light .breadcrumb-item, [data-theme="light"] .breadcrumb-item { color: #0284c7 !important; }
    body.light .actor-text, [data-theme="light"] .actor-text, html.light .actor-text { color: ${light.textMuted} !important; }
    body.light .actor-text strong, [data-theme="light"] .actor-text strong, html.light .actor-text strong,
    body.light .actor-name, [data-theme="light"] .actor-name, html.light .actor-name { color: ${light.textPrimary} !important; }
    body.light .avatar, [data-theme="light"] .avatar, html.light .avatar,
    body.light .user-avatar-initials, [data-theme="light"] .user-avatar-initials, html.light .user-avatar-initials { color: ${light.btnText} !important; }
    body.light .user-name, [data-theme="light"] .user-name, html.light .user-name { color: ${light.textPrimary} !important; }
    body.light .chip, [data-theme="light"] .chip, html.light .chip,
    body.light td.chip-td, [data-theme="light"] td.chip-td, html.light td.chip-td,
    body.light table.chip, [data-theme="light"] table.chip, html.light table.chip {
      background: ${light.chipBg} !important;
      background-color: ${light.chipBg} !important;
      color: ${light.chipText} !important;
      border-color: #cbd5e1 !important;
    }
    body.light .chip-muted, [data-theme="light"] .chip-muted, html.light .chip-muted,
    body.light td.chip-muted, [data-theme="light"] td.chip-muted, html.light td.chip-muted {
      background: #f1f5f9 !important;
      background-color: #f1f5f9 !important;
      color: ${light.textMuted} !important;
    }
    body.light .chip-dot, [data-theme="light"] .chip-dot, html.light .chip-dot { border: none !important; }
    body.light .chip-date-alert, [data-theme="light"] .chip-date-alert, html.light .chip-date-alert {
      border-color: #ef4444 !important;
      color: ${light.textPrimary} !important;
      background: transparent !important;
    }
    body.light .code-box, [data-theme="light"] .code-box, html.light .code-box {
      background: #f8fafc !important;
      background-color: #f8fafc !important;
      border: 1px solid rgba(0,0,0,0.08) !important;
    }
    body.light .code-text, [data-theme="light"] .code-text, html.light .code-text { color: ${light.textPrimary} !important; }
    body.light .fallback-box, [data-theme="light"] .fallback-box, html.light .fallback-box {
      background: #f8fafc !important;
      background-color: #f8fafc !important;
      border: 1px solid rgba(0,0,0,0.08) !important;
    }
    body.light .fallback-label, [data-theme="light"] .fallback-label, html.light .fallback-label { color: ${light.textMuted} !important; }
    body.light .fallback-url, [data-theme="light"] .fallback-url, html.light .fallback-url,
    body.light .fallback-link, [data-theme="light"] .fallback-link, html.light .fallback-link { color: #0284c7 !important; }
    body.light .disclaimer-text, [data-theme="light"] .disclaimer-text, html.light .disclaimer-text { color: ${light.textMuted} !important; }
    body.light .callout-box, [data-theme="light"] .callout-box, html.light .callout-box {
      background-color: #f8fafc !important;
      border-left: 4px solid #0ea5e9 !important;
      color: ${light.textSecondary} !important;
    }
    body.light .footer p, [data-theme="light"] .footer p, html.light .footer p { color: #94a3b8 !important; }
  `;
}
