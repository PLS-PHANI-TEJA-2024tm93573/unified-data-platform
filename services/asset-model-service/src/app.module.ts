import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AssetsModule } from './assets/assets.module';
import { AssetTypesModule } from './asset-types/asset-types.module';
import { VariablesModule } from './variables/variables.module';
import { DatabaseModule } from './database/database.module';
import { AssetType } from './asset-types/entities/asset-type.entity';

@Module({
  imports: [
    AssetTypesModule,
    VariablesModule,
    DatabaseModule,
    AssetsModule,
    ConfigModule.forRoot({
      isGlobal:true
    }),
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
