import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertDivisionData1763968986218 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO public.division
        (id, "createdAt", "updatedAt", "createdBy", "updatedBy", division, division_code, "companyId", "isActive")
        VALUES(1, NOW(), NOW(), NULL, NULL, 'Division 1', 'DV 1', 1, true)
        ON CONFLICT (id) DO NOTHING;
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM public.division
        WHERE division_code = 'DV 1';
      `,
    );
  }
}
