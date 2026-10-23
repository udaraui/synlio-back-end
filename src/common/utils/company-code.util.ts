import { EntityManager } from 'typeorm';

export const COMPANY_CODE_LENGTH = 5;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Number of trailing characters we are willing to vary before going random. */
const MAX_VARIABLE_TAIL = 3;

/**
 * Derives the preferred 5-letter code from a company name:
 * the first 5 letters (A-Z only, accents stripped), padded with "X" for short names.
 */
export function buildCompanyCodeBase(name: string): string {
  const letters = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return letters.slice(0, COMPANY_CODE_LENGTH).padEnd(COMPANY_CODE_LENGTH, 'X');
}

/** Yields every combination of `length` letters in alphabetical order. */
function* letterCombinations(length: number): Generator<string> {
  const total = Math.pow(ALPHABET.length, length);
  for (let i = 0; i < total; i++) {
    let n = i;
    let combo = '';
    for (let c = 0; c < length; c++) {
      combo = ALPHABET[n % ALPHABET.length] + combo;
      n = Math.floor(n / ALPHABET.length);
    }
    yield combo;
  }
}

/**
 * Ordered list of candidates related to the company name:
 * the base code first, then the same code with its last 1, 2 and 3 letters varied.
 */
function* companyCodeCandidates(name: string): Generator<string> {
  const base = buildCompanyCodeBase(name);
  yield base;
  for (let tail = 1; tail <= MAX_VARIABLE_TAIL; tail++) {
    const head = base.slice(0, COMPANY_CODE_LENGTH - tail);
    for (const combo of letterCombinations(tail)) {
      yield head + combo;
    }
  }
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < COMPANY_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Generates a 5-letter company code, derived from the company name, that does not
 * exist in the `company` table yet (compared case-insensitively).
 */
export async function generateUniqueCompanyCode(
  manager: EntityManager,
  name: string,
  excludeCompanyId?: number,
): Promise<string> {
  const base = buildCompanyCodeBase(name);
  const keep = base.slice(0, COMPANY_CODE_LENGTH - MAX_VARIABLE_TAIL);

  // One query covers every candidate that varies only the last MAX_VARIABLE_TAIL letters.
  const params: any[] = [`${keep}%`];
  let sql = `SELECT UPPER("company_code") AS "code" FROM "company" WHERE UPPER("company_code") LIKE $1`;
  if (excludeCompanyId) {
    sql += ` AND "id" <> $2`;
    params.push(excludeCompanyId);
  }
  const rows: { code: string }[] = await manager.query(sql, params);
  const taken = new Set(rows.map((r) => r.code));

  for (const candidate of companyCodeCandidates(name)) {
    if (!taken.has(candidate)) return candidate;
  }

  // Extremely crowded prefix: fall back to random codes checked against the DB.
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = randomCode();
    const exists = await manager.query(
      `SELECT 1 FROM "company" WHERE UPPER("company_code") = $1 LIMIT 1`,
      [candidate],
    );
    if (exists.length === 0) return candidate;
  }

  throw new Error('Unable to generate a unique company code');
}
