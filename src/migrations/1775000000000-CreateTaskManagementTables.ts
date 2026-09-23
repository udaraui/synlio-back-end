import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskManagementTables1775000000000
  implements MigrationInterface
{
  name = 'CreateTaskManagementTables1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================
    // 1. task_space_hierarchy_level
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "task_space_hierarchy_level" (
        "id"          SERIAL                    NOT NULL,
        "createdAt"   TIMESTAMP                 NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP                 NOT NULL DEFAULT now(),
        "createdBy"   character varying(50),
        "updatedBy"   character varying(50),
        "sequence"    integer                   NOT NULL,
        "name"        character varying(255)    NOT NULL,
        "icon"        character varying(100)             DEFAULT 'Folder',
        "color"       character varying(50)              DEFAULT '#6366f1',
        CONSTRAINT "PK_task_space_hierarchy_level" PRIMARY KEY ("id")
      )
    `);

    // =========================================================
    // 2. task_space
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "task_space" (
        "id"          SERIAL                 NOT NULL,
        "createdAt"   TIMESTAMP              NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP              NOT NULL DEFAULT now(),
        "createdBy"   character varying(50),
        "updatedBy"   character varying(50),
        "name"        character varying      NOT NULL,
        "prefix"      character varying      NOT NULL,
        "description" character varying,
        "companyId"   integer                NOT NULL,
        "divisionId"  integer,
        CONSTRAINT "PK_task_space" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_companyId"  ON "task_space" ("companyId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_divisionId" ON "task_space" ("divisionId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space"
        ADD CONSTRAINT "FK_task_space_company"
        FOREIGN KEY ("companyId") REFERENCES "company"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space"
        ADD CONSTRAINT "FK_task_space_division"
        FOREIGN KEY ("divisionId") REFERENCES "division"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // =========================================================
    // 3. task_space_hierarchy_level_map  (TaskSpace ↔ HierarchyLevel)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "task_space_hierarchy_level_map" (
        "taskSpaceId"      integer NOT NULL,
        "hierarchyLevelId" integer NOT NULL,
        CONSTRAINT "PK_task_space_hierarchy_level_map"
          PRIMARY KEY ("taskSpaceId", "hierarchyLevelId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ts_hl_map_taskSpaceId"
        ON "task_space_hierarchy_level_map" ("taskSpaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ts_hl_map_hierarchyLevelId"
        ON "task_space_hierarchy_level_map" ("hierarchyLevelId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_map"
        ADD CONSTRAINT "FK_ts_hl_map_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_map"
        ADD CONSTRAINT "FK_ts_hl_map_hierarchyLevel"
        FOREIGN KEY ("hierarchyLevelId") REFERENCES "task_space_hierarchy_level"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 4. task_space_owners  (TaskSpace ↔ User)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "task_space_owners" (
        "taskSpaceId" integer NOT NULL,
        "userId"      integer NOT NULL,
        CONSTRAINT "PK_task_space_owners" PRIMARY KEY ("taskSpaceId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_owners_taskSpaceId"
        ON "task_space_owners" ("taskSpaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_owners_userId"
        ON "task_space_owners" ("userId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space_owners"
        ADD CONSTRAINT "FK_task_space_owners_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_owners"
        ADD CONSTRAINT "FK_task_space_owners_user"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 5. task_space_resources  (TaskSpace ↔ Resource)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "task_space_resources" (
        "taskSpaceId" integer NOT NULL,
        "resourceId"  integer NOT NULL,
        CONSTRAINT "PK_task_space_resources" PRIMARY KEY ("taskSpaceId", "resourceId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_resources_taskSpaceId"
        ON "task_space_resources" ("taskSpaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_task_space_resources_resourceId"
        ON "task_space_resources" ("resourceId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space_resources"
        ADD CONSTRAINT "FK_task_space_resources_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_resources"
        ADD CONSTRAINT "FK_task_space_resources_resource"
        FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 6. tm_task
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task" (
        "id"                 SERIAL                  NOT NULL,
        "createdAt"          TIMESTAMP               NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP               NOT NULL DEFAULT now(),
        "createdBy"          character varying(50),
        "updatedBy"          character varying(50),
        "name"               character varying        NOT NULL,
        "description"        text,
        "special"            boolean                  NOT NULL DEFAULT false,
        "taskVersion"        integer                  NOT NULL DEFAULT 0,
        "progressPercentage" integer                  NOT NULL DEFAULT 0,
        "estimateEffort"     integer                  NOT NULL DEFAULT 0,
        "actualEffort"       integer                  NOT NULL DEFAULT 0,
        "startDate"          date,
        "dueDate"            date,
        "completionDate"     date,
        "actualStartDate"    date,
        "actualEndDate"      date,
        "companyId"          integer,
        "divisionId"         integer,
        "taskSpaceId"        integer                  NOT NULL,
        "statusId"           integer,
        "severityId"         integer,
        "parentTaskId"       integer,
        "assigneeId"         integer,
        CONSTRAINT "PK_tm_task" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_taskSpaceId"  ON "tm_task" ("taskSpaceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_statusId"     ON "tm_task" ("statusId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_severityId"   ON "tm_task" ("severityId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_parentTaskId" ON "tm_task" ("parentTaskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_assigneeId"   ON "tm_task" ("assigneeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_companyId"    ON "tm_task" ("companyId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_status"
        FOREIGN KEY ("statusId") REFERENCES "status"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_severity"
        FOREIGN KEY ("severityId") REFERENCES "severity"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_parentTask"
        FOREIGN KEY ("parentTaskId") REFERENCES "tm_task"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_assignee"
        FOREIGN KEY ("assigneeId") REFERENCES "resource"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // =========================================================
    // 7. tm_task_linked_tasks  (Task ↔ Task self-ref)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_linked_tasks" (
        "taskId"       integer NOT NULL,
        "linkedTaskId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_linked_tasks" PRIMARY KEY ("taskId", "linkedTaskId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_linked_taskId"       ON "tm_task_linked_tasks" ("taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_linked_linkedTaskId"  ON "tm_task_linked_tasks" ("linkedTaskId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_linked_tasks"
        ADD CONSTRAINT "FK_tm_task_linked_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task_linked_tasks"
        ADD CONSTRAINT "FK_tm_task_linked_linkedTask"
        FOREIGN KEY ("linkedTaskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 8. tm_task_co_assignees  (Task ↔ Resource)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_co_assignees" (
        "taskId"     integer NOT NULL,
        "resourceId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_co_assignees" PRIMARY KEY ("taskId", "resourceId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_co_assignees_taskId"     ON "tm_task_co_assignees" ("taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_co_assignees_resourceId"  ON "tm_task_co_assignees" ("resourceId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_co_assignees"
        ADD CONSTRAINT "FK_tm_task_co_assignees_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task_co_assignees"
        ADD CONSTRAINT "FK_tm_task_co_assignees_resource"
        FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 9. tm_task_members  (Task ↔ Resource)
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_members" (
        "taskId"     integer NOT NULL,
        "resourceId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_members" PRIMARY KEY ("taskId", "resourceId")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_members_taskId"     ON "tm_task_members" ("taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_members_resourceId"  ON "tm_task_members" ("resourceId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_members"
        ADD CONSTRAINT "FK_tm_task_members_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task_members"
        ADD CONSTRAINT "FK_tm_task_members_resource"
        FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 10. tm_task_attachment
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_attachment" (
        "id"        SERIAL                  NOT NULL,
        "createdAt" TIMESTAMP               NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP               NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "link"      text                    NOT NULL,
        "fileName"  character varying,
        "taskId"    integer                 NOT NULL,
        CONSTRAINT "PK_tm_task_attachment" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_attachment_taskId" ON "tm_task_attachment" ("taskId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_attachment"
        ADD CONSTRAINT "FK_tm_task_attachment_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 11. tm_task_checklist_item
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_checklist_item" (
        "id"             SERIAL                 NOT NULL,
        "createdAt"      TIMESTAMP              NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP              NOT NULL DEFAULT now(),
        "createdBy"      character varying(50),
        "updatedBy"      character varying(50),
        "name"           character varying      NOT NULL,
        "isChecked"      boolean                NOT NULL DEFAULT false,
        "attachmentLink" text,
        "taskId"         integer                NOT NULL,
        CONSTRAINT "PK_tm_task_checklist_item" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_checklist_item_taskId" ON "tm_task_checklist_item" ("taskId")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_checklist_item"
        ADD CONSTRAINT "FK_tm_task_checklist_item_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // =========================================================
    // 12. tm_task_event
    // =========================================================
    await queryRunner.query(`
      CREATE TABLE "tm_task_event" (
        "id"         SERIAL                  NOT NULL,
        "createdAt"  TIMESTAMP               NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP               NOT NULL DEFAULT now(),
        "createdBy"  character varying(50),
        "updatedBy"  character varying(50),
        "eventType"  character varying       NOT NULL,
        "version"    integer                 NOT NULL DEFAULT 0,
        "actorId"    character varying,
        "payload"    jsonb                   NOT NULL DEFAULT '{}',
        "occurredAt" TIMESTAMP               NOT NULL DEFAULT now(),
        "taskId"     integer                 NOT NULL,
        CONSTRAINT "PK_tm_task_event" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tm_task_event_taskId"    ON "tm_task_event" ("taskId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tm_task_event_task_time" ON "tm_task_event" ("taskId", "occurredAt")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tm_task_event_task_version" ON "tm_task_event" ("taskId", "version")`);

    await queryRunner.query(`
      ALTER TABLE "tm_task_event"
        ADD CONSTRAINT "FK_tm_task_event_task"
        FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  // ─────────────────────────────────────────────────────────────────────────
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order

    // Child tables first
    await queryRunner.query(`ALTER TABLE "tm_task_event"             DROP CONSTRAINT "FK_tm_task_event_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_checklist_item"    DROP CONSTRAINT "FK_tm_task_checklist_item_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_attachment"        DROP CONSTRAINT "FK_tm_task_attachment_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_members"           DROP CONSTRAINT "FK_tm_task_members_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_members"           DROP CONSTRAINT "FK_tm_task_members_resource"`);
    await queryRunner.query(`ALTER TABLE "tm_task_co_assignees"      DROP CONSTRAINT "FK_tm_task_co_assignees_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_co_assignees"      DROP CONSTRAINT "FK_tm_task_co_assignees_resource"`);
    await queryRunner.query(`ALTER TABLE "tm_task_linked_tasks"      DROP CONSTRAINT "FK_tm_task_linked_task"`);
    await queryRunner.query(`ALTER TABLE "tm_task_linked_tasks"      DROP CONSTRAINT "FK_tm_task_linked_linkedTask"`);
    await queryRunner.query(`ALTER TABLE "tm_task"                   DROP CONSTRAINT "FK_tm_task_assignee"`);
    await queryRunner.query(`ALTER TABLE "tm_task"                   DROP CONSTRAINT "FK_tm_task_parentTask"`);
    await queryRunner.query(`ALTER TABLE "tm_task"                   DROP CONSTRAINT "FK_tm_task_severity"`);
    await queryRunner.query(`ALTER TABLE "tm_task"                   DROP CONSTRAINT "FK_tm_task_status"`);
    await queryRunner.query(`ALTER TABLE "tm_task"                   DROP CONSTRAINT "FK_tm_task_taskSpace"`);
    await queryRunner.query(`ALTER TABLE "task_space_resources"      DROP CONSTRAINT "FK_task_space_resources_taskSpace"`);
    await queryRunner.query(`ALTER TABLE "task_space_resources"      DROP CONSTRAINT "FK_task_space_resources_resource"`);
    await queryRunner.query(`ALTER TABLE "task_space_owners"         DROP CONSTRAINT "FK_task_space_owners_taskSpace"`);
    await queryRunner.query(`ALTER TABLE "task_space_owners"         DROP CONSTRAINT "FK_task_space_owners_user"`);
    await queryRunner.query(`ALTER TABLE "task_space_hierarchy_level_map" DROP CONSTRAINT "FK_ts_hl_map_taskSpace"`);
    await queryRunner.query(`ALTER TABLE "task_space_hierarchy_level_map" DROP CONSTRAINT "FK_ts_hl_map_hierarchyLevel"`);
    await queryRunner.query(`ALTER TABLE "task_space"                DROP CONSTRAINT "FK_task_space_division"`);
    await queryRunner.query(`ALTER TABLE "task_space"                DROP CONSTRAINT "FK_task_space_company"`);

    await queryRunner.query(`DROP TABLE "tm_task_event"`);
    await queryRunner.query(`DROP TABLE "tm_task_checklist_item"`);
    await queryRunner.query(`DROP TABLE "tm_task_attachment"`);
    await queryRunner.query(`DROP TABLE "tm_task_members"`);
    await queryRunner.query(`DROP TABLE "tm_task_co_assignees"`);
    await queryRunner.query(`DROP TABLE "tm_task_linked_tasks"`);
    await queryRunner.query(`DROP TABLE "tm_task"`);
    await queryRunner.query(`DROP TABLE "task_space_resources"`);
    await queryRunner.query(`DROP TABLE "task_space_owners"`);
    await queryRunner.query(`DROP TABLE "task_space_hierarchy_level_map"`);
    await queryRunner.query(`DROP TABLE "task_space"`);
    await queryRunner.query(`DROP TABLE "task_space_hierarchy_level"`);
  }
}

