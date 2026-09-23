import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertPrivilagesData1763968176270 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (1, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Create Company',
                'Company', 'create:company', 'Create a new company.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (2, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Edit Company', 'Company',
                'edit:company', 'Edit company details.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (3, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Delete Company',
                'Company', 'delete:company', 'Delete a company.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (4, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'View Company', 'Company',
                'view:company', 'View company information.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (5, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Create Division',
                'Division', 'create:division', 'Create a new division.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (6, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Edit Division',
                'Division', 'edit:division', 'Edit division details.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (7, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Delete Division',
                'Division', 'delete:division', 'Delete a division.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (8, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'View Division',
                'Division', 'view:division', 'View division information.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (9, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Create Role', 'Role',
                'create:role', 'Create a new role.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (10, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Edit Role', 'Role',
                'edit:role', 'Edit role details.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (11, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Delete Role', 'Role',
                'delete:role', 'Delete a role.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (12, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'View Role', 'Role',
                'view:role', 'View role information.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (13, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Create User',
                'User Management', 'create:user', 'Create a new user management.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (14, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Edit User',
                'User Management', 'edit:user', 'Edit user management details.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (15, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'Delete User',
                'User Management', 'delete:user', 'Delete a user management.')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description)
        VALUES (16, '2025-11-04 23:27:26.790', '2025-11-04 23:27:26.790', 'system', 'system', 'View User',
                'User Management', 'view:user', 'View user management information.')
        ON CONFLICT (id) DO NOTHING;
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DELETE
        FROM public.privilege
        WHERE access_key IN (
                             'create:company', 'edit:company', 'delete:company', 'view:company',
                             'create:division', 'edit:division', 'delete:division', 'view:division',
                             'create:role', 'edit:role', 'delete:role', 'view:role',
                             'create:user', 'edit:user', 'delete:user', 'view:user'
          );
      `);
  }
}
