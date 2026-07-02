#Requires -Version 5.1
<#
.SYNOPSIS
    Grid CLI Installer for Windows

.DESCRIPTION
    Downloads and installs the Grid CLI binary to %USERPROFILE%\.grid\bin
    Requires gh CLI for private repo access, or GITHUB_TOKEN environment variable.

.PARAMETER Version
    Specific version to install (default: latest)

.EXAMPLE
    # Clone and run (private repo)
    git clone git@github.com:the-gridai/grid-cli.git $env:TEMP\grid-install
    & "$env:TEMP\grid-install\grid\install\install.ps1"
    Remove-Item -Recurse -Force "$env:TEMP\grid-install"

.EXAMPLE
    # Install specific version
    $env:GRID_VERSION = "v0.1.0"; .\install.ps1
#>

[CmdletBinding()]
param(
    [string]$Version = $env:GRID_VERSION
)

$ErrorActionPreference = 'Stop'

# Configuration
$Repo = "the-gridai/grid-cli"
$BinaryName = "grid"
$InstallDir = if ($env:GRID_INSTALL_DIR) { $env:GRID_INSTALL_DIR } else { "$env:USERPROFILE\.grid\bin" }

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Get-Architecture {
    $arch = [System.Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")
    switch ($arch) {
        "AMD64" { return "amd64" }
        "ARM64" { return "arm64" }
        default { Write-Error "Unsupported architecture: $arch" }
    }
}

function Test-GhAuth {
    try {
        $ghPath = Get-Command gh -ErrorAction Stop
        $null = & gh auth status 2>&1
        return $true
    }
    catch {
        return $false
    }
}

function Get-LatestVersion {
    # Try gh CLI first
    if (Test-GhAuth) {
        try {
            $output = & gh release list --repo $Repo --limit 1 --json tagName 2>&1
            $releases = $output | ConvertFrom-Json
            if ($releases -and $releases.Count -gt 0) {
                return $releases[0].tagName
            }
        }
        catch { }
    }
    
    # Try with GITHUB_TOKEN
    if ($env:GITHUB_TOKEN) {
        try {
            $headers = @{ Authorization = "token $env:GITHUB_TOKEN" }
            $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $headers -UseBasicParsing
            return $response.tag_name
        }
        catch { }
    }
    
    Write-Error @"
Failed to get latest version.

For private repos, ensure you have:
1. gh CLI installed and authenticated: gh auth login
2. Or set GITHUB_TOKEN environment variable

Install gh CLI from: https://cli.github.com/
"@
}

function Install-Binary {
    param(
        [string]$Arch,
        [string]$Version
    )
    
    $binaryFilename = "$BinaryName-windows-$Arch.exe"
    
    Write-Info "Downloading Grid CLI $Version for windows-$Arch..."
    
    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    $installPath = Join-Path $InstallDir "$BinaryName.exe"
    $downloaded = $false
    
    # Try gh CLI first
    if (Test-GhAuth) {
        Write-Info "Using gh CLI to download..."
        try {
            Push-Location $InstallDir
            & gh release download $Version --repo $Repo --pattern $binaryFilename 2>&1 | Out-Null
            Pop-Location
            
            $downloadedFile = Join-Path $InstallDir $binaryFilename
            if (Test-Path $downloadedFile) {
                Move-Item -Path $downloadedFile -Destination $installPath -Force
                $downloaded = $true
            }
        }
        catch {
            Pop-Location
        }
    }
    
    # Try with GITHUB_TOKEN
    if (-not $downloaded -and $env:GITHUB_TOKEN) {
        Write-Info "Using GITHUB_TOKEN to download..."
        $downloadUrl = "https://github.com/$Repo/releases/download/$Version/$binaryFilename"
        $tempFile = [System.IO.Path]::GetTempFileName()
        
        try {
            $headers = @{
                Authorization = "token $env:GITHUB_TOKEN"
                Accept = "application/octet-stream"
            }
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -Headers $headers -UseBasicParsing
            Move-Item -Path $tempFile -Destination $installPath -Force
            $downloaded = $true
        }
        catch {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        }
    }
    
    if (-not $downloaded) {
        Write-Error @"
Failed to download binary.

Possible issues:
1. Version $Version may not have a release for windows-$Arch
2. gh CLI not authenticated: run 'gh auth login'
3. GITHUB_TOKEN not set or invalid

Check available releases with:
  gh release view $Version --repo $Repo
"@
    }
    
    Write-Info "Installed to: $installPath"
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    
    if ($currentPath -like "*$InstallDir*") {
        Write-Info "PATH already contains $InstallDir"
        return
    }
    
    $newPath = "$currentPath;$InstallDir"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    
    # Also update current session
    $env:PATH = "$env:PATH;$InstallDir"
    
    Write-Info "Added $InstallDir to PATH"
    Write-Warn "You may need to restart your terminal for PATH changes to take effect"
}

function Verify-Installation {
    $installPath = Join-Path $InstallDir "$BinaryName.exe"
    
    if (-not (Test-Path $installPath)) {
        Write-Error "Installation verification failed. Binary not found at $installPath"
    }
    
    try {
        $output = & $installPath --version 2>&1
        Write-Info "Verified: $output"
    }
    catch {
        Write-Info "Binary installed successfully"
    }
}

function Main {
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host "         Grid CLI Installer            " -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check authentication for private repo
    if (-not $env:GITHUB_TOKEN -and -not (Test-GhAuth)) {
        Write-Error @"
GitHub authentication required for private repo.

Please either:
1. Install and authenticate gh CLI:
   - Install from: https://cli.github.com/
   - Run: gh auth login

2. Or set GITHUB_TOKEN environment variable:
   `$env:GITHUB_TOKEN = 'your-token-here'
"@
    }
    
    # Detect architecture
    $arch = Get-Architecture
    Write-Info "Detected: windows-$arch"
    
    # Get version
    if (-not $Version) {
        Write-Info "Getting latest version..."
        $script:Version = Get-LatestVersion
    }
    Write-Info "Version: $Version"
    
    # Install
    Install-Binary -Arch $arch -Version $Version
    
    # Setup PATH
    Add-ToPath
    
    # Verify
    Verify-Installation
    
    Write-Host ""
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host "       Installation Complete!          " -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Run 'grid --help' to get started." -ForegroundColor White
    Write-Host ""
}

# Run main
Main
