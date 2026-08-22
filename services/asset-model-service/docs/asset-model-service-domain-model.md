classDiagram

    class AssetType {
        +UUID id
        +string name
        +string description
        +datetime createdAt
        +datetime updatedAt
    }

    class VariableDefinition {
        +UUID id
        +string name
        +DataType dataType
        +string unit
        +string description
        +datetime createdAt
        +datetime updatedAt
    }

    class AssetTypeVariable {
        +UUID assetTypeId
        +UUID variableDefinitionId
        +boolean required
    }

    class Asset {
        +UUID id
        +string name
        +UUID assetTypeId
        +UUID parentAssetId
        +string description
        +string location
        +JSON metadata
        +datetime createdAt
        +datetime updatedAt
    }

    class AssetVariable {
        +UUID assetId
        +UUID variableDefinitionId
        +boolean isCustom
    }

    class DataType {
        <<enumeration>>
        FLOAT
        INTEGER
        BOOLEAN
        STRING
    }

    AssetType "1" --> "0..*" Asset : defines type
    AssetType "1" --> "0..*" AssetTypeVariable : defines variables
    VariableDefinition "1" --> "0..*" AssetTypeVariable : used by types

    Asset "1" --> "0..*" AssetVariable : exposes
    VariableDefinition "1" --> "0..*" AssetVariable : describes

    Asset "0..1" --> "0..*" Asset : parent / children

    VariableDefinition --> DataType