import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserProfilePictureToTicketPermission1710072000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add userProfilePicture column to ticket_permission table
    await queryRunner.addColumn(
      'ticket_permission',
      new TableColumn({
        name: 'userProfilePicture',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Optionally: Populate existing records from user table
    await queryRunner.query(`
      UPDATE ticket_permission tp
      SET "userProfilePicture" = u.profile_picture
      FROM "user" u
      WHERE tp."userId" = u.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove userProfilePicture column
    await queryRunner.dropColumn('ticket_permission', 'userProfilePicture');
  }
}
