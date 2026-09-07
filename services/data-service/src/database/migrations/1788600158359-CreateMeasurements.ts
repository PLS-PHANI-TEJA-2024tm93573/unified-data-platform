import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMeasurements1788600158359 implements MigrationInterface {
  name = 'CreateMeasurements1788600158359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "measurements" (
        "variable_id" uuid NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL,
        "numeric_value" DOUBLE PRECISION,
        "boolean_value" boolean,
        "text_value" text
      )
    `);

    await queryRunner.query(`
      SELECT create_hypertable('measurements', 'timestamp', if_not_exists => TRUE)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_measurements_variable_id_timestamp"
      ON "measurements" ("variable_id", "timestamp" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_measurements_variable_id_timestamp"
    `);
    await queryRunner.query('DROP TABLE IF EXISTS "measurements"');
  }
}
