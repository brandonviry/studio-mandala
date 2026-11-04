[CmdletBinding()]
param(
    [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$tauriCli = Join-Path $projectRoot 'node_modules\@tauri-apps\cli\tauri.js'
$wdioCli = Join-Path $projectRoot 'node_modules\@wdio\cli\bin\wdio.js'

if (-not (Test-Path -LiteralPath $tauriCli)) {
    throw "CLI Tauri introuvable. Exécutez npm install."
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$previousE2e = $env:VITE_MANDALA_E2E

Push-Location $projectRoot
try {
    $env:VITE_MANDALA_E2E = 'true'
    & $node $tauriCli build --debug --no-bundle --features e2e --config src-tauri/tauri.e2e.conf.json
    if ($LASTEXITCODE -ne 0) {
        throw "La construction du binaire Tauri E2E a échoué ($LASTEXITCODE)."
    }
}
finally {
    $env:VITE_MANDALA_E2E = $previousE2e
    Pop-Location
}

if ($BuildOnly) {
    exit 0
}

if (-not (Test-Path -LiteralPath $wdioCli)) {
    throw "CLI WebdriverIO introuvable. Exécutez npm install."
}

Push-Location $projectRoot
try {
    & $node $wdioCli run wdio.conf.ts
    if ($LASTEXITCODE -ne 0) {
        throw "Les tests desktop WebdriverIO ont échoué ($LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}
