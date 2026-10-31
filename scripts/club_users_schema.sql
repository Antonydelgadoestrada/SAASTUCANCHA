-- =====================================================================
-- SCRIPT DDL: MÓDULO DE USUARIOS POR CLUB (RECEPCIONISTAS) - TUCANCHA
-- Archivo: scripts/club_users_schema.sql
-- Ejecución: 100% Aditivo, Seguro e Idempotente (IF NOT EXISTS)
-- Base de Datos Objetivo: PostgreSQL (testdb / produccion)
-- =====================================================================

-- 1. Agregar el valor 'RECEPCIONISTA' al enum user_role_enum si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'user_role_enum' AND e.enumlabel = 'RECEPCIONISTA'
    ) THEN
        ALTER TYPE user_role_enum ADD VALUE 'RECEPCIONISTA';
    END IF;
END $$;

-- 2. Agregar columnas necesarias en la tabla "user"
ALTER TABLE "user" 
    ADD COLUMN IF NOT EXISTS "assignedClubId" UUID NULL,
    ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL;

-- 3. Clave foránea segura hacia la tabla "club"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_assigned_club'
    ) THEN
        ALTER TABLE "user"
            ADD CONSTRAINT fk_user_assigned_club 
            FOREIGN KEY ("assignedClubId") REFERENCES "club"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Índices para optimizar consultas de usuarios por club y estado
CREATE INDEX IF NOT EXISTS idx_user_assigned_club ON "user"("assignedClubId") WHERE "assignedClubId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_role_active ON "user"("role", "isActive") WHERE "deletedAt" IS NULL;
