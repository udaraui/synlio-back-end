import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpaceAlertRule1777300000000 implements MigrationInterface {
  name = 'CreateSpaceAlertRule1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "space_alert_rule" (
        "id"                    SERIAL PRIMARY KEY,
        "name"                  VARCHAR(100) NOT NULL,
        "spaceType"             VARCHAR(10)  NOT NULL,
        "spaceId"               INT          NOT NULL,
        "events"                JSON         NOT NULL DEFAULT '[]',
        "channel"               VARCHAR(10)  NOT NULL,
        "toAssignee"            BOOLEAN NOT NULL DEFAULT FALSE,
        "toCoAssignees"         BOOLEAN NOT NULL DEFAULT FALSE,
        "toParticipants"        BOOLEAN NOT NULL DEFAULT FALSE,
        "toCreator"             BOOLEAN NOT NULL DEFAULT FALSE,
        "toActor"               BOOLEAN NOT NULL DEFAULT FALSE,
        "toAdditionalUserIds"   JSON    NOT NULL DEFAULT '[]',
        "ccAssignee"            BOOLEAN NOT NULL DEFAULT FALSE,
        "ccCoAssignees"         BOOLEAN NOT NULL DEFAULT FALSE,
        "ccParticipants"        BOOLEAN NOT NULL DEFAULT FALSE,
        "ccCreator"             BOOLEAN NOT NULL DEFAULT FALSE,
        "ccActor"               BOOLEAN NOT NULL DEFAULT FALSE,
        "ccAdditionalUserIds"   JSON    NOT NULL DEFAULT '[]',
        "isActive"              BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
        "createdBy"             VARCHAR(50),
        "updatedBy"             VARCHAR(50)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sar_space"
        ON "space_alert_rule" ("spaceType", "spaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_sar_active"
        ON "space_alert_rule" ("spaceType", "spaceId", "isActive")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sar_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sar_space"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "space_alert_rule"`);
  }
}
