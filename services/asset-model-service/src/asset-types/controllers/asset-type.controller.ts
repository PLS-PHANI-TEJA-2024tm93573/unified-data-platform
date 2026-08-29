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
import { ApiTags } from '@nestjs/swagger';
import { CreateAssetTypeDto } from '../dto/create-asset-type.dto';
import { AssetTypeService } from '../services/asset-type.service';
import { AddAssetTypeVariableDto } from '../dto/add-asset-type-variable.dto';
import { UpdateAssetTypeDto } from '../dto/update-asset-type.dto';

@Controller('asset-types')
@ApiTags('Asset Types')
export class AssetTypeController {
  constructor(private readonly assetTypeService: AssetTypeService) {}

  @Post()
  create(@Body() dto: CreateAssetTypeDto) {
    return this.assetTypeService.create(dto);
  }

  @Get()
  getAllAssetTypes(
    // @Query() query: GetAssetTypesQueryDto
  ) {
    return this.assetTypeService.getAllAssetTypes();
  }

  @Get(':id')
  getAssetTypeById(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetTypeService.getAssetTypeById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetTypeDto,
  ) {
    return this.assetTypeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetTypeService.remove(id);
  }

  @Post(':assetTypeId/variables')
  addVariable(
    @Param('assetTypeId', ParseUUIDPipe) assetTypeId: string,
    @Body() dto: AddAssetTypeVariableDto,
  ) {
    return this.assetTypeService.addVariable(assetTypeId, dto);
  }

  @Delete(':assetTypeId/variables/:variableDefinitionId')
  removeVariable(
    @Param('assetTypeId', ParseUUIDPipe) assetTypeId: string,
    @Param('variableDefinitionId', ParseUUIDPipe) variableDefinitionId: string,
  ) {
    return this.assetTypeService.removeVariable(
      assetTypeId,
      variableDefinitionId,
    );
  }

  @Get(':assetTypeId/variables')
  getVariables(@Param('assetTypeId', ParseUUIDPipe) assetTypeId: string) {
    return this.assetTypeService.getVariables(assetTypeId);
  }
}
