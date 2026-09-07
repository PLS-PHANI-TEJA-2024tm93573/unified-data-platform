import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';
import { Measurement } from '../database/entities/measurement.entity';
import { MeasurementQueryDto } from './dto/measurement-query.dto';

export const MEASUREMENT_REPOSITORY = 'MEASUREMENT_REPOSITORY';
export const DATA_SERVICE_VARIABLE_QUERY_REPOSITORY =
  'DATA_SERVICE_VARIABLE_QUERY_REPOSITORY';

export type NormalizedMeasurement = {
  timestamp: string;
  value: number | boolean | string | null;
};

export type MeasurementResponse = {
  asset_variable_id: string;
  data_type: string;
  unit: string | null;
  timestamp?: string;
  value?: number | boolean | string | null;
  data?: NormalizedMeasurement[];
};

@Injectable()
export class MeasurementsService {
  constructor(
    @Inject(MEASUREMENT_REPOSITORY)
    private readonly measurementRepository: Repository<Measurement>,
    @Inject(DATA_SERVICE_VARIABLE_QUERY_REPOSITORY)
    private readonly variableRepository: Repository<DataServiceVariable>,
  ) {}

  async findInRange(query: MeasurementQueryDto): Promise<MeasurementResponse> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from > to) {
      throw new BadRequestException('from must not be later than to');
    }
    const metadata = await this.getMetadata(query.asset_variable_id);

    const builder = this.measurementRepository
      .createQueryBuilder('measurement')
      .where('measurement.variable_id = :variableId', {
        variableId: query.asset_variable_id,
      })
      .andWhere('measurement.timestamp >= :from', { from })
      .andWhere('measurement.timestamp <= :to', { to })
      .orderBy('measurement.timestamp', 'ASC');

    if (query.limit !== undefined) {
      builder.limit(query.limit);
    }

    const measurements = await builder.getMany();
    return {
      asset_variable_id: query.asset_variable_id,
      data_type: metadata.dataType,
      unit: metadata.unit,
      data: measurements.map((measurement) => this.normalize(measurement)),
    };
  }

  async findLatest(assetVariableId: string): Promise<MeasurementResponse> {
    const metadata = await this.getMetadata(assetVariableId);
    const measurement = await this.measurementRepository
      .createQueryBuilder('measurement')
      .where('measurement.variable_id = :variableId', { variableId: assetVariableId })
      .orderBy('measurement.timestamp', 'DESC')
      .limit(1)
      .getOne();

    if (!measurement) {
      throw new NotFoundException(`No measurement found for ${assetVariableId}`);
    }

    return {
      asset_variable_id: assetVariableId,
      data_type: metadata.dataType,
      unit: metadata.unit,
      ...this.normalize(measurement),
    };
  }

  private async getMetadata(assetVariableId: string): Promise<DataServiceVariable> {
    const metadata = await this.variableRepository.findOneBy({ assetVariableId });
    if (!metadata) {
      throw new NotFoundException(`Unknown AssetVariable ${assetVariableId}`);
    }
    return metadata;
  }

  private normalize(measurement: Measurement): NormalizedMeasurement {
    let value: number | boolean | string | null = null;
    if (measurement.numericValue !== null) {
      value = measurement.numericValue;
    } else if (measurement.booleanValue !== null) {
      value = measurement.booleanValue;
    } else if (measurement.textValue !== null) {
      value = measurement.textValue;
    }

    return {
      timestamp: measurement.timestamp.toISOString(),
      value,
    };
  }
}