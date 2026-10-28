$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.env')) {
  $gerador = [Security.Cryptography.RandomNumberGenerator]::Create()
  $bytesBanco = New-Object byte[] 24
  $bytesAdmin = New-Object byte[] 16
  $gerador.GetBytes($bytesBanco)
  $gerador.GetBytes($bytesAdmin)
  $gerador.Dispose()
  $senhaBanco = [BitConverter]::ToString($bytesBanco).Replace('-', '').ToLowerInvariant()
  $senhaAdmin = [BitConverter]::ToString($bytesAdmin).Replace('-', '').ToLowerInvariant()
  $ambiente = (Get-Content -Raw .env.example).Replace('altere_esta_senha', $senhaBanco).Replace('substitua-por-uma-senha-forte', $senhaAdmin)
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $ambiente, [Text.UTF8Encoding]::new($false))
}
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Abra o Docker Desktop, aguarde iniciar e tente novamente.' }
docker compose up --build -d --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar os contêineres.' }
Write-Host 'RotaJa pronto: http://localhost:3002 (ou a porta WEB_PORT configurada no .env)'
Write-Host 'Use ADMIN_EMAIL e ADMIN_SENHA do arquivo .env para entrar.'
Write-Host 'Os dados persistem nos volumes do Docker. Para parar: docker compose stop'
