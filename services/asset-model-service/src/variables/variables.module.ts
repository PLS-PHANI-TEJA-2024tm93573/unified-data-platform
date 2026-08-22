import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VariableDefinition } from './entities/variable-definition.entity';


@Module({
    imports: [
        TypeOrmModule.forFeature([VariableDefinition])
    ]

})
export class VariablesModule {}
