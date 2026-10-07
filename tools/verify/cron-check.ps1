# PokeMatrix watchdog: tsc (root+server) + vitest, log only, never pushes.
# Scheduled via: schtasks /Create /TN PokeMatrixVerify /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\ARK\pokematrix\tools\verify\cron-check.ps1" /SC MINUTE /MO 30
$repo = 'C:\Users\ARK\pokematrix'
Set-Location -LiteralPath $repo
$log = Join-Path $repo 'tools\verify\.state\cron.log'
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm'
Add-Content -LiteralPath $log -Value "[$ts] watchdog start" -Encoding utf8
npx tsc --noEmit 2>&1 | Select-Object -Last 5 | Out-File -LiteralPath $log -Append -Encoding utf8
npx tsc -p server/tsconfig.json --noEmit 2>&1 | Select-Object -Last 5 | Out-File -LiteralPath $log -Append -Encoding utf8
npm run test:vitest 2>&1 | Select-Object -Last 6 | Out-File -LiteralPath $log -Append -Encoding utf8
Add-Content -LiteralPath $log -Value "[$ts] watchdog done" -Encoding utf8
