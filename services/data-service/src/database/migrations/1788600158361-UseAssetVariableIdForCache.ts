import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseAssetVariableIdForCache1788600158361
  implements MigrationInterface
{
  name = 'UseAssetVariableIdForCache1788600158361';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" DROP CONSTRAINT "PK_data_service_variables"',
    );
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" RENAME COLUMN "variable_id" TO "asset_variable_id"',
    );
    await queryRunner.query(`
      DELETE FROM "data_service_variables" duplicate
      USING "data_service_variables" retained
      WHERE duplicate."asset_variable_id" = retained."asset_variable_id"
        AND duplicate.ctid > retained.ctid
    `);
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" ADD CONSTRAINT "PK_data_service_variables" PRIMARY KEY ("asset_variable_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" DROP CONSTRAINT "PK_data_service_variables"',
    );
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" RENAME COLUMN "asset_variable_id" TO "variable_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "data_service_variables" ADD CONSTRAINT "PK_data_service_variables" PRIMARY KEY ("variable_id", "asset_id")',
    );
  }
}