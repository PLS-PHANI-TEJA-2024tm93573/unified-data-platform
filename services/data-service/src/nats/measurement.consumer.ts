import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { DataServiceVariable } from '../database/entities/data-service-variable.entity';

export const DATA_SERVICE_VARIABLE_REPOSITORY =
  'DATA_SERVICE_VARIABLE_REPOSITORY';

type MeasurementMessage = {
  variable_id: string;
  timestamp: string;
  value: unknown;
};

type TypedMeasurementValue = {
  numericValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MeasurementConsumer {
  private readonly logger = new Logger(MeasurementConsumer.name);

  constructor(
    @Inject(DATA_SERVICE_VARIABLE_REPOSITORY)
    private readonly variableRepository: Repository<DataServiceVariable>,
    private readonly dataSource: DataSource,
  ) {}

  async processMessage(payload: string): Promise<boolean> {
    let message: MeasurementMessage;

    try {
      message = JSON.parse(payload) as MeasurementMessage;
    } catch (error) {
      this.logger.warn(`Rejected measurement with malformed JSON: ${this.describe(error)}`);
      return false;
    }

    if (!this.isMeasurementMessage(message)) {
      this.logger.warn('Rejected measurement with invalid message fields');
      return false;
    }

    const timestamp = new Date(message.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      this.logger.warn(`Rejected measurement with invalid timestamp for ${message.variable_id}`);
      return false;
    }

    const metadata = await this.variableRepository.findOneBy({
      assetVariableId: message.variable_id,
    });
    if (!metadata) {
      this.logger.warn(`Rejected measurement for unknown AssetVariable ${message.variable_id}`);
      return false;
    }

    const typedValue = this.toTypedValue(message.value, metadata.dataType);
    if (!typedValue) {
      this.logger.warn(
        `Rejected value for AssetVariable ${message.variable_id}: expected ${metadata.dataType}`,
      );
      return false;
    }

    try {
      await this.dataSource.query(
        `INSERT INTO "measurements" ("variable_id", "timestamp", "numeric_value", "boolean_value", "text_value")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          message.variable_id,
          timestamp,
          typedValue.numericValue,
          typedValue.booleanValue,
          typedValue.textValue,
        ],
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to persist measurement for AssetVariable ${message.variable_id}: ${this.describe(error)}`,
      );
      return false;
    }
  }

  private isMeasurementMessage(value: unknown): value is MeasurementMessage {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const message = value as Record<string, unknown>;
    return (
      typeof message.variable_id === 'string' &&
      UUID_PATTERN.test(message.variable_id) &&
      typeof message.timestamp === 'string' &&
      Object.hasOwn(message, 'value') &&
      message.value !== null &&
      message.value !== undefined
    );
  }

  private toTypedValue(value: unknown, dataType: string): TypedMeasurementValue | null {
    switch (dataType.trim().toUpperCase()) {
      case 'FLOAT':
        return typeof value === 'number' && Number.isFinite(value)
          ? { numericValue: value, booleanValue: null, textValue: null }
          : null;
      case 'INTEGER':
        return typeof value === 'number' && Number.isInteger(value)
          ? { numericValue: value, booleanValue: null, textValue: null }
          : null;
      case 'BOOLEAN':
        return typeof value === 'boolean'
          ? { numericValue: null, booleanValue: value, textValue: null }
          : null;
      case 'STRING':
        return typeof value === 'string'
          ? { numericValue: null, booleanValue: null, textValue: value }
          : null;
      default:
        return null;
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}