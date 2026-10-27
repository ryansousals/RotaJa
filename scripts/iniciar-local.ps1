$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.env')) {
  $senhaBanco = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  $senhaAdmin = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
  $ambiente = (Get-Content -Raw .env.example).Replace('altere_esta_senha', $senhaBanco).Replace('substitua-por-uma-senha-forte', $senhaAdmin)
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $ambiente, [Text.UTF8Encoding]::new($false))
}
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar os contêineres.' }
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências locais.' }
npm run db:gerar
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o cliente do banco.' }
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw 'Falha ao cadastrar o administrador.' }
Write-Host 'API disponível em http://localhost:3001/saude. Credenciais locais no arquivo .env.'
