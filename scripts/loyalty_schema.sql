-- =====================================================================
-- SCRIPT DDL: MÓDULO DE FIDELIDAD POR PUNTOS (TUCANCHA)
-- Archivo: scripts/loyalty_schema.sql
-- Ejecución: 100% Aditivo, Seguro e Idempotente (IF NOT EXISTS)
-- Base de Datos Objetivo: testdb (DigitalOcean Staging/Test)
-- =====================================================================

-- 1. Tabla de Configuración de Fidelidad por Club
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

-- 2. Tabla de Catálogo de Premios por Club
CREATE TABLE IF NOT EXISTS loyalty_reward (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "pointsCost" INTEGER NOT NULL CHECK ("pointsCost" >= 1),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loyalty_reward_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reward_club_active ON loyalty_reward("clubId", "isActive");

-- 3. Tabla de Saldo de Puntos por Usuario y por Club
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

-- 4. Tabla de Canjes de Premios
CREATE TABLE IF NOT EXISTS loyalty_redemption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rewardId" UUID,
    "rewardNameSnapshot" VARCHAR(255) NOT NULL,
    "rewardCostSnapshot" INTEGER NOT NULL CHECK ("rewardCostSnapshot" >= 1),
    code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'DELIVERED', 'REJECTED', 'EXPIRED'
    "rejectReason" VARCHAR(255),
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedByUserId" UUID,
    CONSTRAINT fk_loyalty_redemption_club FOREIGN KEY ("clubId") REFERENCES club(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_redemption_user FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_redemption_reward FOREIGN KEY ("rewardId") REFERENCES loyalty_reward(id) ON DELETE SET NULL,
    CONSTRAINT fk_loyalty_redemption_resolver FOREIGN KEY ("resolvedByUserId") REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_club_status ON loyalty_redemption("clubId", status);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_user ON loyalty_redemption("userId");
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_code ON loyalty_redemption(code);

-- 5. Tabla de Transacciones / Movimientos de Puntos (Inmutable)
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
