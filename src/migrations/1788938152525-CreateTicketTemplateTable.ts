import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTicketTemplateTable1788938152525 implements MigrationInterface {
    name = 'CreateTicketTemplateTable1788938152525'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ticket_template" (
                "id" SERIAL NOT NULL, 
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "createdBy" character varying(50), 
                "updatedBy" character varying(50), 
                "name" character varying NOT NULL, 
                "isShared" boolean NOT NULL DEFAULT false, 
                "ticketSpaceId" integer NOT NULL, 
                "templateData" jsonb NOT NULL, 
                CONSTRAINT "PK_ticket_template_id" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            ALTER TABLE "ticket_template" 
            ADD CONSTRAINT "FK_ticket_template_ticketSpaceId" 
            FOREIGN KEY ("ticketSpaceId") REFERENCES "ticket_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_template" DROP CONSTRAINT "FK_ticket_template_ticketSpaceId"`);
        await queryRunner.query(`DROP TABLE "ticket_template"`);
    }
}
