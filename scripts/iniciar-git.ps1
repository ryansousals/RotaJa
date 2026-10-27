$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.git')) { git init -b main }
git status --short
Write-Host 'Revise os arquivos antes de criar os commits indicados em docs/GIT.md.'
