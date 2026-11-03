-- =====================================================================
-- MIGRACIÓN ADITIVA E IDEMPOTENTE: HORARIOS PICOS Y MUERTOS - PROMOCIONES
-- Archivo: scripts/promotions_schema.sql
-- Ejecución: 100% Aditivo, Seguro e Idempotente (IF NOT EXISTS)
-- Base de Datos Objetivo: PostgreSQL (testdb / produccion)
-- =====================================================================

-- 1. Crear tabla "promotion" si no existe (con columnas históricas)
CREATE TABLE IF NOT EXISTS "promotion" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar NOT NULL,
  "description" varchar,
  "type" varchar(30) DEFAULT 'happy_hour' NOT NULL,
  "discount" jsonb,
  "conditions" jsonb,
  "startDate" date DEFAULT CURRENT_DATE NOT NULL,
  "endDate" date,
  "maxUses" integer,
  "currentUses" integer DEFAULT 0 NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);

-- 2. Agregar columnas necesarias para promociones por franja horaria y multitenancy
ALTER TABLE "promotion"
  ADD COLUMN IF NOT EXISTS "clubId" uuid,
  ADD COLUMN IF NOT EXISTS "courtId" uuid,
  ADD COLUMN IF NOT EXISTS "applyToAllCourts" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "startTime" varchar(5) DEFAULT '00:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "endTime" varchar(5) DEFAULT '23:59' NOT NULL,
  ADD COLUMN IF NOT EXISTS "daysOfWeek" integer[] DEFAULT '{1,2,3,4,5,6,0}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "discountPercentage" numeric(5, 2) DEFAULT 0 NOT NULL;

-- 3. Claves Foráneas seguras con verificación condicional
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_promotion_club'
  ) THEN
    ALTER TABLE "promotion"
      ADD CONSTRAINT fk_promotion_club
      FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_promotion_court'
  ) THEN
    ALTER TABLE "promotion"
      ADD CONSTRAINT fk_promotion_court
      FOREIGN KEY ("courtId") REFERENCES "court"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Índices para optimizar consultas de promociones por club, cancha y estado
CREATE INDEX IF NOT EXISTS idx_promotion_club_active 
  ON "promotion"("clubId", "isActive");

CREATE INDEX IF NOT EXISTS idx_promotion_court_lookup 
  ON "promotion"("courtId", "isActive");

CREATE INDEX IF NOT EXISTS idx_promotion_global_active 
  ON "promotion"("clubId", "applyToAllCourts", "isActive");
