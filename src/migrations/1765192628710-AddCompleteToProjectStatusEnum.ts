import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompleteToProjectStatusEnum1765192628710
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the enum value already exists
    const enumCheck = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'complete' 
                AND enumtypid = (
                    SELECT oid FROM pg_type WHERE typname = 'project_status_enum'
                )
            ) as exists
        `);

    if (enumCheck[0].exists) {
      console.log(
        'Enum value "complete" already exists in project_status_enum',
      );
      return;
    }

    console.log('Adding "complete" value to project_status_enum...');

    // Add the new enum value
    await queryRunner.query(`
            ALTER TYPE project_status_enum ADD VALUE 'complete'
        `);

    console.log(' Added "complete" to project_status_enum');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type if you want to remove a value
    console.log(
      'Cannot remove enum value in down migration - PostgreSQL limitation',
    );
  }
}
