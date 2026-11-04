param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath(
    (Join-Path -Path $PSScriptRoot -ChildPath '..\..')
)
$bundleDirectory = [System.IO.Path]::GetFullPath(
    (Join-Path -Path $projectRoot -ChildPath 'src-tauri\target\release\bundle\nsis')
)

if (-not $bundleDirectory.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Le dossier de bundle résolu se trouve hors du projet.'
}
if (-not (Test-Path -LiteralPath $bundleDirectory -PathType Container)) {
    throw "Bundle NSIS absent : $bundleDirectory"
}

$productionConfigurationFiles = @(
    (Join-Path -Path $projectRoot -ChildPath 'src-tauri\tauri.conf.json'),
    (Join-Path -Path $projectRoot -ChildPath 'src-tauri\capabilities\main.json')
)
$forbiddenProductionPatterns = @(
    'wdio:',
    'wdioTauri',
    '"withGlobalTauri"\s*:\s*true'
)
foreach ($pattern in $forbiddenProductionPatterns) {
    $match = Select-String `
        -LiteralPath $productionConfigurationFiles `
        -Pattern $pattern `
        -CaseSensitive
    if ($match) {
        throw "Composant de test desktop interdit dans la production : $pattern"
    }
}

$cargoManifest = Join-Path -Path $projectRoot -ChildPath 'src-tauri\Cargo.toml'
$productionTree = & cargo tree `
    --manifest-path $cargoManifest `
    --edges normal `
    --no-default-features
if ($LASTEXITCODE -ne 0) {
    throw 'Impossible de contrôler l’arbre Cargo de production.'
}
if ($productionTree -match 'tauri-plugin-wdio') {
    throw 'Une dépendance WDIO est active dans l’arbre Cargo de production.'
}

$rendererDirectory = Join-Path -Path $projectRoot -ChildPath 'dist'
if (-not (Test-Path -LiteralPath $rendererDirectory -PathType Container)) {
    throw "Renderer de production absent : $rendererDirectory"
}
$rendererFiles = @(Get-ChildItem -LiteralPath $rendererDirectory -File -Recurse)
foreach ($pattern in @('@wdio/tauri-plugin', 'wdioTauri', 'e2e_file_paths')) {
    $match = Select-String -LiteralPath $rendererFiles.FullName -SimpleMatch -Pattern $pattern
    if ($match) {
        throw "Composant E2E trouvé dans le renderer de production : $pattern"
    }
}

$productionBinary = Join-Path `
    -Path $projectRoot `
    -ChildPath 'src-tauri\target\release\mandala-layers-studio.exe'
if (-not (Test-Path -LiteralPath $productionBinary -PathType Leaf)) {
    throw "Binaire de production absent : $productionBinary"
}
$ripgrep = (Get-Command rg -ErrorAction Stop).Source
foreach ($pattern in @('tauri-plugin-wdio', 'wdioTauri', 'e2e_file_paths')) {
    & $ripgrep --text --quiet --fixed-strings $pattern $productionBinary
    if ($LASTEXITCODE -eq 0) {
        throw "Composant E2E trouvé dans le binaire de production : $pattern"
    }
    if ($LASTEXITCODE -gt 1) {
        throw "Échec de l’inspection du binaire de production pour : $pattern"
    }
}

$installers = @(
    Get-ChildItem -LiteralPath $bundleDirectory -Filter '*setup.exe' -File
)
if ($installers.Count -ne 1) {
    throw "Un unique installateur NSIS était attendu, trouvé : $($installers.Count)."
}

$installer = $installers[0]
if ($installer.Length -lt 1MB) {
    throw "L’installateur est anormalement petit : $($installer.Length) octets."
}

$hash = Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256
Write-Host "Installateur : $($installer.FullName)"
Write-Host "SHA-256     : $($hash.Hash)"

if (-not $Install) {
    Write-Host 'Contrôle d’artefact réussi. Utiliser -Install sur une VM propre pour le smoke complet.'
    exit 0
}

$smokeRoot = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath (
    'studio-mandala-smoke-' + [guid]::NewGuid().ToString('N')
)
$smokeRoot = [System.IO.Path]::GetFullPath($smokeRoot)
$systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $smokeRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Le dossier de smoke résolu se trouve hors du répertoire temporaire.'
}

New-Item -ItemType Directory -Path $smokeRoot | Out-Null
try {
    $installProcess = Start-Process `
        -FilePath $installer.FullName `
        -ArgumentList @('/S', "/D=$smokeRoot") `
        -WindowStyle Hidden `
        -PassThru `
        -Wait
    if ($installProcess.ExitCode -ne 0) {
        throw "L’installation silencieuse a échoué avec le code $($installProcess.ExitCode)."
    }

    $application = Get-ChildItem -LiteralPath $smokeRoot -Filter '*.exe' -File -Recurse |
        Where-Object { $_.Name -ne 'uninstall.exe' } |
        Select-Object -First 1
    if (-not $application) {
        throw 'Aucun exécutable applicatif trouvé après installation.'
    }

    $applicationProcess = Start-Process `
        -FilePath $application.FullName `
        -WindowStyle Hidden `
        -PassThru
    Start-Sleep -Seconds 5
    if ($applicationProcess.HasExited) {
        throw "L’application s’est arrêtée prématurément avec le code $($applicationProcess.ExitCode)."
    }
    Stop-Process -Id $applicationProcess.Id
    $applicationProcess.WaitForExit()

    $uninstaller = Get-ChildItem -LiteralPath $smokeRoot -Filter 'uninstall.exe' -File -Recurse |
        Select-Object -First 1
    if (-not $uninstaller) {
        throw 'Désinstallateur NSIS introuvable.'
    }
    $uninstallProcess = Start-Process `
        -FilePath $uninstaller.FullName `
        -ArgumentList '/S' `
        -WindowStyle Hidden `
        -PassThru `
        -Wait
    if ($uninstallProcess.ExitCode -ne 0) {
        throw "La désinstallation a échoué avec le code $($uninstallProcess.ExitCode)."
    }
}
finally {
    if (Test-Path -LiteralPath $smokeRoot) {
        Remove-Item -LiteralPath $smokeRoot -Recurse -Force
    }
}

Write-Host 'Installation, lancement, fermeture et désinstallation validés.'
