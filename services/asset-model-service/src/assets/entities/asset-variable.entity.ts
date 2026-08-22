import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Asset } from './asset.entity';
import { VariableDefinition } from '../../variables/entities/variable-definition.entity';

@Entity('asset_variables')
@Unique(['asset', 'variableDefinition'])
export class AssetVariable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Asset, { nullable: false })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @ManyToOne(() => VariableDefinition, { nullable: false })
  @JoinColumn({ name: 'variable_definition_id' })
  variableDefinition!: VariableDefinition;

  @Column({ default: false })
  isCustom!: boolean;
}