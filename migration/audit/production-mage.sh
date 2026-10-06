#!/usr/bin/env bash
# Keep Mage's isolated backend and lifecycle while serving production frontend assets.
set -euo pipefail
production_repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
production_pnpm=$(command -v pnpm)
production_adapter_dir=$(mktemp -d)
trap 'rm -rf "$production_adapter_dir"' EXIT
export VIKUNJA_PRODUCTION_PNPM="$production_pnpm"
cat > "$production_adapter_dir/pnpm" <<'ADAPTER'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  build:dev)
    shift
    "$VIKUNJA_PRODUCTION_PNPM" exec vite build --mode production --outDir dist-dev "$@"
    exec "$VIKUNJA_PRODUCTION_PNPM" exec workbox copyLibraries dist-dev/
    ;;
  preview:dev)
    shift
    exec "$VIKUNJA_PRODUCTION_PNPM" exec vite preview --outDir dist-dev --mode production "$@"
    ;;
  *) exec "$VIKUNJA_PRODUCTION_PNPM" "$@" ;;
esac
ADAPTER
chmod +x "$production_adapter_dir/pnpm"
cd "$production_repo_root"
PATH="$production_adapter_dir:$PATH" mage test:e2e "$@"
