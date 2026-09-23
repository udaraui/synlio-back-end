import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTaskDenormalizedColumns1737552916000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Task Space denormalized columns
    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'taskSpaceName',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'taskSpacePrefix',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    // Status denormalized columns
    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'statusName',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'statusColor',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'statusBase',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    // Severity denormalized columns
    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'severityName',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'severityColor',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    // Assignee denormalized columns
    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'assigneeName',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'assigneeProfilePicUrl',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tm_task',
      new TableColumn({
        name: 'assigneeEmail',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop assignee columns
    await queryRunner.dropColumn('tm_task', 'assigneeEmail');
    await queryRunner.dropColumn('tm_task', 'assigneeProfilePicUrl');
    await queryRunner.dropColumn('tm_task', 'assigneeName');

    // Drop severity columns
    await queryRunner.dropColumn('tm_task', 'severityColor');
    await queryRunner.dropColumn('tm_task', 'severityName');

    // Drop status columns
    await queryRunner.dropColumn('tm_task', 'statusBase');
    await queryRunner.dropColumn('tm_task', 'statusColor');
    await queryRunner.dropColumn('tm_task', 'statusName');

    // Drop task space columns
    await queryRunner.dropColumn('tm_task', 'taskSpacePrefix');
    await queryRunner.dropColumn('tm_task', 'taskSpaceName');
  }
}

