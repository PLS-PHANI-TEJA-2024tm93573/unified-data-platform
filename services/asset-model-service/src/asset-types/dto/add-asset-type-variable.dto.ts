import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddAssetTypeVariableDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({ format: 'uuid' })
  variableDefinitionId!: string;

  @IsBoolean()
  @ApiProperty({ example: true })
  required!: boolean;
}
