# Build MiMo Flow into dist/ — bundles the proxy, patcher, dashboard, docs,
# and (if present) the portable node.exe + ffmpeg.exe runtimes.
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$root = (Get-Item -LiteralPath $dir).Parent.FullName
$dist = Join-Path $root 'dist'

if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

# Project files
Copy-Item -LiteralPath (Join-Path $root 'src') -Destination $dist -Recurse
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'config.sample.json') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'dashboard.ps1') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'launch.ps1') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'MiMo-Flow.bat') -Destination $dist

# Optional portable runtimes (added by maintainer before packaging)
$node = Join-Path $root 'node.exe'
$ffmpeg = Join-Path $root 'ffmpeg.exe'
if (Test-Path -LiteralPath $node) { Copy-Item -LiteralPath $node -Destination $dist } else { Write-Warning 'node.exe not found in root — add it before release.' }
if (Test-Path -LiteralPath $ffmpeg) { Copy-Item -LiteralPath $ffmpeg -Destination $dist } else { Write-Warning 'ffmpeg.exe not found in root — add it before release.' }

Write-Host "Built -> $dist"
