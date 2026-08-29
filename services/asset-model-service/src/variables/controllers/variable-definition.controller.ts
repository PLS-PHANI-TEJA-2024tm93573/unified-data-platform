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
import { CreateVariableDefinitionDto } from '../dto/create-variable-definition.dto';
import { VariableDefinitionService } from '../services/variable-definition.service';
import { UpdateVariableDefinitionDto } from '../dto/update-variable-definition.dto';

@Controller('variables')
@ApiTags('Variable Definitions')
export class VariableDefinitionController {
  constructor(
    private readonly variableDefinitionService: VariableDefinitionService,
  ) {}

  @Post()
  create(@Body() dto: CreateVariableDefinitionDto) {
    return this.variableDefinitionService.create(dto);
  }

  @Get()
  getAll() {
    return this.variableDefinitionService.getAll();
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.variableDefinitionService.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariableDefinitionDto,
  ) {
    return this.variableDefinitionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.variableDefinitionService.remove(id);
  }
}
