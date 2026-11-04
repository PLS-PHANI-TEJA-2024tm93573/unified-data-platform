
#!/usr/bin/env bash

set -Eeuo pipefail

# ==============================================
# k3s + Flux CD Installer
# Debian Linux / WSL2
# ==============================================

K3S_VERSION="${K3S_VERSION:-}"
FLUX_VERSION="${FLUX_VERSION:-}"
K3S_TIMEOUT=180

log() {
    echo -e "\n[INFO] $1"
}

error() {
    echo -e "\n[ERROR] $1" >&2
    exit 1
}

# ----------------------------------------------
# 1. Check execution environment
# ----------------------------------------------

if [[ $EUID -eq 0 ]]; then
    error "Run this script as a normal user, not with sudo."
fi

if ! grep -qi "debian" /etc/os-release; then
    error "This script is intended for Debian Linux."
fi

if ! command -v sudo >/dev/null 2>&1; then
    error "sudo is required. Install it and add your user to sudo group."
fi

sudo -v

if [[ "$(ps -p 1 -o comm= | tr -d ' ')" != "systemd" ]]; then
    error "systemd is not running.

Enable systemd inside WSL:

sudo nano /etc/wsl.conf

Add:

[boot]
systemd=true

Then execute in Windows PowerShell:

wsl --shutdown

Restart Debian and run this script again."
fi

log "Debian and systemd checks passed."

# ----------------------------------------------
# 2. Install dependencies
# ----------------------------------------------

log "Updating Debian packages..."

sudo apt-get update

sudo apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    jq \
    iptables \
    socat \
    conntrack

# ----------------------------------------------
# 3. Install k3s
# ----------------------------------------------

if command -v k3s >/dev/null 2>&1; then
    log "k3s binary already exists."
else
    log "Installing k3s..."

    if [[ -n "$K3S_VERSION" ]]; then
        curl -sfL https://get.k3s.io |
            sudo env INSTALL_K3S_VERSION="$K3S_VERSION" sh -
    else
        curl -sfL https://get.k3s.io |
            sudo sh -
    fi
fi

# ----------------------------------------------
# 4. Start k3s
# ----------------------------------------------

log "Enabling and starting k3s..."

sudo systemctl enable k3s
sudo systemctl restart k3s

# ----------------------------------------------
# 5. Configure kubectl
# ----------------------------------------------

log "Configuring kubectl..."

mkdir -p "$HOME/.kube"

if [[ -f "$HOME/.kube/config" ]]; then
    BACKUP="$HOME/.kube/config.backup.$(date +%Y%m%d%H%M%S)"
    cp "$HOME/.kube/config" "$BACKUP"
    log "Existing kubeconfig backed up to $BACKUP"
fi

sudo install \
    -o "$(id -u)" \
    -g "$(id -g)" \
    -m 600 \
    /etc/rancher/k3s/k3s.yaml \
    "$HOME/.kube/config"

export KUBECONFIG="$HOME/.kube/config"

# ----------------------------------------------
# 6. Wait for Kubernetes readiness
# ----------------------------------------------

log "Waiting for Kubernetes node..."

kubectl wait \
    --for=condition=Ready \
    node \
    --all \
    --timeout="${K3S_TIMEOUT}s"

# ----------------------------------------------
# 7. Install Flux CD CLI
# ----------------------------------------------

if command -v flux >/dev/null 2>&1; then
    log "Flux CLI already installed."
else
    log "Installing Flux CD CLI..."

    if [[ -n "$FLUX_VERSION" ]]; then
        curl -s https://fluxcd.io/install.sh |
            sudo env FLUX_VERSION="$FLUX_VERSION" bash
    else
        curl -s https://fluxcd.io/install.sh |
            sudo bash
    fi
fi

# ----------------------------------------------
# 8. Verify installations
# ----------------------------------------------

log "Checking k3s service..."

sudo systemctl is-active k3s

log "Checking Kubernetes version..."

kubectl version

log "Checking Kubernetes nodes..."

kubectl get nodes -o wide

log "Checking cluster pods..."

kubectl get pods -A

log "Checking Flux CLI..."

flux version

# ----------------------------------------------
# 9. Flux prerequisites
# ----------------------------------------------

log "Checking Flux prerequisites..."

flux check --pre

# ----------------------------------------------
# 10. Completion
# ----------------------------------------------

echo
echo "============================================"
echo " INSTALLATION COMPLETED SUCCESSFULLY"
echo "============================================"
echo
echo "Installed:"
echo "  - k3s"
echo "  - kubectl"
echo "  - Flux CD CLI"
echo
echo "Verification:"
echo "  kubectl get nodes"
echo "  kubectl get pods -A"
echo "  flux check --pre"
echo
echo "Next: Bootstrap Flux with GitHub."
echo
