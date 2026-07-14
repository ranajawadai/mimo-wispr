$ErrorActionPreference = 'SilentlyContinue'
$dir = $PSScriptRoot

# Use the bundled portable node.exe if it exists, otherwise the system node.
$node = Join-Path $dir 'node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node = 'node.exe' }

# Point ffmpeg at the bundled binary when present.
$env:FFMPEG_PATH = Join-Path $dir 'ffmpeg.exe'
if (-not (Test-Path -LiteralPath $env:FFMPEG_PATH)) { $env:FFMPEG_PATH = '' }

# Start the local proxy.
$proxy = Join-Path $dir 'src\proxy\proxy.js'
Start-Process -FilePath $node -ArgumentList $proxy -WindowStyle Hidden
Start-Sleep -Seconds 1.5

# Restart Wispr Flow so the patched asar is loaded.
Get-Process -Name 'Wispr Flow' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$wispr = Join-Path $env:LOCALAPPDATA 'WisprFlow\Wispr Flow.exe'
if (Test-Path -LiteralPath $wispr) { Start-Process -FilePath $wispr }
