/**
 * Design tokens and brand assets for Synlio Email System.
 * Ensures strict cross-client visual fidelity across Light & Dark modes.
 */

export const EmailTokens = {
  fontFamily:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoFontFamily: "'DM Mono', SFMono-Regular, Consolas, monospace",

  // Light Mode Tokens (matches frontend Synlio theme)
  light: {
    canvasBg: '#f1f5f9',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    headerBg: '#0b1329',
    headerBorder: '#0b1329',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    borderDivider: '#e2e8f0',
    btnBg: '#0ea5e9',
    btnText: '#ffffff',
    chipBg: '#ffffff',
    chipBorder: '#e2e8f0',
    chipText: '#334155',
  },

  // Dark Mode Tokens (matches pure-black high-contrast Synlio dark theme)
  dark: {
    canvasBg: 'transparent',
    cardBg: '#000000',
    cardBorder: '#172036',
    headerBg: '#050b17',
    headerBorder: '#1e2d4d',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    borderDivider: '#111a2e',
    btnBg: '#0ea5e9',
    btnText: '#ffffff',
    chipBg: '#091322',
    chipBorder: '#1e2d4d',
    chipText: '#e2e8f0',
  },
};

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
    // Fallback to plain url if signing fails
  }

  return envUrl;
}

export const SYNLIO_LOGO_URL = getSynlioLogoUrl();
export const SYNLIO_LOGO_DATA_URI = getSynlioLogoUrl();
