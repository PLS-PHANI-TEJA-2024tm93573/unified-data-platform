import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVariableDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dataType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
