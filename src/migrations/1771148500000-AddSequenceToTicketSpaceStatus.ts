import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSequenceToTicketSpaceStatus1771148500000
  implements MigrationInterface
{
  name = 'AddSequenceToTicketSpaceStatus1771148500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" ADD "sequence" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" DROP COLUMN "sequence"`,
    );
  }
}
