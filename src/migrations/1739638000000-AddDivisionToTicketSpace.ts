import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDivisionToTicketSpace1739638000000
  implements MigrationInterface
{
  name = 'AddDivisionToTicketSpace1739638000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add divisionId column to ticket_space table
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD COLUMN "divisionId" integer NOT NULL DEFAULT 1
    `);

    // Create index on divisionId for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_divisionId" ON "ticket_space" ("divisionId")
    `);

    // Add foreign key constraint to division table
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD CONSTRAINT "FK_ticket_space_division"
      FOREIGN KEY ("divisionId")
      REFERENCES "division"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Remove the default value after adding the column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ALTER COLUMN "divisionId" DROP DEFAULT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      DROP CONSTRAINT "FK_ticket_space_division"
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX "IDX_ticket_space_divisionId"
    `);

    // Drop divisionId column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      DROP COLUMN "divisionId"
    `);
  }
}
