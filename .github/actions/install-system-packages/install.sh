#!/usr/bin/env bash
# Install Ubuntu system packages on CI runners without depending on a healthy apt mirror.
#
# GitHub-hosted runners fetch packages from azure.archive.ubuntu.com, which intermittently
# trickles at a few KB/s and pushes jobs into timeout-minutes. This script:
#   1. skips packages the runner image already provides (dpkg-installed, or a command of the
#      same name on PATH such as the image's /usr/local/bin/cmake), so apt is not touched at all
#      when nothing is missing;
#   2. keeps downloaded .deb files in a directory the action caches with actions/cache, keyed by
#      the exact resolved package URIs, so warm runs download nothing from the Ubuntu pool;
#   3. time-boxes every network phase and, on a stall, drops the Azure mirror for the public
#      Ubuntu archive before one retry.
set -euo pipefail
shopt -s inherit_errexit

command_name="${1:?usage: install.sh resolve|install}"

privileged() {
  if [[ "$(id -u)" == 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

output() {
  printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT:-/dev/null}"
}

archive_dir="${SYSTEM_PACKAGES_ARCHIVE_DIR:-${RUNNER_TEMP:-/tmp}/system-packages-archives}"
update_timeout="${SYSTEM_PACKAGES_UPDATE_TIMEOUT:-120}"
download_timeout="${SYSTEM_PACKAGES_DOWNLOAD_TIMEOUT:-300}"
apt_options=(-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o "Dir::Cache::Archives=$archive_dir")

requested_packages() {
  local package
  for package in ${SYSTEM_PACKAGES:-}; do
    printf '%s\n' "$package"
  done
  if [[ -n "${SYSTEM_PACKAGES_ENVIRONMENT_FILE:-}" && -f "$SYSTEM_PACKAGES_ENVIRONMENT_FILE" ]]; then
    python3 - "$SYSTEM_PACKAGES_ENVIRONMENT_FILE" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as handle:
    data = tomllib.load(handle)
for package in data.get("system", {}).get("apt", []):
    print(package)
PY
  fi
  if [[ -n "${SYSTEM_PACKAGES_PLAYWRIGHT:-}" ]]; then
    playwright_packages
  fi
}

# Playwright's own `install --with-deps` runs an unbounded apt-get against the same mirror.
# Ask it for the dependency list instead and install that list through this script.
playwright_packages() {
  local report status=0
  # shellcheck disable=SC2086 # the CLI and browser list are intentionally word-split
  report="$(${SYSTEM_PACKAGES_PLAYWRIGHT_CLI:-bunx playwright} install-deps --dry-run ${SYSTEM_PACKAGES_PLAYWRIGHT_BROWSERS:-} 2>&1)" || status=$?
  PLAYWRIGHT_REPORT="$report" python3 - "$status" <<'PY'
import os, re, sys
status = int(sys.argv[1])
report = os.environ["PLAYWRIGHT_REPORT"]
if "All system dependencies are installed" in report:
    sys.exit(0)
# Playwright >= 1.56 lists missing packages; older releases print the apt-get command line.
listed = re.search(r"Missing system dependencies \(\d+\):\n((?:[ \t]+\S+\n?)+)", report)
command = re.search(r"--no-install-recommends ([^\"\n]+)", report)
if listed:
    packages = listed.group(1).split()
elif command:
    packages = command.group(1).split()
else:
    sys.stderr.write(f"could not read Playwright system dependencies (exit {status}):\n{report}\n")
    sys.exit(2)
print("\n".join(packages))
PY
}

is_provided() {
  local package="$1" status
  status="$(dpkg-query -W -f='${db:Status-Abbrev}' "$package" 2>/dev/null || true)"
  [[ "$status" == ii* ]] && return 0
  command -v "$package" >/dev/null 2>&1
}

prefer_public_archive() {
  local mirrors=/etc/apt/apt-mirrors.txt
  echo "::warning::apt stalled on the primary mirror; retrying against archive.ubuntu.com"
  if [[ -f "$mirrors" ]] && grep -q 'azure\.archive\.ubuntu\.com' "$mirrors"; then
    grep -v 'azure\.archive\.ubuntu\.com' "$mirrors" | privileged tee "$mirrors.ci" >/dev/null
    privileged mv "$mirrors.ci" "$mirrors"
  fi
  local sources
  for sources in /etc/apt/sources.list /etc/apt/sources.list.d/*; do
    [[ -f "$sources" ]] && privileged sed -i 's#http://azure\.archive\.ubuntu\.com/#http://archive.ubuntu.com/#g' "$sources"
  done
  return 0
}

# Run an apt phase under a time limit; on failure switch mirrors once and retry.
with_mirror_fallback() {
  local limit="$1"
  shift
  if privileged timeout "$limit" "$@"; then
    return 0
  fi
  prefer_public_archive
  privileged timeout "$update_timeout" apt-get "${apt_options[@]}" update -qq
  privileged timeout "$limit" "$@"
}

resolve() {
  local -a missing=()
  local package requested
  requested="$(requested_packages)"
  while IFS= read -r package; do
    [[ -z "$package" ]] && continue
    if is_provided "$package"; then
      echo "system package already provided by the image: $package"
    else
      missing+=("$package")
    fi
  done < <(sort -u <<<"$requested")

  if (( ${#missing[@]} == 0 )); then
    echo "No system packages to install; apt is not contacted."
    output packages ""
    return 0
  fi

  echo "Missing system packages: ${missing[*]}"
  # Created as the runner user so actions/cache can restore into it; apt runs as root.
  mkdir -p "$archive_dir/partial"
  with_mirror_fallback "$update_timeout" apt-get "${apt_options[@]}" update -qq
  local uris
  uris="$(privileged apt-get "${apt_options[@]}" install --print-uris -qq -y --no-install-recommends "${missing[@]}" | awk '{print $2}' | sort)"
  printf '%s\n' "$uris" > "$archive_dir.wanted"
  local image="${ImageOS:-$(. /etc/os-release && echo "$ID$VERSION_ID")}"
  local prefix="system-packages-v1-$image-$(uname -m)-$(printf '%s\n' "${missing[@]}" | sha256sum | cut -c1-16)-"
  output packages "${missing[*]}"
  output restore_prefix "$prefix"
  output cache_key "$prefix$(printf '%s\n' "$uris" | sha256sum | cut -c1-16)"
  output archive_dir "$archive_dir"
}

install() {
  read -r -a missing <<<"${SYSTEM_PACKAGES_MISSING:?}"
  mkdir -p "$archive_dir/partial"
  # man-db trigger processing dominates dpkg time on runners and is never needed in CI.
  privileged rm -f /var/lib/man-db/auto-update || true
  with_mirror_fallback "$download_timeout" apt-get "${apt_options[@]}" install --download-only -y --no-install-recommends "${missing[@]}"
  privileged env DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" install -y --no-download --no-install-recommends "${missing[@]}"

  # Keep only the debs this package set resolves to, so the cache does not grow across updates.
  local deb
  for deb in "$archive_dir"/*.deb; do
    [[ -e "$deb" ]] || continue
    grep -qxF "$(basename "$deb")" "$archive_dir.wanted" || privileged rm -f "$deb"
  done
  privileged rm -rf "$archive_dir/partial" "$archive_dir/lock"
  privileged chown -R "$(id -u):$(id -g)" "$archive_dir"
}

case "$command_name" in
  resolve) resolve ;;
  install) install ;;
  *)
    echo "unknown command: $command_name" >&2
    exit 2
    ;;
esac
