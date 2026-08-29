import {
  Entity,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('variable_definitions')
export class VariableDefinition {
  /**
     * variable_definitions
        --------------------
        id
        name
        data_type
        unit
        description
        created_at
        updated_at
     * 
     */

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ name: 'data_type' })
  dataType!: string;

  @Column()
  unit!: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
