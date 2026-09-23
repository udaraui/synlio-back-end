import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAssigneeSkillToTask1783400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'assigneeSkill',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tm_task', 'assigneeSkill');
  }
}
