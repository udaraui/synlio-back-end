import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveResourcePoolRelationFromProjectModule1764813769888
  implements MigrationInterface
{
  name = 'RemoveResourcePoolRelationFromProjectModule1764813769888';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints if they exist
    const projectTable = await queryRunner.getTable('project');
    if (projectTable) {
      const fk1 = projectTable.foreignKeys.find(
        (fk) => fk.name === 'FK_5b8d82d287edbc75ee70ae3f4d0',
      );
      if (fk1) {
        await queryRunner.query(
          `ALTER TABLE "project" DROP CONSTRAINT "FK_5b8d82d287edbc75ee70ae3f4d0"`,
        );
      }
    }

    const projectGroupTable = await queryRunner.getTable('project_group');
    if (projectGroupTable) {
      const fk2 = projectGroupTable.foreignKeys.find(
        (fk) => fk.name === 'FK_3caedf1cc7c4a2f78543e0400d9',
      );
      if (fk2) {
        await queryRunner.query(
          `ALTER TABLE "project_group" DROP CONSTRAINT "FK_3caedf1cc7c4a2f78543e0400d9"`,
        );
      }
    }

    // Drop test columns from resource_pool if they exist
    const resourcePoolTable = await queryRunner.getTable('resource_pool');
    if (resourcePoolTable) {
      if (resourcePoolTable.findColumnByName('test')) {
        await queryRunner.query(
          `ALTER TABLE "resource_pool" DROP COLUMN "test"`,
        );
      }
      if (resourcePoolTable.findColumnByName('nullableTestColumn')) {
        await queryRunner.query(
          `ALTER TABLE "resource_pool" DROP COLUMN "nullableTestColumn"`,
        );
      }
    }

    // Drop resourcePoolId columns if they exist (use CASCADE to drop dependent objects)
    if (projectTable && projectTable.findColumnByName('resourcePoolId')) {
      // Drop any remaining foreign keys on this column
      await queryRunner.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'project'::regclass AND contype = 'f' 
                              AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'project'::regclass AND attname = 'resourcePoolId'))
                    LOOP
                        EXECUTE 'ALTER TABLE project DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
                    END LOOP;
                END $$;
            `);
      await queryRunner.query(
        `ALTER TABLE "project" DROP COLUMN IF EXISTS "resourcePoolId" CASCADE`,
      );
    }

    if (
      projectGroupTable &&
      projectGroupTable.findColumnByName('resourcePoolId')
    ) {
      // Drop any remaining foreign keys on this column
      await queryRunner.query(`
                DO $$ 
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'project_group'::regclass AND contype = 'f' 
                              AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'project_group'::regclass AND attname = 'resourcePoolId'))
                    LOOP
                        EXECUTE 'ALTER TABLE project_group DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
                    END LOOP;
                END $$;
            `);
      await queryRunner.query(
        `ALTER TABLE "project_group" DROP COLUMN IF EXISTS "resourcePoolId" CASCADE`,
      );
    }

    if (projectGroupTable && projectGroupTable.findColumnByName('test_two')) {
      await queryRunner.query(
        `ALTER TABLE "project_group" DROP COLUMN "test_two"`,
      );
    }

    // Skip project_resource_resources table modifications - already handled by FixProjectResourceTableTypes migration
    console.log(
      'Skipping project_resource_resources table modifications - already handled by earlier migration',
    );

    // Add role foreign key if it doesn't exist
    const roleTable = await queryRunner.getTable('role');
    if (roleTable) {
      const fkExists = roleTable.foreignKeys.find(
        (fk) => fk.name === 'FK_6d29d31feb24503b868472091bc',
      );
      if (!fkExists) {
        await queryRunner.query(
          `ALTER TABLE "role" ADD CONSTRAINT "FK_6d29d31feb24503b868472091bc" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "FK_92f5277b6fe7f46488e1669aa83"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "FK_2f1d38bb603681369ab79a2e390"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role" DROP CONSTRAINT "FK_6d29d31feb24503b868472091bc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_92f5277b6fe7f46488e1669aa8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f1d38bb603681369ab79a2e39"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "PK_1a4931e29da90ef315e257a57fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD CONSTRAINT "PK_2f1d38bb603681369ab79a2e390" PRIMARY KEY ("projectId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP COLUMN "resourceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD "resourceId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "PK_2f1d38bb603681369ab79a2e390"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD CONSTRAINT "PK_project_resource_resources" PRIMARY KEY ("resourceId", "projectId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "PK_project_resource_resources"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD CONSTRAINT "PK_project_resource_resources" PRIMARY KEY ("resourceId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP COLUMN "projectId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD "projectId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" DROP CONSTRAINT "PK_project_resource_resources"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_resource_resources" ADD CONSTRAINT "PK_project_resource_resources" PRIMARY KEY ("resourceId", "projectId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" ADD "test_two" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" ADD "resourcePoolId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "resourcePoolId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" ADD "nullableTestColumn" character varying(50) DEFAULT 'A'`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" ADD "test" character varying(50) DEFAULT 'T'`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" ADD CONSTRAINT "FK_3caedf1cc7c4a2f78543e0400d9" FOREIGN KEY ("resourcePoolId") REFERENCES "resource_pool"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_5b8d82d287edbc75ee70ae3f4d0" FOREIGN KEY ("resourcePoolId") REFERENCES "resource_pool"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
