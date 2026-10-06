# Аудит покрытия аутентификацией серверных маршрутов.
#
# Обработчик, который меняет состояние (POST/PUT/PATCH/DELETE), обязан проходить
# через authMiddleware. Публичными могут быть только вход, refresh и чтение.
#
# Разбор построчный: берём текст от каждого router.<verb>('path' до следующего
# router.<verb>. Попытка разобрать сбалансированные скобки регуляркой давала
# 9 обработчиков из 23 — часть определений многострочная.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$routeFiles = @(Get-ChildItem -Path 'server\src\routes\*.ts' -File)
if ($routeFiles.Count -eq 0) { Write-Error 'no route files found'; exit 1 }

# Публичные маршруты. Пути указаны относительно точки монтирования: auth.ts
# подключён как /api/auth, поэтому маршрут в нём записан как '/tg', а не
# '/auth/tg'.
#   /tg, /register — вход, токена ещё нет.
#   /refresh       — аутентифицируется refresh-токеном из тела запроса.
#   клиентские ошибки — принимаются до логина, иначе их не отправить.
#   /leaderboard   — публичное чтение, по замыслу видно всем.
$publicPaths = @(
    '/tg', '/register', '/refresh',
    '/log-client-error', '/health', '/', '*'
)

# Признаки того, что обработчик проверяет право доступа. Кроме общих middleware
# в проекте есть и встроенная проверка: admin.ts сравнивает Bearer-токен с
# ADMIN_PASS через timingSafeEqual и допускает JWT с is_admin. Раньше детектор
# знал только про authMiddleware и помечал защищённый админский маршрут как
# открытый.
$authSignals = 'authMiddleware|requireAdmin|socketAuth|adminPass|is_admin|jwt\.verify|verifyToken'

$problems = @()
$total = 0

foreach ($f in $routeFiles) {
    $text = Get-Content $f.FullName -Raw
    $rel = $f.FullName.Replace("$root\", '')

    $rx = [regex]"router\.(get|post|put|patch|delete)\(\s*[`"']([^`"']*)[`"']"
    $hits = @($rx.Matches($text))
    for ($i = 0; $i -lt $hits.Count; $i++) {
        $total++
        $verb = $hits[$i].Groups[1].Value.ToUpper()
        $path = $hits[$i].Groups[2].Value

        # Сигнатура = текст от текущего совпадения до следующего (или до конца).
        $startIdx = $hits[$i].Index
        $endIdx = if ($i + 1 -lt $hits.Count) { $hits[$i + 1].Index } else { $text.Length }
        $sig = $text.Substring($startIdx, [Math]::Min(600, $endIdx - $startIdx))

        $hasAuth = $sig -match $authSignals
        $isWrite = $verb -in @('POST', 'PUT', 'PATCH', 'DELETE')
        $isPublic = $publicPaths -contains $path

        if ($isWrite -and -not $hasAuth -and -not $isPublic) {
            $problems += [pscustomobject]@{ Route = "$rel  $verb $path"; Why = 'WRITE WITHOUT AUTH' }
        }
        elseif (-not $hasAuth -and -not $isPublic) {
            $problems += [pscustomobject]@{ Route = "$rel  $verb $path"; Why = 'read without auth middleware' }
        }
    }
}

Write-Output "ROUTES SCANNED: $total"
Write-Output "AUTH GAPS     : $($problems.Count)"
Write-Output ''
if ($problems.Count) {
    $problems | Format-Table -AutoSize | Out-String -Width 160 | Write-Output
    exit 1
}
else {
    Write-Output '  (none — every route either has auth middleware or is a known public endpoint)'
}
exit 0
