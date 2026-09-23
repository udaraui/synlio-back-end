import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddColorToNote1778500000000 implements MigrationInterface {
  name = 'AddColorToNote1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'note',
      new TableColumn({
        name: 'color',
        type: 'varchar',
        length: '50',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('note', 'color');
  }
}

