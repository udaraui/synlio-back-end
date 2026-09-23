import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationAndEmailTables1774000000000
  implements MigrationInterface
{
  name = 'CreateNotificationAndEmailTables1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ //
    //  notification
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE "notification" (
        "id"             SERIAL                NOT NULL,
        "createdAt"      TIMESTAMP             NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP             NOT NULL DEFAULT now(),
        "createdBy"      character varying(50),
        "updatedBy"      character varying(50),
        "from"           text,
        "to"             text,
        "title"          text,
        "description"    text,
        "companyId"      integer,
        "userId"         integer,
        "username"       character varying,
        "attachmentPath" text,
        "isSent"         boolean               NOT NULL DEFAULT false,
        "isRead"         boolean               NOT NULL DEFAULT false,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_companyId" ON "notification" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_userId" ON "notification" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_isSent" ON "notification" ("isSent")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_isRead" ON "notification" ("isRead")`,
    );

    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD CONSTRAINT "FK_notification_company"
      FOREIGN KEY ("companyId")
      REFERENCES "company"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD CONSTRAINT "FK_notification_user"
      FOREIGN KEY ("userId")
      REFERENCES "user"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------ //
    //  notification_attachment
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE "notification_attachment" (
        "id"             SERIAL  NOT NULL,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"      character varying(50),
        "updatedBy"      character varying(50),
        "link"           text    NOT NULL,
        "notificationId" integer NOT NULL,
        CONSTRAINT "PK_notification_attachment" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_attachment_notificationId" ON "notification_attachment" ("notificationId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "notification_attachment"
      ADD CONSTRAINT "FK_notification_attachment_notification"
      FOREIGN KEY ("notificationId")
      REFERENCES "notification"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------ //
    //  email
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE "email" (
        "id"             SERIAL    NOT NULL,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"      character varying(50),
        "updatedBy"      character varying(50),
        "from"           text,
        "to"             text,
        "ccTo"           text,
        "subject"        text,
        "description"    text,
        "companyId"      integer,
        "userId"         integer,
        "username"       character varying,
        "attachmentPath" text,
        "isSent"         boolean   NOT NULL DEFAULT false,
        "expiredAt"      TIMESTAMP,
        "image"          text,
        "isError"        boolean   NOT NULL DEFAULT false,
        "errorText"      text,
        "spaceId"        integer,
        CONSTRAINT "PK_email" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_email_companyId" ON "email" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_userId" ON "email" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_isSent" ON "email" ("isSent")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_isError" ON "email" ("isError")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_spaceId" ON "email" ("spaceId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "email"
      ADD CONSTRAINT "FK_email_company"
      FOREIGN KEY ("companyId")
      REFERENCES "company"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "email"
      ADD CONSTRAINT "FK_email_user"
      FOREIGN KEY ("userId")
      REFERENCES "user"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------ //
    //  email_attachment
    // ------------------------------------------------------------------ //
    await queryRunner.query(`
      CREATE TABLE "email_attachment" (
        "id"        SERIAL  NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "link"      text    NOT NULL,
        "emailId"   integer NOT NULL,
        CONSTRAINT "PK_email_attachment" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_email_attachment_emailId" ON "email_attachment" ("emailId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "email_attachment"
      ADD CONSTRAINT "FK_email_attachment_email"
      FOREIGN KEY ("emailId")
      REFERENCES "email"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------ //
    //  email_attachment
    // ------------------------------------------------------------------ //
    await queryRunner.query(
      `ALTER TABLE "email_attachment" DROP CONSTRAINT "FK_email_attachment_email"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_email_attachment_emailId"`);
    await queryRunner.query(`DROP TABLE "email_attachment"`);

    // ------------------------------------------------------------------ //
    //  email
    // ------------------------------------------------------------------ //
    await queryRunner.query(
      `ALTER TABLE "email" DROP CONSTRAINT "FK_email_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email" DROP CONSTRAINT "FK_email_company"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_email_spaceId"`);
    await queryRunner.query(`DROP INDEX "IDX_email_isError"`);
    await queryRunner.query(`DROP INDEX "IDX_email_isSent"`);
    await queryRunner.query(`DROP INDEX "IDX_email_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_email_companyId"`);
    await queryRunner.query(`DROP TABLE "email"`);

    // ------------------------------------------------------------------ //
    //  notification_attachment
    // ------------------------------------------------------------------ //
    await queryRunner.query(
      `ALTER TABLE "notification_attachment" DROP CONSTRAINT "FK_notification_attachment_notification"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_notification_attachment_notificationId"`,
    );
    await queryRunner.query(`DROP TABLE "notification_attachment"`);

    // ------------------------------------------------------------------ //
    //  notification
    // ------------------------------------------------------------------ //
    await queryRunner.query(
      `ALTER TABLE "notification" DROP CONSTRAINT "FK_notification_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" DROP CONSTRAINT "FK_notification_company"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_notification_isRead"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_isSent"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_companyId"`);
    await queryRunner.query(`DROP TABLE "notification"`);
  }
}
