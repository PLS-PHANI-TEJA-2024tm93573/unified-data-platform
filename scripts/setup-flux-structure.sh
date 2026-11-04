#!/usr/bin/env bash
set -Eeuo pipefail

# Scaffold the Flux/Kustomize layout for the unified-data-platform repository.
# Run from anywhere inside the Git repository, or pass the repository root:
#   ./setup-flux-structure.sh
#   ./setup-flux-structure.sh /path/to/unified-data-platform

ROOT_DIR="${1:-}"
if [[ -z "$ROOT_DIR" ]]; then
  ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "$ROOT_DIR" || ! -d "$ROOT_DIR/.git" ]]; then
  echo "ERROR: Could not identify a Git repository."
  echo "Usage: $0 [repository-root]"
  exit 1
fi

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
CLUSTER_DIR="$ROOT_DIR/clusters/k3s"
ROOT_KUSTOMIZATION="$CLUSTER_DIR/kustomization.yaml"
NAMESPACE_FILE="$CLUSTER_DIR/namespace.yml"

if [[ ! -f "$NAMESPACE_FILE" ]]; then
  echo "ERROR: Expected namespace manifest not found: $NAMESPACE_FILE"
  echo "This script deliberately does not invent or replace your namespace manifest."
  exit 1
fi

# Refuse to overwrite a non-empty flux-system directory. Flux bootstrap owns
# that directory and its contents should not be modified by this scaffold.
if [[ -d "$CLUSTER_DIR/flux-system" ]] && \
   find "$CLUSTER_DIR/flux-system" -mindepth 1 -print -quit | grep -q .; then
  echo "NOTE: clusters/k3s/flux-system contains files; they will be left untouched."
fi

mkdir -p \
  "$CLUSTER_DIR/infrastructure/nats" \
  "$CLUSTER_DIR/infrastructure/postgres" \
  "$CLUSTER_DIR/applications/asset-service" \
  "$CLUSTER_DIR/applications/data-service" \
  "$CLUSTER_DIR/applications/kpi-service" \
  "$CLUSTER_DIR/applications/simulator"

# Back up the existing root Kustomize file before replacing it.
if [[ -f "$ROOT_KUSTOMIZATION" ]]; then
  BACKUP="${ROOT_KUSTOMIZATION}.backup.$(date +%Y%m%d-%H%M%S)"
  cp -p "$ROOT_KUSTOMIZATION" "$BACKUP"
  echo "Backed up existing root Kustomization to:"
  echo "  $BACKUP"
fi

cat > "$ROOT_KUSTOMIZATION" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yml
  - infrastructure
  - applications
YAML

cat > "$CLUSTER_DIR/infrastructure/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources: []
YAML

cat > "$CLUSTER_DIR/applications/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources: []
YAML

echo
echo "Created the Flux/Kustomize directory structure:"
find "$CLUSTER_DIR" -maxdepth 3 -type f -print | sort

echo
echo "Validating the Kustomize build..."
if command -v kubectl >/dev/null 2>&1; then
  kubectl kustomize "$CLUSTER_DIR" >/dev/null
  echo "Kustomize build: OK"
else
  echo "WARNING: kubectl not found; skipped Kustomize validation."
fi

echo
echo "Review the changes:"
git -C "$ROOT_DIR" status --short
git -C "$ROOT_DIR" diff -- clusters/k3s

echo
echo "Next steps:"
echo "  1. Review clusters/k3s/kustomization.yaml and the generated child files."
echo "  2. Confirm namespace.yml defines Namespace/industrial-iot."
echo "  3. Commit and push the changes to main to let Flux reconcile them."
echo
echo "No workloads were deployed by this script."
