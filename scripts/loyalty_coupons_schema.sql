-- =====================================================================
-- MIGRACIÓN ADITIVA E IDEMPOTENTE: CUPONES DE FIDELIDAD (TUCANCHA)
-- Archivo: scripts/loyalty_coupons_schema.sql
-- Ejecución: 100% Aditivo, Seguro e Idempotente (IF NOT EXISTS)
-- Base de Datos Objetivo: testdb (DigitalOcean Staging) / Producción
-- =====================================================================

-- 1. Campos nuevos en loyalty_reward (Premios con Tipo y Valor)
ALTER TABLE loyalty_reward 
  ADD COLUMN IF NOT EXISTS reward_type varchar(30) DEFAULT 'TEXT_ONLY' NOT NULL,
  ADD COLUMN IF NOT EXISTS discount_value numeric(10, 2),
  ADD COLUMN IF NOT EXISTS max_discount_amount numeric(10, 2);

-- 2. Campos nuevos en loyalty_redemption (Snapshots, Vínculo con Reserva y Descuento)
ALTER TABLE loyalty_redemption 
  ADD COLUMN IF NOT EXISTS reward_type_snapshot varchar(30) DEFAULT 'TEXT_ONLY' NOT NULL,
  ADD COLUMN IF NOT EXISTS discount_value_snapshot numeric(10, 2),
  ADD COLUMN IF NOT EXISTS max_discount_snapshot numeric(10, 2),
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS applied_discount_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

-- 3. Clave Foránea segura (ON DELETE SET NULL) con verificación condicional
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_loyalty_redemption_booking'
  ) THEN
    ALTER TABLE loyalty_redemption 
      ADD CONSTRAINT fk_loyalty_redemption_booking 
      FOREIGN KEY (booking_id) REFERENCES booking(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Índice único condicional: una reserva solo puede tener un cupón aplicado
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_redemption_booking 
  ON loyalty_redemption (booking_id) 
  WHERE booking_id IS NOT NULL;
