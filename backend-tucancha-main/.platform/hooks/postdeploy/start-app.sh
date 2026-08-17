#!/bin/bash

echo "🚀 Ejecutando start-app.sh en postdeploy"

cd /var/app/current || {
  echo "❌ No se pudo acceder a /var/app/current"
  exit 1
}

echo "📥 Instalando dependencias..."

if [ -f package-lock.json ]; then
  echo "🔒 Se detectó package-lock.json, usando 'npm ci'"
  npm install || {
    echo "❌ Falló la instalación con 'npm ci'"
    exit 1
  }
else
  echo "⚠️ No se encontró package-lock.json, usando 'npm install --omit=dev'"
  npm install --omit=dev || {
    echo "❌ Falló la instalación con 'npm install'"
    exit 1
  }
fi

echo "✅ Dependencias instaladas correctamente"
echo "✅ Postdeploy finalizado correctamente"
