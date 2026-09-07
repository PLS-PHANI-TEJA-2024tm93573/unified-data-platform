import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('data_service_variables')
export class DataServiceVariable {
  @PrimaryColumn('uuid', { name: 'asset_variable_id' })
  assetVariableId!: string;

  @Column('uuid', { name: 'asset_id' })
  assetId!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar', { name: 'data_type' })
  dataType!: string;

  @Column('varchar', { nullable: true })
  unit!: string | null;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}