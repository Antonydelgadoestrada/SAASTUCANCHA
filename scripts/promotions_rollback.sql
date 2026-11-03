-- =====================================================================
-- SCRIPT DE ROLLBACK: HORARIOS PICOS Y MUERTOS - PROMOCIONES
-- Archivo: scripts/promotions_rollback.sql
-- Objetivo: Revertir de forma segura las modificaciones en caso de contingencia.
-- =====================================================================

-- 1. Eliminar índices agregados
DROP INDEX IF EXISTS idx_promotion_global_active;
DROP INDEX IF EXISTS idx_promotion_court_lookup;
DROP INDEX IF EXISTS idx_promotion_club_active;

-- 2. Eliminar restricciones de clave foránea
ALTER TABLE "promotion" DROP CONSTRAINT IF EXISTS fk_promotion_court;
ALTER TABLE "promotion" DROP CONSTRAINT IF EXISTS fk_promotion_club;

-- 3. Eliminar columnas agregadas (conservando la tabla promotion original)
ALTER TABLE "promotion"
  DROP COLUMN IF EXISTS "discountPercentage",
  DROP COLUMN IF EXISTS "daysOfWeek",
  DROP COLUMN IF EXISTS "endTime",
  DROP COLUMN IF EXISTS "startTime",
  DROP COLUMN IF EXISTS "applyToAllCourts",
  DROP COLUMN IF EXISTS "courtId",
  DROP COLUMN IF EXISTS "clubId";
