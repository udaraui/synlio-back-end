import { MigrationInterface, QueryRunner } from 'typeorm';

// Privilege IDs assigned after migration run:
// 108 - Excel Upload                      (group: Excel,              level_type: config, access_key: upload:excel)
// 109 - Pulse                             (group: Pulse,              level_type: data,   access_key: access:pulse)
// 110 - Admin Consent - Meeting Providers (group: Pulse,              level_type: data,   access_key: admin-consent:meeting-providers)
// 111 - Guest Member                      (group: Project Management, level_type: data,   access_key: access:guest-member)
export class InsertNewPrivileges1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (108, NOW(), NOW(), 'system', 'system', 'Excel Upload',
                'Excel', 'upload:excel', 'Upload data via Excel files.', 'config')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (109, NOW(), NOW(), 'system', 'system', 'Pulse',
                'Pulse', 'access:pulse', 'Access the Pulse module.', 'data')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (110, NOW(), NOW(), 'system', 'system', 'Admin Consent - Meeting Providers',
                'Pulse', 'admin-consent:meeting-providers', 'Grant admin consent for meeting providers integration.', 'data')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (111, NOW(), NOW(), 'system', 'system', 'Guest Member',
                'Project Management', 'access:guest-member', 'Access as a guest member in projects.', 'data')
        ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DELETE FROM public.privilege
        WHERE id IN (108, 109, 110, 111);
    `);
  }
}
