import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrpcModule } from './grpc/grpc.module';
import { DataServiceVariable } from './database/entities/data-service-variable.entity';
import { Measurement } from './database/entities/measurement.entity';
import { AssetModelSyncService } from './asset-model/asset-model-sync.service';
import { NatsModule } from './nats/nats.module';
import { MeasurementsModule } from './measurements/measurements.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    GrpcModule,
    NatsModule,
    MeasurementsModule,
    TypeOrmModule.forFeature([DataServiceVariable, Measurement]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: false,
    })
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, AssetModelSyncService],
})
export class AppModule { }
