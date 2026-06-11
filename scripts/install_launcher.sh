#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Memory Vault Desktop Launcher Installer
#  Configures and registers the launcher in the desktop database.
# ══════════════════════════════════════════════════════════

set -e

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "=== Installing Memory Vault Desktop Launcher ==="

# 1. Paths
EXEC_PATH="${SCRIPT_DIR}/launch.sh"
ICON_PATH="${PROJECT_ROOT}/mnemonic_engine/static/icon.png"
DESKTOP_TEMPLATE="${PROJECT_ROOT}/memory-vault.desktop"
DESKTOP_DEST="${HOME}/.local/share/applications/memory-vault.desktop"

# 2. Make scripts executable
echo "Making scripts executable..."
chmod +x "${EXEC_PATH}"

# 3. Verify files exist
if [ ! -f "${DESKTOP_TEMPLATE}" ]; then
    echo "Error: Template file ${DESKTOP_TEMPLATE} not found." >&2
    exit 1
fi
if [ ! -f "${ICON_PATH}" ]; then
    echo "Warning: Icon file ${ICON_PATH} not found. Icon might be missing in application launcher."
fi

# 4. Generate the personalized desktop entry file
echo "Generating customized desktop entry..."
mkdir -p "$(dirname "${DESKTOP_DEST}")"

sed -e "s|__EXEC_PATH__|${EXEC_PATH}|g" \
    -e "s|__ICON_PATH__|${ICON_PATH}|g" \
    "${DESKTOP_TEMPLATE}" > "${DESKTOP_DEST}"

# 5. Set correct permissions for desktop files
chmod +x "${DESKTOP_DEST}"

# 6. Update desktop applications database
echo "Registering application launcher with the system..."
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${HOME}/.local/share/applications"
fi

echo "=== Installation Successful! ==="
echo "You can now search for 'Memory Vault' in your applications menu."
