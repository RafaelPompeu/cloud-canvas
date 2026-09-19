$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (Test-Path -LiteralPath '.venv/Scripts/python.exe') {
    $ProjectPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
} elseif (Test-Path -LiteralPath '.runtime/python/python.exe') {
    $ProjectPython = Join-Path $PSScriptRoot '.runtime/python/python.exe'
    # The optional portable runtime is local to this checkout, not a system install.
    $RuntimePathFile = Join-Path $PSScriptRoot '.runtime/python/python313._pth'
    [System.IO.File]::WriteAllLines($RuntimePathFile, @('python313.zip', '.', 'Lib/site-packages', $PSScriptRoot, 'import site'), [System.Text.UTF8Encoding]::new($false))
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $ProjectPython = (Get-Command python).Source
} else {
    throw 'Python nao encontrado. Instale Python 3.10 ou superior e siga o README.md.'
}

Write-Host 'Cloud Canvas: http://127.0.0.1:5000' -ForegroundColor Cyan
Write-Host 'Pressione Ctrl+C para encerrar.'
& $ProjectPython app.py
exit $LASTEXITCODE
