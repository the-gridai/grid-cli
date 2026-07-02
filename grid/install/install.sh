#!/bin/bash
#
# Grid CLI Installer
#
# For Private Repo - Use gh CLI:
#   gh api repos/the-gridai/grid-cli/contents/grid/install/install.sh --jq '.content' | base64 -d | bash
#
# Or clone and run:
#   git clone git@github.com:the-gridai/grid-cli.git /tmp/grid-cli-install
#   bash /tmp/grid-cli-install/grid/install/install.sh
#   rm -rf /tmp/grid-cli-install
#
# Installs the Grid CLI binary to ~/.grid/bin/grid

set -e

# Configuration
REPO="the-gridai/grid-cli"
INSTALL_DIR="${GRID_INSTALL_DIR:-$HOME/.grid/bin}"
BINARY_NAME="grid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Parse arguments
VERSION=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --version|-v)
      VERSION="$2"
      shift 2
      ;;
    --help|-h)
      echo "Grid CLI Installer"
      echo ""
      echo "Usage (requires gh CLI for private repo):"
      echo ""
      echo "  # One-liner with gh CLI:"
      echo "  gh api repos/the-gridai/grid-cli/contents/grid/install/install.sh --jq '.content' | base64 -d | bash"
      echo ""
      echo "  # Or clone and run:"
      echo "  git clone git@github.com:the-gridai/grid-cli.git /tmp/grid-install && bash /tmp/grid-install/grid/install/install.sh && rm -rf /tmp/grid-install"
      echo ""
      echo "  # With specific version:"
      echo "  bash install.sh --version v0.1.0"
      echo ""
      echo "Options:"
      echo "  --version, -v    Install a specific version (default: latest)"
      echo "  --help, -h       Show this help message"
      echo ""
      echo "Requirements:"
      echo "  - gh CLI (https://cli.github.com/) authenticated with 'gh auth login'"
      echo "  - Or GITHUB_TOKEN environment variable with repo access"
      exit 0
      ;;
    *)
      warn "Unknown option: $1"
      shift
      ;;
  esac
done

# Detect OS
detect_os() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  
  case "$os" in
    linux*)
      echo "linux"
      ;;
    darwin*)
      echo "darwin"
      ;;
    msys*|mingw*|cygwin*)
      echo "windows"
      ;;
    *)
      error "Unsupported operating system: $os"
      ;;
  esac
}

# Detect architecture
detect_arch() {
  local arch
  arch=$(uname -m)
  
  case "$arch" in
    x86_64|amd64)
      echo "amd64"
      ;;
    arm64|aarch64)
      echo "arm64"
      ;;
    *)
      error "Unsupported architecture: $arch"
      ;;
  esac
}

# Check if gh CLI is available and authenticated
check_gh_auth() {
  if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) is required for private repo access.
    
Install gh: https://cli.github.com/
Then authenticate: gh auth login

Or set GITHUB_TOKEN environment variable."
  fi
  
  if ! gh auth status &> /dev/null; then
    error "GitHub CLI is not authenticated.
    
Run: gh auth login
Or set GITHUB_TOKEN environment variable."
  fi
}

# Get latest release version
get_latest_version() {
  local latest
  
  # Try gh CLI first (works with private repos)
  if command -v gh &> /dev/null; then
    latest=$(gh release list --repo "${REPO}" --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null)
    if [ -n "$latest" ]; then
      echo "$latest"
      return
    fi
  fi
  
  # Fallback to API with GITHUB_TOKEN
  if [ -n "$GITHUB_TOKEN" ]; then
    latest=$(curl -fsSL -H "Authorization: token $GITHUB_TOKEN" \
      "https://api.github.com/repos/${REPO}/releases/latest" | \
      grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -n "$latest" ]; then
      echo "$latest"
      return
    fi
  fi
  
  error "Failed to get latest version. 
  
For private repos, ensure you have:
1. gh CLI installed and authenticated: gh auth login
2. Or set GITHUB_TOKEN environment variable"
}

# Download and install binary
install_binary() {
  local os="$1"
  local arch="$2"
  local version="$3"
  
  # Construct binary name
  local binary_name="${BINARY_NAME}-${os}-${arch}"
  if [ "$os" = "windows" ]; then
    binary_name="${binary_name}.exe"
  fi
  
  info "Downloading Grid CLI ${version} for ${os}-${arch}..."
  
  # Create install directory
  mkdir -p "$INSTALL_DIR"
  
  local install_path="${INSTALL_DIR}/${BINARY_NAME}"
  local downloaded=false
  
  # Try gh CLI first (best for private repos)
  if command -v gh &> /dev/null; then
    info "Using gh CLI to download..."
    if gh release download "${version}" --repo "${REPO}" --pattern "${binary_name}" --dir "$INSTALL_DIR" 2>/dev/null; then
      mv "${INSTALL_DIR}/${binary_name}" "$install_path"
      downloaded=true
    fi
  fi
  
  # Fallback: Try with GITHUB_TOKEN
  if [ "$downloaded" = false ] && [ -n "$GITHUB_TOKEN" ]; then
    info "Using GITHUB_TOKEN to download..."
    local download_url="https://github.com/${REPO}/releases/download/${version}/${binary_name}"
    local temp_file
    temp_file=$(mktemp)
    
    if curl -fsSL -H "Authorization: token $GITHUB_TOKEN" \
       -H "Accept: application/octet-stream" \
       "$download_url" -o "$temp_file" 2>/dev/null; then
      mv "$temp_file" "$install_path"
      downloaded=true
    else
      rm -f "$temp_file"
    fi
  fi
  
  # Check if download succeeded
  if [ "$downloaded" = false ]; then
    error "Failed to download binary.

Possible issues:
1. Version ${version} may not have a release for ${os}-${arch}
2. gh CLI not authenticated: run 'gh auth login'
3. GITHUB_TOKEN not set or invalid

Available release assets can be checked with:
  gh release view ${version} --repo ${REPO}"
  fi
  
  chmod +x "$install_path"
  info "Installed to: ${install_path}"
}

# Add to PATH in shell config
setup_path() {
  local shell_config=""
  local shell_name=""
  
  # Detect shell
  if [ -n "$ZSH_VERSION" ]; then
    shell_config="$HOME/.zshrc"
    shell_name="zsh"
  elif [ -n "$BASH_VERSION" ]; then
    shell_config="$HOME/.bashrc"
    shell_name="bash"
  elif [ -f "$HOME/.profile" ]; then
    shell_config="$HOME/.profile"
    shell_name="sh"
  fi
  
  # Check if already in PATH
  if echo "$PATH" | grep -q "$INSTALL_DIR"; then
    info "PATH already contains ${INSTALL_DIR}"
    return
  fi
  
  # Add to shell config if possible
  if [ -n "$shell_config" ]; then
    local export_line="export PATH=\"\$PATH:${INSTALL_DIR}\""
    
    if [ -f "$shell_config" ] && grep -q "$INSTALL_DIR" "$shell_config"; then
      info "PATH already configured in ${shell_config}"
    else
      echo "" >> "$shell_config"
      echo "# Grid CLI" >> "$shell_config"
      echo "$export_line" >> "$shell_config"
      info "Added ${INSTALL_DIR} to PATH in ${shell_config}"
      warn "Run 'source ${shell_config}' or open a new terminal to use grid"
    fi
  else
    warn "Could not detect shell. Please add ${INSTALL_DIR} to your PATH manually."
    echo ""
    echo "Add this to your shell configuration file:"
    echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
  fi
}

# Verify installation
verify_installation() {
  local install_path="${INSTALL_DIR}/${BINARY_NAME}"
  
  if [ ! -f "$install_path" ]; then
    error "Installation verification failed. Binary not found at ${install_path}"
  fi
  
  # Try to run the binary
  if "$install_path" --version > /dev/null 2>&1; then
    local version
    version=$("$install_path" --version 2>&1 | head -n1)
    info "Verified: ${version}"
  else
    info "Binary installed successfully"
  fi
}

# Main installation flow
main() {
  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║           Grid CLI Installer                 ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""
  
  # Check for authentication (private repo)
  if [ -z "$GITHUB_TOKEN" ]; then
    check_gh_auth
  fi
  
  # Detect OS and architecture
  local os
  local arch
  os=$(detect_os)
  arch=$(detect_arch)
  
  info "Detected: ${os}-${arch}"
  
  # Get version
  if [ -z "$VERSION" ]; then
    info "Getting latest version..."
    VERSION=$(get_latest_version)
  fi
  
  info "Version: ${VERSION}"
  
  # Install
  install_binary "$os" "$arch" "$VERSION"
  
  # Setup PATH
  setup_path
  
  # Verify
  verify_installation
  
  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║           Installation Complete!             ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""
  echo "Run 'grid --help' to get started."
  echo ""
}

main
