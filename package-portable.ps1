# package-portable.ps1 - Compila el wrapper y produce el .exe portable en assets/.
#
# Uso (desde la raíz del repo):
#   .\package-portable.ps1            # fast mode (default, sin compresión)
#   .\package-portable.ps1 -Fast:$false  # max compression (lento)
#
# Salida:
#   assets\Proxy Mapper-<version>-portable.exe
#
# Optimizaciones aplicadas (no requieren parámetros):
#   - ELECTRON_BUILDER_COMPRESSION_LEVEL=0 (store mode, sin LZMA2)
#   - electronLanguages: ['en-US','es'] en electron-builder.yml (55 → 2 locales)
#   - Wrapper C# con WaitForExit(15min) en node_modules/7zip-bin/win/x64/7za.exe
#     (resuelve el error "Cannot create symbolic link" de winCodeSign en
#     Windows sin Developer Mode)

param(
    [switch]$Fast = $true
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$desktop = Join-Path $root 'desktop'
$assets = Join-Path $root 'assets'
$yml = Join-Path $desktop 'electron-builder.yml'

if (-not (Test-Path -LiteralPath $desktop)) {
    throw "No se encontró $desktop. Ejecutá el script desde la raíz del repo."
}
if (-not (Test-Path -LiteralPath $yml)) {
    throw "No se encontró $yml."
}

$version = (Get-Content -LiteralPath (Join-Path $desktop 'package.json') | ConvertFrom-Json).version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "No se pudo leer la versión de $desktop\package.json"
}

$outName = "Proxy Mapper-$version-portable.exe"
$outPath = Join-Path $assets $outName

if (-not (Test-Path -LiteralPath $assets)) {
    New-Item -ItemType Directory -Path $assets | Out-Null
}

if ($Fast) {
    $env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '0'
    Write-Host "Modo FAST: mx=0 (store, sin compresion LZMA2). ~2-3 min, .exe ~30% mas grande." -ForegroundColor Yellow
} else {
    Write-Host "Modo MAX compression: mx=9. ~7-10 min, .exe mas chico." -ForegroundColor Yellow
}

Write-Host "[1/4] Limpiando dist/ previo..." -ForegroundColor Cyan
Push-Location $desktop
try {
    npm run clean:dist | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "npm run clean:dist fallo (exit $LASTEXITCODE)" }

    Write-Host "[2/4] Compilando renderer/main/preload..." -ForegroundColor Cyan
    npm run build | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "npm run build fallo (exit $LASTEXITCODE)" }

    Write-Host "[3/4] Empaquetando portable..." -ForegroundColor Cyan
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    npx electron-builder --win portable --publish never | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "electron-builder fallo (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
    Remove-Item Env:ELECTRON_BUILDER_COMPRESSION_LEVEL -ErrorAction SilentlyContinue
}

$builtPath = Join-Path $desktop "dist\$outName"
if (-not (Test-Path -LiteralPath $builtPath)) {
    throw "No se encontró el portable en $builtPath"
}

Write-Host "[4/4] Copiando a assets/..." -ForegroundColor Cyan
Copy-Item -LiteralPath $builtPath -Destination $outPath -Force
$sizeMb = [math]::Round((Get-Item -LiteralPath $outPath).Length / 1MB, 1)
Write-Host "Listo: $outPath ($sizeMb MB)" -ForegroundColor Green
