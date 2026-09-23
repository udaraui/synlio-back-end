import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskVersionAndCreateTaskEventTable1740562800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add taskVersion column to task table
    await queryRunner.query(`
      ALTER TABLE public.task
      ADD COLUMN IF NOT EXISTS "taskVersion" int4 NOT NULL DEFAULT 0;
    `);

    // Create task_event table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.task_event (
        id bigserial NOT NULL,
        task_id int4 NOT NULL,
        occurred_at timestamp DEFAULT now() NOT NULL,
        actor_id varchar NULL,
        event_type varchar NOT NULL,
        "version" int4 NOT NULL,
        correlation_id uuid NULL,
        payload jsonb DEFAULT '{}'::jsonb NOT NULL,
        CONSTRAINT task_event_pkey PRIMARY KEY (id)
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_task_event_task_time 
      ON public.task_event USING btree (task_id, occurred_at DESC);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_task_event_task_version 
      ON public.task_event USING btree (task_id, version);
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE public.task_event 
      ADD CONSTRAINT task_event_task_id_fkey 
      FOREIGN KEY (task_id) REFERENCES public.task(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop task_event table (will cascade to constraints and indexes)
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.task_event CASCADE;
    `);

    // Remove taskVersion column from task table
    await queryRunner.query(`
      ALTER TABLE public.task
      DROP COLUMN IF EXISTS "taskVersion";
    `);
  }
}
