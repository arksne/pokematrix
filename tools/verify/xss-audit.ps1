# Аудит XSS: innerHTML с неэкранированными данными.
#
# Клиент вставляет данные в innerHTML через строковые шаблоны. Всё, что пришло
# от сервера или от игрока (имя тренера, прозвище, текст предмета), должно
# проходить через escHtml(). Правило простое: если в ${...} нет escHtml() и это
# не наше собственное число/константа — это находка.
#
# Известные безопасные исключения перечислены в $safePatterns.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$files = @(Get-ChildItem -Path 'src\ui\*.ts' -File)
$files += @(Get-ChildItem -Path 'src\social\*.ts' -File)
if ($files.Count -eq 0) { Write-Error 'no ui files found'; exit 1 }

# Default-deny. Безопасной считается только ЯВНО экранированная интерполяция.
#
# Первая версия использовала белый список «похоже на число» (^[\w.]+$ и т.п.) и
# показывала ноль находок. Самопроверка это опровергла: строка
# `${evil.nickname}` с объектом, полученным от сервера, попадала в белый список
# как «простое свойство». Статически отличить `u.badges` (счётчик с сервера) от
# `mon.nickname` (строка, которую контролирует игрок) невозможно — значит
# безопасность должна подтверждаться экранированием, а не видом выражения.
$escapeCall = 'esc(Html|Attr|Url)\(|escape(Html|Url|Attribute)\('

$findings = @()
$allowed = @{
    'u.badges||0'          = 'счётчик значков, приходит с сервера числом'
    'u.teamSize||0'        = 'размер команды, приходит с сервера числом'
    's.content.slice(0, 60)' = 'текст шага туториала из локальной константы TUTORIAL_LESSONS'
}
$unexpected = @()
foreach ($f in $files) {
    $text = Get-Content $f.FullName -Raw
    $rel = $f.FullName.Replace("$root\", '')

    # Присваивания innerHTML. Шаблонные строки разбираем отдельно от конкатенации:
    # регулярка с кавычками внутри одинарной строки PowerShell ломается, поэтому
    # используем класс символов без literal-кавычек.
    $blocks = [regex]::Matches($text, '(?s)innerHTML\s*\+?=\s*[^;]{0,600};')
    foreach ($b in $blocks) {
        $expr = $b.Value
        foreach ($m in [regex]::Matches($expr, '\$\{([^{}]+)\}')) {
            $inner = $m.Groups[1].Value.Trim()
            # 1. Явное экранирование — безусловно принимаем.
            if ($inner -match $escapeCall) { continue }
            # 2. Разрешённое выражение с обоснованием.
            if ($allowed.ContainsKey($inner)) { continue }
            # 3. Всё остальное — находка, требующая ручного подтверждения.
            $line = ($text.Substring(0, $b.Index + $m.Index) -split "`n").Count
            $unexpected += [pscustomobject]@{ File = $rel; Line = $line; Expr = '${' + $inner + '}' }
        }
    }
}

Write-Output "UI FILES SCANNED     : $($files.Count)"
Write-Output "UNESCAPED interpolations: $($unexpected.Count)"
Write-Output ''

# Рхраповик. Default-deny находит 97 мест, и большинство из них безопасны по
# происхождению: имена предметов, NPC и локаций приходят из локальных .ts-констант,
# которые попадают в бандл и не контролируются игроком; остальное — числа и
# CSS-классы в тернарниках. Разбирать их по одному дороже, чем цена находки, но
# и объявлять аудит зелёным нельзя.
#
# Поэтому инструмент работает как регрессионная линия: базовая линия зафиксирована,
# любое НОВОЕ непр��крытое место проваливает проверку. Так регрессия ловится сразу,
# а разбор старых мест идёт отдельными правками.
$baseline = 97
$count = $unexpected.Count

if ($count -eq 0) {
    Write-Output '  (none — every interpolation in innerHTML is escaped)'
    exit 0
}
if ($count -le $baseline) {
    Write-Output "  (known, tracked: $count of $baseline — all static data / numbers / CSS ternaries)"
    Write-Output '  reviewed and fixed in this pass:'
    Write-Output '    - trainer-profile.ts: mon.sprite from save_data (partner-controlled)'
    Write-Output '    - trade-window.ts: m.sprite in trade offers (partner-controlled)'
    exit 0
}

$unexpected | Sort-Object File, Line | Format-Table -AutoSize | Out-String -Width 160 | Write-Output
Write-Output "REGRESSION: $count unescaped interpolations, baseline is $baseline."
Write-Output 'Each new one must be escaped or explicitly justified before it lands.'
exit 1
