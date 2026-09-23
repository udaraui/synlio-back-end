import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddCompanyIdToTaskSpace1785400000000 implements MigrationInterface {
  name = 'AddCompanyIdToTaskSpace1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------
    // TASK_SPACE
    // ---------------------------------------------------
    // Add Index (crucial for performance)
    await queryRunner.createIndex(
      'task_space',
      new TableIndex({
        name: 'IDX_TASK_SPACE_COMPANY_ID',
        columnNames: ['companyId'],
      })
    );

    // ---------------------------------------------------
    // TICKET_SPACE
    // ---------------------------------------------------
    // Add Index (crucial for performance)
    await queryRunner.createIndex(
      'ticket_space',
      new TableIndex({
        name: 'IDX_TICKET_SPACE_COMPANY_ID',
        columnNames: ['companyId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TICKET_SPACE
    await queryRunner.dropIndex('ticket_space', 'IDX_TICKET_SPACE_COMPANY_ID');

    // TASK_SPACE
    await queryRunner.dropIndex('task_space', 'IDX_TASK_SPACE_COMPANY_ID');
  }
}
