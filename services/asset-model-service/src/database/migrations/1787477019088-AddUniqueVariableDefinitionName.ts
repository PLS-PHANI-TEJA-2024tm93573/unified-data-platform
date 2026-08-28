import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueVariableDefinitionName1787477019088 implements MigrationInterface {
  name = 'AddUniqueVariableDefinitionName1787477019088';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "FK_asset_type_variables_asset_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "FK_asset_type_variables_variable_definition"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_asset_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_parent_asset"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "FK_asset_variables_asset"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "FK_asset_variables_variable_definition"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_asset_type_variables_asset_type_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_assets_asset_type_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_assets_parent_asset_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_asset_variables_asset_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "UQ_asset_type_variables_asset_type_variable_definition"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "UQ_asset_variables_asset_variable_definition"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "UQ_2be543656b3ac9595218791606d" UNIQUE ("asset_type_id", "variable_definition_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "UQ_87fb533ce6de99a671064672b31" UNIQUE ("asset_id", "variable_definition_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "FK_8ce78f24225f2127763604f82ba" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "FK_5a379203fa33f3f0fbfcc0edae9" FOREIGN KEY ("variable_definition_id") REFERENCES "variable_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "FK_d43ed9e838f74bcc07b1266a8d6" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "FK_46515691cb8510cfcc8edbcf7db" FOREIGN KEY ("parent_asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "FK_8cb5be7751663a8ea3190d4fed1" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "FK_500818980f8f9e37bfacc973831" FOREIGN KEY ("variable_definition_id") REFERENCES "variable_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "FK_500818980f8f9e37bfacc973831"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "FK_8cb5be7751663a8ea3190d4fed1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" DROP CONSTRAINT "FK_46515691cb8510cfcc8edbcf7db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" DROP CONSTRAINT "FK_d43ed9e838f74bcc07b1266a8d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "FK_5a379203fa33f3f0fbfcc0edae9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "FK_8ce78f24225f2127763604f82ba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" DROP CONSTRAINT "UQ_87fb533ce6de99a671064672b31"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" DROP CONSTRAINT "UQ_2be543656b3ac9595218791606d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "UQ_asset_variables_asset_variable_definition" UNIQUE ("asset_id", "variable_definition_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "UQ_asset_type_variables_asset_type_variable_definition" UNIQUE ("asset_type_id", "variable_definition_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_variables_asset_id" ON "asset_variables" USING btree ("asset_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assets_parent_asset_id" ON "assets" USING btree ("parent_asset_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assets_asset_type_id" ON "assets" USING btree ("asset_type_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_type_variables_asset_type_id" ON "asset_type_variables" USING btree ("asset_type_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "FK_asset_variables_variable_definition" FOREIGN KEY ("variable_definition_id") REFERENCES "variable_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_variables" ADD CONSTRAINT "FK_asset_variables_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_parent_asset" FOREIGN KEY ("parent_asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_asset_type" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "FK_asset_type_variables_variable_definition" FOREIGN KEY ("variable_definition_id") REFERENCES "variable_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_type_variables" ADD CONSTRAINT "FK_asset_type_variables_asset_type" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
