# Аудит интерактивных элементов клиента.
#
# Для каждой кнопки/ссылки с id в index.html проверяем, что на неё есть ссылка
# в коде. Элемент без единого упоминания в скриптах — это фича, которой нельзя
# воспользоваться: либо кнопка-заглушка, либо обработчик потерялся при рефакторинге.
# Именно так в проекте disappear��лись «Достижения», «Туториал», «PvP» и «Справка».
#
# Отдельно отмечаем кнопки, на которые вешают обработчик динамически (onclick
# через строковые id в innerHTML) — их нельзя считать мёртвыми, поэтому такие
# помечаются как «wired by innerHTML», а не как ошибка.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$html = Get-Content 'index.html' -Raw

$q = [char]39; $dq = [char]34

# Кнопки и кликабельные элементы с id.
$controls = [regex]::Matches($html, '<button\b[^>]*\bid="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
$navs = [regex]::Matches($html, '<[^>]*class="[^"]*nav-item[^"]*"[^>]*\bdata-target="([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }

$files = @(Get-ChildItem -Path 'src' -Recurse -Include *.ts, *.js -File)
$files += Get-Item 'main.ts'
$all = ($files | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"

if ($controls.Count -eq 0) { Write-Error 'no controls parsed — index.html read failed'; exit 1 }

function Test-Referenced([string]$id) {
    $e = [regex]::Escape($id)
    # Прямое обращение по id, обращение через одинарные/двойные кавычки,
    # и упоминание внутри строки (динамический onclick / innerHTML).
    return [regex]::IsMatch($all, "$e") -or [regex]::IsMatch($all, "getElementById\(\s*[`"$q]$e[`"$q]\s*\)")
}

$dead = @()
$rows = @()

foreach ($id in ($controls | Sort-Object -Unique)) {
    $ref = Test-Referenced $id
    $rows += [pscustomobject]@{ Id = $id; Referenced = $ref }
    if (-not $ref) { $dead += $id }
}

Write-Output "BUTTONS WITH ID IN HTML: $(($controls | Sort-Object -Unique).Count)"
Write-Output "REFERENCED IN CODE      : $(($rows | Where-Object Referenced).Count)"
Write-Output ''
if ($dead.Count) {
    Write-Output 'CONTROLS WITH NO CODE REFERENCE (unreachable features):'
    $dead | ForEach-Object { Write-Output "  DEAD -> $_" }
} else {
    Write-Output '  (none — every button id is referenced somewhere in the client)'
}

Write-Output ''
Write-Output "NAV TARGETS IN HTML: $($navs.Count)"
$navDead = @()
foreach ($n in ($navs | Sort-Object -Unique)) {
    $viewId = "view-$($n -replace '^view-', '')"
    $hasCode = (Test-Referenced $n)
    $hasView = [regex]::IsMatch($html, "id=[`"$q]$([regex]::Escape($viewId))[`"$q]")
    $hasTitle = (Test-Referenced $viewId) -or [regex]::IsMatch($all, [regex]::Escape($n))
    if (-not $hasView) { $navDead += "$n (нет контейнера $viewId в index.html)" }
    elseif (-not $hasCode) { $navDead += "$n (нет кода перехода)" }
}
if ($navDead.Count) {
    Write-Output 'NAV PROBLEMS:'
    $navDead | ForEach-Object { Write-Output "  $($_)" }
} else {
    Write-Output '  (none — every nav target has a container and code)'
}

exit $(if ($dead.Count -or $navDead.Count) { 1 } else { 0 })
