import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { AssetType } from "./asset-type.entity";
import { VariableDefinition } from "../../variables/entities/variable-definition.entity";


@Entity('asset_type_variables')
@Unique(['assetType', 'variableDefinition'])
export class AssetTypeVariable {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({default:false})
    required!: boolean;

    @ManyToOne(()=> AssetType, { nullable: false })
    @JoinColumn({name: 'asset_type_id'})
    assetType!:AssetType

    @ManyToOne(() => VariableDefinition, { nullable: false })
    @JoinColumn({ name: 'variable_definition_id' })
    variableDefinition!: VariableDefinition;


    

}