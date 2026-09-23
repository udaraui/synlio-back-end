import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateWorkLogTable1778600000003 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "work_log",
            columns: [
                {
                    name: "id",
                    type: "int",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                },
                {
                    name: "companyId",
                    type: "int",
                    isNullable: false,
                },
                {
                    name: "divisionId",
                    type: "int",
                    isNullable: true,
                },
                {
                    name: "postId",
                    type: "int",
                    isNullable: false,
                },
                {
                    name: "postCode",
                    type: "varchar",
                    isNullable: false,
                },
                {
                    name: "postEventId",
                    type: "int",
                    isNullable: true,
                },
                {
                    name: "postType",
                    type: "enum",
                    enum: ["TASK", "TICKET"],
                    isNullable: false,
                },
                {
                    name: "resourceId",
                    type: "int",
                    isNullable: false,
                },
                {
                    name: "resourceName",
                    type: "varchar",
                    isNullable: false,
                },
                {
                    name: "resourceEmail",
                    type: "varchar",
                    isNullable: false,
                },
                {
                    name: "resourceType",
                    type: "enum",
                    enum: ["HUMAN", "MACHINE"],
                    isNullable: false,
                },
                {
                    name: "startTimeDate",
                    type: "date",
                    isNullable: true,
                },
                {
                    name: "endTimeDate",
                    type: "date",
                    isNullable: true,
                },
                {
                    name: "effort",
                    type: "int",
                    default: 0,
                },
                {
                    name: "note",
                    type: "text",
                    isNullable: true,
                },
                {
                    name: "createdAt",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "updatedAt",
                    type: "timestamp",
                    default: "now()",
                },
                {
                    name: "createdBy",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "updatedBy",
                    type: "varchar",
                    isNullable: true,
                },
            ],
        }), true);

        await queryRunner.createIndex("work_log", new TableIndex({
            name: "IDX_work_log_companyId_postId_resourceId",
            columnNames: ["companyId", "postId", "resourceId"],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("work_log");
    }

}
