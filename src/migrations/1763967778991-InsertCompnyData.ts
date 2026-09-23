import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertCompnyData1763967778991 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if company already exists
    const existingCompany = await queryRunner.query(
      `SELECT id FROM company WHERE company_code = 'UNLSH'`,
    );

    if (existingCompany && existingCompany.length > 0) {
      console.log('Company UNLSH already exists, skipping insertion');
      return;
    }

    await queryRunner.query(
      `
          INSERT INTO public.company
          (id, "createdAt", "updatedAt", "createdBy", "updatedBy", company, company_code, logo, suspend_on, "isActive")
          VALUES(1, NOW(), NOW(), NULL, NULL, 'Unleash Ideas', 'UNLSH', NULL, NULL, 'active'::public.company_isactive_enum);
        `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM "company" WHERE "company_code" = 'UNLSH';
        `,
    );
  }
}
