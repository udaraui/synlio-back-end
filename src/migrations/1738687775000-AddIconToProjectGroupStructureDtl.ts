import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIconToProjectGroupStructureDtl1738687775000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add icon column
    await queryRunner.addColumn(
      'project_group_structure_dtl',
      new TableColumn({
        name: 'icon',
        type: 'varchar',
        length: '100',
        isNullable: true,
        default: "'Folder'",
      }),
    );

    // Add iconColor column
    await queryRunner.addColumn(
      'project_group_structure_dtl',
      new TableColumn({
        name: 'iconColor',
        type: 'varchar',
        length: '50',
        isNullable: true,
        default: "'#6366f1'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove iconColor column
    await queryRunner.dropColumn('project_group_structure_dtl', 'iconColor');

    // Remove icon column
    await queryRunner.dropColumn('project_group_structure_dtl', 'icon');
  }
}
