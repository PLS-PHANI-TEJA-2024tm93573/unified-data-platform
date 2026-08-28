import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class AddAssetTypeVariableDto {
  @IsUUID()
  @IsNotEmpty()
  variableDefinitionId!: string;

  @IsBoolean()
  required!: boolean;
}
