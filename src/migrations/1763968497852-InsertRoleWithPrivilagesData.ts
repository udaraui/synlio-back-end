import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertRoleWithPrivilagesData1763968497852
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO public."role"(id, "createdAt", "updatedAt", "createdBy", "updatedBy", "role", "companyId", "isActive")
      VALUES(1, NOW(), NOW(), NULL, NULL, 'Admin', 1, true)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 1)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 2)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 3)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 4)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 5)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 6)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 7)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 8)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 9)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 10)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 11)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 12)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 13)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 14)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 15)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.role_privileges_privilege
        ("roleId", "privilegeId")
      VALUES(1, 16)
      ON CONFLICT DO NOTHING;
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM public.role_privileges_privilege
        WHERE "roleId" = 1;
        `,
    );
    await queryRunner.query(
      `
        DELETE FROM public."role"
        WHERE id = 1;
        `,
    );
  }
}
