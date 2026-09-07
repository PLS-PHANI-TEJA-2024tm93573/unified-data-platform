import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MAX_MEASUREMENT_LIMIT = 10_000;

export class MeasurementQueryDto {
  @IsUUID()
  asset_variable_id!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEASUREMENT_LIMIT)
  limit?: number;
}