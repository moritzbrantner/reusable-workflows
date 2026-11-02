#!/usr/bin/env bash
set -euo pipefail

# Trust only the official wasm-bindgen publishers. The caller pins a release
# version; GitHub's release metadata supplies the asset digest, so updating a
# tool does not require maintaining a second, repository-owned SHA table.
tool="${VERIFIED_WASM_TOOL:?VERIFIED_WASM_TOOL is required}"
version="${VERIFIED_WASM_VERSION:?VERIFIED_WASM_VERSION is required}"
if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Unsupported verified WASM CLI version: $version" >&2
  exit 2
fi

case "$tool" in
  wasm-pack) repository=wasm-bindgen/wasm-pack; tag="v$version" ;;
  wasm-bindgen) repository=wasm-bindgen/wasm-bindgen; tag="$version" ;;
  *)
    echo "Unsupported verified WASM CLI tool: $tool" >&2
    exit 2
    ;;
esac

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) target=x86_64-unknown-linux-musl ;;
  Linux-aarch64) target=aarch64-unknown-linux-musl ;;
  *)
    echo "Unsupported verified WASM CLI host: $(uname -s)-$(uname -m)" >&2
    exit 2
    ;;
esac

if [[ "$tool" == wasm-pack ]]; then
  archive_name="wasm-pack-v$version-$target.tar.gz"
  root_name="wasm-pack-v$version-$target"
else
  archive_name="wasm-bindgen-$version-$target.tar.gz"
  root_name="wasm-bindgen-$version-$target"
fi
release_url="https://github.com/$repository/releases/download/$tag/$archive_name"
api_url="https://api.github.com/repos/$repository/releases/tags/$tag"

working_dir="$(mktemp -d)"
trap 'rm -rf "$working_dir"' EXIT

authorization=()
if [[ -n "${VERIFIED_WASM_GITHUB_TOKEN:-}" ]]; then
  authorization=(-H "Authorization: Bearer $VERIFIED_WASM_GITHUB_TOKEN")
fi
curl --fail --location --silent --show-error --retry 3 \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "${authorization[@]}" "$api_url" --output "$working_dir/release.json"

digest="$(python3 - "$working_dir/release.json" "$archive_name" "$release_url" <<'PY'
import json
import re
import sys

metadata_path, archive_name, release_url = sys.argv[1:]
try:
    with open(metadata_path, encoding="utf-8") as stream:
        metadata = json.load(stream)
    matching = [asset for asset in metadata["assets"] if asset.get("name") == archive_name]
    if len(matching) != 1 or matching[0].get("browser_download_url") != release_url:
        raise ValueError("expected release asset is absent or has an unexpected URL")
    digest = matching[0].get("digest")
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[a-fA-F0-9]{64}", digest):
        raise ValueError("release asset has no valid publisher-reported SHA-256 digest")
except (OSError, ValueError, KeyError, TypeError) as error:
    sys.exit(f"Invalid official WASM release metadata: {error}")
print(digest.removeprefix("sha256:"))
PY
)"

archive="$working_dir/$archive_name"
curl --fail --location --silent --show-error --retry 3 "$release_url" --output "$archive"
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status || {
  echo "SHA-256 mismatch for official $tool $version release" >&2
  exit 1
}

install_dir="$RUNNER_TEMP/verified-wasm-cli/$tool/$version/bin"
tar -xzf "$archive" -C "$working_dir"
mkdir -p "$install_dir"
install -m 0755 "$working_dir/$root_name/$tool" "$install_dir/$tool"
test "$("$install_dir/$tool" --version)" = "$tool $version" || {
  echo "Official $tool reported an unexpected version" >&2
  exit 1
}

# GITHUB_PATH takes effect in subsequent steps, not in this calling shell.
printf '%s\n' "$install_dir" >> "$GITHUB_PATH"
echo "Installed official $tool $version ($target); publisher digest verified"
