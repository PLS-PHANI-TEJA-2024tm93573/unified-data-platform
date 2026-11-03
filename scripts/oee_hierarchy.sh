#!/usr/bin/env bash
#
# Create ProductionLine01 demo asset hierarchy in the Asset Model Service.
#
# Requirements: bash, curl, jq
# Usage:
#   chmod +x oee_hierarchy.sh
#   ./oee_hierarchy.sh
#
# Optional:
#   BASE_URL=http://localhost:3000 ./oee_hierarchy.sh
#
# The script reuses existing asset types and variable definitions by name.
# It creates the assets if they do not already exist by name. It also checks
# existing type-variable associations and asset-variable assignments before
# creating them.
#
# API timestamps createdAt / updatedAt are server-generated. They are not
# accepted by the create endpoints and are intentionally not sent.

set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "ERROR: jq is required." >&2; exit 1; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local output="$TMP_DIR/response.json"
  local status

  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$output" -w '%{http_code}' \
      -X "$method" "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' \
      --data "$body")"
  else
    status="$(curl -sS -o "$output" -w '%{http_code}' \
      -X "$method" "${BASE_URL}${path}" \
      -H 'Accept: application/json')"
  fi

  if [[ ! "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "ERROR: $method $path returned HTTP $status" >&2
    cat "$output" >&2 || true
    echo >&2
    return 1
  fi

  cat "$output"
}

json_escape() {
  jq -Rn --arg value "$1" '$value'
}

get_or_create_type() {
  local name="$1"
  local description="$2"
  local list id payload response

  list="$(request GET "/asset-types")"
  id="$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$list" | head -n1)"

  if [[ -n "$id" ]]; then
    echo "Using existing asset type: $name ($id)" >&2
    printf '%s' "$id"
    return
  fi

  payload="$(jq -n --arg name "$name" --arg description "$description" \
    '{name:$name, description:$description}')"
  response="$(request POST "/asset-types" "$payload")"
  id="$(jq -er '.id' <<<"$response")"
  echo "Created asset type: $name ($id)" >&2
  printf '%s' "$id"
}

get_or_create_variable() {
  local name="$1"
  local data_type="$2"
  local unit="$3"
  local description="$4"
  local list id payload response

  list="$(request GET "/variables")"
  id="$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$list" | head -n1)"

  if [[ -n "$id" ]]; then
    echo "Using existing variable definition: $name ($id)" >&2
    printf '%s' "$id"
    return
  fi

  # The supplied OpenAPI schema limits CreateVariableDefinition.description
  # to 20 characters. The detailed human-readable definitions are kept in the
  # companion TXT file, so omit description from the POST body.
  payload="$(jq -n \
    --arg name "$name" \
    --arg dataType "$data_type" \
    --arg unit "$unit" \
    '{name:$name, dataType:$dataType, unit:$unit}')"

  response="$(request POST "/variables" "$payload")"
  id="$(jq -er '.id' <<<"$response")"
  echo "Created variable definition: $name ($id)" >&2
  printf '%s' "$id"
}

get_or_create_asset() {
  local name="$1"
  local type_id="$2"
  local description="$3"
  local location="$4"
  local parent_id="${5:-}"
  local list id payload response

  list="$(request GET "/assets")"
  id="$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$list" | head -n1)"

  if [[ -n "$id" ]]; then
    echo "Using existing asset: $name ($id)" >&2
    printf '%s' "$id"
    return
  fi

  if [[ -n "$parent_id" ]]; then
    payload="$(jq -n \
      --arg name "$name" \
      --arg assetTypeId "$type_id" \
      --arg description "$description" \
      --arg location "$location" \
      --arg parentAssetId "$parent_id" \
      '{name:$name, assetTypeId:$assetTypeId, description:$description,
        location:$location, parentAssetId:$parentAssetId}')"
  else
    payload="$(jq -n \
      --arg name "$name" \
      --arg assetTypeId "$type_id" \
      --arg description "$description" \
      --arg location "$location" \
      '{name:$name, assetTypeId:$assetTypeId, description:$description,
        location:$location}')"
  fi

  response="$(request POST "/assets" "$payload")"
  id="$(jq -er '.id' <<<"$response")"
  echo "Created asset: $name ($id)" >&2
  printf '%s' "$id"
}

ensure_type_variable() {
  local type_id="$1"
  local variable_id="$2"
  local required="${3:-false}"
  local existing payload

  existing="$(request GET "/asset-types/${type_id}/variables")"
  if jq -e --arg id "$variable_id" \
      '.[] | select(.variableDefinition.id == $id)' <<<"$existing" >/dev/null; then
    return
  fi

  payload="$(jq -n --arg id "$variable_id" --argjson required "$required" \
    '{variableDefinitionId:$id, required:$required}')"
  request POST "/asset-types/${type_id}/variables" "$payload" >/dev/null
}

ensure_asset_variable() {
  local asset_id="$1"
  local variable_id="$2"
  local existing payload

  existing="$(request GET "/assets/${asset_id}/variables")"
  if jq -e --arg id "$variable_id" \
      '.[] | select(.variableDefinition.id == $id)' <<<"$existing" >/dev/null; then
    return
  fi

  payload="$(jq -n --arg id "$variable_id" '{variableDefinitionId:$id}')"
  request POST "/assets/${asset_id}/variables" "$payload" >/dev/null
}

# ---------------------------------------------------------------------------
# 1. Asset types
# ---------------------------------------------------------------------------
echo "== Creating/reusing asset types =="

T_LINE="$(get_or_create_type "PRODUCTION_LINE" "Complete manufacturing production line")"
T_STATION="$(get_or_create_type "PRODUCTION_STATION" "Production station within a line")"
T_MIXER="$(get_or_create_type "MIXER" "Ingredient mixing equipment")"
T_BOILER_HUB="$(get_or_create_type "BOILER_HUB" "Logical grouping for process boilers")"
T_BOILER="$(get_or_create_type "BOILER" "Batch heating and process boiler")"
T_PUMP="$(get_or_create_type "PUMP" "Liquid transfer pump")"
T_PACKAGER="$(get_or_create_type "PACKAGER" "Bottle filling and packaging equipment")"

# ---------------------------------------------------------------------------
# 2. Variable definitions (created once, reused by name)
# ---------------------------------------------------------------------------
echo "== Creating/reusing variable definitions =="

declare -A V
add_var() {
  local key="$1" name="$2" dtype="$3" unit="$4" description="$5"
  V["$key"]="$(get_or_create_variable "$name" "$dtype" "$unit" "$description")"
}

# Production line
add_var line_status line_status STRING "-" "Current production line state"
add_var line_good total_good_bottles INTEGER bottles "Cumulative good finished bottles"
add_var line_reject total_rejected_bottles INTEGER bottles "Cumulative rejected finished bottles"
add_var line_total total_bottles INTEGER bottles "Cumulative finished bottles produced"

# Station
add_var station_status station_status STRING "-" "Current production station state"
add_var active_equipment active_equipment_count INTEGER equipment "Number of active equipment assets"

# Common equipment operation
add_var machine_status machine_status STRING "-" "Current equipment operating state"
add_var time_running time_running FLOAT s "Cumulative equipment running time"

# Mixer
add_var ingredient_weight ingredient_weight FLOAT g "Measured ingredient weight"
add_var mixing_speed mixing_speed FLOAT rpm "Actual agitator rotational speed"
add_var batch_count batch_count INTEGER batches "Cumulative completed mixing batches"
add_var batch_reject batch_rejected_count INTEGER batches "Cumulative rejected mixing batches"
add_var mixer_cycle actual_cycle_time FLOAT s/batch "Actual mixing cycle duration"
add_var batch_id batch_id STRING "-" "Current production batch identifier"

# Boiler hub
add_var hub_status hub_status STRING "-" "Boiler subsystem state"
add_var active_boilers active_boiler_count INTEGER boilers "Number of active boilers"
add_var available_boilers available_boiler_count INTEGER boilers "Number of available boilers"

# Boilers
add_var temperature temperature FLOAT "°C" "Measured process temperature"
add_var target_temperature target_temperature FLOAT "°C" "Configured temperature setpoint"
add_var pressure pressure FLOAT psi "Measured process pressure"
add_var target_pressure target_pressure FLOAT psi "Configured pressure setpoint"
add_var heating_count heating_cycle_count INTEGER cycles "Cumulative completed heating cycles"
add_var boiler_reject rejected_batch_count INTEGER batches "Cumulative batches rejected after boiler processing"
add_var heating_cycle_time actual_heating_cycle_time FLOAT s/cycle "Actual heating cycle duration"
add_var heating_active heating_cycle_active BOOLEAN "-" "Whether a heating cycle is active"

# Pump
add_var volume_pumped volume_pumped FLOAT L "Cumulative volume transferred"
add_var flow_rate flow_rate FLOAT L/min "Actual liquid flow rate"
add_var target_flow target_flow_rate FLOAT L/min "Configured target liquid flow rate"
add_var transfer_count transfer_cycle_count INTEGER transfers "Cumulative completed transfer operations"
add_var transfer_reject rejected_transfer_count INTEGER transfers "Cumulative rejected transfer operations"
add_var transfer_time actual_transfer_cycle_time FLOAT s/transfer "Actual transfer operation duration"

# Packager
add_var good_bottles good_bottles INTEGER bottles "Cumulative quality-accepted bottles"
add_var rejected_bottles rejected_bottles INTEGER bottles "Cumulative rejected bottles"
add_var production_speed production_speed FLOAT bottles/min "Actual packaging production rate"
add_var bottle_fill bottle_fill_level FLOAT mL "Measured bottle fill quantity"
add_var target_fill target_fill_level FLOAT mL "Required bottle fill quantity"
add_var jam_count jam_count INTEGER events "Cumulative packaging jam events"

# Inputs used by the KPI service to calculate OEE. Availability, performance,
# quality, and OEE are calculated outputs; they are not telemetry variables.
OEE_LINE_VARIABLES=(line_status line_total line_good line_reject)
OEE_PACKAGER_VARIABLES=(machine_status line_total good_bottles rejected_bottles)

# ---------------------------------------------------------------------------
# 3. Associate variable definitions with asset types
#    required=false because this demo may simulate only a subset initially.
# ---------------------------------------------------------------------------
echo "== Associating variables with asset types =="

associate() {
  local type_id="$1"
  shift
  local key
  for key in "$@"; do
    ensure_type_variable "$type_id" "${V[$key]}" false
  done
}

associate "$T_LINE" "${OEE_LINE_VARIABLES[@]}"
associate "$T_STATION" station_status active_equipment
associate "$T_MIXER" machine_status time_running ingredient_weight mixing_speed batch_count batch_reject mixer_cycle batch_id
associate "$T_BOILER_HUB" hub_status active_boilers available_boilers
associate "$T_BOILER" machine_status time_running temperature target_temperature pressure target_pressure heating_count boiler_reject heating_cycle_time batch_id heating_active
associate "$T_PUMP" machine_status time_running volume_pumped flow_rate target_flow transfer_count transfer_reject transfer_time batch_id
associate "$T_PACKAGER" "${OEE_PACKAGER_VARIABLES[@]}" time_running production_speed bottle_fill target_fill jam_count batch_id

# ---------------------------------------------------------------------------
# 4. Create assets in parent-before-child order
# ---------------------------------------------------------------------------
echo "== Creating/reusing assets =="

A_LINE="$(get_or_create_asset "ProductionLine01" "$T_LINE" "Beverage manufacturing production line" "Building A / Production Area")"
A_STATION="$(get_or_create_asset "Station01" "$T_STATION" "Main production station" "Building A / Production Area / Station 01" "$A_LINE")"
A_MIXER="$(get_or_create_asset "Mixer_01" "$T_MIXER" "Ingredient mixing equipment" "Station 01" "$A_STATION")"
A_HUB="$(get_or_create_asset "Boiler_Hub" "$T_BOILER_HUB" "Logical grouping for process boilers" "Station 01" "$A_STATION")"
A_BOILER1="$(get_or_create_asset "Boiler_01" "$T_BOILER" "Process heating boiler 01" "Station 01 / Boiler Area" "$A_HUB")"
A_BOILER2="$(get_or_create_asset "Boiler_02" "$T_BOILER" "Process heating boiler 02" "Station 01 / Boiler Area" "$A_HUB")"
A_PUMP="$(get_or_create_asset "Pump_0" "$T_PUMP" "Processed liquid transfer pump" "Station 01" "$A_STATION")"
A_PACKAGER="$(get_or_create_asset "Packager" "$T_PACKAGER" "Bottle filling and packaging machine" "Station 01 / Packaging Area" "$A_STATION")"

# ---------------------------------------------------------------------------
# 5. Assign variables to assets.
#    The API requires the variable to be associated with the asset's type first.
# ---------------------------------------------------------------------------
echo "== Assigning variables to assets =="

assign() {
  local asset_id="$1"
  shift
  local key
  for key in "$@"; do
    ensure_asset_variable "$asset_id" "${V[$key]}"
  done
}

assign "$A_LINE" "${OEE_LINE_VARIABLES[@]}"
assign "$A_STATION" station_status active_equipment
assign "$A_MIXER" machine_status time_running ingredient_weight mixing_speed batch_count batch_reject mixer_cycle batch_id
assign "$A_HUB" hub_status active_boilers available_boilers
assign "$A_BOILER1" machine_status time_running temperature target_temperature pressure target_pressure heating_count boiler_reject heating_cycle_time batch_id heating_active
assign "$A_BOILER2" machine_status time_running temperature target_temperature pressure target_pressure heating_count boiler_reject heating_cycle_time batch_id heating_active
assign "$A_PUMP" machine_status time_running volume_pumped flow_rate target_flow transfer_count transfer_reject transfer_time batch_id
assign "$A_PACKAGER" "${OEE_PACKAGER_VARIABLES[@]}" time_running production_speed bottle_fill target_fill jam_count batch_id

# ---------------------------------------------------------------------------
# 6. Print resulting hierarchy and audit metadata
# ---------------------------------------------------------------------------
echo
echo "== Resulting asset hierarchy =="
request GET "/assets/hierarchy" | jq .

echo
echo "== Variable definitions (includes server-generated createdAt/updatedAt) =="
request GET "/variables" | jq '[.[] | {id, name, dataType, unit, description, createdAt, updatedAt}]'

echo
echo "Done."
echo "Note: this script creates/reuses model metadata only. It does not publish telemetry readings."
