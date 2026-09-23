import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentEntities1737000000000 implements MigrationInterface {
  name = 'CreateCommentEntities1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Comment table
    await queryRunner.query(`
            CREATE TABLE "comment" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdBy" character varying,
                "updatedBy" character varying,
                "parentId" integer,
                "comment" text NOT NULL,
                "postId" integer NOT NULL,
                "postType" character varying(10) NOT NULL,
                CONSTRAINT "PK_0b0e4bbc8415ec426f87f3a88e2" PRIMARY KEY ("id")
            )
        `);

    // Create index on postId and postType for better query performance
    await queryRunner.query(`
            CREATE INDEX "IDX_comment_post" ON "comment" ("postId", "postType")
        `);

    // Create index on parentId for nested comment queries
    await queryRunner.query(`
            CREATE INDEX "IDX_comment_parentId" ON "comment" ("parentId")
        `);

    // Add self-referencing foreign key for parent comment
    await queryRunner.query(`
            ALTER TABLE "comment"
            ADD CONSTRAINT "FK_comment_parentId"
            FOREIGN KEY ("parentId")
            REFERENCES "comment"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

    // Create CommentAttachment table
    await queryRunner.query(`
            CREATE TABLE "comment_attachment" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdBy" character varying,
                "updatedBy" character varying,
                "link" text NOT NULL,
                "commentId" integer NOT NULL,
                CONSTRAINT "PK_comment_attachment" PRIMARY KEY ("id")
            )
        `);

    // Create index on commentId
    await queryRunner.query(`
            CREATE INDEX "IDX_comment_attachment_commentId" ON "comment_attachment" ("commentId")
        `);

    // Add foreign key to Comment
    await queryRunner.query(`
            ALTER TABLE "comment_attachment"
            ADD CONSTRAINT "FK_comment_attachment_commentId"
            FOREIGN KEY ("commentId")
            REFERENCES "comment"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

    // Create TaskAttachment table
    await queryRunner.query(`
            CREATE TABLE "task_attachment" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdBy" character varying,
                "updatedBy" character varying,
                "link" text NOT NULL,
                "taskId" integer NOT NULL,
                CONSTRAINT "PK_task_attachment" PRIMARY KEY ("id")
            )
        `);

    // Create index on taskId
    await queryRunner.query(`
            CREATE INDEX "IDX_task_attachment_taskId" ON "task_attachment" ("taskId")
        `);

    // Add foreign key to Task
    await queryRunner.query(`
            ALTER TABLE "task_attachment"
            ADD CONSTRAINT "FK_task_attachment_taskId"
            FOREIGN KEY ("taskId")
            REFERENCES "task"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop TaskAttachment table and constraints
    await queryRunner.query(
      `ALTER TABLE "task_attachment" DROP CONSTRAINT "FK_task_attachment_taskId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_task_attachment_taskId"`);
    await queryRunner.query(`DROP TABLE "task_attachment"`);

    // Drop CommentAttachment table and constraints
    await queryRunner.query(
      `ALTER TABLE "comment_attachment" DROP CONSTRAINT "FK_comment_attachment_commentId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comment_attachment_commentId"`,
    );
    await queryRunner.query(`DROP TABLE "comment_attachment"`);

    // Drop Comment table and constraints
    await queryRunner.query(
      `ALTER TABLE "comment" DROP CONSTRAINT "FK_comment_parentId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_comment_parentId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comment_post"`);
    await queryRunner.query(`DROP TABLE "comment"`);
  }
}
