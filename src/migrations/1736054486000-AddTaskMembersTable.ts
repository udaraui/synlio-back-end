import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class AddTaskMembersTable1736054486000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_members junction table
    await queryRunner.createTable(
      new Table({
        name: 'task_members',
        columns: [
          {
            name: 'taskId',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'resourceId',
            type: 'int',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    // Add foreign key to task table
    await queryRunner.createForeignKey(
      'task_members',
      new TableForeignKey({
        columnNames: ['taskId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'task',
        onDelete: 'CASCADE',
      }),
    );

    // Add foreign key to resource table
    await queryRunner.createForeignKey(
      'task_members',
      new TableForeignKey({
        columnNames: ['resourceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'resource',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const table = await queryRunner.getTable('task_members');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('task_members', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('task_members');
  }
}
