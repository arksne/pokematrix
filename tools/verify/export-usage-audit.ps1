# Аудит достижимости экспортов: функции, которые экспортируются, но ни разу не
# вызываются. Это два класса проблем в одном списке:
#   - фича написана, но никуда не подключена (то же, что случилось с кнопками
#     «Достижения»/«Туториал»/«PvP» — обработчик потерялся, функция осталась);
#   - мёртвый код, который вводит в заблуждение при чтении.
#
# Считаем вызовы по всем исходникам клиента (src/**, main.ts) и по e2e/verify,
# потому что часть функций используется только проверками.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$q = [char]39; $dq = [char]34

$srcFiles = @(Get-ChildItem -Path 'src' -Recurse -Include *.ts, *.js -File)
$srcFiles += Get-Item 'main.ts'
$testFiles = @(Get-ChildItem -Path 'tools/verify', 'e2e' -Recurse -Include *.mjs -File -ErrorAction SilentlyContinue)

$srcAll = ($srcFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$testAll = ($testFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$everywhere = $srcAll + "`n" + $testAll

# Экспортируемые функции: export function NAME / export async function NAME
$exports = @()
foreach ($f in $srcFiles) {
    $text = Get-Content $f.FullName -Raw
    foreach ($m in [regex]::Matches($text, 'export\s+(?:async\s+)?function\s+([A-Za-z_]\w*)')) {
        $exports += [pscustomobject]@{ Name = $m.Groups[1].Value; File = $f.FullName.Replace("$root\", '') }
    }
    foreach ($m in [regex]::Matches($text, 'export\s+const\s+([A-Za-z_]\w*)\s*=')) {
        $exports += [pscustomobject]@{ Name = $m.Groups[1].Value; File = $f.FullName.Replace("$root\", '') }
    }
}

if ($exports.Count -eq 0) { Write-Error 'no exports parsed'; exit 1 }

$neverCalled = @()
foreach ($e in $exports) {
    $n = $e.Name
    # Считаем использование имени вне строки объявления экспорта.
    # Ищем: вызов name( , обращение name. , деструктуризация { name , : name
    $usedInSrc = [regex]::Matches($srcAll, "(?<![\w$])$([regex]::Escape($n))(?![\w$]\s*[:=]\s*(async\s+)?function)(?![\w$]*\s*=)") |
        Measure-Object | Select-Object -ExpandProperty Count
    $usedInTests = [regex]::Matches($testAll, "(?<![\w$])$([regex]::Escape($n))(?![\w$])") |
        Measure-Object | Select-Object -ExpandProperty Count
    # 1 = только само объявление
    if ($usedInSrc -le 1 -and $usedInTests -eq 0) {
        $neverCalled += $e
    }
}

# Константы, которые существуют как схема/документация, а не как вызываемый код.
# Их удалять нельзя: на них ссылаются комментарии и они перечисляют допустимые
# значения. Явный список, чтобы «инфо» не выглядело как ошибка.
$allowed = @{
    'STAT_NAMES'  = 'список ключей STAT_MAP, используется как схема при разборе stats'
    'QUEST_TYPES' = 'перечень допустимых типов квестов, служит документацией QUEST_CONFIGS'
}
$unexpected = @($neverCalled | Where-Object { -not $allowed.ContainsKey($_.Name) })
$known = @($neverCalled | Where-Object { $allowed.ContainsKey($_.Name) })

Write-Output "EXPORTS FOUND       : $($exports.Count)"
Write-Output "UNEXPECTED UNUSED   : $($unexpected.Count)"
Write-Output "ALLOWED UNUSED      : $($known.Count)"
Write-Output ''
if ($known.Count) {
    Write-Output 'ALLOWED (schema/documentation constants):'
    $known | ForEach-Object { Write-Output "  $($_.Name) — $($allowed[$_.Name])" }
    Write-Output ''
}
if ($unexpected.Count) {
    Write-Output 'UNEXPECTED UNUSED (dead code or unwired feature):'
    $unexpected | Sort-Object File, Name | ForEach-Object { Write-Output "  $($_.File)  ->  $($_.Name)" }
    exit 1
} else {
    Write-Output '  (no unexpected unused exports)'
}
exit 0
