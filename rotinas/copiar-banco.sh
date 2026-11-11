#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
arquivo="backups/rotaja-$(date -u +%Y%m%dT%H%M%S)-$$.dump"
trap 'rm -f "$arquivo.parcial"' EXIT
docker compose --env-file .env.producao -f compose.producao.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$arquivo.parcial"
test -s "$arquivo.parcial"
docker compose --env-file .env.producao -f compose.producao.yml exec -T db pg_restore --list < "$arquivo.parcial" > /dev/null
mv "$arquivo.parcial" "$arquivo"
echo "Backup criado: $arquivo. Guarde também uma cópia fora do servidor."
