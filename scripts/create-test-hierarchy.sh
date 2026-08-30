#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required but not installed. Run: sudo apt install -y jq" >&2
    exit 1
  fi
}

wait_for_api() {
  for _ in $(seq 1 30); do
    if curl -fsS "$BASE_URL/asset-types" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "API is not responding at $BASE_URL" >&2
  exit 1
}

api_call() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"

  if [[ -n "$payload" ]]; then
    curl -sS -X "$method" \
      -H "Content-Type: application/json" \
      --data "$payload" \
      -w "\n%{http_code}" \
      "$BASE_URL$path"
  else
    curl -sS -X "$method" \
      -H "Content-Type: application/json" \
      -w "\n%{http_code}" \
      "$BASE_URL$path"
  fi
}

find_asset_type_id() {
  local name="$1"
  curl -fsS "$BASE_URL/asset-types" 2>/dev/null | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' | head -n 1
}

find_variable_definition_id() {
  local name="$1"
  curl -fsS "$BASE_URL/variables" 2>/dev/null | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' | head -n 1
}

find_asset_id() {
  local name="$1"
  curl -fsS "$BASE_URL/assets" 2>/dev/null | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' | head -n 1
}

ensure_asset_type() {
  local name="$1"
  local description="$2"
  local existing_id

  existing_id=$(find_asset_type_id "$name")
  if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
    echo "$existing_id"
    return 0
  fi

  local response
  response=$(api_call POST "/asset-types" "$(jq -nc --arg name "$name" --arg description "$description" '{name: $name, description: $description}')")

  local body="${response%$'\n'*}"
  local code="${response##*$'\n'}"

  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "$body" | jq -r '.id'
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    existing_id=$(find_asset_type_id "$name")
    if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
      echo "$existing_id"
      return 0
    fi
  fi

  echo "Failed to create asset type '$name'" >&2
  echo "$body" >&2
  exit 1
}

ensure_variable_definition() {
  local name="$1"
  local data_type="$2"
  local unit="$3"
  local description="$4"
  local existing_id

  existing_id=$(find_variable_definition_id "$name")
  if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
    echo "$existing_id"
    return 0
  fi

  local response
  response=$(api_call POST "/variables" "$(jq -nc --arg name "$name" --arg dataType "$data_type" --arg unit "$unit" --arg description "$description" '{name: $name, dataType: $dataType, unit: $unit, description: $description}')")

  local body="${response%$'\n'*}"
  local code="${response##*$'\n'}"

  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "$body" | jq -r '.id'
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    existing_id=$(find_variable_definition_id "$name")
    if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
      echo "$existing_id"
      return 0
    fi
  fi

  echo "Failed to create variable definition '$name'" >&2
  echo "$body" >&2
  exit 1
}

ensure_asset_type_variable() {
  local asset_type_id="$1"
  local variable_definition_id="$2"
  local required="$3"

  local response
  response=$(api_call POST "/asset-types/$asset_type_id/variables" "$(jq -nc --arg variableDefinitionId "$variable_definition_id" --argjson required "$required" '{variableDefinitionId: $variableDefinitionId, required: $required}')")

  local body="${response%$'\n'*}"
  local code="${response##*$'\n'}"

  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "$body" | jq .
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    echo "Association already exists for asset type $asset_type_id and variable $variable_definition_id"
    return 0
  fi

  echo "Failed to attach variable $variable_definition_id to asset type $asset_type_id" >&2
  echo "$body" >&2
  exit 1
}

ensure_asset() {
  local name="$1"
  local asset_type_id="$2"
  local parent_asset_id="${3:-}"
  local description="${4:-}"

  local existing_id
  existing_id=$(find_asset_id "$name")
  if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
    echo "$existing_id"
    return 0
  fi

  local payload
  if [[ -n "$parent_asset_id" ]]; then
    payload=$(jq -nc --arg name "$name" --arg assetTypeId "$asset_type_id" --arg parentAssetId "$parent_asset_id" --arg description "$description" '{name: $name, assetTypeId: $assetTypeId, parentAssetId: $parentAssetId, description: $description}')
  else
    payload=$(jq -nc --arg name "$name" --arg assetTypeId "$asset_type_id" --arg description "$description" '{name: $name, assetTypeId: $assetTypeId, description: $description}')
  fi

  local response
  response=$(api_call POST "/assets" "$payload")

  local body="${response%$'\n'*}"
  local code="${response##*$'\n'}"

  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "$body" | jq -r '.id'
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    existing_id=$(find_asset_id "$name")
    if [[ -n "$existing_id" && "$existing_id" != "null" ]]; then
      echo "$existing_id"
      return 0
    fi
  fi

  echo "Failed to create asset '$name'" >&2
  echo "$body" >&2
  exit 1
}

ensure_asset_variable() {
  local asset_id="$1"
  local variable_definition_id="$2"

  local response
  response=$(api_call POST "/assets/$asset_id/variables" "$(jq -nc --arg variableDefinitionId "$variable_definition_id" '{variableDefinitionId: $variableDefinitionId}')")

  local body="${response%$'\n'*}"
  local code="${response##*$'\n'}"

  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "$body" | jq .
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    echo "Asset variable association already exists for asset $asset_id and variable $variable_definition_id"
    return 0
  fi

  echo "Failed to assign variable $variable_definition_id to asset $asset_id" >&2
  echo "$body" >&2
  exit 1
}

require_jq
wait_for_api

echo "=========================================="
echo " Creating Asset Model Test Hierarchy"
echo "=========================================="

echo ""
echo "1. Creating or reusing ASSEMBLY_LINE AssetType..."
ASSEMBLY_LINE_TYPE_ID=$(ensure_asset_type "ASSEMBLY_LINE" "Assembly line")
echo "Assembly Line AssetType ID: $ASSEMBLY_LINE_TYPE_ID"

echo ""
echo "2. Creating or reusing MOTOR AssetType..."
MOTOR_TYPE_ID=$(ensure_asset_type "MOTOR" "Motor asset")
echo "Motor AssetType ID: $MOTOR_TYPE_ID"

echo ""
echo "3. Creating or reusing temperature VariableDefinition..."
TEMPERATURE_ID=$(ensure_variable_definition "temperature" "FLOAT" "C" "Motor temp")
echo "Temperature Variable ID: $TEMPERATURE_ID"

echo ""
echo "4. Creating or reusing speed VariableDefinition..."
SPEED_ID=$(ensure_variable_definition "speed" "INTEGER" "RPM" "Motor speed")
echo "Speed Variable ID: $SPEED_ID"

echo ""
echo "5. Adding temperature to MOTOR AssetType..."
ensure_asset_type_variable "$MOTOR_TYPE_ID" "$TEMPERATURE_ID" true

echo ""
echo "6. Adding speed to MOTOR AssetType..."
ensure_asset_type_variable "$MOTOR_TYPE_ID" "$SPEED_ID" true

echo ""
echo "7. Creating or reusing Assembly-Line-01..."
LINE_ID=$(ensure_asset "Assembly-Line-01" "$ASSEMBLY_LINE_TYPE_ID" "" "Test assembly")
echo "Assembly Line Asset ID: $LINE_ID"

echo ""
echo "8. Creating or reusing Motor-001..."
MOTOR_001_ID=$(ensure_asset "Motor-001" "$MOTOR_TYPE_ID" "$LINE_ID" "First test motor")
echo "Motor-001 Asset ID: $MOTOR_001_ID"

echo ""
echo "9. Creating or reusing Motor-002..."
MOTOR_002_ID=$(ensure_asset "Motor-002" "$MOTOR_TYPE_ID" "$LINE_ID" "Second test motor")
echo "Motor-002 Asset ID: $MOTOR_002_ID"

echo ""
echo "10. Assigning temperature to Motor-001..."
ensure_asset_variable "$MOTOR_001_ID" "$TEMPERATURE_ID"

echo ""
echo "11. Assigning speed to Motor-001..."
ensure_asset_variable "$MOTOR_001_ID" "$SPEED_ID"

echo ""
echo "12. Assigning temperature to Motor-002..."
ensure_asset_variable "$MOTOR_002_ID" "$TEMPERATURE_ID"

echo ""
echo "=========================================="
echo " Test data ready"
echo "=========================================="

echo ""
echo "Assembly Line:"
echo "  $LINE_ID"

echo ""
echo "Motor-001:"
echo "  $MOTOR_001_ID"

echo ""
echo "Motor-002:"
echo "  $MOTOR_002_ID"

echo ""
echo "Temperature:"
echo "  $TEMPERATURE_ID"

echo ""
echo "Speed:"
echo "  $SPEED_ID"

echo ""
echo "=========================================="
echo " Now test gRPC GetAssetHierarchy in Bruno"
echo "=========================================="
