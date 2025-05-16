#!/bin/bash

# This script automates the process of building the Next.js frontend,
# preparing the backend by copying the frontend assets, and then
# launching the Rust backend server.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Attendance Tracker Full Application Runner ---"

# --- Phase 1: Building the Frontend (Next.js - web-ui) ---
echo ""
echo "Phase 1: Building the Frontend..."

# Navigate to the frontend directory
echo "Step 1.1: Navigating to web-ui/ directory..."
cd web-ui

# Install dependencies
echo "Step 1.2: Installing frontend dependencies with Bun..."
bun install

# Build for static export
# This assumes 'output: "export"' is set in web-ui/next.config.ts (or .js/.mjs)
echo "Step 1.3: Building static frontend assets..."
bun run build
# The output of this build is typically in the 'web-ui/out/' directory.

echo "Frontend build complete. Assets are in web-ui/out/"
cd ..
# Navigate back to the project root

# --- Phase 2: Preparing the Backend (Rust - back-end) ---
echo ""
echo "Phase 2: Preparing the Backend..."

# Define the target directory for frontend assets within the backend
# This path is relative to the backend's execution directory (where Cargo.toml is)
FRONTEND_ASSETS_TARGET_DIR="back-end/static_frontend"

echo "Step 2.1: Creating target directory for frontend assets: ${FRONTEND_ASSETS_TARGET_DIR}"
mkdir -p "${FRONTEND_ASSETS_TARGET_DIR}"

echo "Step 2.2: Copying built frontend assets from web-ui/out/ to ${FRONTEND_ASSETS_TARGET_DIR}/"
# Ensure the target directory is empty or handle existing files if necessary (here we overwrite)
# Using rsync for more robust copying (e.g., deletes files in dest not in source if --delete is used)
# For simplicity, cp -R is used here. Add '/* .' to copy contents.
cp -R web-ui/out/* "${FRONTEND_ASSETS_TARGET_DIR}/"
# An alternative using rsync that also cleans the destination:
# rsync -av --delete web-ui/out/ "${FRONTEND_ASSETS_TARGET_DIR}/"


# Configure the backend environment variable FRONTEND_BUILD_PATH
# This script assumes you have a .env file in the back-end/ directory.
# It will attempt to set or update FRONTEND_BUILD_PATH.
BACKEND_ENV_FILE="back-end/.env"
# The path in .env should be relative to where the backend executable runs,
# which is typically the 'back-end/' directory itself when using 'cargo run'.
DESIRED_ENV_PATH="./static_frontend" # Note: relative to back-end execution

echo "Step 2.3: Ensuring FRONTEND_BUILD_PATH is set correctly in ${BACKEND_ENV_FILE}..."
if [ -f "${BACKEND_ENV_FILE}" ]; then
    # Check if the variable already exists and update it
    if grep -q "^FRONTEND_BUILD_PATH=" "${BACKEND_ENV_FILE}"; then
        echo "Updating existing FRONTEND_BUILD_PATH in ${BACKEND_ENV_FILE} to ${DESIRED_ENV_PATH}"
        # Using sed: Note platform differences (GNU sed vs BSD sed for -i)
        # This version attempts to be more compatible:
        sed -i.bak "s|^FRONTEND_BUILD_PATH=.*|FRONTEND_BUILD_PATH=${DESIRED_ENV_PATH}|" "${BACKEND_ENV_FILE}" && rm "${BACKEND_ENV_FILE}.bak"
    else
        echo "Adding FRONTEND_BUILD_PATH=${DESIRED_ENV_PATH} to ${BACKEND_ENV_FILE}"
        echo "" >> "${BACKEND_ENV_FILE}" # Add a newline for separation if file doesn't end with one
        echo "FRONTEND_BUILD_PATH=${DESIRED_ENV_PATH}" >> "${BACKEND_ENV_FILE}"
    fi
else
    echo "Warning: ${BACKEND_ENV_FILE} not found. Creating it with default values."
    echo "Please ensure DATABASE_URL and other necessary variables are set!"
    echo "FRONTEND_BUILD_PATH=${DESIRED_ENV_PATH}" > "${BACKEND_ENV_FILE}"
    echo "DATABASE_URL=sqlite:database.db" >> "${BACKEND_ENV_FILE}"
    echo "CONFIRMATION_CODE_DURATION_SECONDS=300" >> "${BACKEND_ENV_FILE}"
    # Add other essential env vars if known
fi
echo "Backend environment prepared."


# --- Phase 3: Launching the Backend ---
echo ""
echo "Phase 3: Launching the Backend..."

# Navigate to the backend directory
echo "Step 3.1: Navigating to back-end/ directory..."
cd back-end

echo "Step 3.2: Launching backend server with 'cargo run'..."
echo "The server will serve frontend assets from '${DESIRED_ENV_PATH}' (relative to back-end/)"
echo "Access the application via the URL provided in the backend logs (usually http://localhost:PORT or http://127.0.0.1:PORT)."
echo "Press Ctrl+C to stop the server."

# Run the backend
# For a release build, you would use 'cargo build --release' first,
# then run the executable from 'target/release/'.
cargo run

echo ""
echo "--- Backend server stopped. ---" 