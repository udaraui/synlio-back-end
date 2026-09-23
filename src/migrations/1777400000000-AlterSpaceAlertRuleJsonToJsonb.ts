import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts the three JSON columns in space_alert_rule to JSONB.
 *
 * Why: TypeORM's `json` type can return the raw string value from the Node-
 * postgres driver in some versions, causing Array.isArray(r.events) to
 * return false and r.events.includes(event) to always return false.
 * JSONB is automatically parsed by pg and TypeORM to a native JS object/array.
 */
export class AlterSpaceAlertRuleJsonToJsonb1777400000000
  implements MigrationInterface
{
  name = 'AlterSpaceAlertRuleJsonToJsonb1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "space_alert_rule"
        ALTER COLUMN "events"              TYPE JSONB USING "events"::text::jsonb,
        ALTER COLUMN "toAdditionalUserIds" TYPE JSONB USING "toAdditionalUserIds"::text::jsonb,
        ALTER COLUMN "ccAdditionalUserIds" TYPE JSONB USING "ccAdditionalUserIds"::text::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "space_alert_rule"
        ALTER COLUMN "events"              TYPE JSON USING "events"::text::json,
        ALTER COLUMN "toAdditionalUserIds" TYPE JSON USING "toAdditionalUserIds"::text::json,
        ALTER COLUMN "ccAdditionalUserIds" TYPE JSON USING "ccAdditionalUserIds"::text::json
    `);
  }
}

