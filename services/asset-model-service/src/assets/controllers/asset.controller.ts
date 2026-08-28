import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateAssetDto } from '../dto/create-asset.dto';
import { AssetService } from '../services/asset.service';
import { AddAssetVariableDto } from '../dto/add-asset-varaible.dto';
import { UpdateAssetDto } from '../dto/update-asset.dto';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetService.create(dto);
  }

  @Get()
  getAllAssets() {
    return this.assetService.getAllAssets();
  }

  @Get(':assetId/variables')
  getVariables(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.assetService.getVariables(assetId);
  }

  @Get(':id')
  getAsssetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetService.getAssetById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    return this.assetService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetService.remove(id);
  }

  @Post(':assetId/variables')
  addVariable(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AddAssetVariableDto,
  ) {
    return this.assetService.addVariable(assetId, dto);
  }

  @Delete(':assetId/variables/:variableDefinitionId')
  removeVariable(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Param('variableDefinitionId', ParseUUIDPipe) variableDefinitionId: string,
  ) {
    return this.assetService.removeVariable(assetId, variableDefinitionId);
  }
}
