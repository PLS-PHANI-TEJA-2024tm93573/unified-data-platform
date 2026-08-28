import { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export interface DatabaseConfigReader {
  getOrThrow<T>(propertyPath: string): T;
}

export function getDatabaseConnectionConfig(
  config: DatabaseConfigReader,
): Pick<
  PostgresDataSourceOptions,
  | 'type'
  | 'host'
  | 'port'
  | 'username'
  | 'password'
  | 'database'
  | 'namingStrategy'
> {
  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DATABASE_HOST'),
    port: Number(config.getOrThrow<string>('DATABASE_PORT')),
    username: config.getOrThrow<string>('DATABASE_USER'),
    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: config.getOrThrow<string>('DATABASE_NAME'),
    namingStrategy: new SnakeNamingStrategy(),
  };
}
