#!/usr/bin/env bash
set -euo pipefail

# Verified byte digests were established in 2d-lab#30 and maps#222.
# Unsupported versions or architectures fail instead of floating or compiling.
tool="$VERIFIED_WASM_TOOL"
version="$VERIFIED_WASM_VERSION"
host="$(uname -s)-$(uname -m)"
case "$tool/$version/$host" in
  # Official wasm-pack v0.15.0 SHA-256 digests from the GitHub release.
  wasm-pack/0.15.0/Linux-x86_64)
    target=x86_64-unknown-linux-musl
    digest=c09f971ecaed9a2efc80fdcea7a00ef6b53c7fadc8c57d1f61b53a6aa66b668a
    ;;
  wasm-pack/0.15.0/Linux-aarch64)
    target=aarch64-unknown-linux-musl
    digest=e17ef0806381c3a0acb9c9ddad643a49facaa5a2ecf657a421d4d8f3357a24b7
    ;;
  wasm-pack/0.14.0/Linux-x86_64)
    target=x86_64-unknown-linux-musl
    digest=278a8d668085821f4d1a637bd864f1713f872b0ae3a118c77562a308c0abfe8d
    ;;
  wasm-pack/0.14.0/Linux-aarch64)
    target=aarch64-unknown-linux-musl
    digest=5941c7b05060440ff37ee50fe9009a408e63fa5ba607a3b0736f5a887ec5f2ca
    ;;
  wasm-bindgen/0.2.129/Linux-x86_64)
    target=x86_64-unknown-linux-musl
    digest=82d12bb940e2d4e72e0d5605387fc1b8ca179044e012b620f0ce4e7440e8320e
    ;;
  wasm-bindgen/0.2.129/Linux-aarch64)
    target=aarch64-unknown-linux-musl
    digest=2ed4351c35dd9440308bbb02767d47ea278efe851a52465300f3c94f5b6c2a87
    ;;
  *)
    echo "Unsupported verified WASM CLI identity: $tool/$version/$host" >&2
    exit 2
    ;;
esac

if [[ "$tool" == wasm-pack ]]; then
  archive_name="wasm-pack-v$version-$target.tar.gz"
  root_name="wasm-pack-v$version-$target"
  release_url="https://github.com/wasm-bindgen/wasm-pack/releases/download/v$version/$archive_name"
else
  archive_name="wasm-bindgen-$version-$target.tar.gz"
  root_name="wasm-bindgen-$version-$target"
  release_url="https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$version/$archive_name"
fi

working_dir="$(mktemp -d)"
trap 'rm -rf "$working_dir"' EXIT
archive="$working_dir/$archive_name"
curl --fail --location --silent --show-error --retry 3 "$release_url" --output "$archive"
printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status || {
  echo "SHA-256 mismatch for pinned $tool $version release" >&2
  exit 1
}

install_dir="$RUNNER_TEMP/verified-wasm-cli/$tool/$version/bin"
tar -xzf "$archive" -C "$working_dir"
mkdir -p "$install_dir"
install -m 0755 "$working_dir/$root_name/$tool" "$install_dir/$tool"
test "$("$install_dir/$tool" --version)" = "$tool $version" || {
  echo "Pinned $tool reported an unexpected version" >&2
  exit 1
}

# GITHUB_PATH takes effect in subsequent steps, not in this calling shell.
printf '%s\n' "$install_dir" >> "$GITHUB_PATH"
echo "Verified $tool $version ($target)"
