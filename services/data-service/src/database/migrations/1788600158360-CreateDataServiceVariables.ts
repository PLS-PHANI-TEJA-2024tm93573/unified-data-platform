import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDataServiceVariables1788600158360
  implements MigrationInterface
{
  name = 'CreateDataServiceVariables1788600158360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "data_service_variables" (
        "variable_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "data_type" varchar NOT NULL,
        "unit" varchar,
        "updated_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_data_service_variables" PRIMARY KEY ("variable_id", "asset_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "data_service_variables"',
    );
  }
}