import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddActualDatesToTask1736397600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'task',
      new TableColumn({
        name: 'actualStartDate',
        type: 'date',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'task',
      new TableColumn({
        name: 'actualEndDate',
        type: 'date',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('task', 'actualEndDate');
    await queryRunner.dropColumn('task', 'actualStartDate');
  }
}
