import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariableDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ maxLength: 100, example: 'temperature' })
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({ maxLength: 50, example: 'FLOAT' })
  dataType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @ApiProperty({ maxLength: 20, example: '°C' })
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ApiPropertyOptional({ maxLength: 20, example: 'Motor temperature' })
  description?: string;
}
