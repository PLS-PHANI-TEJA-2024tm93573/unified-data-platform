import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddAssetVariableDto {
  @IsUUID()
  @IsNotEmpty()
  variableDefinitionId!: string;
}
