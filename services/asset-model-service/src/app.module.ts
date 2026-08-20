import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './assets/assets.module';
import { AssetTypesModule } from './asset-types/asset-types.module';
import { VariablesModule } from './variables/variables.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [AssetsModule, AssetTypesModule, VariablesModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
