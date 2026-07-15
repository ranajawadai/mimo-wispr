$ErrorActionPreference = 'SilentlyContinue'
$dir = $PSScriptRoot

# Use the bundled portable node.exe if it exists, otherwise the system node.
$node = Join-Path $dir 'node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node = 'node.exe' }

# Point ffmpeg at the bundled binary when present.
$env:FFMPEG_PATH = Join-Path $dir 'ffmpeg.exe'
if (-not (Test-Path -LiteralPath $env:FFMPEG_PATH)) { $env:FFMPEG_PATH = '' }

# Self-heal: re-patch Wispr on every launch (Wispr auto-updates wipe the patch).
# The dashboard patches first and sets MIMOWISPER_SKIP_PATCH=1 to avoid double work.
if ($env:MIMOWISPER_SKIP_PATCH -ne '1') {
  $patch = Join-Path $dir 'src\patcher\patch.js'
  $patchLog = Join-Path $dir 'mimowisper-patch.log'
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = "`"$patch`""
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $p.Start() | Out-Null
  $out = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  $out | Out-File -FilePath $patchLog -Encoding UTF8
}

# Start the local proxy.
$proxy = Join-Path $dir 'src\proxy\proxy.js'
Start-Process -FilePath $node -ArgumentList $proxy -WindowStyle Hidden
Start-Sleep -Seconds 1.5

# Restart Wispr Flow so the patched asar is loaded.
Get-Process -Name 'Wispr Flow' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$wispr = Join-Path $env:LOCALAPPDATA 'WisprFlow\Wispr Flow.exe'
if (Test-Path -LiteralPath $wispr) { Start-Process -FilePath $wispr }
