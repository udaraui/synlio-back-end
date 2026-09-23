import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurrencyAndResourceCost1775400000000
  implements MigrationInterface
{
  name = 'CreateCurrencyAndResourceCost1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create currency master table ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "currency" (
        "id"          SERIAL PRIMARY KEY,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"   character varying(50),
        "updatedBy"   character varying(50),
        "code"        character varying NOT NULL UNIQUE,
        "name"        character varying NOT NULL,
        "symbol"      character varying,
        "isActive"    boolean NOT NULL DEFAULT true
      )
    `);

    // ── 2. Seed LKR, USD, EUR ─────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "currency" ("code", "name", "symbol", "isActive")
      VALUES
        ('LKR', 'Sri Lankan Rupee', 'Rs',  true),
        ('USD', 'US Dollar',        '$',   true),
        ('EUR', 'Euro',             '€',   true)
      ON CONFLICT ("code") DO NOTHING
    `);

    // ── 3. Create resource_cost table ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "resource_cost_rate_type_enum" AS ENUM ('per_day', 'per_hour')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_cost" (
        "id"          SERIAL PRIMARY KEY,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"   character varying(50),
        "updatedBy"   character varying(50),
        "resourceId"  integer NOT NULL UNIQUE,
        "cost"        numeric(15, 2) NOT NULL,
        "currencyId"  integer,
        "rate_type"   "resource_cost_rate_type_enum" NOT NULL DEFAULT 'per_day',
        CONSTRAINT "FK_resource_cost_resource"
          FOREIGN KEY ("resourceId")
          REFERENCES "resource" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_resource_cost_currency"
          FOREIGN KEY ("currencyId")
          REFERENCES "currency" ("id")
          ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop resource_cost first (it depends on currency)
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_cost"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resource_cost_rate_type_enum"`);

    // Drop currency table
    await queryRunner.query(`DROP TABLE IF EXISTS "currency"`);
  }
}
