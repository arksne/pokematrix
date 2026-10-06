# Симметрия сохранения боя: всё, что saveBattleState() записывает, обязано
# читаться обратно в restoreBattleState(). Поле, которое пишется, но не
# восстанавливается, означает потерю состояния после F5 — ровно тот класс багов,
# который закрывался в предыдущих сессиях (battle_state «не сохранялся»).
#
# Разбор примитивный и намеренно буквальный: берём строки между телами двух
# функций и сравниваем список присваиваний state.X = ... против чтений state.X.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$core = Get-Content 'src/battle/core.ts'
$text = $core -join "`n"

function Get-BodyRange([string]$fnName, [string]$nextFn) {
    $s = ($core | Select-String -Pattern "function $fnName\(" | Select-Object -First 1).LineNumber
    $e = ($core | Select-String -Pattern "function $nextFn\(" | Select-Object -First 1).LineNumber
    if (-not $s) { throw "not found: $fnName" }
    if (-not $e) { $e = $core.Count }
    return $core[($s - 1)..($e - 1)]
}

$saveBody    = Get-BodyRange 'saveBattleState'    'clearBattleState'
$restoreBody = Get-BodyRange 'restoreBattleState' 'renderBattleUI'

# Пишет: state.<field> = ... (в saveBattleState локальная переменная называется state)
$written = [regex]::Matches(($saveBody -join "`n"), 'state\.(\w+)\s*=') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

# Читает: state.<field> (без присваивания) в restoreBattleState
$readBody = $restoreBody -join "`n"
$assignedInRestore = [regex]::Matches($readBody, 'state\.(\w+)\s*=') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$read = [regex]::Matches($readBody, 'state\.(\w+)') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

# Всё, что写入, должно встречаться в restore хотя бы раз (чтение или присваивание)
$missing = $written | Where-Object { $_ -notin $read }

Write-Output "FIELDS WRITTEN BY saveBattleState : $($written.Count)"
$written | ForEach-Object { Write-Output "  $_" }
Write-Output ''
Write-Output "NOT READ BACK BY restoreBattleState: $($missing.Count)"
if ($missing) {
    $missing | ForEach-Object { Write-Output "  LOST -> $_" }
    exit 1
}
else {
    Write-Output '  (none — save/restore round-trip is symmetric)'
}
