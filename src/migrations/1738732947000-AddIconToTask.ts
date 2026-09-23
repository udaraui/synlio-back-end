import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIconToTask1738732947000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hierarchyLevelIcon column
    await queryRunner.addColumn(
      'task',
      new TableColumn({
        name: 'hierarchyLevelIcon',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    // Add hierarchyLevelIconColor column
    await queryRunner.addColumn(
      'task',
      new TableColumn({
        name: 'hierarchyLevelIconColor',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove hierarchyLevelIconColor column
    await queryRunner.dropColumn('task', 'hierarchyLevelIconColor');

    // Remove hierarchyLevelIcon column
    await queryRunner.dropColumn('task', 'hierarchyLevelIcon');
  }
}
