import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { MeasurementQueryDto } from './dto/measurement-query.dto';
import { MeasurementsService } from './measurements.service';

@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get()
  findInRange(@Query() query: MeasurementQueryDto) {
    return this.measurementsService.findInRange(query);
  }

  @Get(':assetVariableId/latest')
  findLatest(@Param('assetVariableId', new ParseUUIDPipe()) assetVariableId: string) {
    return this.measurementsService.findLatest(assetVariableId);
  }
}