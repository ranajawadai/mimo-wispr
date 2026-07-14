Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$dir = $PSScriptRoot
$cfgPath = Join-Path $dir 'config.json'
$samplePath = Join-Path $dir 'config.sample.json'

function Load-Config {
  if (Test-Path -LiteralPath $cfgPath) {
    try { return (Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json) } catch {}
  }
  if (Test-Path -LiteralPath $samplePath) {
    try { return (Get-Content -LiteralPath $samplePath -Raw | ConvertFrom-Json) } catch {}
  }
  return [pscustomobject]@{}
}

function Save-ConfigKey($key) {
  $cfg = Load-Config
  if ($null -eq $cfg.mimo_api_key) {
    $cfg = [pscustomobject]@{ mimo_api_key = $key }
  } else {
    $cfg.mimo_api_key = $key
  }
  $cfg | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $cfgPath -Encoding UTF8
}

function Run-Node($scriptPath) {
  $node = Join-Path $dir 'node.exe'
  if (-not (Test-Path -LiteralPath $node)) { $node = 'node.exe' }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = "`"$scriptPath`""
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $p.Start() | Out-Null
  $out = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  return $out
}

function Repoint-Shortcut {
  $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Wispr Flow.lnk'
  $launcher = Join-Path $dir 'launch.ps1'
  $sh = New-Object -ComObject WScript.Shell
  $sc = $sh.CreateShortcut($lnk)
  $sc.TargetPath = 'powershell.exe'
  $sc.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`""
  $sc.WorkingDirectory = $dir
  $sc.IconLocation = Join-Path $env:LOCALAPPDATA 'WisprFlow\Wispr Flow.exe'
  $sc.Save()
  return $lnk
}

function Show-Status {
  $cfg = Load-Config
  if ($cfg.mimo_api_key -and $cfg.mimo_api_key.Length -gt 0) {
    $status.Text = 'Status: Key saved  |  Ready to launch'
    $status.ForeColor = [System.Drawing.Color]::FromArgb(60,180,90)
  } else {
    $status.Text = 'Status: No MiMo key yet  |  Paste your key and Save'
    $status.ForeColor = [System.Drawing.Color]::FromArgb(220,170,60)
  }
}

# ---- UI ----
$form = New-Object Windows.Forms.Form
$form.Text = 'MiMo Flow'
$form.Size = New-Object Drawing.Size(460, 360)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object Drawing.Font('Segoe UI', 10)

$title = New-Object Windows.Forms.Label
$title.Text = 'MiMo Flow'
$title.Font = New-Object Drawing.Font('Segoe UI', 16, [Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(90,80,200)
$title.Location = New-Object Drawing.Point(20, 14)
$title.Size = New-Object Drawing.Size(300, 30)
$form.Controls.Add($title)

$sub = New-Object Windows.Forms.Label
$sub.Text = 'Wispr Flow + your own MiMo key = unlimited dictation'
$sub.ForeColor = [System.Drawing.Color]::FromArgb(120,120,120)
$sub.Location = New-Object Drawing.Point(20, 46)
$sub.Size = New-Object Drawing.Size(400, 18)
$form.Controls.Add($sub)

$lbl = New-Object Windows.Forms.Label
$lbl.Text = 'MiMo API key:'
$lbl.Location = New-Object Drawing.Point(20, 84)
$lbl.Size = New-Object Drawing.Size(120, 22)
$form.Controls.Add($lbl)

$tb = New-Object Windows.Forms.TextBox
$tb.Location = New-Object Drawing.Point(150, 82)
$tb.Size = New-Object Drawing.Size(280, 24)
$tb.PasswordChar = '*'
$cfg0 = Load-Config
if ($cfg0.mimo_api_key) { $tb.Text = $cfg0.mimo_api_key }
$form.Controls.Add($tb)

$save = New-Object Windows.Forms.Button
$save.Text = 'Save Key'
$save.Location = New-Object Drawing.Point(150, 114)
$save.Size = New-Object Drawing.Size(120, 32)
$save.BackColor = [System.Drawing.Color]::FromArgb(90,80,200)
$save.ForeColor = [System.Drawing.Color]::White
$save.FlatStyle = 'Flat'
$save.Add_Click({
  if (-not $tb.Text -or $tb.Text.Trim().Length -eq 0) { [Windows.Forms.MessageBox]::Show('Enter your MiMo API key first.', 'MiMo Flow'); return }
  Save-ConfigKey $tb.Text.Trim()
  [Windows.Forms.MessageBox]::Show('Key saved locally (config.json). It is never shared.', 'MiMo Flow')
  Show-Status
})
$form.Controls.Add($save)

$setup = New-Object Windows.Forms.Button
$setup.Text = 'First-time Setup'
$setup.Location = New-Object Drawing.Point(20, 168)
$setup.Size = New-Object Drawing.Size(190, 38)
$setup.Add_Click({
  $out = Run-Node (Join-Path $dir 'src\patcher\patch.js')
  try { $lnk = Repoint-Shortcut } catch { $lnk = '' }
  $msg = "Wispr patched.`n$out"
  if ($lnk) { $msg += "`nDesktop shortcut repointed to MiMo Flow." }
  [Windows.Forms.MessageBox]::Show($msg, 'MiMo Flow')
})
$form.Controls.Add($setup)

$launch = New-Object Windows.Forms.Button
$launch.Text = 'Launch Wispr'
$launch.Location = New-Object Drawing.Point(240, 168)
$launch.Size = New-Object Drawing.Size(190, 38)
$launch.BackColor = [System.Drawing.Color]::FromArgb(60,180,90)
$launch.ForeColor = [System.Drawing.Color]::White
$launch.Add_Click({
  $cfg = Load-Config
  if (-not $cfg.mimo_api_key) { [Windows.Forms.MessageBox]::Show('Save your MiMo key first (Save Key).', 'MiMo Flow'); return }
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $dir 'launch.ps1')`""
  [Windows.Forms.MessageBox]::Show('Proxy started + Wispr launching.', 'MiMo Flow')
})
$form.Controls.Add($launch)

$status = New-Object Windows.Forms.Label
$status.Location = New-Object Drawing.Point(20, 220)
$status.Size = New-Object Drawing.Size(410, 20)
$form.Controls.Add($status)

$log = New-Object Windows.Forms.TextBox
$log.Multiline = $true
$log.ScrollBars = 'Vertical'
$log.ReadOnly = $true
$log.Location = New-Object Drawing.Point(20, 248)
$log.Size = New-Object Drawing.Size(410, 70)
$form.Controls.Add($log)

$form.Add_Shown({ Show-Status })
[Windows.Forms.Application]::EnableVisualStyles() | Out-Null
[Windows.Forms.Application]::Run($form)
