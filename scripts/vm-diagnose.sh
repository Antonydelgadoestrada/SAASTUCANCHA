#!/bin/bash
# Diagnóstico rápido en la VM (desde la raíz del repo canchas/)
set -e

echo "=== Contenedores ==="
docker ps -a --filter name=tucancha --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ""
echo "=== Logs API (últimas 40 líneas) ==="
docker logs tucancha-api --tail 40 2>&1 || true

echo ""
echo "=== Variables DB (sin contraseña) ==="
if [ -f backend-tucancha-main/.env ]; then
  grep -E '^DATABASE_' backend-tucancha-main/.env | sed 's/PASSWORD=.*/PASSWORD=***/'
else
  echo "FALTA backend-tucancha-main/.env"
fi

echo ""
echo "=== Test puerto 3001 local ==="
curl -sf --max-time 5 http://127.0.0.1:3001/ && echo " API responde OK" || echo " API no responde en :3001"
