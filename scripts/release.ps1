# Package the built dist/ into a versioned release zip under releases/.
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$root = (Get-Item -LiteralPath $dir).Parent.FullName
$dist = Join-Path $root 'dist'
$releases = Join-Path $root 'releases'
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$zip = Join-Path $releases "mimowisper-$version.zip"

if (-not (Test-Path -LiteralPath $dist)) { Write-Error 'dist/ not found — run scripts/build.ps1 first.'; exit 1 }
New-Item -ItemType Directory -Path $releases -Force | Out-Null
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }

# Use Compress-Archive (PowerShell 5.1 / 7 available on Windows).
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $zip -Force
Write-Host "Release -> $zip"
