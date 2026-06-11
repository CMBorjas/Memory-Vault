#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Memory Vault Desktop Launcher Installer
#  Configures and registers the launcher for Arch Garuda
#  Linux (KDE Plasma / Wayland).
#
#  Strategy: The project root contains spaces ("Memory Vault"),
#  which the .desktop Exec= field cannot handle reliably on KDE.
#  We resolve this by:
#    1. Creating a symlink at ~/.local/bin/memory-vault-launch
#       that points to the real launch.sh (no spaces in symlink path).
#    2. Copying the icon to ~/.local/share/icons/memory-vault.png
#       (no spaces in icon path).
#  Both the applications/ entry and the Desktop shortcut use these
#  clean paths, so KDE Plasma parses them without issue.
# ══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Installing Memory Vault Desktop Launcher ==="

# ── Source paths (may contain spaces) ────────────────────
REAL_LAUNCH="${SCRIPT_DIR}/launch.sh"
REAL_ICON="${PROJECT_ROOT}/mnemonic_engine/static/icon.png"
DESKTOP_TEMPLATE="${PROJECT_ROOT}/memory-vault.desktop"

# ── Clean install paths (no spaces) ──────────────────────
CLEAN_BIN="${HOME}/.local/bin/memory-vault-launch"
CLEAN_ICON="${HOME}/.local/share/icons/memory-vault.png"
APP_ENTRY="${HOME}/.local/share/applications/memory-vault.desktop"
DESKTOP_FILE="${HOME}/Desktop/memory-vault.desktop"

# ── 1. Make the real launch script executable ─────────────
echo "Making launch script executable..."
chmod +x "${REAL_LAUNCH}"

# ── 2. Create the space-free symlink for the Exec= path ───
echo "Creating clean-path symlink at ${CLEAN_BIN}..."
mkdir -p "$(dirname "${CLEAN_BIN}")"
ln -sf "${REAL_LAUNCH}" "${CLEAN_BIN}"
chmod +x "${CLEAN_BIN}"

# ── 3. Copy the icon to a clean path ──────────────────────
if [ -f "${REAL_ICON}" ]; then
    echo "Installing icon to ${CLEAN_ICON}..."
    mkdir -p "$(dirname "${CLEAN_ICON}")"
    cp "${REAL_ICON}" "${CLEAN_ICON}"
else
    echo "Warning: Icon not found at ${REAL_ICON}."
    CLEAN_ICON=""
fi

# ── 4. Build the .desktop file content ────────────────────
DESKTOP_CONTENT="[Desktop Entry]
Name=Memory Vault
Comment=Launch the Anti-Gravity Knowledge Engine (Mnemonic Engine + Vault)
Exec=${CLEAN_BIN}
Icon=${CLEAN_ICON}
Terminal=false
Type=Application
Categories=Education;Utility;
StartupNotify=true
X-KDE-SubstituteUID=false"

# ── 5. Write and register the applications entry ──────────
echo "Writing application launcher..."
mkdir -p "$(dirname "${APP_ENTRY}")"
echo "${DESKTOP_CONTENT}" > "${APP_ENTRY}"
chmod +x "${APP_ENTRY}"

# Mark as trusted for KDE Plasma
if command -v gio > /dev/null 2>&1; then
    gio set "${APP_ENTRY}" metadata::trusted true 2>/dev/null || true
fi

# ── 6. Write and trust the Desktop shortcut ───────────────
if [ -d "${HOME}/Desktop" ]; then
    echo "Writing Desktop shortcut..."
    echo "${DESKTOP_CONTENT}" > "${DESKTOP_FILE}"
    chmod +x "${DESKTOP_FILE}"
    if command -v gio > /dev/null 2>&1; then
        gio set "${DESKTOP_FILE}" metadata::trusted true 2>/dev/null || true
    fi
fi

# ── 7. Refresh desktop applications database ──────────────
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database "${HOME}/.local/share/applications"
fi

echo ""
echo "=== Installation Successful! ==="
echo "Exec path  : ${CLEAN_BIN} → ${REAL_LAUNCH}"
echo "Icon path  : ${CLEAN_ICON}"
echo ""
echo "You can now:"
echo "  • Double-click the Memory Vault icon on your Desktop"
echo "  • Search for 'Memory Vault' in the KDE application launcher"
echo ""
echo "If the icon shows as 'Untrusted', right-click it and"
echo "select 'Allow Launching' in the KDE Plasma menu."
