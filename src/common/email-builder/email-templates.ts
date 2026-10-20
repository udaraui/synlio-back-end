import { withMsoIconFallback } from './email-components';

/**
 * Resolves the Synlio brand mark logo URL.
 * Reads the logo URL strictly from process.env.SYNLIO_LOGO_URL.
 * If the URL points to Azure Blob Storage without a SAS query token,
 * dynamically generates a valid read SAS token using AZURE_STORAGE_CONNECTION_KEY / AZURE_STORAGE_CONNECTION_STRING
 * from .env so that email clients and web previews can render it without being blocked by HTTP 409 PublicAccessNotPermitted.
 */
export function getSynlioLogoUrl(): string {
  const envUrl = process.env.SYNLIO_LOGO_URL || '';
  if (!envUrl) return '';

  // If already contains query params or is not an Azure blob URL, return as-is
  if (envUrl.includes('?') || !envUrl.includes('.blob.core.windows.net')) {
    return envUrl;
  }

  try {
    const key =
      process.env.AZURE_STORAGE_CONNECTION_KEY ||
      process.env.AZURE_STORAGE_CONNECTION_STRING?.match(/AccountKey=([^;]+)/)?.[1];

    const accountNameMatch = envUrl.match(/https:\/\/([^.]+)\.blob\.core\.windows\.net/);
    const accountName = accountNameMatch?.[1] || 'synlioblobstorage';

    if (key) {
      const {
        generateBlobSASQueryParameters,
        BlobSASPermissions,
        StorageSharedKeyCredential,
      } = require('@azure/storage-blob');

      const urlObj = new URL(envUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const containerName = pathParts[0] || 'synlio-logo';
      const blobName = pathParts.slice(1).join('/') || 'logo.png';

      const cred = new StorageSharedKeyCredential(accountName, key);
      const startsOn = new Date();
      startsOn.setMinutes(startsOn.getMinutes() - 15);
      const expiresOn = new Date();
      expiresOn.setFullYear(expiresOn.getFullYear() + 10);

      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'),
          startsOn,
          expiresOn,
        },
        cred,
      ).toString();

      return `${envUrl}?${sas}`;
    }
  } catch {
    // If auto-signing fails, fallback to clean envUrl
  }

  return envUrl;
}

export const SYNLIO_LOGO_URL = getSynlioLogoUrl();
export const SYNLIO_LOGO_DATA_URI = getSynlioLogoUrl();

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
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: #f1f5f9;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      padding: 32px 16px;
      margin: 0;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06);
      transition: all 0.2s ease;
    }

    /* ── Header: Synlio Deep Navy ── */
    .header {
      background: #0b1329;
      border-bottom: 1px solid #0b1329;
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
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    /* ── Hero / Content Shell ── */
    .hero {
      background: #ffffff;
      padding: 24px 32px 20px;
    }
    .breadcrumb {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      margin-bottom: 10px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .breadcrumb-item {
      color: #0284c7;
      font-weight: 600;
    }
    .ticket-title {
      font-size: 19px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.35;
      margin-bottom: 10px;
      letter-spacing: -0.01em;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .ticket-desc {
      font-size: 13.5px;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 14px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .actor-row {
      margin-top: 10px;
    }
    .actor-text {
      font-size: 13px;
      color: #64748b;
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.5;
    }
    .actor-text strong {
      color: #0f172a;
      font-weight: 600;
    }
    .avatar, .user-avatar-initials {
      display: inline-block;
      vertical-align: middle;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #0ea5e9;
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', sans-serif;
      text-align: center;
      line-height: 28px;
      object-fit: cover;
    }

    /* ── Meta Table Rows (divide-y matching Project/Ticket Card) ── */
    .meta {
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      border-collapse: collapse;
      width: 100%;
    }
    .meta-label,
    .meta-value {
      border-bottom: 1px solid #f1f5f9;
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
      color: #64748b;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 12px 16px 12px 32px;
      vertical-align: middle;
      text-align: left;
    }
    .meta-value {
      font-size: 13px;
      color: #0f172a;
      font-weight: 500;
      font-family: 'Plus Jakarta Sans', sans-serif;
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
      background: #ffffff;
      color: #334155;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      font-family: 'Plus Jakarta Sans', sans-serif;
      vertical-align: middle;
    }
    .chip-muted {
      opacity: 0.6;
      background: #f1f5f9;
      color: #64748b;
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

    /* Date Badges: RED BORDER & RED ICON ONLY IF OVERDUE */
    .chip-date-alert {
      border: 1px solid #ef4444 !important;
      color: #0f172a !important;
      background: transparent !important;
    }

    .user-name {
      color: #0f172a;
    }
    .co-count {
      color: #64748b;
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
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      padding: 24px 32px 28px;
      text-align: center;
    }
    .cta-btn {
      display: inline-block;
      background-color: #0ea5e9 !important;
      color: #ffffff !important;
      text-decoration: none !important;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 24px;
      border-radius: 6px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 1px 3px rgba(14,165,233,0.3);
      mso-padding-alt: 10px 24px;
      vertical-align: middle;
    }
    .cta-btn-text, .cta-btn-icon {
      color: #ffffff !important;
      vertical-align: middle;
      text-decoration: none !important;
    }
    .cta-btn svg, .cta-btn * {
      color: #ffffff !important;
      stroke: #ffffff !important;
    }
    .cta-sub {
      margin-top: 12px;
      font-size: 12px;
      color: #64748b;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    /* ── Auth Template Elements ── */
    .code-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 36px;
      text-align: center;
      display: inline-block;
    }
    .code-text {
      font-family: 'DM Mono', SFMono-Regular, Consolas, monospace;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 10px;
      color: #0f172a;
    }
    .fallback-box {
      border: 1px solid #e2e8f0;
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
      font-family: 'Plus Jakarta Sans', sans-serif;
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
      body, .outer-table {
        background: #030712 !important;
        background-color: #030712 !important;
        color: #f8fafc !important;
      }
      .wrapper, .email-card {
        background: #000000 !important;
        background-color: #000000 !important;
        border-color: #1e2d4d !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
      }
      .header {
        background: #050b17 !important;
        background-color: #050b17 !important;
        border-bottom: 1px solid #1e2d4d !important;
      }
      .hero {
        background: #000000 !important;
        background-color: #000000 !important;
      }
      .meta {
        background: #000000 !important;
        background-color: #000000 !important;
        border-top-color: #1e2d4d !important;
      }
      .meta-label, .meta-value {
        border-bottom-color: #1e2d4d !important;
      }
      .meta tr:last-child > td, .meta-row-last > td {
        border-bottom: none !important;
      }
      .meta table, .meta table tr, .meta table td {
        border: none !important;
        border-bottom: none !important;
      }
      .meta-label {
        color: #94a3b8 !important;
      }
      .meta-value {
        color: #f8fafc !important;
      }
      .ticket-title {
        color: #ffffff !important;
      }
      .ticket-desc {
        color: #cbd5e1 !important;
      }
      .breadcrumb {
        color: #94a3b8 !important;
      }
      .breadcrumb-item {
        color: #38bdf8 !important;
      }
      .actor-text {
        color: #94a3b8 !important;
      }
      .actor-text strong {
        color: #ffffff !important;
      }
      /* Dark mode: button text and icons must be black */
      .cta {
        background: #000000 !important;
        background-color: #000000 !important;
        border-top-color: #1e2d4d !important;
      }
      .cta-btn-cell {
        background-color: #0ea5e9 !important;
      }
      .cta-btn {
        background-color: #0ea5e9 !important;
        color: #000000 !important;
      }
      .cta-btn *, .cta-btn-text, .cta-btn-icon {
        color: #000000 !important;
        stroke: #000000 !important;
        text-decoration: none !important;
      }
      /* Dark mode: avatar initials must be black */
      .avatar, .user-avatar-initials {
        color: #000000 !important;
      }
      .user-name {
        color: #f8fafc !important;
      }
      .chip {
        background: #091322 !important;
        background-color: #091322 !important;
        color: #e2e8f0 !important;
        border-color: #1e2d4d !important;
        box-shadow: none !important;
      }
      .chip-muted {
        opacity: 0.6 !important;
        background: #091322 !important;
        background-color: #091322 !important;
        color: #64748b !important;
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
        border-color: #1e2d4d !important;
      }
      .code-text {
        color: #38bdf8 !important;
      }
      .fallback-box {
        background: #070e1c !important;
        background-color: #070e1c !important;
        border-color: #1e2d4d !important;
      }
      .fallback-label {
        color: #94a3b8 !important;
      }
      .fallback-url, .fallback-link {
        color: #38bdf8 !important;
      }
      .footer p {
        color: #64748b !important;
      }
    }

    /* ── Microsoft Outlook Web Dark Mode ([data-ogsc] / [data-ogsb]) ─── */
    [data-ogsc] body, [data-ogsb] body, [data-ogsb] .outer-table {
      background-color: #030712 !important;
      color: #f8fafc !important;
    }
    [data-ogsb] .wrapper, [data-ogsb] .email-card {
      background-color: #000000 !important;
    }
    [data-ogsc] .wrapper, [data-ogsc] .email-card {
      border-color: #1e2d4d !important;
    }
    [data-ogsb] .header {
      background-color: #050b17 !important;
    }
    [data-ogsc] .header {
      border-bottom-color: #1e2d4d !important;
    }
    [data-ogsb] .hero {
      background-color: #000000 !important;
    }
    [data-ogsb] .meta {
      background-color: #000000 !important;
    }
    [data-ogsc] .meta {
      border-top-color: #1e2d4d !important;
    }
    [data-ogsc] .meta-label, [data-ogsc] .meta-value {
      border-bottom-color: #1e2d4d !important;
    }
    [data-ogsc] .meta-label {
      color: #94a3b8 !important;
    }
    [data-ogsc] .meta-value {
      color: #f8fafc !important;
    }
    [data-ogsc] .ticket-title {
      color: #ffffff !important;
    }
    [data-ogsc] .ticket-desc {
      color: #cbd5e1 !important;
    }
    [data-ogsc] .breadcrumb {
      color: #94a3b8 !important;
    }
    [data-ogsc] .breadcrumb-item {
      color: #38bdf8 !important;
    }
    [data-ogsc] .actor-text {
      color: #94a3b8 !important;
    }
    [data-ogsc] .actor-text strong {
      color: #ffffff !important;
    }
    [data-ogsb] .cta {
      background-color: #000000 !important;
    }
    [data-ogsc] .cta {
      border-top-color: #1e2d4d !important;
    }
    [data-ogsb] .cta-btn-cell {
      background-color: #0ea5e9 !important;
    }
    [data-ogsb] .cta-btn {
      background-color: #0ea5e9 !important;
    }
    [data-ogsc] .cta-btn, [data-ogsc] .cta-btn-text, [data-ogsc] .cta-btn-icon {
      color: #000000 !important;
      text-decoration: none !important;
    }
    [data-ogsc] .cta-btn svg, [data-ogsc] .cta-btn path {
      stroke: #000000 !important;
    }
    [data-ogsc] .avatar, [data-ogsc] .user-avatar-initials {
      color: #000000 !important;
    }
    [data-ogsc] .user-name {
      color: #f8fafc !important;
    }
    [data-ogsb] .chip {
      background-color: #091322 !important;
    }
    [data-ogsc] .chip {
      color: #e2e8f0 !important;
      border-color: #1e2d4d !important;
    }
    [data-ogsb] .chip-muted {
      background-color: #091322 !important;
    }
    [data-ogsc] .chip-muted {
      color: #64748b !important;
    }
    [data-ogsc] .chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
    }
    [data-ogsb] .code-box {
      background-color: #070e1c !important;
    }
    [data-ogsc] .code-box {
      border-color: #1e2d4d !important;
    }
    [data-ogsc] .code-text {
      color: #38bdf8 !important;
    }
    [data-ogsb] .fallback-box {
      background-color: #070e1c !important;
    }
    [data-ogsc] .fallback-box {
      border-color: #1e2d4d !important;
    }
    [data-ogsc] .fallback-label {
      color: #94a3b8 !important;
    }
    [data-ogsc] .fallback-url, [data-ogsc] .fallback-link {
      color: #38bdf8 !important;
    }
    [data-ogsc] .footer p {
      color: #64748b !important;
    }

    /* ── Explicit .dark Styles (For Theme Switcher) ─────────────────────── */
    body.dark, [data-theme="dark"] body, html.dark body {
      background: #030712 !important;
      color: #f8fafc !important;
    }
    body.dark .outer-table, [data-theme="dark"] .outer-table, html.dark .outer-table {
      background: #030712 !important;
    }
    body.dark .wrapper, [data-theme="dark"] .wrapper, html.dark .wrapper {
      background: #000000 !important;
      border-color: #1e2d4d !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6) !important;
    }
    body.dark .header, [data-theme="dark"] .header, html.dark .header {
      background: #050b17 !important;
      border-bottom: 1px solid #1e2d4d !important;
    }
    body.dark .hero, [data-theme="dark"] .hero, html.dark .hero {
      background: #000000 !important;
    }
    body.dark .meta, [data-theme="dark"] .meta, html.dark .meta {
      background: #000000 !important;
      border-top-color: #1e2d4d !important;
    }
    body.dark .meta-label, [data-theme="dark"] .meta-label, html.dark .meta-label,
    body.dark .meta-value, [data-theme="dark"] .meta-value, html.dark .meta-value {
      border-bottom: 1px solid #1e2d4d !important;
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
      color: #94a3b8 !important;
    }
    body.dark .meta-value, [data-theme="dark"] .meta-value, html.dark .meta-value {
      color: #f8fafc !important;
    }
    body.dark .ticket-title, [data-theme="dark"] .ticket-title, html.dark .ticket-title {
      color: #ffffff !important;
    }
    body.dark .ticket-desc, [data-theme="dark"] .ticket-desc, html.dark .ticket-desc {
      color: #cbd5e1 !important;
    }
    body.dark .breadcrumb, [data-theme="dark"] .breadcrumb {
      color: #94a3b8 !important;
    }
    body.dark .breadcrumb-item, [data-theme="dark"] .breadcrumb-item {
      color: #38bdf8 !important;
    }
    body.dark .actor-text, [data-theme="dark"] .actor-text, html.dark .actor-text {
      color: #94a3b8 !important;
    }
    body.dark .actor-text strong, [data-theme="dark"] .actor-text strong, html.dark .actor-text strong {
      color: #ffffff !important;
    }
    /* Dark mode: button text and icons must be black */
    body.dark .cta, [data-theme="dark"] .cta, html.dark .cta {
      background: #000000 !important;
      border-top-color: #1e2d4d !important;
    }
    body.dark .cta-btn-cell, [data-theme="dark"] .cta-btn-cell, html.dark .cta-btn-cell {
      background-color: #0ea5e9 !important;
    }
    body.dark .cta-btn, [data-theme="dark"] .cta-btn, html.dark .cta-btn,
    body.dark .cta-btn *, [data-theme="dark"] .cta-btn *, html.dark .cta-btn *,
    body.dark .cta-btn-text, [data-theme="dark"] .cta-btn-text, html.dark .cta-btn-text,
    body.dark .cta-btn-icon, [data-theme="dark"] .cta-btn-icon, html.dark .cta-btn-icon {
      color: #000000 !important;
      stroke: #000000 !important;
      text-decoration: none !important;
    }
    /* Dark mode: avatar initials must be black */
    body.dark .avatar, [data-theme="dark"] .avatar, html.dark .avatar,
    body.dark .user-avatar-initials, [data-theme="dark"] .user-avatar-initials, html.dark .user-avatar-initials {
      color: #000000 !important;
    }
    body.dark .user-name, [data-theme="dark"] .user-name, html.dark .user-name {
      color: #f8fafc !important;
    }
    body.dark .chip, [data-theme="dark"] .chip, html.dark .chip {
      background: #091322 !important;
      color: #e2e8f0 !important;
      border-color: #1e2d4d !important;
      box-shadow: none !important;
    }
    body.dark .chip-muted, [data-theme="dark"] .chip-muted, html.dark .chip-muted {
      opacity: 0.6 !important;
      background: #091322 !important;
      color: #64748b !important;
    }
    body.dark .chip-date-alert, [data-theme="dark"] .chip-date-alert, html.dark .chip-date-alert {
      border-color: #ef4444 !important;
      color: #f8fafc !important;
      background: transparent !important;
    }
    body.dark .code-box, [data-theme="dark"] .code-box, html.dark .code-box {
      background: #070e1c !important;
      border-color: #1e2d4d !important;
    }
    body.dark .code-text, [data-theme="dark"] .code-text, html.dark .code-text {
      color: #38bdf8 !important;
    }
    body.dark .fallback-box, [data-theme="dark"] .fallback-box, html.dark .fallback-box {
      background: #070e1c !important;
      border-color: #1e2d4d !important;
    }
    body.dark .fallback-label, [data-theme="dark"] .fallback-label, html.dark .fallback-label {
      color: #94a3b8 !important;
    }
    body.dark .fallback-url, [data-theme="dark"] .fallback-url, html.dark .fallback-url,
    body.dark .fallback-link, [data-theme="dark"] .fallback-link, html.dark .fallback-link {
      color: #38bdf8 !important;
    }
    body.dark .footer p, [data-theme="dark"] .footer p, html.dark .footer p {
      color: #64748b !important;
    }

    /* ── Explicit .light Styles (For Theme Switcher) ────────────────────── */
    body.light, [data-theme="light"] body, html.light body {
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }
    body.light .outer-table, [data-theme="light"] .outer-table, html.light .outer-table {
      background: #f1f5f9 !important;
    }
    body.light .wrapper, [data-theme="light"] .wrapper, html.light .wrapper {
      background: #ffffff !important;
      border-color: #e2e8f0 !important;
      box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06) !important;
    }
    body.light .header, [data-theme="light"] .header, html.light .header {
      background: #0b1329 !important;
      border-bottom: 1px solid #0b1329 !important;
    }
    body.light .hero, [data-theme="light"] .hero, html.light .hero {
      background: #ffffff !important;
    }
    body.light .meta, [data-theme="light"] .meta, html.light .meta {
      background: #ffffff !important;
      border-top-color: #f1f5f9 !important;
    }
    body.light .meta-label, [data-theme="light"] .meta-label, html.light .meta-label,
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value {
      border-bottom: 1px solid #f1f5f9 !important;
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
      color: #64748b !important;
    }
    body.light .meta-value, [data-theme="light"] .meta-value, html.light .meta-value {
      color: #0f172a !important;
    }
    body.light .ticket-title, [data-theme="light"] .ticket-title, html.light .ticket-title {
      color: #0f172a !important;
    }
    body.light .ticket-desc, [data-theme="light"] .ticket-desc, html.light .ticket-desc {
      color: #334155 !important;
    }
    body.light .breadcrumb, [data-theme="light"] .breadcrumb {
      color: #64748b !important;
    }
    body.light .breadcrumb-item, [data-theme="light"] .breadcrumb-item {
      color: #0284c7 !important;
    }
    body.light .actor-text, [data-theme="light"] .actor-text, html.light .actor-text {
      color: #64748b !important;
    }
    body.light .actor-text strong, [data-theme="light"] .actor-text strong, html.light .actor-text strong {
      color: #0f172a !important;
    }
    body.light .cta, [data-theme="light"] .cta, html.light .cta {
      background: #ffffff !important;
      border-top-color: #f1f5f9 !important;
    }
    body.light .cta-btn-cell, [data-theme="light"] .cta-btn-cell, html.light .cta-btn-cell {
      background-color: #0ea5e9 !important;
    }
    body.light .cta-btn, [data-theme="light"] .cta-btn, html.light .cta-btn,
    body.light .cta-btn *, [data-theme="light"] .cta-btn *, html.light .cta-btn * {
      color: #ffffff !important;
      stroke: #ffffff !important;
      text-decoration: none !important;
    }
    body.light .avatar, [data-theme="light"] .avatar, html.light .avatar,
    body.light .user-avatar-initials, [data-theme="light"] .user-avatar-initials, html.light .user-avatar-initials {
      color: #ffffff !important;
    }
    body.light .user-name, [data-theme="light"] .user-name, html.light .user-name {
      color: #0f172a !important;
    }
    body.light .chip, [data-theme="light"] .chip, html.light .chip {
      background: #ffffff !important;
      color: #334155 !important;
      border-color: #e2e8f0 !important;
    }
    body.light .chip-muted, [data-theme="light"] .chip-muted, html.light .chip-muted {
      opacity: 0.6 !important;
      background: #f1f5f9 !important;
    }
    body.light .chip-date-alert, [data-theme="light"] .chip-date-alert, html.light .chip-date-alert {
      border: 1px solid #ef4444 !important;
      color: #0f172a !important;
      background: transparent !important;
    }
    body.light .code-box, [data-theme="light"] .code-box, html.light .code-box {
      background: #f8fafc !important;
      border-color: #e2e8f0 !important;
    }
    body.light .code-text, [data-theme="light"] .code-text, html.light .code-text {
      color: #0f172a !important;
    }
    body.light .fallback-box, [data-theme="light"] .fallback-box, html.light .fallback-box {
      background: transparent !important;
      border-color: #e2e8f0 !important;
    }
    body.light .fallback-label, [data-theme="light"] .fallback-label, html.light .fallback-label {
      color: #64748b !important;
    }
    body.light .fallback-url, [data-theme="light"] .fallback-url, html.light .fallback-url,
    body.light .fallback-link, [data-theme="light"] .fallback-link, html.light .fallback-link {
      color: #0284c7 !important;
    }
    body.light .footer p, [data-theme="light"] .footer p, html.light .footer p {
      color: #94a3b8 !important;
    }
  </style>
</head>
<body bgcolor="#f1f5f9" style="margin:0;padding:32px 16px;background-color:#f1f5f9;color:#0f172a;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer centering table for email client canvas -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9" class="outer-table" style="background-color:#f1f5f9;width:100%;table-layout:fixed;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td align="center" valign="top" style="padding:0;">
        <!-- Card Container (max-width 600px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#ffffff" class="wrapper email-card" style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <!-- Header -->
          <tr>
            <td bgcolor="#0b1329" class="header" style="background-color:#0b1329;padding:18px 32px;border-bottom:1px solid #0b1329;">
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

    const sentence = actionSentence || `<strong style="color:#0f172a;font-weight:600;">${actorName}</strong> updated this project`;

    actorRowHtml = `
      <div class="actor-row" style="margin-top:10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td valign="middle" style="padding-right:10px;">${avatarHtml}</td>
            <td valign="middle"><div class="actor-text" style="font-size:13px;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;line-height:1.5;">${sentence}</div></td>
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
    const rowsHtml = metaRows.map((row, i) => {
      const isLast = i === metaRows.length - 1;
      const cls = isLast ? 'meta-row-last' : 'meta-row';
      const borderStyle = isLast ? 'border-bottom:none !important;' : 'border-bottom:1px solid #f1f5f9;';
      return `<tr class="${cls}"><td class="meta-label" width="120" valign="middle" style="width:120px;font-size:13px;font-weight:500;color:#64748b;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 16px 12px 32px;vertical-align:middle;text-align:left;${borderStyle}">${row.label}</td><td class="meta-value" valign="middle" style="font-size:13px;color:#0f172a;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;padding:12px 32px 12px 16px;vertical-align:middle;text-align:right;${borderStyle}">${row.valueHtml}</td></tr>`;
    }).join('');

    metaHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="meta" style="background-color:#ffffff;border-top:1px solid #f1f5f9;border-collapse:collapse;width:100%;mso-table-lspace:0pt;mso-table-rspace:0pt;">${rowsHtml}</table>`;
  }

  let ctaHtml = '';
  if (ctaUrl) {
    const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:4px;"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;
    const arrowUpRight = withMsoIconFallback(arrowSvg, '&#8599;', 'font-size:13px;vertical-align:middle;margin-left:4px;');

    ctaHtml = `
      <div class="cta" style="background-color:#ffffff;border-top:1px solid #f1f5f9;padding:24px 32px 28px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td align="center" bgcolor="#0ea5e9" class="cta-btn-cell" style="background-color:#0ea5e9;border-radius:6px;mso-padding-alt:10px 24px;">
              <a href="${ctaUrl}" target="_blank" class="cta-btn" style="display:inline-block;background-color:#0ea5e9;color:#ffffff !important;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:6px;text-decoration:none !important;line-height:1.4;-webkit-text-size-adjust:none;box-shadow:0 1px 3px rgba(14,165,233,0.3);">
                <span class="cta-btn-text" style="color:#ffffff !important;text-decoration:none !important;font-weight:600;">${ctaLabel}</span>&nbsp;<span class="cta-btn-icon" style="color:#ffffff !important;text-decoration:none !important;font-size:13px;vertical-align:middle;">${arrowUpRight}</span>
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
    <div class="hero" style="background-color:#ffffff;padding:24px 32px 20px;">
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
          <td class="code-box" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 36px;text-align:center;">
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

  const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:4px;"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;
  const arrowUpRight = withMsoIconFallback(arrowSvg, '&#8599;', 'font-size:13px;vertical-align:middle;margin-left:4px;');

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
          <td align="center" bgcolor="#0ea5e9" class="cta-btn-cell" style="background-color:#0ea5e9;border-radius:6px;mso-padding-alt:10px 24px;">
            <a href="${resetLink}" target="_blank" class="cta-btn" style="display:inline-block;background-color:#0ea5e9;color:#ffffff !important;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:600;padding:10px 24px;border-radius:6px;text-decoration:none !important;line-height:1.4;-webkit-text-size-adjust:none;box-shadow:0 1px 3px rgba(14,165,233,0.3);">
              <span class="cta-btn-text" style="color:#ffffff !important;text-decoration:none !important;font-weight:600;">Reset Password</span>&nbsp;<span class="cta-btn-icon" style="color:#ffffff !important;text-decoration:none !important;font-size:13px;vertical-align:middle;">${arrowUpRight}</span>
            </a>
          </td>
        </tr>
      </table>

      <!-- Fallback URL Card -->
      <div class="fallback-box" style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-top:24px;text-align:left;background-color:transparent;">
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
