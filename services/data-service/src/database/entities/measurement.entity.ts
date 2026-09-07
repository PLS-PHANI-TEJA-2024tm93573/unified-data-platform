import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('measurements')
export class Measurement {
  @PrimaryColumn('uuid', { name: 'variable_id' })
  variableId!: string;

  @PrimaryColumn('timestamptz')
  timestamp!: Date;

  @Column('double precision', { name: 'numeric_value', nullable: true })
  numericValue!: number | null;

  @Column('boolean', { name: 'boolean_value', nullable: true })
  booleanValue!: boolean | null;

  @Column('text', { name: 'text_value', nullable: true })
  textValue!: string | null;
}