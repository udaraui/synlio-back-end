import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UpdateCompanyIdIndex1785500000000 implements MigrationInterface {
  name = 'UpdateCompanyIdIndex1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------
    // TASK_SPACE
    // ---------------------------------------------------
    // Drop old index
    await queryRunner.dropIndex('task_space', 'IDX_TASK_SPACE_COMPANY_ID');

    // Create new composite index (id + companyId)
    await queryRunner.createIndex(
      'task_space',
      new TableIndex({
        name: 'IDX_TASK_SPACE_ID_COMPANY_ID',
        columnNames: ['id', 'companyId'],
      })
    );

    // ---------------------------------------------------
    // TICKET_SPACE
    // ---------------------------------------------------
    // Drop old index
    await queryRunner.dropIndex('ticket_space', 'IDX_TICKET_SPACE_COMPANY_ID');

    // Create new composite index (id + companyId)
    await queryRunner.createIndex(
      'ticket_space',
      new TableIndex({
        name: 'IDX_TICKET_SPACE_ID_COMPANY_ID',
        columnNames: ['id', 'companyId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TICKET_SPACE
    await queryRunner.dropIndex('ticket_space', 'IDX_TICKET_SPACE_ID_COMPANY_ID');
    
    // Recreate old index
    await queryRunner.createIndex(
      'ticket_space',
      new TableIndex({
        name: 'IDX_TICKET_SPACE_COMPANY_ID',
        columnNames: ['companyId'],
      })
    );

    // TASK_SPACE
    await queryRunner.dropIndex('task_space', 'IDX_TASK_SPACE_ID_COMPANY_ID');
    
    // Recreate old index
    await queryRunner.createIndex(
      'task_space',
      new TableIndex({
        name: 'IDX_TASK_SPACE_COMPANY_ID',
        columnNames: ['companyId'],
      })
    );
  }
}
