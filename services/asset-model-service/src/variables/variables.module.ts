import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VariableDefinition } from './entities/variable-definition.entity';
import { VariableDefinitionService } from './services/variable-definition.service';
import { VariableDefinitionController } from './controllers/variable-definition.controller';
import { AssetTypeVariable } from '../asset-types/entities/asset-type-variable.entity';
import { AssetVariable } from '../assets/entities/asset-variable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VariableDefinition,
      AssetTypeVariable,
      AssetVariable,
    ]),
  ],
  controllers: [VariableDefinitionController],
  providers: [VariableDefinitionService],
})
export class VariablesModule {}
