Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$dir = $PSScriptRoot
$cfgPath = Join-Path $dir 'config.json'
$samplePath = Join-Path $dir 'config.sample.json'

# ---------- config helpers ----------
function Load-Config {
  if (Test-Path -LiteralPath $cfgPath) {
    try { return (Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json) } catch {}
  }
  if (Test-Path -LiteralPath $samplePath) {
    try { return (Get-Content -LiteralPath $samplePath -Raw | ConvertFrom-Json) } catch {}
  }
  return [pscustomobject]@{}
}
function Save-Key($key) {
  $cfg = Load-Config
  if ($null -eq $cfg.mimo_api_key) { $cfg = [pscustomobject]@{ mimo_api_key = $key } }
  else { $cfg.mimo_api_key = $key }
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
  try { $sc.IconLocation = Join-Path $env:LOCALAPPDATA 'WisprFlow\Wispr Flow.exe' } catch {}
  $sc.Save()
  return $lnk
}
function Test-WisprInstalled {
  $base = Join-Path $env:LOCALAPPDATA 'WisprFlow'
  if (-not (Test-Path -LiteralPath $base)) { return $false }
  if (Test-Path -LiteralPath (Join-Path $base 'Wispr Flow.exe')) { return $true }
  $asar = Get-ChildItem -LiteralPath $base -Recurse -Filter 'app.asar' -ErrorAction SilentlyContinue | Select-Object -First 1
  return ($null -ne $asar)
}
function Refresh-Status {
  $cfg = Load-Config
  if ($cfg.mimo_api_key -and $cfg.mimo_api_key.Length -gt 0) {
    $keyStatus.Text = 'MiMo key: Saved OK'
    $keyStatus.ForeColor = [System.Drawing.Color]::FromArgb(60,180,90)
  } else {
    $keyStatus.Text = 'MiMo key: not saved yet'
    $keyStatus.ForeColor = [System.Drawing.Color]::FromArgb(220,170,60)
  }
  if (Test-WisprInstalled) {
    $wisprStatus.Text = 'Wispr Flow: Installed'
    $wisprStatus.ForeColor = [System.Drawing.Color]::FromArgb(60,180,90)
  } else {
    $wisprStatus.Text = 'Wispr Flow: NOT installed (use Download button)'
    $wisprStatus.ForeColor = [System.Drawing.Color]::FromArgb(220,90,70)
  }
}
function Log($m) { $log.AppendText($m + [Environment]::NewLine); $log.ScrollToCaret() }
function Info($m) { [Windows.Forms.MessageBox]::Show($m, 'MiMo Flow') }

# ---------- UI ----------
$form = New-Object Windows.Forms.Form
$form.Text = 'MiMo Flow'
$form.Size = New-Object Drawing.Size(500, 420)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object Drawing.Font('Segoe UI', 10)

$title = New-Object Windows.Forms.Label
$title.Text = 'MiMo Flow'
$title.Font = New-Object Drawing.Font('Segoe UI', 18, [Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(90,80,200)
$title.Location = New-Object Drawing.Point(20, 14)
$title.Size = New-Object Drawing.Size(300, 32)
$form.Controls.Add($title)

$sub = New-Object Windows.Forms.Label
$sub.Text = 'Unlimited Wispr dictation with your own MiMo key'
$sub.ForeColor = [System.Drawing.Color]::FromArgb(120,120,120)
$sub.Location = New-Object Drawing.Point(20, 48)
$sub.Size = New-Object Drawing.Size(420, 18)
$form.Controls.Add($sub)

$gk = New-Object Windows.Forms.Button
$gk.Text = 'Get MiMo API Key'
$gk.Location = New-Object Drawing.Point(20, 80)
$gk.Size = New-Object Drawing.Size(150, 30)
$gk.BackColor = [System.Drawing.Color]::FromArgb(240,240,245)
$gk.Add_Click({ Start-Process 'https://platform.xiaomimimo.com' })
$form.Controls.Add($gk)

$dl = New-Object Windows.Forms.Button
$dl.Text = 'Download Wispr Flow'
$dl.Location = New-Object Drawing.Point(185, 80)
$dl.Size = New-Object Drawing.Size(150, 30)
$dl.BackColor = [System.Drawing.Color]::FromArgb(240,240,245)
$dl.Add_Click({ Start-Process 'https://wisprflow.ai' })
$form.Controls.Add($dl)

$lbl = New-Object Windows.Forms.Label
$lbl.Text = '1. Paste your MiMo API key here:'
$lbl.Location = New-Object Drawing.Point(20, 126)
$lbl.Size = New-Object Drawing.Size(300, 20)
$form.Controls.Add($lbl)

$tb = New-Object Windows.Forms.TextBox
$tb.Location = New-Object Drawing.Point(20, 148)
$tb.Size = New-Object Drawing.Size(300, 24)
$tb.PasswordChar = '*'
$cfg0 = Load-Config
if ($cfg0.mimo_api_key) { $tb.Text = $cfg0.mimo_api_key }
$form.Controls.Add($tb)

$save = New-Object Windows.Forms.Button
$save.Text = 'Save Key'
$save.Location = New-Object Drawing.Point(330, 146)
$save.Size = New-Object Drawing.Size(120, 30)
$save.BackColor = [System.Drawing.Color]::FromArgb(90,80,200)
$save.ForeColor = [System.Drawing.Color]::White
$save.FlatStyle = 'Flat'
$save.Add_Click({
  if (-not $tb.Text -or $tb.Text.Trim().Length -eq 0) { Info 'Pehle MiMo API key box mein daalo.'; return }
  Save-Key $tb.Text.Trim()
  Info 'Key save ho gaya (config.json mein, sirf tumhare machine pe).'
  Refresh-Status
})
$form.Controls.Add($save)

$keyStatus = New-Object Windows.Forms.Label
$keyStatus.Location = New-Object Drawing.Point(20, 180)
$keyStatus.Size = New-Object Drawing.Size(240, 18)
$form.Controls.Add($keyStatus)

$wisprStatus = New-Object Windows.Forms.Label
$wisprStatus.Location = New-Object Drawing.Point(270, 180)
$wisprStatus.Size = New-Object Drawing.Size(210, 18)
$form.Controls.Add($wisprStatus)

$start = New-Object Windows.Forms.Button
$start.Text = 'Start MiMo Flow'
$start.Location = New-Object Drawing.Point(20, 210)
$start.Size = New-Object Drawing.Size(440, 42)
$start.BackColor = [System.Drawing.Color]::FromArgb(60,180,90)
$start.ForeColor = [System.Drawing.Color]::White
$start.Font = New-Object Drawing.Font('Segoe UI', 12, [Drawing.FontStyle]::Bold)
$start.Add_Click({
  $cfg = Load-Config
  if (-not $cfg.mimo_api_key) { Info 'Pehle apni MiMo API key box mein daalo aur Save Key dabao.'; return }
  if (-not (Test-WisprInstalled)) {
    Info "Wispr Flow install nahi hai. 'Download Wispr Flow' button se install karo (sign in karo), phir Start dabao."
    Start-Process 'https://wisprflow.ai'
    return
  }
  Log 'Wispr patch kiya ja raha hai (pehli baar)...'
  $out = Run-Node (Join-Path $dir 'src\patcher\patch.js')
  Log $out
  try { Repoint-Shortcut | Out-Null } catch {}
  Log 'Proxy + Wispr start ho raha hai...'
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $dir 'launch.ps1')`""
  Log 'Ho gaya! Ab Wispr mein dictate karo.'
  Log 'Note: pehli baar Wispr microphone permission mangega - Allow karo.'
  Info 'Setup complete! MiMo Flow is running. Start dictating in Wispr.'
})
$form.Controls.Add($start)

$log = New-Object Windows.Forms.TextBox
$log.Multiline = $true
$log.ScrollBars = 'Vertical'
$log.ReadOnly = $true
$log.Location = New-Object Drawing.Point(20, 262)
$log.Size = New-Object Drawing.Size(440, 120)
$form.Controls.Add($log)

$form.Add_Shown({ Refresh-Status })
[Windows.Forms.Application]::EnableVisualStyles() | Out-Null
[Windows.Forms.Application]::Run($form)
