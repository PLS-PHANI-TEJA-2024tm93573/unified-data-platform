import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVariableDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiPropertyOptional({ maxLength: 100 })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiPropertyOptional({ maxLength: 50 })
  dataType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiPropertyOptional({ maxLength: 100 })
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ maxLength: 500 })
  description?: string;
}
