import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkItemLinking1783500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── link_type ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "link_type" (
        "id"        SERIAL PRIMARY KEY,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" varchar(50),
        "updatedBy" varchar(50),
        "name"      varchar NOT NULL,
        "postType"  varchar(20) NOT NULL DEFAULT 'Task',
        "color"     varchar,
        "icon"      varchar,
        "isDefault" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_link_type_name_postType"
        ON "link_type" ("name", "postType")
    `);

    // ── work_item_link ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_link" (
        "id"         SERIAL PRIMARY KEY,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"  varchar(50),
        "updatedBy"  varchar(50),
        "sourceType" varchar(20) NOT NULL,
        "sourceId"   integer NOT NULL,
        "targetType" varchar(20) NOT NULL,
        "targetId"   integer NOT NULL,
        "linkTypeId" integer,
        "note"       text,
        "companyId"  integer,
        CONSTRAINT "FK_work_item_link_linkType"
          FOREIGN KEY ("linkTypeId") REFERENCES "link_type"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_item_link_source"
        ON "work_item_link" ("sourceType", "sourceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_item_link_target"
        ON "work_item_link" ("targetType", "targetId")
    `);

    // ── Seed default link types for both Task and Ticket ──────────────────
    const defaults = [
      { name: 'Blocks', isDefault: false },
      { name: 'Depends On', isDefault: false },
      { name: 'Relates To', isDefault: false },
      { name: 'Duplicates', isDefault: false },
      { name: 'Linked', isDefault: true },
    ];
    for (const postType of ['Task', 'Ticket']) {
      for (const d of defaults) {
        await queryRunner.query(
          `INSERT INTO "link_type" ("name", "postType", "isDefault", "createdBy")
           VALUES ($1, $2, $3, 'system')
           ON CONFLICT ("name", "postType") DO NOTHING`,
          [d.name, postType, d.isDefault],
        );
      }
    }

    // ── Drop the legacy task-to-task join table ───────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS "tm_task_linked_tasks"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_link"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "link_type"`);

    // Recreate the legacy join table (structure only) for rollback safety
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tm_task_linked_tasks" (
        "taskId"       integer NOT NULL,
        "linkedTaskId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_linked_tasks" PRIMARY KEY ("taskId", "linkedTaskId")
      )
    `);
  }
}
