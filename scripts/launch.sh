#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Memory Vault Launch Script
#  Orchestrates the docker container lifecycle and opens
#  the web browser to the GUI on Arch Garuda Linux.
# ══════════════════════════════════════════════════════════

set -e

# Resolve the real path of this script, following symlinks
# (needed when launched via ~/.local/bin/memory-vault-launch symlink)
REAL_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "${REAL_SCRIPT}")"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
cd "${PROJECT_ROOT}"

echo "=== Starting Memory Vault ==="

# 1. Check if Docker Daemon is active
if ! systemctl is-active --quiet docker; then
    echo "Docker service is not active. Attempting to start docker (requires sudo)..."
    sudo systemctl start docker
fi

# 2. Check for docker compose or docker-compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose --version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Error: Neither 'docker compose' nor 'docker-compose' was found." >&2
    echo "Please install docker-compose to run this application." >&2
    exit 1
fi

# 3. Spin up docker container
echo "Launching Docker containers..."
$DOCKER_COMPOSE up -d

# 4. Wait for the FastAPI engine to become healthy
echo "Waiting for engine API on port 8000..."
MAX_ATTEMPTS=15
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -f http://localhost:8000/api/health >/dev/null 2>&1; then
        echo "Engine is online!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting ($ATTEMPT/$MAX_ATTEMPTS)..."
    sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Warning: Timeout waiting for engine on http://localhost:8000. Attempting to open browser anyway."
fi

# 5. Open Web GUI in default browser
echo "Opening Web GUI..."
xdg-open "http://localhost:8000" || echo "Failed to open browser. Please navigate to http://localhost:8000 manually."

echo "=== Startup Complete ==="
