import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectGroupStructureAndRelations1737554400000
  implements MigrationInterface
{
  name = 'CreateProjectGroupStructureAndRelations1737554400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create project_group_structure_hdr table
    await queryRunner.query(`
      CREATE TABLE "project_group_structure_hdr" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "PK_project_group_structure_hdr" PRIMARY KEY ("id")
      )
    `);

    // Create project_group_structure_dtl table
    await queryRunner.query(`
      CREATE TABLE "project_group_structure_dtl" (
        "id" SERIAL NOT NULL,
        "sequence" integer NOT NULL,
        "name" character varying(255) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "PK_project_group_structure_dtl" PRIMARY KEY ("id")
      )
    `);

    // Create join table for hdr-dtl relationship (many-to-many)
    await queryRunner.query(`
      CREATE TABLE "project_group_structure_hdr_dtl" (
        "hdrId" integer NOT NULL,
        "dtlId" integer NOT NULL,
        CONSTRAINT "PK_project_group_structure_hdr_dtl" PRIMARY KEY ("hdrId", "dtlId")
      )
    `);

    // Create indexes for join table
    await queryRunner.query(`
      CREATE INDEX "IDX_project_group_structure_hdr_dtl_hdrId" 
      ON "project_group_structure_hdr_dtl" ("hdrId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_project_group_structure_hdr_dtl_dtlId" 
      ON "project_group_structure_hdr_dtl" ("dtlId")
    `);

    // Add foreign key constraints for hdr-dtl join table
    await queryRunner.query(`
      ALTER TABLE "project_group_structure_hdr_dtl" 
      ADD CONSTRAINT "FK_hdr_dtl_hdrId" 
      FOREIGN KEY ("hdrId") 
      REFERENCES "project_group_structure_hdr"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group_structure_hdr_dtl" 
      ADD CONSTRAINT "FK_hdr_dtl_dtlId" 
      FOREIGN KEY ("dtlId") 
      REFERENCES "project_group_structure_dtl"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
    `);

    // Add projectGroupStructureHdrId column to project_group table
    await queryRunner.query(`
      ALTER TABLE "project_group" 
      ADD COLUMN "projectGroupStructureHdrId" integer NULL
    `);

    // Add foreign key constraint from project_group to project_group_structure_hdr
    await queryRunner.query(`
      ALTER TABLE "project_group" 
      ADD CONSTRAINT "FK_project_group_structure_hdr" 
      FOREIGN KEY ("projectGroupStructureHdrId") 
      REFERENCES "project_group_structure_hdr"("id") 
      ON DELETE SET NULL 
      ON UPDATE CASCADE
    `);

    // Create join table for project_group and project_group_structure_dtl (many-to-many)
    await queryRunner.query(`
      CREATE TABLE "project_group_custom_structure" (
        "projectGroupId" integer NOT NULL,
        "dtlId" integer NOT NULL,
        CONSTRAINT "PK_project_group_custom_structure" PRIMARY KEY ("projectGroupId", "dtlId")
      )
    `);

    // Create indexes for project_group-dtl join table
    await queryRunner.query(`
      CREATE INDEX "IDX_project_group_custom_structure_projectGroupId" 
      ON "project_group_custom_structure" ("projectGroupId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_project_group_custom_structure_dtlId" 
      ON "project_group_custom_structure" ("dtlId")
    `);

    // Add foreign key constraints for project_group-dtl join table
    await queryRunner.query(`
      ALTER TABLE "project_group_custom_structure" 
      ADD CONSTRAINT "FK_project_group_custom_structure_projectGroupId" 
      FOREIGN KEY ("projectGroupId") 
      REFERENCES "project_group"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group_custom_structure" 
      ADD CONSTRAINT "FK_project_group_custom_structure_dtlId" 
      FOREIGN KEY ("dtlId") 
      REFERENCES "project_group_structure_dtl"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
    `);

    // Insert predefined structure data
    // Insert structure headers
    await queryRunner.query(`
      INSERT INTO "project_group_structure_hdr" ("id", "name", "status", "createdAt", "updatedAt", "createdBy", "updatedBy")
      VALUES 
        (1, 'Simple', 'active', NOW(), NOW(), 'system', 'system'),
        (2, 'Standard', 'active', NOW(), NOW(), 'system', 'system'),
        (3, 'Advanced', 'active', NOW(), NOW(), 'system', 'system'),
        (4, 'Enterprise', 'active', NOW(), NOW(), 'system', 'system')
    `);

    // Insert structure details
    await queryRunner.query(`
      INSERT INTO "project_group_structure_dtl" ("id", "sequence", "name", "status", "createdAt", "updatedAt", "createdBy", "updatedBy")
      VALUES 
        -- Simple structure
        (1, 1, 'Project', 'active', NOW(), NOW(), 'system', 'system'),
        (2, 2, 'Task', 'active', NOW(), NOW(), 'system', 'system'),
        -- Standard structure
        (3, 1, 'Project', 'active', NOW(), NOW(), 'system', 'system'),
        (4, 2, 'Task', 'active', NOW(), NOW(), 'system', 'system'),
        (5, 3, 'Sub-task', 'active', NOW(), NOW(), 'system', 'system'),
        -- Advanced structure
        (6, 1, 'Project', 'active', NOW(), NOW(), 'system', 'system'),
        (7, 2, 'Phase', 'active', NOW(), NOW(), 'system', 'system'),
        (8, 3, 'Task', 'active', NOW(), NOW(), 'system', 'system'),
        (9, 4, 'Sub-task', 'active', NOW(), NOW(), 'system', 'system'),
        -- Enterprise structure
        (10, 1, 'Initiative', 'active', NOW(), NOW(), 'system', 'system'),
        (11, 2, 'Program', 'active', NOW(), NOW(), 'system', 'system'),
        (12, 3, 'Work Item', 'active', NOW(), NOW(), 'system', 'system'),
        (13, 4, 'Action', 'active', NOW(), NOW(), 'system', 'system')
    `);

    // Link headers to their details
    await queryRunner.query(`
      INSERT INTO "project_group_structure_hdr_dtl" ("hdrId", "dtlId")
      VALUES 
        -- Simple structure
        (1, 1), (1, 2),
        -- Standard structure
        (2, 3), (2, 4), (2, 5),
        -- Advanced structure
        (3, 6), (3, 7), (3, 8), (3, 9),
        -- Enterprise structure
        (4, 10), (4, 11), (4, 12), (4, 13)
    `);

    // Update sequences for auto-increment
    await queryRunner.query(`
      SELECT setval('project_group_structure_hdr_id_seq', 4, true)
    `);

    await queryRunner.query(`
      SELECT setval('project_group_structure_dtl_id_seq', 13, true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(`
      ALTER TABLE "project_group_custom_structure" 
      DROP CONSTRAINT "FK_project_group_custom_structure_dtlId"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group_custom_structure" 
      DROP CONSTRAINT "FK_project_group_custom_structure_projectGroupId"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group" 
      DROP CONSTRAINT "FK_project_group_structure_hdr"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group_structure_hdr_dtl" 
      DROP CONSTRAINT "FK_hdr_dtl_dtlId"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_group_structure_hdr_dtl" 
      DROP CONSTRAINT "FK_hdr_dtl_hdrId"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_project_group_custom_structure_dtlId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_project_group_custom_structure_projectGroupId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_project_group_structure_hdr_dtl_dtlId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_project_group_structure_hdr_dtl_hdrId"
    `);

    // Drop join tables
    await queryRunner.query(`
      DROP TABLE "project_group_custom_structure"
    `);

    await queryRunner.query(`
      DROP TABLE "project_group_structure_hdr_dtl"
    `);

    // Drop column from project_group
    await queryRunner.query(`
      ALTER TABLE "project_group" 
      DROP COLUMN "projectGroupStructureHdrId"
    `);

    // Drop main tables
    await queryRunner.query(`
      DROP TABLE "project_group_structure_dtl"
    `);

    await queryRunner.query(`
      DROP TABLE "project_group_structure_hdr"
    `);
  }
}
