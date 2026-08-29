import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddAssetVariableDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ format: 'uuid' })
  variableDefinitionId!: string;
}
