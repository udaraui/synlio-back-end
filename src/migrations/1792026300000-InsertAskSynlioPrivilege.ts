import { MigrationInterface, QueryRunner } from 'typeorm';

// Privilege ID:
// 120 - View Ask Synlio (group: Intelligence, level_type: data, access_key: view:ask-synlio)
export class InsertAskSynlioPrivilege1792026300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO public.privilege
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", privilege, "group", access_key, description, level_type)
        VALUES (120, NOW(), NOW(), 'system', 'system', 'View Ask Synlio',
                'Intelligence', 'view:ask-synlio', 'Allow user to view ask synlio', 'data')
        ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DELETE FROM public.privilege
        WHERE id = 120;
    `);
  }
}
