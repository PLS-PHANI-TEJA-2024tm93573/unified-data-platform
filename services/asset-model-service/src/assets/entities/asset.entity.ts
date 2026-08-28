import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AssetType } from '../../asset-types/entities/asset-type.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @ManyToOne(() => AssetType, {
    nullable: false,
  })
  @JoinColumn({ name: 'asset_type_id' })
  assetType!: AssetType;

  @ManyToOne(() => Asset, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_asset_id' })
  parentAsset?: Asset;

  @OneToMany(() => Asset, (asset) => asset.parentAsset)
  children!: Asset[];

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
