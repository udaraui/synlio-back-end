import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorFieldsToUserConfig1769899000000
  implements MigrationInterface
{
  name = 'AddColorFieldsToUserConfig1769899000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_config" 
       ADD COLUMN "primaryColor" character varying DEFAULT 'default'`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_config" 
       ADD COLUMN "sidebarColor" character varying DEFAULT 'default'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_config" DROP COLUMN "sidebarColor"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_config" DROP COLUMN "primaryColor"`,
    );
  }
}
