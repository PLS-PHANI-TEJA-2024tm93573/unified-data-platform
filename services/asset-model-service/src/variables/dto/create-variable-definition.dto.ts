import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVariableDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dataType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  description?: string;
}
