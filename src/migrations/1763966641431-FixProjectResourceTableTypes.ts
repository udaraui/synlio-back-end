import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixProjectResourceTableTypes1763966641431
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the project and resource tables exist
    const projectTableExists = await queryRunner.hasTable('project');
    const resourceTableExists = await queryRunner.hasTable('resource');

    // Only proceed if both tables exist
    if (!projectTableExists || !resourceTableExists) {
      console.log(
        'Skipping FixProjectResourceTableTypes migration - required tables do not exist yet',
      );
      return;
    }

    // Drop the existing table and recreate it with correct integer types
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_resource_resources" CASCADE`,
    );

    await queryRunner.query(`
            CREATE TABLE "project_resource_resources" (
                "projectId" integer NOT NULL,
                "resourceId" integer NOT NULL,
                CONSTRAINT "PK_project_resource_resources" PRIMARY KEY ("projectId", "resourceId")
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_2f1d38bb603681369ab79a2e39" ON "project_resource_resources" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92f5277b6fe7f46488e1669aa8" ON "project_resource_resources" ("resourceId")`,
    );

    await queryRunner.query(`
            ALTER TABLE "project_resource_resources" 
            ADD CONSTRAINT "FK_2f1d38bb603681369ab79a2e390" 
            FOREIGN KEY ("projectId") REFERENCES "project"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "project_resource_resources" 
            ADD CONSTRAINT "FK_92f5277b6fe7f46488e1669aa83" 
            FOREIGN KEY ("resourceId") REFERENCES "resource"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_resource_resources" CASCADE`,
    );
  }
}
