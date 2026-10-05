# Аудит модалок: каждая должна уметь открываться и закрываться.
#
# Раньше кнопки «Достижения», «Туториал», «PvP», «Справка» вообще не существовали
# из-за условия на несуществующий #view-info. Этот скрипт ловит такое повторение,
# а заодно находит фичи, которые написаны, но недостижимы из интерфейса.
#
# Учитывает паттерн с алиасом, потому что в коде повсеместно используется
#     const modal = document.getElementById('shop-modal');
#     modal.style.display = 'flex';
# и прямая цепочка getElementById('x').style.display встречается далеко не везде.
# Без слежения за алиасами проверка даёт ложные «никогда не открыта».

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$html = Get-Content 'index.html' -Raw

# Настоящая модалка в этом проекте — элемент с классом modal-overlay.
# Отбираем по классу, а не по наличию подстроки «modal» в id: иначе в проверку
# попадают внутренние элементы модалки профиля тренера (#modal-trainer-name,
# #modal-trainer-badges, #modal-trainer-team), которые заполняются через
# innerText/innerHTML и по определению не показываются/скрываются.
$modals = [regex]::Matches($html, '<(?:div|section)[^>]*\bid="([^"]+)"[^>]*class="[^"]*modal-overlay[^"]*"') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

# Дополнительно: элементы с modal-overlay в другом порядке атрибутов.
$modals += [regex]::Matches($html, '<(?:div|section)[^>]*\bclass="[^"]*modal-overlay[^"]*"[^>]*\bid="([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }
$modals = $modals | Sort-Object -Unique

$files = @(Get-ChildItem -Path 'src' -Recurse -Include *.ts, *.js -File)
$files += Get-Item 'main.ts'
$all = ($files | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"

$q = [char]39
$dq = [char]34
$sources = @{}

if ($modals.Count -eq 0) { Write-Error 'No modals found — index.html read failed'; exit 1 }

Write-Output "MODALS IN HTML: $($modals.Count)"
Write-Output ''

$report = @()

foreach ($m in $modals) {
    $referenced = $false
    $canOpen = $false
    $canClose = $false

    # Разбираем по файлам: для каждого find(id) собираем имена переменных-алиасов.
    foreach ($f in $files) {
        $text = Get-Content $f.FullName -Raw

        $pattern = "(?:const|let|var)\s+(\w+)\s*=\s*document\.getElementById\([`"$q]$([regex]::Escape($m))[`"$q]\)"
        $aliases = @([regex]::Matches($text, $pattern) | ForEach-Object { $_.Groups[1].Value })
        $direct  = [regex]::IsMatch($text, "document\.getElementById\([`"$q]$([regex]::Escape($m))[`"$q]\)")

        if ($aliases.Count -eq 0 -and -not $direct) { continue }
        $referenced = $true

        $names = @($aliases) + '#'

        foreach ($n in $names) {
            # $n = '#' — прямая цепочка getElementById(...).style.display.
            # Между именем и .style в коде стоит TypeScript-assertion (!),
            # например `modal!.style.display = 'flex'`, поэтому он допустим.
            if ($n -eq '#') {
                if ($text -match "getElementById\([`"$q]$([regex]::Escape($m))[`"$q]\)\!?\.style\.display\s*=\s*[`"$q']flex") { $canOpen = $true }
                if ($text -match "getElementById\([`"$q]$([regex]::Escape($m))[`"$q]\)\!?\.style\.display\s*=\s*[`"$q']none") { $canClose = $true }
            }
            else {
                $esc = [regex]::Escape($n)
                if ($text -match "${esc}\!?\.style\.display\s*=\s*[`"$q']flex") { $canOpen = $true }
                if ($text -match "${esc}\!?\.style\.display\s*=\s*[`"$q']none") { $canClose = $true }
                if ($text -match "${esc}\!?\.style\.removeAttribute\(") { $canClose = $true }
            }
        }
    }

    $note = ''
    if (-not $referenced) { $note = 'NOT REFERENCED IN CODE' }
    elseif (-not $canOpen)  { $note = 'referenced but never shown' }
    elseif (-not $canClose) { $note = 'no way to close' }

    $report += [pscustomobject]@{
        Modal      = $m
        Referenced = $referenced
        Open       = $canOpen
        Close      = $canClose
        Note       = $note
    }
}

$report | Format-Table -AutoSize | Out-String -Width 200 | Write-Output

$bad = $report | Where-Object { $_.Note }
Write-Output ("=" * 60)
if ($bad) {
    $bad | ForEach-Object { Write-Output "  $($_.Modal): $($_.Note)" }
    exit 1
}
else {
    Write-Output 'ALL MODALS: referenced, can be opened and closed'
}
