import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('asset_types')
export class AssetType {
  /**
     * AssetType
        ├── id
        ├── name
        ├── description
        ├── createdAt
        └── updatedAt

        should map to 

                asset_types
        ────────────────────────────
        id            UUID PK
        name          VARCHAR UNIQUE
        description   VARCHAR NULL
        created_at    TIMESTAMP
        updated_at    TIMESTAMP
     */

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
