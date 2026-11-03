import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';
import {
  DATA_SERVICE_VARIABLE_REPOSITORY,
  MeasurementConsumer,
} from './measurement.consumer';
import { NatsService } from './nats.service';
import { AssetModelSyncModule } from '../asset-model/asset-model-sync.module';

@Module({
  imports: [AssetModelSyncModule],
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
