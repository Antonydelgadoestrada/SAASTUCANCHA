-- =====================================================================
-- SCRIPT CONSOLIDADO DE LANZAMIENTO: FIDELIDAD, CUPONES Y USUARIOS (TUCANCHA)
-- Archivo: scripts/release_loyalty_users_schema.sql
-- Rama Objetivo: main -> Producción (PostgreSQL)
-- Características: 100% Aditivo, Seguro, Idempotente (Re-ejecutable sin errores)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. MÓDULO DE USUARIOS POR CLUB: ENUM Y EXTENSIÓN DE TABLA "user"
-- ---------------------------------------------------------------------

-- 1.1 Agregar el valor 'RECEPCIONISTA' al enum user_role_enum si no existe
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

-- 1.2 Agregar columnas aditivas en la tabla existente "user"
ALTER TABLE "user" 
    ADD COLUMN IF NOT EXISTS "assignedClubId" UUID NULL,
    ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ NULL;

-- 1.3 Clave foránea segura hacia "club" (ON DELETE SET NULL)
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

-- 1.4 Índices para consultas de usuarios por club y roles activos
CREATE INDEX IF NOT EXISTS idx_user_assigned_club ON "user"("assignedClubId") WHERE "assignedClubId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_role_active ON "user"("role", "isActive") WHERE "deletedAt" IS NULL;


-- ---------------------------------------------------------------------
-- 2. MÓDULO DE FIDELIDAD: NUEVAS TABLAS "loyalty_*"
-- ---------------------------------------------------------------------

-- 2.1 Tabla de Configuración de Fidelidad por Club
CREATE TABLE IF NOT EXISTS loyalty_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    mode VARCHAR(10) NOT NULL DEFAULT 'A', -- 'A': Por horario (Día/Noche) | 'B': Por cantidad de reservas
    "dayPoints" INTEGER NOT NULL DEFAULT 0 CHECK ("dayPoints" >= 0),
    "nightPoints" INTEGER NOT NULL DEFAULT 0 CHECK ("nightPoints" >= 0),
    "nightStartsAt" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "bonusEveryX" INTEGER NOT NULL DEFAULT 1 CHECK ("bonusEveryX" >= 1),
    "bonusPoints" INTEGER NOT NULL DEFAULT 0 CHECK ("bonusPoints" >= 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loyalty_config_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_config_club ON loyalty_config("clubId");

-- 2.2 Tabla de Catálogo de Premios por Club
CREATE TABLE IF NOT EXISTS loyalty_reward (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "pointsCost" INTEGER NOT NULL CHECK ("pointsCost" >= 1),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    reward_type VARCHAR(30) DEFAULT 'TEXT_ONLY' NOT NULL,
    discount_value NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loyalty_reward_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_club_active ON loyalty_reward("clubId", "isActive");

-- 2.3 Tabla de Saldo de Puntos por Usuario y por Club
CREATE TABLE IF NOT EXISTS loyalty_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    "paidReservationsCount" INTEGER NOT NULL DEFAULT 0 CHECK ("paidReservationsCount" >= 0),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loyalty_balance_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_balance_user FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT uq_loyalty_balance_club_user UNIQUE ("clubId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_loyalty_balance_user ON loyalty_balance("userId");
CREATE INDEX IF NOT EXISTS idx_loyalty_balance_club ON loyalty_balance("clubId");

-- 2.4 Tabla de Canjes de Premios (con soporte nativo para cupones)
CREATE TABLE IF NOT EXISTS loyalty_redemption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rewardId" UUID,
    "rewardNameSnapshot" VARCHAR(255) NOT NULL,
    "rewardCostSnapshot" INTEGER NOT NULL CHECK ("rewardCostSnapshot" >= 1),
    code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'DELIVERED', 'REJECTED', 'EXPIRED', 'APPLIED'
    "rejectReason" VARCHAR(255),
    reward_type_snapshot VARCHAR(30) DEFAULT 'TEXT_ONLY' NOT NULL,
    discount_value_snapshot NUMERIC(10, 2),
    max_discount_snapshot NUMERIC(10, 2),
    booking_id UUID,
    applied_discount_amount NUMERIC(10, 2),
    applied_at TIMESTAMPTZ,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedByUserId" UUID,
    CONSTRAINT fk_loyalty_redemption_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_redemption_user FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_redemption_reward FOREIGN KEY ("rewardId") REFERENCES loyalty_reward(id) ON DELETE SET NULL,
    CONSTRAINT fk_loyalty_redemption_resolver FOREIGN KEY ("resolvedByUserId") REFERENCES "user"(id) ON DELETE SET NULL
);

-- Clave foránea segura a booking (ON DELETE SET NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_loyalty_redemption_booking'
    ) THEN
        ALTER TABLE loyalty_redemption 
            ADD CONSTRAINT fk_loyalty_redemption_booking 
            FOREIGN KEY (booking_id) REFERENCES booking(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_club_status ON loyalty_redemption("clubId", status);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_user ON loyalty_redemption("userId");
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_code ON loyalty_redemption(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_redemption_booking ON loyalty_redemption (booking_id) WHERE booking_id IS NOT NULL;

-- 2.5 Tabla de Transacciones / Movimientos de Puntos (Inmutable)
CREATE TABLE IF NOT EXISTS loyalty_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'EARN_DAY', 'EARN_NIGHT', 'EARN_COUNT', 'EARN_BONUS', 'REDEEM', 'REFUND', 'REVERSAL'
    points INTEGER NOT NULL, -- Positivo para EARN_*, negativo para REDEEM/REVERSAL, 0 para EARN_COUNT
    "bookingId" UUID,
    "redemptionId" UUID,
    note VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loyalty_tx_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_tx_user FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_tx_booking FOREIGN KEY ("bookingId") REFERENCES booking(id) ON DELETE SET NULL,
    CONSTRAINT fk_loyalty_tx_redemption FOREIGN KEY ("redemptionId") REFERENCES loyalty_redemption(id) ON DELETE SET NULL
);

-- Índice único condicional: garantiza que una misma reserva no otorgue puntos duplicados del mismo tipo
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_tx_booking_type ON loyalty_transaction ("bookingId", type) WHERE "bookingId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_club_user ON loyalty_transaction("clubId", "userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transaction("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_booking ON loyalty_transaction("bookingId");

COMMIT;
