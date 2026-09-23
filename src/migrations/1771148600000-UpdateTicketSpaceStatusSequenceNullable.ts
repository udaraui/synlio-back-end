import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTicketSpaceStatusSequenceNullable1771148600000
  implements MigrationInterface
{
  name = 'UpdateTicketSpaceStatusSequenceNullable1771148600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" ALTER COLUMN "sequence" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" ALTER COLUMN "sequence" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" ALTER COLUMN "sequence" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_space_status" ALTER COLUMN "sequence" SET NOT NULL`,
    );
  }
}
