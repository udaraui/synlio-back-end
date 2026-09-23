import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertUserData1763967044448 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if user already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM "user" WHERE email = 'admin@unleashideas.com'`,
    );

    if (existingUser && existingUser.length > 0) {
      console.log(
        'User admin@unleashideas.com already exists, skipping insertion',
      );
      return;
    }

    await queryRunner.query(
      `
        INSERT INTO public."user"(id, "createdAt", "updatedAt", "createdBy", "updatedBy", first_name, last_name, mobile_number, email, "password", profile_picture, "hashedRefreshToken", "isActive")
        VALUES(3, NOW(), NOW(), NULL, NULL, 'Admin', 'User2', '0998876453', 'admin@unleashideas.com', '$2b$10$CTdC07htMcsKmsSJDKTweuwq5qA3RDjYWbI0ymW3zojAd0J8jGwOG', NULL, '$2b$10$UBIY6utJhpO5BUQv1Y362uguYmIlj5e90CMr7vVrPgVoY/mCZOmeG', true);
        `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM "user" WHERE "email" = 'admin@unleashideas.com';
        `,
    );
  }
}
