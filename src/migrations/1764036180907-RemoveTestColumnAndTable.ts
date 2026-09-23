import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTestColumnAndTable1764036180907
  implements MigrationInterface
{
  name = 'RemoveTestColumnAndTable1764036180907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist before dropping them
    const resourcePoolTable = await queryRunner.getTable('resource_pool');
    if (resourcePoolTable) {
      if (resourcePoolTable.findColumnByName('test')) {
        await queryRunner.query(
          `ALTER TABLE "resource_pool" DROP COLUMN "test"`,
        );
      }
      if (resourcePoolTable.findColumnByName('nullableTestColumn')) {
        await queryRunner.query(
          `ALTER TABLE "resource_pool" DROP COLUMN "nullableTestColumn"`,
        );
      }
    }

    const projectGroupTable = await queryRunner.getTable('project_group');
    if (projectGroupTable && projectGroupTable.findColumnByName('test_two')) {
      await queryRunner.query(
        `ALTER TABLE "project_group" DROP COLUMN "test_two"`,
      );
    }

    // Add foreign key constraint (check if it doesn't already exist)
    const roleTable = await queryRunner.getTable('role');
    if (roleTable) {
      const fkExists = roleTable.foreignKeys.find(
        (fk) => fk.name === 'FK_6d29d31feb24503b868472091bc',
      );
      if (!fkExists) {
        await queryRunner.query(
          `ALTER TABLE "role" ADD CONSTRAINT "FK_6d29d31feb24503b868472091bc" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role" DROP CONSTRAINT "FK_6d29d31feb24503b868472091bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" ADD "test_two" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" ADD "nullableTestColumn" character varying(50) DEFAULT 'A'`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" ADD "test" character varying(50) DEFAULT 'T'`,
    );
  }
}
