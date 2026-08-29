import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetTypeDto {
  @ApiProperty({ maxLength: 100, example: 'MOTOR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ maxLength: 500, example: 'Industrial electric motor' })
  description?: string;
}
