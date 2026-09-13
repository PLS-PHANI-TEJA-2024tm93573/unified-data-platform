import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MeasurementQueryDto } from './dto/measurement-query.dto';
import { MeasurementsService } from './measurements.service';

@ApiTags('Measurements')
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get measurements in a time range' })
  @ApiResponse({ status: 200, description: 'Measurements returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  @ApiResponse({ status: 404, description: 'Unknown asset variable.' })
  @ApiQuery({ name: 'asset_variable_id', required: true, type: String, description: 'Asset variable identifier' })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Start timestamp for the range' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'End timestamp for the range' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of rows to return' })
  findInRange(@Query() query: MeasurementQueryDto) {
    return this.measurementsService.findInRange(query);
  }

  @Get(':assetVariableId/latest')
  @ApiOperation({ summary: 'Get the latest measurement for an asset variable' })
  @ApiParam({
    name: 'assetVariableId',
    type: String,
    description: 'Asset variable identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Latest measurement returned successfully.' })
  @ApiResponse({ status: 404, description: 'No measurement found for the supplied asset variable.' })
  findLatest(@Param('assetVariableId', new ParseUUIDPipe()) assetVariableId: string) {
    return this.measurementsService.findLatest(assetVariableId);
  }
}