import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MAX_MEASUREMENT_LIMIT = 10_000;

export class MeasurementQueryDto {
  @ApiProperty({
    description: 'Unique asset variable identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  asset_variable_id!: string;

  @ApiProperty({
    description: 'Start timestamp for the measurement range',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: 'End timestamp for the measurement range',
    example: '2026-09-02T00:00:00.000Z',
  })
  @IsDateString()
  to!: string;

  @ApiProperty({
    description: 'Optional maximum number of rows to return',
    example: 100,
    required: false,
    minimum: 1,
    maximum: MAX_MEASUREMENT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEASUREMENT_LIMIT)
  limit?: number;
}