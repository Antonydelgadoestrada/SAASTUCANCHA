# Memoria del Proyecto: Nueva Implementación de Puntos de Fidelización

## 1. Contexto Crítico de Producción
- **Entorno de Producción:** El sistema **TuCancha** está actualmente desplegado en producción en **Digital Ocean** con usuarios y clubes activos reales utilizando la plataforma.
- **Regla Fundamental Inquebrantable:** **NO MODIFICAR CÓDIGO QUE YA FUNCIONA.** Cualquier modificación en servicios existentes (`PaymentService`, `BookingService`, etc.) debe ser exclusivamente aditiva, no bloqueante (`fire-and-forget`) y protegida con `@Optional()` y captura de errores `try/catch` para que ninguna falla en puntos interfiera con los flujos de cobro o reserva en producción.

## 2. Flujo de Git y Ramas de Trabajo
- **Rama Actual de Trabajo:** `feature/loyalty-points`.
- **Rama Objetivo de Integración:** `MAIN-2.0` (o `main 2.0`).
- **ADVERTENCIA CRÍTICA:** **NUNCA** hacer merge directo ni push a la rama `main`, ya que `main` tiene configurado el autodeploy directo a los servidores de producción de Digital Ocean, y un compañero de equipo se encuentra trabajando en otro apartado que se integrará primero en `MAIN-2.0`.

## 3. Arquitectura del Módulo de Fidelidad
### Base de Datos (DDL Aditivo y Seguro)
- Script: `scripts/loyalty_schema.sql` (ejecutable de forma segura con `IF NOT EXISTS` sin alterar tablas legadas).
- Tablas aisladas con prefijo `loyalty_`:
  1. `loyalty_config`: Configuración por club (Modo A: día/noche; Modo B: cada X reservas).
  2. `loyalty_reward`: Catálogo de premios por club.
  3. `loyalty_balance`: Saldo de puntos y contador de reservas por usuario y club.
  4. `loyalty_redemption`: Canjes solicitados con código alfanumérico único `TC-XXXXXX`.
  5. `loyalty_transaction`: Libro inmutable de movimientos de puntos.

### Backend (NestJS 10)
- Módulo global: `src/loyalty/loyalty.module.ts`.
- Servicio: `src/loyalty/loyalty.service.ts` (idempotencia garantizada, bloqueos pesimistas `pessimistic_write` en canjes, cron horario de auto-expiración de canjes de 30 días con reembolso automático).
- Controladores:
  - `src/loyalty/loyalty-club.controller.ts`: Rutas `/loyalty/club/*` con aislamiento estricto por JWT (`req.user.club.id`).
  - `src/loyalty/loyalty-user.controller.ts`: Rutas `/loyalty/user/*` con JWT de jugador (`req.user.id`).
- Pruebas unitarias: 33 tests aprobados (17 en servicio, 16 en controladores).

### Hooks en Servicios Existentes
- `src/payment/payment.service.ts`:
  1. Aprobación Webhook Mercado Pago 100% online (`type === PAGO_COMPLETO` o `saldoStatus === NO_APLICA`).
  2. Aprobación de Comprobante Manual (`auditManualPayment`) cuando totaliza el 100%.
  3. Aprobación de Saldo (`auditSaldoPayment`) cuando completa el 100%.
  4. Liquidación presencial en club (`settleSaldoAtClub`) cuando el saldo se paga en recepción.
- `src/booking/booking.service.ts`:
  5. Reserva manual marcada como pagada (`markAsPaid`).
  6. Reversión de puntos por cancelación de reserva (`cancelBooking`).

### Frontend (Next.js 14/15)
- Cliente API: `nextjs-cancha-main/lib/loyalty.ts`.
- Panel del Club: `/club/loyalty` (`components/club/loyalty-content.tsx`): Mesa de validación rápida por código `TC-XXXXXX`, gestión de premios, configuración Modo A/B e historial de canjes.
- Portal del Jugador: `/user/loyalty` (`components/user/loyalty-content.tsx`): Selector de club, saldo de puntos, catálogo de canje, generación de cupón y movimientos.
- Navegación: `components/layout/app-sidebar.tsx`.

## 4. Feature Flags de Seguridad
- `LOYALTY_ENABLED=false`: Desactiva por completo el otorgamiento y canje si está en `false`.
- `LOYALTY_ALLOWED_CLUB_IDS=""`: Permite habilitar el piloto únicamente para uno o más UUIDs de clubes específicos antes del lanzamiento masivo.
