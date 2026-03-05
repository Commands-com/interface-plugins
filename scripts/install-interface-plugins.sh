#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: ./scripts/install-interface-plugins.sh [options]

Options:
  --source <dir>          Source plugin directory (default: ./interface-plugins)
  --dest <dir>            Destination plugin directory (default: ~/.commands-agent/interface-plugins)
  --allowlist <file>      Allowlist output file (default: ~/.commands-agent/interface-plugins-allowed.json)
  --skip-allowlist        Do not write allowlist file
  --skip-npm-install      Skip npm install for plugins that have package.json
  --prune                 Enable stale plugin pruning (disabled by default)
  --skip-prune            Disable stale plugin pruning (explicit no-op)
  -h, --help              Show this help
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_DIR="${REPO_ROOT}/interface-plugins"
DEST_DIR="${HOME}/.commands-agent/interface-plugins"
ALLOWLIST_PATH=""
WRITE_ALLOWLIST=1
INSTALL_DEPS=1
PRUNE_EXPLICIT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="$2"; shift 2 ;;
    --dest)
      DEST_DIR="$2"; shift 2 ;;
    --allowlist)
      ALLOWLIST_PATH="$2"; shift 2 ;;
    --skip-allowlist)
      WRITE_ALLOWLIST=0; shift ;;
    --skip-npm-install)
      INSTALL_DEPS=0; shift ;;
    --prune)
      PRUNE_EXPLICIT="yes"; shift ;;
    --skip-prune)
      PRUNE_EXPLICIT="no"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Derive allowlist path from --dest when --allowlist is not explicitly provided
if [[ -z "${ALLOWLIST_PATH}" ]]; then
  ALLOWLIST_PATH="$(dirname "${DEST_DIR}")/interface-plugins-allowed.json"
fi

# Validate source before any directory creation or side effects.
if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Source directory not found: ${SOURCE_DIR}" >&2
  exit 1
fi

# Determine whether stale-plugin pruning should run.
# Pruning is disabled by default to avoid deleting plugins managed by
# other repos/tools in a shared destination directory.
if [[ -n "${PRUNE_EXPLICIT}" ]]; then
  PRUNE=$([[ "${PRUNE_EXPLICIT}" == "yes" ]] && echo 1 || echo 0)
else
  PRUNE=0
  echo "Note: stale-plugin pruning is disabled by default. Pass --prune to enable." >&2
fi

mkdir -p "${DEST_DIR}"

echo "Installing interface plugins"
echo "Source: ${SOURCE_DIR}"
echo "Dest:   ${DEST_DIR}"

shopt -s nullglob

# Collect source plugin names so we can prune stale destinations
source_plugin_names=()

for plugin_path in "${SOURCE_DIR}"/*; do
  [[ -d "${plugin_path}" ]] || continue
  plugin_name="$(basename "${plugin_path}")"
  source_plugin_names+=("${plugin_name}")
  dest_plugin_path="${DEST_DIR}/${plugin_name}"

  echo "[${plugin_name}] syncing"
  mkdir -p "${dest_plugin_path}"

  rsync_excludes=(--exclude '.DS_Store' --exclude '.git')
  # Only exclude node_modules when we will run npm install afterward;
  # with --skip-npm-install, preserve vendored node_modules from source.
  if [[ "${INSTALL_DEPS}" -eq 1 ]]; then
    rsync_excludes+=(--exclude 'node_modules/')
  fi

  rsync -a --delete "${rsync_excludes[@]}" \
    "${plugin_path}/" "${dest_plugin_path}/"

  # Marker used by prune step to avoid deleting third-party folders.
  echo "installed by commands-com-agent-interfaces" > "${dest_plugin_path}/.installed-by-commands-interface-plugins"

  if [[ "${INSTALL_DEPS}" -eq 1 && -f "${dest_plugin_path}/package.json" ]]; then
    echo "[${plugin_name}] npm install --omit=dev"
    npm install --prefix "${dest_plugin_path}" --omit=dev
  fi
done

# Remove stale destination plugin directories that no longer exist in source.
# Safety: only delete directories this installer previously managed.
if [[ "${PRUNE}" -eq 1 ]]; then
  for dest_entry in "${DEST_DIR}"/*; do
    [[ -d "${dest_entry}" ]] || continue
    entry_name="$(basename "${dest_entry}")"
    found=0
    for src_name in "${source_plugin_names[@]}"; do
      if [[ "${src_name}" == "${entry_name}" ]]; then
        found=1
        break
      fi
    done
    if [[ "${found}" -eq 0 ]]; then
      if [[ -f "${dest_entry}/.installed-by-commands-interface-plugins" ]]; then
        echo "[${entry_name}] removing stale plugin directory"
        rm -rf "${dest_entry}"
      else
        echo "[${entry_name}] skipping removal (not managed by this installer)"
      fi
    fi
  done
fi

if [[ "${WRITE_ALLOWLIST}" -eq 1 ]]; then
  node "${REPO_ROOT}/scripts/generate-interface-allowlist.mjs" "${DEST_DIR}" "${ALLOWLIST_PATH}"
fi

echo "Done. Restart Commands Desktop to load plugins."
