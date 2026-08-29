import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssetTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiPropertyOptional({ maxLength: 100, example: 'MOTOR' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ maxLength: 500 })
  description?: string;
}
