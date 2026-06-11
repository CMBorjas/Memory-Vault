#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Memory Vault Desktop Launcher Installer
#  Configures and registers the launcher in the desktop
#  database for Arch Garuda Linux (KDE Plasma / Wayland).
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
DESKTOP_DIR="${HOME}/Desktop"

# 2. Make launch script executable
echo "Making scripts executable..."
chmod +x "${EXEC_PATH}"

# 3. Verify template exists
if [ ! -f "${DESKTOP_TEMPLATE}" ]; then
    echo "Error: Template file ${DESKTOP_TEMPLATE} not found." >&2
    exit 1
fi

# Warn (but do not fail) if icon is missing
if [ ! -f "${ICON_PATH}" ]; then
    echo "Warning: Icon file ${ICON_PATH} not found. Icon may be missing in launcher."
fi

# 4. Escape spaces in paths for the Exec= field (backslash-space, per .desktop spec)
#    Icon= does NOT need escaping — raw paths are fine there.
EXEC_ESCAPED="${EXEC_PATH// /\\ }"

# 5. Generate the personalised desktop entry file
echo "Generating customised desktop entry..."
mkdir -p "$(dirname "${DESKTOP_DEST}")"
sed -e "s|__EXEC_PATH__|${EXEC_ESCAPED}|g" \
    -e "s|__ICON_PATH__|${ICON_PATH}|g" \
    "${DESKTOP_TEMPLATE}" > "${DESKTOP_DEST}"

# 6. Set correct permissions
chmod +x "${DESKTOP_DEST}"

# 7. Mark as trusted for KDE Plasma (prevents "untrusted launcher" dialog)
if command -v gio > /dev/null 2>&1; then
    echo "Marking launcher as trusted (gio)..."
    gio set "${DESKTOP_DEST}" metadata::trusted true 2>/dev/null || true
fi

# 8. Install a copy directly to the Desktop if the folder exists
if [ -d "${DESKTOP_DIR}" ]; then
    echo "Installing launcher to Desktop..."
    cp "${DESKTOP_DEST}" "${DESKTOP_DIR}/memory-vault.desktop"
    chmod +x "${DESKTOP_DIR}/memory-vault.desktop"
    # Trust the Desktop copy too
    if command -v gio > /dev/null 2>&1; then
        gio set "${DESKTOP_DIR}/memory-vault.desktop" metadata::trusted true 2>/dev/null || true
    fi
fi

# 9. Update desktop applications database
echo "Registering with desktop application database..."
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database "${HOME}/.local/share/applications"
fi

echo ""
echo "=== Installation Successful! ==="
echo "Launch path : ${EXEC_PATH}"
echo "Icon        : ${ICON_PATH}"
echo ""
echo "You can now:"
echo "  • Search for 'Memory Vault' in your KDE application launcher"
echo "  • Double-click the icon on your Desktop"
echo ""
echo "If the Desktop icon still shows as untrusted, right-click it"
echo "and select 'Allow Launching' in the KDE Plasma context menu."
