import { MigrationInterface, QueryRunner } from 'typeorm';

// Privilege IDs assigned after migration run:
// 112 - Export Excel - Tasks   (group: Project Management, level_type: data, access_key: export:excel-tasks)
// 113 - Export Excel - Tickets (group: Ticket Management,  level_type: data, access_key: export:excel-tickets)
export class InsertExportExcelPrivileges1785400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (112, NOW(), NOW(), 'system', 'system', 'Export Excel - Tasks',
                'Project Management', 'export:excel-tasks', 'Export tasks to Excel.', 'data')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (113, NOW(), NOW(), 'system', 'system', 'Export Excel - Tickets',
                'Ticket Management', 'export:excel-tickets', 'Export tickets to Excel.', 'data')
        ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DELETE FROM public.privilege
        WHERE id IN (112, 113);
    `);
  }
}
