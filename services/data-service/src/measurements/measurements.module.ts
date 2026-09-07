import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';
import { Measurement } from '../database/entities/measurement.entity';
import {
  DATA_SERVICE_VARIABLE_QUERY_REPOSITORY,
  MEASUREMENT_REPOSITORY,
  MeasurementsService,
} from './measurements.service';
import { MeasurementsController } from './measurements.controller';

@Module({
  controllers: [MeasurementsController],
  providers: [
    {
      provide: MEASUREMENT_REPOSITORY,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => dataSource.getRepository(Measurement),
    },
    {
      provide: DATA_SERVICE_VARIABLE_QUERY_REPOSITORY,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(DataServiceVariable),
    },
    MeasurementsService,
  ],
})
export class MeasurementsModule {}