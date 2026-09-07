import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';
import {
  DATA_SERVICE_VARIABLE_REPOSITORY,
  MeasurementConsumer,
} from './measurement.consumer';
import { NatsService } from './nats.service';

@Module({
  providers: [
    {
      provide: DATA_SERVICE_VARIABLE_REPOSITORY,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(DataServiceVariable),
    },
    MeasurementConsumer,
    NatsService,
  ],
})
export class NatsModule {}