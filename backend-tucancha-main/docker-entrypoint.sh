#!/bin/sh
set -e

strip_quotes() {
  value="$1"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

for var in \
  DATABASE_HOST DATABASE_PORT DATABASE_USERNAME DATABASE_PASSWORD DATABASE_DATABASE \
  JWT_SECRET JWT_REFRESH_SECRET JWT_ACCESS_SECRET DATABASE_SSL
do
  eval "raw=\${$var}"
  cleaned="$(strip_quotes "$raw")"
  if [ -n "$cleaned" ]; then
    export "$var=$cleaned"
  fi
done

missing=""
for var in DATABASE_HOST DATABASE_USERNAME DATABASE_PASSWORD DATABASE_DATABASE; do
  eval "value=\${$var}"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done

if [ -z "$JWT_REFRESH_SECRET" ] && [ -n "$JWT_SECRET" ]; then
  export JWT_REFRESH_SECRET="$JWT_SECRET"
fi

if [ -z "$JWT_ACCESS_SECRET" ] && [ -n "$JWT_SECRET" ]; then
  export JWT_ACCESS_SECRET="$JWT_SECRET"
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
  missing="$missing JWT_SECRET/JWT_REFRESH_SECRET"
fi

if [ -n "$missing" ]; then
  echo "ERROR: faltan variables en backend-tucancha-main/.env:$missing"
  echo "Usa el .env del repo o copia: cp backend-tucancha-main/.env.vm.example backend-tucancha-main/.env"
  exit 1
fi

DB_PORT="${DATABASE_PORT:-5432}"
DB_SSL_MODE="disable"
if [ "$DATABASE_SSL" = "true" ]; then
  DB_SSL_MODE="require"
fi

echo "Probando PostgreSQL en ${DATABASE_HOST}:${DB_PORT} (sslmode=${DB_SSL_MODE})..."
if ! PGPASSWORD="$DATABASE_PASSWORD" PGSSLMODE="$DB_SSL_MODE" \
  psql -h "$DATABASE_HOST" -p "$DB_PORT" -U "$DATABASE_USERNAME" -d "$DATABASE_DATABASE" \
  -c 'SELECT 1' >/dev/null 2>&1; then
  echo "ERROR: no se pudo conectar a PostgreSQL."
  echo "  Host: ${DATABASE_HOST}:${DB_PORT}"
  echo "  Usuario: ${DATABASE_USERNAME}"
  echo "  Base: ${DATABASE_DATABASE}"
  echo ""
  echo "Causas frecuentes:"
  echo "  1) RDS security group sin puerto 5432 desde esta EC2"
  echo "  2) DATABASE_PASSWORD con # sin comillas en .env (usa \"Tucancha#25\")"
  echo "  3) Credenciales incorrectas"
  PGPASSWORD="$DATABASE_PASSWORD" PGSSLMODE="$DB_SSL_MODE" \
    psql -h "$DATABASE_HOST" -p "$DB_PORT" -U "$DATABASE_USERNAME" -d "$DATABASE_DATABASE" \
    -c 'SELECT 1' 2>&1 || true
  exit 1
fi

echo "PostgreSQL OK. Iniciando API..."
exec node dist/main
