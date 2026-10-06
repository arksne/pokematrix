<#
.SYNOPSIS
    Сторож для долгих команд: жёсткий таймаут + прогресс + гарантированный возврат.

.DESCRIPTION
    Основная проблема прошлых прогонов: команда без верхней границы молча висит,
    и агент перестаёт отвечать. Этот скрипт исключает такое:
      - таймаут по умолчанию 20 минут, дальше процесс убивается;
      - вывод пишется в лог и одновременно печатается в консоль (хвост);
      - по завершении печатается сводка и последние строки лога.

.EXAMPLE
    pwsh tools/verify/watchdog.ps1 -TimeoutSec 900 -Log "$env:TEMP\verify.log" -Command "npm run verify"
#>
param(
    [Parameter(Mandatory = $true)][string]$Command,
    [int]$TimeoutSec = 1200,
    [string]$Log = "$env:TEMP\opencode\watchdog.log",
    [switch]$Quiet
)

$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Log) | Out-Null
if (Test-Path $Log) { Remove-Item $Log -Force }

# cmd.exe нужен для цепочек && и перенаправлений, которые pwsh не разбирает сам.
$tmp = [System.IO.Path]::GetTempFileName()
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$proc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', $Command `
    -WorkingDirectory (Get-Location).Path `
    -RedirectStandardOutput $Log `
    -RedirectStandardError "$Log.err" `
    -PassThru -WindowStyle Hidden

Write-Host "[watchdog] запущено: $Command"
Write-Host "[watchdog] pid=$($proc.Id) таймаут=${TimeoutSec}s лог=$Log"

$exited = $false
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if ($proc.HasExited) { $exited = $true; break }
    Start-Sleep -Seconds 5
}

if (-not $exited) {
    Write-Host "[watchdog] ТАЙМАУТ ${TimeoutSec}s — процесс убивается"
    try { $proc.Kill($true) } catch { try { $proc.Kill() } catch {} }
    Start-Sleep -Seconds 2
}

$code = if ($exited) { $proc.ExitCode } else { 124 }
$sw.Stop()

if (Test-Path "$Log.err") {
    $errTxt = Get-Content "$Log.err" -Raw -ErrorAction SilentlyContinue
    if ($errTxt -and $errTxt.Trim()) { Add-Content -Path $Log -Value $errTxt -Encoding UTF8 }
}

Write-Host ("[watchdog] завершено за {0:n0}s, код {1}" -f $sw.Elapsed.TotalSeconds, $code)

if (-not $Quiet -and (Test-Path $Log)) {
    Write-Host '[watchdog] ---- хвост лога ----'
    Get-Content $Log -Tail 40 -ErrorAction SilentlyContinue | ForEach-Object { "  $_" }
    Write-Host '[watchdog] ---- конец ----'
}

exit $code
