import { ApiProperty } from '@nestjs/swagger';

export class AssetHierarchyVariableDto {
  @ApiProperty({ format: 'uuid', example: '6b0f8c1e-1c87-4ec5-8f1a-4a7ce5e5d1a1' })
  id!: string;

  @ApiProperty({ example: 'temperature' })
  name!: string;

  @ApiProperty({ example: 'FLOAT' })
  dataType!: string;

  @ApiProperty({ example: '°C' })
  unit!: string;
}

export class AssetHierarchyAssetTypeDto {
  @ApiProperty({ format: 'uuid', example: 'e7b0f0d5-0fce-4af8-9ee2-7d50dfc0f1ff' })
  id!: string;

  @ApiProperty({ example: 'MOTOR' })
  name!: string;
}

export class AssetHierarchyNodeDto {
  @ApiProperty({ format: 'uuid', example: '2f2d3d6b-4dd5-4d0d-b4f4-cf2bb58b49d2' })
  id!: string;

  @ApiProperty({ example: 'Motor-001' })
  name!: string;

  @ApiProperty({ type: AssetHierarchyAssetTypeDto })
  assetType!: AssetHierarchyAssetTypeDto;

  @ApiProperty({ type: [AssetHierarchyVariableDto] })
  variables!: AssetHierarchyVariableDto[];

  @ApiProperty({ type: [AssetHierarchyNodeDto] })
  children!: AssetHierarchyNodeDto[];
}

export class AssetHierarchyResponseDto {
  @ApiProperty({ type: [AssetHierarchyNodeDto] })
  roots!: AssetHierarchyNodeDto[];
}
