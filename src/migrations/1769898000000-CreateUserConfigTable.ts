import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserConfigTable1769898000000 implements MigrationInterface {
  name = 'CreateUserConfigTable1769898000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_config" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "userId" integer NOT NULL,
        "theme" character varying DEFAULT 'system',
        "viewPreference" jsonb,
        CONSTRAINT "PK_user_config_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_config_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_config_userId" FOREIGN KEY ("userId") 
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_user_config_userId" ON "user_config" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_config_userId"`);
    await queryRunner.query(`DROP TABLE "user_config"`);
  }
}
