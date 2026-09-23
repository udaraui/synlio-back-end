import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTestCloumnsFromPGTable1763975325062
  implements MigrationInterface
{
  name = 'RemoveTestCloumnsFromPGTable1763975325062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before dropping
    const projectGroupTable = await queryRunner.getTable('project_group');
    if (projectGroupTable && projectGroupTable.findColumnByName('test_two')) {
      await queryRunner.query(
        `ALTER TABLE "project_group" DROP COLUMN "test_two"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_group" ADD "test_two" integer`,
    );
  }
}
