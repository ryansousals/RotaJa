#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env.producao || { echo 'Crie .env.producao conforme documentacao/PUBLICACAO.md'; exit 1; }
if grep -Eq 'SUBSTITUIR|rotaja.exemplo.com|seu-email@exemplo.com' .env.producao; then
  echo 'Preencha domínio, e-mail e senhas reais em .env.producao.'; exit 1
fi
chmod 600 .env.producao
docker compose --env-file .env.producao -f compose.producao.yml config --quiet
# Antes de atualizar uma instalação existente, preserve um backup.
if docker compose --env-file .env.producao -f compose.producao.yml ps --status running --services | grep -qx db; then
  bash rotinas/copiar-banco.sh
fi
docker compose --env-file .env.producao -f compose.producao.yml up --build -d
docker compose --env-file .env.producao -f compose.producao.yml ps
echo 'Serviços iniciados. Confira o HTTPS e /api/saude antes de liberar a operação.'
