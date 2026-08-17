#!/bin/bash
# Backup script for TuCancha database

# Get directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ENV_FILE="$DIR/../backend-tucancha-main/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Extract variables cleanly
DB_HOST=$(grep -E "^DATABASE_HOST=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_PORT=$(grep -E "^DATABASE_PORT=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_USER=$(grep -E "^DATABASE_USERNAME=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_PASS=$(grep -E "^DATABASE_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_NAME=$(grep -E "^DATABASE_DATABASE=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
DB_SSL=$(grep -E "^DATABASE_SSL=" "$ENV_FILE" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

DB_PORT=${DB_PORT:-5432}

# Target directory for backups
BACKUP_DIR="$DIR/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/tucancha_backup_$TIMESTAMP.sql.gz"

echo "Starting database backup for $DB_NAME on $DB_HOST..."

# SSL setup
if [ "$DB_SSL" = "true" ]; then
    export PGSSLMODE="require"
else
    export PGSSLMODE="disable"
fi

export PGPASSWORD="$DB_PASS"

# Run pg_dump
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo "Backup completed successfully: $BACKUP_FILE"
    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "tucancha_backup_*.sql.gz" -mtime +7 -delete
    echo "Pruned old backups."
else
    echo "Error: Backup failed."
    rm -f "$BACKUP_FILE"
    exit 1
fi
