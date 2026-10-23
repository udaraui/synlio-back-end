import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes `company.company_code` unique.
 *
 * Existing duplicates (compared case-insensitively) are resolved first: the oldest
 * company keeps its code, every other company gets a new unique 5-letter code derived
 * from its name. Then the unique index is created.
 */
export class MakeCompanyCodeUnique1792100000000 implements MigrationInterface {
  name = 'MakeCompanyCodeUnique1792100000000';

  private static readonly ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  private baseCode(name: string): string {
    const letters = (name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    return letters.slice(0, 5).padEnd(5, 'X');
  }

  private nextCode(name: string, used: Set<string>): string {
    const alphabet = MakeCompanyCodeUnique1792100000000.ALPHABET;
    const base = this.baseCode(name);
    if (!used.has(base)) return base;

    for (let tail = 1; tail <= 3; tail++) {
      const head = base.slice(0, 5 - tail);
      const total = Math.pow(alphabet.length, tail);
      for (let i = 0; i < total; i++) {
        let n = i;
        let combo = '';
        for (let c = 0; c < tail; c++) {
          combo = alphabet[n % alphabet.length] + combo;
          n = Math.floor(n / alphabet.length);
        }
        const candidate = head + combo;
        if (!used.has(candidate)) return candidate;
      }
    }

    for (let attempt = 0; attempt < 1000; attempt++) {
      let candidate = '';
      for (let i = 0; i < 5; i++) {
        candidate += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      if (!used.has(candidate)) return candidate;
    }
    throw new Error('Unable to generate a unique company code');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const companies: { id: number; company: string; company_code: string | null }[] =
      await queryRunner.query(
        `SELECT "id", "company", "company_code" FROM "company" ORDER BY "id" ASC`,
      );

    const used = new Set<string>();
    const needsNewCode: typeof companies = [];

    for (const c of companies) {
      const key = (c.company_code ?? '').trim().toUpperCase();
      if (!key || used.has(key)) {
        needsNewCode.push(c);
      } else {
        used.add(key);
      }
    }

    for (const c of needsNewCode) {
      const code = this.nextCode(c.company, used);
      used.add(code);
      await queryRunner.query(
        `UPDATE "company" SET "company_code" = $1 WHERE "id" = $2`,
        [code, c.id],
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_company_company_code" ON "company" ("company_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_company_company_code"`);
  }
}
