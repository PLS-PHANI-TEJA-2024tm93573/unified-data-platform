#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -eq 0 ]]; then
  SUDO=()
else
  if ! command -v sudo >/dev/null 2>&1; then
    printf 'Error: sudo is required when running as a non-root user.\n' >&2
    exit 1
  fi
  SUDO=(sudo)
fi

export DEBIAN_FRONTEND=noninteractive

install_debian() {
  local docker_repo="$ID"
  local docker_codename="${VERSION_CODENAME:-$VERSION_ID}"

  if [[ "$ID" == linuxmint || "$ID" == pop ]]; then
    docker_repo=ubuntu
    docker_codename="${UBUNTU_CODENAME:-$docker_codename}"
  fi

  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y ca-certificates curl gnupg

  "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$docker_repo/gpg" \
    | "${SUDO[@]}" gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.gpg

  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$docker_repo" "$docker_codename" \
    | "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list >/dev/null

  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_fedora() {
  "${SUDO[@]}" dnf -y install dnf-plugins-core
  "${SUDO[@]}" dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
  "${SUDO[@]}" dnf -y install \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_rhel() {
  "${SUDO[@]}" dnf -y install dnf-plugins-core
  "${SUDO[@]}" dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  "${SUDO[@]}" dnf -y install \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_arch() {
  "${SUDO[@]}" pacman -Sy --needed --noconfirm ca-certificates curl docker docker-buildx docker-compose
}

if [[ ! -r /etc/os-release ]]; then
  printf 'Error: cannot identify this Linux distribution.\n' >&2
  exit 1
fi

. /etc/os-release
case "$ID" in
  ubuntu|debian|linuxmint|pop)
    install_debian
    ;;
  fedora)
    install_fedora
    ;;
  rhel|rocky|almalinux|centos)
    install_rhel
    ;;
  arch|endeavouros|manjaro)
    install_arch
    ;;
  *)
    printf 'Error: unsupported distribution: %s\n' "$ID" >&2
    printf 'Supported families: Debian/Ubuntu, Fedora/RHEL, and Arch.\n' >&2
    exit 1
    ;;
esac

"${SUDO[@]}" systemctl enable --now docker

if [[ -n ${SUDO_USER:-} ]]; then
  DOCKER_USER=$SUDO_USER
else
  DOCKER_USER=${USER:-$(id -un)}
fi

if [[ "$DOCKER_USER" != root ]]; then
  "${SUDO[@]}" usermod -aG docker "$DOCKER_USER"
fi

printf '\nDocker installation completed.\n'
docker --version
printf 'Compose: '
docker compose version

if [[ "$DOCKER_USER" != root ]]; then
  printf '\nUser %s was added to the docker group. Start a new login session before running Docker without sudo.\n' "$DOCKER_USER"
fi
