import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
    TableUnique,
} from 'typeorm';

export class InitialAssetModel1764000000000 implements MigrationInterface {
    name = 'InitialAssetModel1764000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        await queryRunner.createTable(
            new Table({
                name: 'asset_types',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'name',
                        type: 'character varying',
                        isUnique: true,
                    },
                    {
                        name: 'description',
                        type: 'character varying',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                ],
            }),
        );

        await queryRunner.createTable(
            new Table({
                name: 'variable_definitions',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'name',
                        type: 'character varying',
                        isUnique: true,
                    },
                    {
                        name: 'data_type',
                        type: 'character varying',
                    },
                    {
                        name: 'unit',
                        type: 'character varying',
                    },
                    {
                        name: 'description',
                        type: 'character varying',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                ],
            }),
        );

        await queryRunner.createTable(
            new Table({
                name: 'asset_type_variables',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'required',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'asset_type_id',
                        type: 'uuid',
                    },
                    {
                        name: 'variable_definition_id',
                        type: 'uuid',
                    },
                ],
                uniques: [
                    {
                        name: 'UQ_asset_type_variables_asset_type_variable_definition',
                        columnNames: ['asset_type_id', 'variable_definition_id'],
                    },
                ],
            }),
        );

        await queryRunner.createIndex(
            'asset_type_variables',
            new TableIndex({
                name: 'IDX_asset_type_variables_asset_type_id',
                columnNames: ['asset_type_id'],
            }),
        );
        await queryRunner.createForeignKey(
            'asset_type_variables',
            new TableForeignKey({
                name: 'FK_asset_type_variables_asset_type',
                columnNames: ['asset_type_id'],
                referencedTableName: 'asset_types',
                referencedColumnNames: ['id'],
            }),
        );
        await queryRunner.createForeignKey(
            'asset_type_variables',
            new TableForeignKey({
                name: 'FK_asset_type_variables_variable_definition',
                columnNames: ['variable_definition_id'],
                referencedTableName: 'variable_definitions',
                referencedColumnNames: ['id'],
            }),
        );

        await queryRunner.createTable(
            new Table({
                name: 'assets',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'name',
                        type: 'character varying',
                    },
                    {
                        name: 'asset_type_id',
                        type: 'uuid',
                    },
                    {
                        name: 'parent_asset_id',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'description',
                        type: 'character varying',
                        isNullable: true,
                    },
                    {
                        name: 'location',
                        type: 'character varying',
                        isNullable: true,
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp without time zone',
                        default: 'now()',
                    },
                ],
            }),
        );

        await queryRunner.createIndex(
            'assets',
            new TableIndex({
                name: 'IDX_assets_asset_type_id',
                columnNames: ['asset_type_id'],
            }),
        );
        await queryRunner.createIndex(
            'assets',
            new TableIndex({
                name: 'IDX_assets_parent_asset_id',
                columnNames: ['parent_asset_id'],
            }),
        );
        await queryRunner.createForeignKey(
            'assets',
            new TableForeignKey({
                name: 'FK_assets_asset_type',
                columnNames: ['asset_type_id'],
                referencedTableName: 'asset_types',
                referencedColumnNames: ['id'],
            }),
        );
        await queryRunner.createForeignKey(
            'assets',
            new TableForeignKey({
                name: 'FK_assets_parent_asset',
                columnNames: ['parent_asset_id'],
                referencedTableName: 'assets',
                referencedColumnNames: ['id'],
            }),
        );

        await queryRunner.createTable(
            new Table({
                name: 'asset_variables',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'asset_id',
                        type: 'uuid',
                    },
                    {
                        name: 'variable_definition_id',
                        type: 'uuid',
                    },
                    {
                        name: 'is_custom',
                        type: 'boolean',
                        default: false,
                    },
                ],
                uniques: [
                    {
                        name: 'UQ_asset_variables_asset_variable_definition',
                        columnNames: ['asset_id', 'variable_definition_id'],
                    },
                ],
            }),
        );

        await queryRunner.createIndex(
            'asset_variables',
            new TableIndex({
                name: 'IDX_asset_variables_asset_id',
                columnNames: ['asset_id'],
            }),
        );
        await queryRunner.createForeignKey(
            'asset_variables',
            new TableForeignKey({
                name: 'FK_asset_variables_asset',
                columnNames: ['asset_id'],
                referencedTableName: 'assets',
                referencedColumnNames: ['id'],
            }),
        );
        await queryRunner.createForeignKey(
            'asset_variables',
            new TableForeignKey({
                name: 'FK_asset_variables_variable_definition',
                columnNames: ['variable_definition_id'],
                referencedTableName: 'variable_definitions',
                referencedColumnNames: ['id'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('asset_variables', 'FK_asset_variables_variable_definition');
        await queryRunner.dropForeignKey('asset_variables', 'FK_asset_variables_asset');
        await queryRunner.dropIndex('asset_variables', 'IDX_asset_variables_asset_id');
        await queryRunner.dropTable('asset_variables');

        await queryRunner.dropForeignKey('assets', 'FK_assets_parent_asset');
        await queryRunner.dropForeignKey('assets', 'FK_assets_asset_type');
        await queryRunner.dropIndex('assets', 'IDX_assets_parent_asset_id');
        await queryRunner.dropIndex('assets', 'IDX_assets_asset_type_id');
        await queryRunner.dropTable('assets');

        await queryRunner.dropForeignKey('asset_type_variables', 'FK_asset_type_variables_variable_definition');
        await queryRunner.dropForeignKey('asset_type_variables', 'FK_asset_type_variables_asset_type');
        await queryRunner.dropIndex('asset_type_variables', 'IDX_asset_type_variables_asset_type_id');
        await queryRunner.dropTable('asset_type_variables');

        await queryRunner.dropTable('variable_definitions');
        await queryRunner.dropTable('asset_types');
    }
}
