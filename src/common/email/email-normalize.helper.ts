/**
 * Canonical form for storing and comparing user email addresses.
 *
 * Postgres string comparison is case-sensitive, so without normalization
 * "Mayura@gmail.com" and "mayura@gmail.com" pass the unique constraint as two
 * separate accounts. Every write path should store this form, and every lookup
 * should compare against it.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
