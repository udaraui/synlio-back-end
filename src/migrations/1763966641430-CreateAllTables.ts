import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAllTables1763966641430 implements MigrationInterface {
  name = 'CreateAllTables1763966641430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if tables already exist - if so, skip this migration
    const privilegeTableExists = await queryRunner.hasTable('privilege');
    if (privilegeTableExists) {
      console.log('Tables already exist, skipping CreateAllTables migration');
      return;
    }

    await queryRunner.query(`CREATE TABLE "privilege"
                             (
                                 "id"          SERIAL            NOT NULL,
                                 "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"   character varying(50),
                                 "updatedBy"   character varying(50),
                                 "privilege"   character varying NOT NULL,
                                 "group"       character varying NOT NULL,
                                 "access_key"  character varying NOT NULL,
                                 "description" character varying,
                                 CONSTRAINT "UQ_d5faebd6a7422223ae83c5e19a5" UNIQUE ("access_key"),
                                 CONSTRAINT "Privilege-access_key" UNIQUE ("access_key"),
                                 CONSTRAINT "PK_b1691196ff9c996998bab2e406e" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "role"
                             (
                                 "id"        SERIAL            NOT NULL,
                                 "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy" character varying(50),
                                 "updatedBy" character varying(50),
                                 "role"      character varying NOT NULL,
                                 "companyId" integer           NOT NULL,
                                 "isActive"  boolean           NOT NULL DEFAULT true,
                                 CONSTRAINT "UQ_367aad98203bd8afaed0d704093" UNIQUE ("role"),
                                 CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "calendar_days"
                             (
                                 "id"           SERIAL            NOT NULL,
                                 "createdAt"    TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"    TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"    character varying(50),
                                 "updatedBy"    character varying(50),
                                 "date"         TIMESTAMP         NOT NULL,
                                 "year"         integer           NOT NULL,
                                 "isHoliday"    boolean           NOT NULL DEFAULT false,
                                 "isWeekend"    boolean           NOT NULL,
                                 "isWorkingDay" boolean           NOT NULL,
                                 "dayType"      character varying NOT NULL,
                                 "calendarId"   integer           NOT NULL,
                                 CONSTRAINT "PK_4e038bb33a6b17e98fee1f30ad9" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "calendar"
                             (
                                 "id"        SERIAL            NOT NULL,
                                 "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy" character varying(50),
                                 "updatedBy" character varying(50),
                                 "name"      character varying NOT NULL,
                                 "isActive"  boolean           NOT NULL DEFAULT true,
                                 "companyId" integer,
                                 CONSTRAINT "PK_2492fb846a48ea16d53864e3267" PRIMARY KEY ("id")
                             )`);

    await queryRunner.query(`CREATE TABLE "skill_categories"
                             (
                                 "id"          SERIAL            NOT NULL,
                                 "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"   character varying(50),
                                 "updatedBy"   character varying(50),
                                 "name"        character varying NOT NULL,
                                 "description" character varying NOT NULL,
                                 "isActive"    boolean           NOT NULL DEFAULT true,
                                 "companyId"   integer,
                                 CONSTRAINT "PK_efce364bf7be7b92b7d7f948663" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "skill_level"
                             (
                                 "id"         SERIAL            NOT NULL,
                                 "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"  TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"  character varying(50),
                                 "updatedBy"  character varying(50),
                                 "name"       character varying NOT NULL,
                                 "star_count" integer           NOT NULL,
                                 "isActive"   boolean           NOT NULL DEFAULT true,
                                 "categoryId" integer,
                                 CONSTRAINT "PK_74a4c36c4d54113de03e665c78d" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "skill"
                             (
                                 "id"         SERIAL            NOT NULL,
                                 "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"  TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"  character varying(50),
                                 "updatedBy"  character varying(50),
                                 "name"       character varying NOT NULL,
                                 "isActive"   boolean           NOT NULL DEFAULT true,
                                 "categoryId" integer,
                                 CONSTRAINT "PK_a0d33334424e64fb78dc3ce7196" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "resource_skill"
                             (
                                 "id"              SERIAL    NOT NULL,
                                 "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
                                 "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
                                 "createdBy"       character varying(50),
                                 "updatedBy"       character varying(50),
                                 "resourceId"      integer,
                                 "skillId"         integer,
                                 "skillLevelId"    integer,
                                 "skillCategoryId" integer,
                                 CONSTRAINT "PK_df49b2268bd83a8d0fcd656c9dc" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "resource"
                             (
                                 "id"            SERIAL            NOT NULL,
                                 "createdAt"     TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"     TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"     character varying(50),
                                 "updatedBy"     character varying(50),
                                 "first_name"    character varying NOT NULL,
                                 "last_name"     character varying NOT NULL,
                                 "email"         character varying NOT NULL,
                                 "mobile"        integer,
                                 "profile_pic"   character varying,
                                 "working_hours" integer           NOT NULL,
                                 "companyId"     integer,
                                 "divisionId"    integer,
                                 "active_status" boolean           NOT NULL DEFAULT true,
                                 "calendarId"    integer,
                                 CONSTRAINT "PK_e2894a5867e06ae2e8889f1173f" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "resource_pool"
                             (
                                 "id"          SERIAL            NOT NULL,
                                 "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"   character varying(50),
                                 "updatedBy"   character varying(50),
                                 "name"        character varying NOT NULL,
                                 "companyId"   integer,
                                 "divisionId"  integer,
                                 "poolOwnerId" integer,
                                 CONSTRAINT "PK_8ae85ec194c24a2c2fccd4d4bb7" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(
      `CREATE TYPE "public"."project_status_enum" AS ENUM('todo', 'inProgress', 'onHold')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."project_priority_enum" AS ENUM('low', 'moderate', 'high', 'critical')`,
    );
    await queryRunner.query(`CREATE TABLE "project"
                             (
                                 "id"             SERIAL                           NOT NULL,
                                 "createdAt"      TIMESTAMP                        NOT NULL DEFAULT now(),
                                 "updatedAt"      TIMESTAMP                        NOT NULL DEFAULT now(),
                                 "createdBy"      character varying(50),
                                 "updatedBy"      character varying(50),
                                 "name"           character varying                NOT NULL,
                                 "description"    character varying,
                                 "projectGroupId" integer                          NOT NULL,
                                 "companyId"      integer                          NOT NULL,
                                 "divisionId"     integer,
                                 "status"         "public"."project_status_enum"   NOT NULL DEFAULT 'todo',
                                 "priority"       "public"."project_priority_enum" NOT NULL DEFAULT 'low',
                                 "startDate"      date,
                                 "endDate"        date,
                                 "resourcePoolId" integer,
                                 CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(
      `CREATE TYPE "public"."project_group_status_enum" AS ENUM('active', 'suspend', 'block')`,
    );
    await queryRunner.query(`CREATE TABLE "project_group"
                             (
                                 "id"             SERIAL                               NOT NULL,
                                 "createdAt"      TIMESTAMP                            NOT NULL DEFAULT now(),
                                 "updatedAt"      TIMESTAMP                            NOT NULL DEFAULT now(),
                                 "createdBy"      character varying(50),
                                 "updatedBy"      character varying(50),
                                 "name"           character varying                    NOT NULL,
                                 "prefix"         character varying                    NOT NULL,
                                 "description"    character varying,
                                 "companyId"      integer                              NOT NULL,
                                 "divisionId"     integer,
                                 "resourcePoolId" integer,
                                 "status"         "public"."project_group_status_enum" NOT NULL DEFAULT 'active',
                                 "test_two"       integer,
                                 CONSTRAINT "unique_companyId-prefix" UNIQUE ("companyId", "prefix"),
                                 CONSTRAINT "PK_e1f2447856b1b853e98bcd8508b" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "division"
                             (
                                 "id"            SERIAL            NOT NULL,
                                 "createdAt"     TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"     TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"     character varying(50),
                                 "updatedBy"     character varying(50),
                                 "division"      character varying NOT NULL,
                                 "division_code" character varying NOT NULL,
                                 "companyId"     integer           NOT NULL,
                                 "isActive"      boolean           NOT NULL,
                                 CONSTRAINT "PK_b6f0d207e38106dbddabab3a078" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(
      `CREATE TYPE "public"."company_isactive_enum" AS ENUM('active', 'suspend', 'block')`,
    );
    await queryRunner.query(`CREATE TABLE "company"
                             (
                                 "id"           SERIAL                           NOT NULL,
                                 "createdAt"    TIMESTAMP                        NOT NULL DEFAULT now(),
                                 "updatedAt"    TIMESTAMP                        NOT NULL DEFAULT now(),
                                 "createdBy"    character varying(50),
                                 "updatedBy"    character varying(50),
                                 "company"      character varying                NOT NULL,
                                 "company_code" character varying                NOT NULL,
                                 "logo"         character varying,
                                 "suspend_on"   date,
                                 "isActive"     "public"."company_isactive_enum" NOT NULL DEFAULT 'active',
                                 CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "user_company_role"
                             (
                                 "id"        SERIAL  NOT NULL,
                                 "userId"    integer NOT NULL,
                                 "companyId" integer NOT NULL,
                                 "roleId"    integer NOT NULL,
                                 CONSTRAINT "PK_6e55eaa788a4473890283bea8ac" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_65594c4e415014f01e7418d30b" ON "user_company_role" ("userId", "companyId", "roleId") `,
    );
    await queryRunner.query(`CREATE TABLE "user"
                             (
                                 "id"                 SERIAL            NOT NULL,
                                 "createdAt"          TIMESTAMP         NOT NULL DEFAULT now(),
                                 "updatedAt"          TIMESTAMP         NOT NULL DEFAULT now(),
                                 "createdBy"          character varying(50),
                                 "updatedBy"          character varying(50),
                                 "first_name"         character varying NOT NULL,
                                 "last_name"          character varying NOT NULL,
                                 "mobile_number"      character varying,
                                 "email"              character varying NOT NULL,
                                 "password"           character varying NOT NULL,
                                 "profile_picture"    character varying,
                                 "hashedRefreshToken" character varying,
                                 "isActive"           boolean           NOT NULL DEFAULT true,
                                 CONSTRAINT "unique_user-email" UNIQUE ("email"),
                                 CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE TABLE "role_privileges_privilege"
                             (
                                 "roleId"      integer NOT NULL,
                                 "privilegeId" integer NOT NULL,
                                 CONSTRAINT "PK_8ee6898a6612f9113a4c0518cf3" PRIMARY KEY ("roleId", "privilegeId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d11ab7c8589ca17646c5345fb7" ON "role_privileges_privilege" ("roleId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e04315305e9b12cc7e18bda6ef" ON "role_privileges_privilege" ("privilegeId") `,
    );
    await queryRunner.query(`CREATE TABLE "resource_pool_resources_resource"
                             (
                                 "resourcePoolId" integer NOT NULL,
                                 "resourceId"     integer NOT NULL,
                                 CONSTRAINT "PK_78a6d373dc17b32f3c11c2749df" PRIMARY KEY ("resourcePoolId", "resourceId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_421e7826782ebb9eb17c5dd397" ON "resource_pool_resources_resource" ("resourcePoolId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f1f4501a668e2d08c4cf61df" ON "resource_pool_resources_resource" ("resourceId") `,
    );
    await queryRunner.query(`CREATE TABLE "project_group_owners"
                             (
                                 "projectGroupId" integer NOT NULL,
                                 "userId"         integer NOT NULL,
                                 CONSTRAINT "PK_d6dd4656f0056f6da3e55a5dca8" PRIMARY KEY ("projectGroupId", "userId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_8f8e29d32851b6e4d14281042e" ON "project_group_owners" ("projectGroupId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_444d7fca5a11f6359bd6ba6516" ON "project_group_owners" ("userId") `,
    );
    await queryRunner.query(`CREATE TABLE "project_group_resources"
                             (
                                 "projectGroupId" integer NOT NULL,
                                 "resourceId"     integer NOT NULL,
                                 CONSTRAINT "PK_90039f18cc340ee8b7bb1dd9c39" PRIMARY KEY ("projectGroupId", "resourceId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ef208e17aa0d950000abc05598" ON "project_group_resources" ("projectGroupId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b7debe08730f34336893c65c1d" ON "project_group_resources" ("resourceId") `,
    );
    await queryRunner.query(`CREATE TABLE "division_users_user"
                             (
                                 "divisionId" integer NOT NULL,
                                 "userId"     integer NOT NULL,
                                 CONSTRAINT "PK_73aef56b9cc8ccfb01a64491561" PRIMARY KEY ("divisionId", "userId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_3c6adefc2a5b9e97645001adcd" ON "division_users_user" ("divisionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b739377ea67f2bf076197ba9cf" ON "division_users_user" ("userId") `,
    );
    await queryRunner.query(`CREATE TABLE "user_companies_company"
                             (
                                 "userId"    integer NOT NULL,
                                 "companyId" integer NOT NULL,
                                 CONSTRAINT "PK_4d806db0eeeaa54b2bff6335549" PRIMARY KEY ("userId", "companyId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_11ac2b5cec7baf03fc36120011" ON "user_companies_company" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3faa3b15b4ac404e4e5aaebe8d" ON "user_companies_company" ("companyId") `,
    );
    await queryRunner.query(`CREATE TABLE "user_divisions_division"
                             (
                                 "userId"     integer NOT NULL,
                                 "divisionId" integer NOT NULL,
                                 CONSTRAINT "PK_0ac57e5a96bf5fe5645e1a0df5e" PRIMARY KEY ("userId", "divisionId")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_80dd06fe6390a5529b3b66aa4a" ON "user_divisions_division" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea1cefb234a27c39f75e32d143" ON "user_divisions_division" ("divisionId") `,
    );
    await queryRunner.query(`ALTER TABLE "calendar_days"
        ADD CONSTRAINT "FK_e3d0f4942cc261808659b50b7f3" FOREIGN KEY ("calendarId") REFERENCES "calendar" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "calendar"
        ADD CONSTRAINT "FK_9f44c4b9d30668043e06e4e42c6" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "skill_categories"
        ADD CONSTRAINT "FK_8fb3ba9d64954deb4fb27230b4b" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "skill_level"
        ADD CONSTRAINT "FK_163bc4b9da62ea5bddf506f8b07" FOREIGN KEY ("categoryId") REFERENCES "skill_categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "skill"
        ADD CONSTRAINT "FK_ae50007dd0ddc9050deaa92185b" FOREIGN KEY ("categoryId") REFERENCES "skill_categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_skill"
        ADD CONSTRAINT "FK_71821e9d0fefaa24d168083386b" FOREIGN KEY ("resourceId") REFERENCES "resource" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_skill"
        ADD CONSTRAINT "FK_d1a6c64f10e0026613946b4f45a" FOREIGN KEY ("skillId") REFERENCES "skill" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_skill"
        ADD CONSTRAINT "FK_f3eab1ddbee44cf5cda65385946" FOREIGN KEY ("skillLevelId") REFERENCES "skill_level" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_skill"
        ADD CONSTRAINT "FK_489d1773a30fd0f9fa031593949" FOREIGN KEY ("skillCategoryId") REFERENCES "skill_categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource"
        ADD CONSTRAINT "FK_3a0248cb93ea8101f16ecc4ea9c" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource"
        ADD CONSTRAINT "FK_5311f3b5b02e9f0c7c4c2c9506a" FOREIGN KEY ("divisionId") REFERENCES "division" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource"
        ADD CONSTRAINT "FK_7947e4ca882d17f8d0e09fb0226" FOREIGN KEY ("calendarId") REFERENCES "calendar" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_pool"
        ADD CONSTRAINT "FK_c599352d8fb353e1dd9e3f26fc7" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_pool"
        ADD CONSTRAINT "FK_77219345207661a13296d0d3519" FOREIGN KEY ("divisionId") REFERENCES "division" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_pool"
        ADD CONSTRAINT "FK_623863468168bfb921b9e793f01" FOREIGN KEY ("poolOwnerId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project"
        ADD CONSTRAINT "FK_743b6e19f57b0c29b70dd93994a" FOREIGN KEY ("projectGroupId") REFERENCES "project_group" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project"
        ADD CONSTRAINT "FK_5b8d82d287edbc75ee70ae3f4d0" FOREIGN KEY ("resourcePoolId") REFERENCES "resource_pool" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project_group"
        ADD CONSTRAINT "FK_4f83a5a1d7ef815a59b38263a56" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project_group"
        ADD CONSTRAINT "FK_4c4c5fbe7de4af12822e84b571c" FOREIGN KEY ("divisionId") REFERENCES "division" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project_group"
        ADD CONSTRAINT "FK_3caedf1cc7c4a2f78543e0400d9" FOREIGN KEY ("resourcePoolId") REFERENCES "resource_pool" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "division"
        ADD CONSTRAINT "FK_8697cf60dc4313fdf182851729b" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_company_role"
        ADD CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_company_role"
        ADD CONSTRAINT "FK_3aa0fd26a5fee0b0928a83c748c" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_company_role"
        ADD CONSTRAINT "FK_474a41f820217dec7dfbb346d39" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "role_privileges_privilege"
        ADD CONSTRAINT "FK_d11ab7c8589ca17646c5345fb7f" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "role_privileges_privilege"
        ADD CONSTRAINT "FK_e04315305e9b12cc7e18bda6ef8" FOREIGN KEY ("privilegeId") REFERENCES "privilege" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "resource_pool_resources_resource"
        ADD CONSTRAINT "FK_421e7826782ebb9eb17c5dd397a" FOREIGN KEY ("resourcePoolId") REFERENCES "resource_pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "resource_pool_resources_resource"
        ADD CONSTRAINT "FK_03f1f4501a668e2d08c4cf61dfe" FOREIGN KEY ("resourceId") REFERENCES "resource" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project_group_owners"
        ADD CONSTRAINT "FK_8f8e29d32851b6e4d14281042ef" FOREIGN KEY ("projectGroupId") REFERENCES "project_group" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "project_group_owners"
        ADD CONSTRAINT "FK_444d7fca5a11f6359bd6ba6516c" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "project_group_resources"
        ADD CONSTRAINT "FK_ef208e17aa0d950000abc055981" FOREIGN KEY ("projectGroupId") REFERENCES "project_group" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "project_group_resources"
        ADD CONSTRAINT "FK_b7debe08730f34336893c65c1d2" FOREIGN KEY ("resourceId") REFERENCES "resource" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "division_users_user"
        ADD CONSTRAINT "FK_3c6adefc2a5b9e97645001adcd3" FOREIGN KEY ("divisionId") REFERENCES "division" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "division_users_user"
        ADD CONSTRAINT "FK_b739377ea67f2bf076197ba9cf5" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_companies_company"
        ADD CONSTRAINT "FK_11ac2b5cec7baf03fc361200111" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_companies_company"
        ADD CONSTRAINT "FK_3faa3b15b4ac404e4e5aaebe8df" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "user_divisions_division"
        ADD CONSTRAINT "FK_80dd06fe6390a5529b3b66aa4ae" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_divisions_division"
        ADD CONSTRAINT "FK_ea1cefb234a27c39f75e32d143e" FOREIGN KEY ("divisionId") REFERENCES "division" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_divisions_division" DROP CONSTRAINT "FK_ea1cefb234a27c39f75e32d143e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_divisions_division" DROP CONSTRAINT "FK_80dd06fe6390a5529b3b66aa4ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies_company" DROP CONSTRAINT "FK_3faa3b15b4ac404e4e5aaebe8df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_companies_company" DROP CONSTRAINT "FK_11ac2b5cec7baf03fc361200111"`,
    );
    await queryRunner.query(
      `ALTER TABLE "division_users_user" DROP CONSTRAINT "FK_b739377ea67f2bf076197ba9cf5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "division_users_user" DROP CONSTRAINT "FK_3c6adefc2a5b9e97645001adcd3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group_resources" DROP CONSTRAINT "FK_b7debe08730f34336893c65c1d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group_resources" DROP CONSTRAINT "FK_ef208e17aa0d950000abc055981"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group_owners" DROP CONSTRAINT "FK_444d7fca5a11f6359bd6ba6516c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group_owners" DROP CONSTRAINT "FK_8f8e29d32851b6e4d14281042ef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool_resources_resource" DROP CONSTRAINT "FK_03f1f4501a668e2d08c4cf61dfe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool_resources_resource" DROP CONSTRAINT "FK_421e7826782ebb9eb17c5dd397a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" DROP CONSTRAINT "FK_e04315305e9b12cc7e18bda6ef8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" DROP CONSTRAINT "FK_d11ab7c8589ca17646c5345fb7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_role" DROP CONSTRAINT "FK_474a41f820217dec7dfbb346d39"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_role" DROP CONSTRAINT "FK_3aa0fd26a5fee0b0928a83c748c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_role" DROP CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "division" DROP CONSTRAINT "FK_8697cf60dc4313fdf182851729b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" DROP CONSTRAINT "FK_3caedf1cc7c4a2f78543e0400d9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" DROP CONSTRAINT "FK_4c4c5fbe7de4af12822e84b571c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_group" DROP CONSTRAINT "FK_4f83a5a1d7ef815a59b38263a56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_5b8d82d287edbc75ee70ae3f4d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_743b6e19f57b0c29b70dd93994a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" DROP CONSTRAINT "FK_623863468168bfb921b9e793f01"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" DROP CONSTRAINT "FK_77219345207661a13296d0d3519"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_pool" DROP CONSTRAINT "FK_c599352d8fb353e1dd9e3f26fc7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource" DROP CONSTRAINT "FK_7947e4ca882d17f8d0e09fb0226"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource" DROP CONSTRAINT "FK_5311f3b5b02e9f0c7c4c2c9506a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource" DROP CONSTRAINT "FK_3a0248cb93ea8101f16ecc4ea9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_skill" DROP CONSTRAINT "FK_489d1773a30fd0f9fa031593949"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_skill" DROP CONSTRAINT "FK_f3eab1ddbee44cf5cda65385946"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_skill" DROP CONSTRAINT "FK_d1a6c64f10e0026613946b4f45a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_skill" DROP CONSTRAINT "FK_71821e9d0fefaa24d168083386b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill" DROP CONSTRAINT "FK_ae50007dd0ddc9050deaa92185b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill_level" DROP CONSTRAINT "FK_163bc4b9da62ea5bddf506f8b07"`,
    );
    await queryRunner.query(
      `ALTER TABLE "skill_categories" DROP CONSTRAINT "FK_8fb3ba9d64954deb4fb27230b4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar" DROP CONSTRAINT "FK_9f44c4b9d30668043e06e4e42c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_days" DROP CONSTRAINT "FK_e3d0f4942cc261808659b50b7f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ea1cefb234a27c39f75e32d143"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80dd06fe6390a5529b3b66aa4a"`,
    );
    await queryRunner.query(`DROP TABLE "user_divisions_division"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3faa3b15b4ac404e4e5aaebe8d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_11ac2b5cec7baf03fc36120011"`,
    );
    await queryRunner.query(`DROP TABLE "user_companies_company"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b739377ea67f2bf076197ba9cf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3c6adefc2a5b9e97645001adcd"`,
    );
    await queryRunner.query(`DROP TABLE "division_users_user"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b7debe08730f34336893c65c1d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef208e17aa0d950000abc05598"`,
    );
    await queryRunner.query(`DROP TABLE "project_group_resources"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_444d7fca5a11f6359bd6ba6516"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8f8e29d32851b6e4d14281042e"`,
    );
    await queryRunner.query(`DROP TABLE "project_group_owners"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03f1f4501a668e2d08c4cf61df"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_421e7826782ebb9eb17c5dd397"`,
    );
    await queryRunner.query(`DROP TABLE "resource_pool_resources_resource"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e04315305e9b12cc7e18bda6ef"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d11ab7c8589ca17646c5345fb7"`,
    );
    await queryRunner.query(`DROP TABLE "role_privileges_privilege"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65594c4e415014f01e7418d30b"`,
    );
    await queryRunner.query(`DROP TABLE "user_company_role"`);
    await queryRunner.query(`DROP TABLE "company"`);
    await queryRunner.query(`DROP TYPE "public"."company_isactive_enum"`);
    await queryRunner.query(`DROP TABLE "division"`);
    await queryRunner.query(`DROP TABLE "project_group"`);
    await queryRunner.query(`DROP TYPE "public"."project_group_status_enum"`);
    await queryRunner.query(`DROP TABLE "project"`);
    await queryRunner.query(`DROP TYPE "public"."project_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."project_status_enum"`);
    await queryRunner.query(`DROP TABLE "resource_pool"`);
    await queryRunner.query(`DROP TABLE "resource"`);
    await queryRunner.query(`DROP TABLE "resource_skill"`);
    await queryRunner.query(`DROP TABLE "skill"`);
    await queryRunner.query(`DROP TABLE "skill_level"`);
    await queryRunner.query(`DROP TABLE "skill_categories"`);
    await queryRunner.query(`DROP TABLE "calendar"`);
    await queryRunner.query(`DROP TABLE "calendar_days"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP TABLE "privilege"`);
  }
}
