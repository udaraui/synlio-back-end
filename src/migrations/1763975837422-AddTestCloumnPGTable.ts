import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTestCloumnPGTable1763975837422 implements MigrationInterface {
  name = 'AddTestCloumnPGTable1763975837422';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column doesn't exist before adding
    const projectGroupTable = await queryRunner.getTable('project_group');
    if (
      projectGroupTable &&
      !projectGroupTable.findColumnByName('test_three')
    ) {
      await queryRunner.query(
        `ALTER TABLE "project_group" ADD "test_three" integer`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_group" DROP COLUMN "test_three"`,
    );
  }
}
