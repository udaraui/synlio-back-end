import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWeekEndDayToCompany1782250100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'company',
      new TableColumn({
        name: 'weekEndDay',
        type: 'int',
        default: 5,
        isNullable: true,
        comment: '0 = Sunday, 1 = Monday, ... 5 = Friday, 6 = Saturday',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('company', 'weekEndDay');
  }
}
