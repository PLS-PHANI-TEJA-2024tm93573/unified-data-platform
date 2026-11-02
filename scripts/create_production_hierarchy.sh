#!/usr/bin/env bash
set -Eeuo pipefail

# Asset hierarchy bootstrap script
# Requirements: bash, curl, jq
BASE_URL="${BASE_URL:-http://localhost:3000}"

command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required." >&2; exit 1; }

# POST JSON and return the response body. Fail with the API's response on non-2xx.
post_json() {
  local path="$1"
  local payload="$2"
  local response status body

  response="$(curl -sS -X POST "${BASE_URL}${path}" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    --data "$payload" \
    -w $'\n%{http_code}')" || {
      echo "ERROR: Request failed: POST ${BASE_URL}${path}" >&2
      return 1
    }

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "ERROR: POST ${path} returned HTTP ${status}" >&2
    echo "$body" | jq . 2>/dev/null || echo "$body" >&2
    return 1
  fi

  printf '%s' "$body"
}

require_id() {
  local response="$1"
  local label="$2"
  local id
  id="$(jq -er '.id' <<<"$response")" || {
    echo "ERROR: Could not read .id from ${label} response:" >&2
    jq . <<<"$response" >&2 || true
    return 1
  }
  printf '%s' "$id"
}

create_variable() {
  local name="$1" data_type="$2" unit="$3" description="$4"
  local payload response id
  payload="$(jq -n \
    --arg name "$name" \
    --arg dataType "$data_type" \
    --arg unit "$unit" \
    --arg description "$description" \
    '{name:$name, dataType:$dataType, unit:$unit, description:$description}')"
  response="$(post_json "/variables" "$payload")"
  id="$(require_id "$response" "variable ${name}")"
  echo "Created variable definition: ${name} (${id})" >&2
  printf '%s' "$id"
}

create_asset_type() {
  local name="$1" description="$2"
  local payload response id
  payload="$(jq -n --arg name "$name" --arg description "$description" \
    '{name:$name, description:$description}')"
  response="$(post_json "/asset-types" "$payload")"
  id="$(require_id "$response" "asset type ${name}")"
  echo "Created asset type: ${name} (${id})" >&2
  printf '%s' "$id"
}

associate_variable_with_type() {
  local asset_type_id="$1" variable_id="$2" type_name="$3" variable_name="$4"
  local payload
  payload="$(jq -n --arg id "$variable_id" \
    '{variableDefinitionId:$id, required:true}')"
  post_json "/asset-types/${asset_type_id}/variables" "$payload" >/dev/null
  echo "Associated ${variable_name} with ${type_name}" >&2
}

create_asset() {
  local name="$1" asset_type_id="$2" parent_id="${3:-}"
  local payload response id
  payload="$(jq -n \
    --arg name "$name" \
    --arg assetTypeId "$asset_type_id" \
    --arg parentAssetId "$parent_id" \
    '{
      name:$name,
      assetTypeId:$assetTypeId
    } + (if $parentAssetId == "" then {} else {parentAssetId:$parentAssetId} end)')"
  response="$(post_json "/assets" "$payload")"
  id="$(require_id "$response" "asset ${name}")"
  echo "Created asset: ${name} (${id})" >&2
  printf '%s' "$id"
}

assign_variable_to_asset() {
  local asset_id="$1" variable_id="$2" asset_name="$3" variable_name="$4"
  local payload
  payload="$(jq -n --arg id "$variable_id" '{variableDefinitionId:$id}')"
  post_json "/assets/${asset_id}/variables" "$payload" >/dev/null
  echo "Assigned ${variable_name} to ${asset_name}" >&2
}

echo "Using API: ${BASE_URL}"
echo "Creating variable definitions..."

# Shared variable definitions
VAR_TIME_RUNNING="$(create_variable "time_running" "FLOAT" "seconds" "Operating time")"
VAR_INGREDIENT_WEIGHT="$(create_variable "ingredient_weight" "FLOAT" "grams" "Ingredient weight")"
VAR_TEMPERATURE="$(create_variable "temperature" "FLOAT" "Celsius" "Boiler temperature")"
VAR_PRESSURE="$(create_variable "pressure" "FLOAT" "psi" "Boiler pressure")"
VAR_VOLUME_PUMPED="$(create_variable "volume_pumped" "FLOAT" "liters" "Pumped volume")"
VAR_NO_OF_BOTTLES="$(create_variable "no_of_bottles" "INTEGER" "number/hour" "Bottles per hour")"

echo
echo "Creating asset types..."

TYPE_PRODUCTION_LINE="$(create_asset_type "Production_Line" "Production line")"
TYPE_STATION="$(create_asset_type "Station" "Production station")"
TYPE_MIXER="$(create_asset_type "Mixer" "Ingredient mixer")"
TYPE_BOILER_HUB="$(create_asset_type "Boiler_Hub" "Boiler hub")"
TYPE_BOILER="$(create_asset_type "Boiler" "Boiler unit")"
TYPE_PUMP="$(create_asset_type "Pump" "Pumping unit")"
TYPE_PACKAGER="$(create_asset_type "Packager" "Packaging unit")"

echo
echo "Associating variables with asset types..."

# Production line and station
associate_variable_with_type "$TYPE_PRODUCTION_LINE" "$VAR_TIME_RUNNING" "Production_Line" "time_running"
associate_variable_with_type "$TYPE_STATION" "$VAR_TIME_RUNNING" "Station" "time_running"

# Mixer
associate_variable_with_type "$TYPE_MIXER" "$VAR_TIME_RUNNING" "Mixer" "time_running"
associate_variable_with_type "$TYPE_MIXER" "$VAR_INGREDIENT_WEIGHT" "Mixer" "ingredient_weight"

# Boiler hub and individual boilers
associate_variable_with_type "$TYPE_BOILER_HUB" "$VAR_TIME_RUNNING" "Boiler_Hub" "time_running"
associate_variable_with_type "$TYPE_BOILER" "$VAR_TIME_RUNNING" "Boiler" "time_running"
associate_variable_with_type "$TYPE_BOILER" "$VAR_TEMPERATURE" "Boiler" "temperature"
associate_variable_with_type "$TYPE_BOILER" "$VAR_PRESSURE" "Boiler" "pressure"

# Pump
associate_variable_with_type "$TYPE_PUMP" "$VAR_TIME_RUNNING" "Pump" "time_running"
associate_variable_with_type "$TYPE_PUMP" "$VAR_VOLUME_PUMPED" "Pump" "volume_pumped"

# Packager
associate_variable_with_type "$TYPE_PACKAGER" "$VAR_TIME_RUNNING" "Packager" "time_running"
associate_variable_with_type "$TYPE_PACKAGER" "$VAR_NO_OF_BOTTLES" "Packager" "no_of_bottles"

echo
echo "Creating assets and hierarchy..."

# Root
ASSET_PRODUCTION_LINE="$(create_asset "ProductionLine01" "$TYPE_PRODUCTION_LINE")"

# Station under ProductionLine01
ASSET_STATION="$(create_asset "Station01" "$TYPE_STATION" "$ASSET_PRODUCTION_LINE")"

# Direct children of Station01
ASSET_MIXER="$(create_asset "Mixer_01" "$TYPE_MIXER" "$ASSET_STATION")"
ASSET_BOILER_HUB="$(create_asset "Boiler_Hub" "$TYPE_BOILER_HUB" "$ASSET_STATION")"
ASSET_PUMP="$(create_asset "Pump_0" "$TYPE_PUMP" "$ASSET_STATION")"
ASSET_PACKAGER="$(create_asset "Packager" "$TYPE_PACKAGER" "$ASSET_STATION")"

# Boilers under Boiler_Hub
ASSET_BOILER_01="$(create_asset "Boiler_01" "$TYPE_BOILER" "$ASSET_BOILER_HUB")"
ASSET_BOILER_02="$(create_asset "Boiler_02" "$TYPE_BOILER" "$ASSET_BOILER_HUB")"

echo
echo "Assigning variables to asset instances..."

# ProductionLine01
assign_variable_to_asset "$ASSET_PRODUCTION_LINE" "$VAR_TIME_RUNNING" "ProductionLine01" "time_running"

# Station01
assign_variable_to_asset "$ASSET_STATION" "$VAR_TIME_RUNNING" "Station01" "time_running"

# Mixer_01
assign_variable_to_asset "$ASSET_MIXER" "$VAR_TIME_RUNNING" "Mixer_01" "time_running"
assign_variable_to_asset "$ASSET_MIXER" "$VAR_INGREDIENT_WEIGHT" "Mixer_01" "ingredient_weight"

# Boiler_Hub
assign_variable_to_asset "$ASSET_BOILER_HUB" "$VAR_TIME_RUNNING" "Boiler_Hub" "time_running"

# Boiler_01 and Boiler_02
for boiler_id in "$ASSET_BOILER_01" "$ASSET_BOILER_02"; do
  assign_variable_to_asset "$boiler_id" "$VAR_TIME_RUNNING" "Boiler" "time_running"
  assign_variable_to_asset "$boiler_id" "$VAR_TEMPERATURE" "Boiler" "temperature"
  assign_variable_to_asset "$boiler_id" "$VAR_PRESSURE" "Boiler" "pressure"
done

# Pump_0
assign_variable_to_asset "$ASSET_PUMP" "$VAR_TIME_RUNNING" "Pump_0" "time_running"
assign_variable_to_asset "$ASSET_PUMP" "$VAR_VOLUME_PUMPED" "Pump_0" "volume_pumped"

# Packager
assign_variable_to_asset "$ASSET_PACKAGER" "$VAR_TIME_RUNNING" "Packager" "time_running"
assign_variable_to_asset "$ASSET_PACKAGER" "$VAR_NO_OF_BOTTLES" "Packager" "no_of_bottles"

echo
echo "Bootstrap completed successfully."
echo "Root asset ID: ${ASSET_PRODUCTION_LINE}"
echo "Verify the result with: GET ${BASE_URL}/assets/hierarchy"
