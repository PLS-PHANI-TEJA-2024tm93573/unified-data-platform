import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { getDatabaseConnectionConfig } from './database.config';
import { AssetType } from '../asset-types/entities/asset-type.entity';
import { AssetTypeVariable } from '../asset-types/entities/asset-type-variable.entity';
import { Asset } from '../assets/entities/asset.entity';
import { AssetVariable } from '../assets/entities/asset-variable.entity';
import { VariableDefinition } from '../variables/entities/variable-definition.entity';

loadEnvironment();

const environmentConfig = {
  getOrThrow<T>(propertyPath: string): T {
    const value = process.env[propertyPath];
    if (value === undefined || value === '') {
      throw new Error(
        `Missing required database configuration: ${propertyPath}`,
      );
    }
    return value as T;
  },
};

export default new DataSource({
  ...getDatabaseConnectionConfig(environmentConfig),
  entities: [
    AssetType,
    VariableDefinition,
    AssetTypeVariable,
    Asset,
    AssetVariable,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
