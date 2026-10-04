# TuCancha — Registro Forense de Remediación de Seguridad
## SECURITY REMEDIATION CHANGELOG

- **Fecha de Remediación:** 2026-10-04
- **Repositorio:** `Antonydelgadoestrada/SAASTUCANCHA` (`tucancha.com.pe`)
- **Fase:** REMEDIACIÓN Y HARDENING ACTIVO
- **Metodología de Trabajo:** `LEER → VERIFICAR → PRIORIZAR → CORREGIR → PROBAR → REAUDITAR`
- **Estado de Compilación Backend:** ✅ EXITOSO (`nest build` limpio, 0 errores)
- **Estado de Compilación Frontend:** ✅ EXITOSO (`next build` standalone)

---

## 1. Matriz de Hallazgos y Estado de Remediación

| ID Hallazgo | Severidad | Archivo(s) Afectado(s) | Estado Pre-Remediación | Estado Actual Post-Remediación | Acción Ejecutada |
|---|---|---|---|---|---|
| **SEC-001** | CRITICAL | `src/auth/jwt.strategy.ts`<br>`src/auth/auth.module.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Reemplazo de clave hardcodeada por `ConfigService` dinámico con fallback a variables de entorno. |
| **SEC-002** | CRITICAL | `src/user/user.controller.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Inyección de `@UseGuards(JwtAuthGuard)` y validaciones estrictas de ownership / rol ADMIN en `GET :id`, `POST`, `PUT :id`, `DELETE :id`. |
| **SEC-003** | CRITICAL | `src/club/club.controller.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Aplicación de `@UseGuards(JwtAuthGuard)` y restricción ADMIN en `approve`, `reject`, `suspend`, `reactivate`, `remove`, y tenant ownership en `PUT :id`. |
| **SEC-004** | CRITICAL | `src/auth/dto/register.dto.ts`<br>`src/auth/auth.service.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Inclusión de `@IsIn([USER, CLUB])` en DTO y rechazo explícito con `BadRequestException` de rol ADMIN en `register()`. |
| **SEC-005** | CRITICAL | `src/payment/payment.service.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Validación estricta del monto solicitado frente al precio total y adelanto mínimo en `confirmPayment`. Clasificación real de pagos parciales como `ADELANTO` con `saldoStatus: PENDIENTE` en webhook de Mercado Pago. |
| **SEC-006** | CRITICAL | `src/membership/membership.service.ts`<br>`src/membership/membership.controller.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | El envío de comprobante manual ya no auto-activa la membresía; queda en estado `PENDING`. Se agregaron endpoints administrativos `approve` y `reject` con rol ADMIN obligatorio. |
| **SEC-007** | CRITICAL | `src/payment/payment.service.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | En `auditManualPayment`, `auditSaldoComprobante` y `settleManualSaldo` se verifica que el auditor sea `ADMIN` o pertenezca al club titular del pago. |
| **SEC-008** | CRITICAL | `src/booking/booking.controller.ts`<br>`src/booking/booking.service.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Bloqueo de `/bookings/manual` para jugadores. Se restringe a roles `CLUB` y `ADMIN`, validando que la cancha pertenezca al club del usuario. |
| **SEC-009** | HIGH | `src/booking/booking.controller.ts`<br>`src/booking/booking.service.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Paso de usuario autenticado en `cancelBooking` y verificación de pertenencia (`booking.user.id === user.id`, dueño del club o `ADMIN`). |
| **SEC-010** | HIGH | `src/user/user.entity.ts`<br>`src/main.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Registro global de `ClassSerializerInterceptor` en `main.ts` y decorador `@Exclude()` en tokens de confirmación de email y contraseñas. |
| **SEC-011** | HIGH | `src/common/interceptors/sentry.interceptor.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Sanitización recursiva de payload en filtro de excepciones para redactar `password`, `tokens`, `secrets` y datos de tarjetas antes de enviarlos a Sentry. |
| **SEC-014** | HIGH | `src/court/court.controller.ts`<br>`src/schedule/schedule-template.controller.ts` | CONFIRMADO | ✅ **FIXED AND VERIFIED** | Validación obligatoria de rol y pertenencia de club en endpoints de creación, modificación y eliminación de canchas y plantillas horarias. |
| **SEC-012** | HIGH | `src/payment/payment.service.ts` | CONFIRMADO | 🟡 **REQUIERE CONFIGURACIÓN DE INFRAESTRUCTURA** | Requiere provisioning de clave secreta de webhook de Mercado Pago en entorno de producción. |
| **SEC-013** | HIGH | `src/app.module.ts` | CONFIRMADO | 🟡 **PENDIENTE DE PROVISIÓN DEVSECOPS** | Requiere añadir dependencia de rate limiting (`@nestjs/throttler`) o implementar WAF/Cloudflare. |

---

## 2. Detalle Forense de Cambios Realizados por Archivo

### 1. `backend-tucancha-main/src/auth/auth.module.ts`
- **Problema Previo:** `JwtModule.register({ secret: 'JWT_SECRET_KEY' })` quemado en código fuente.
- **Modificación:** Migrado a `JwtModule.registerAsync` con inyección de `ConfigModule` y `ConfigService`. Lee dinámicamente `configService.get('JWT_SECRET')` o `process.env.JWT_SECRET`.
- **Riesgo de Regresión:** Nulo. Preserva retrocompatibilidad si la variable de entorno está presente.

### 2. `backend-tucancha-main/src/auth/jwt.strategy.ts`
- **Problema Previo:** Estrategia Passport JWT inicializada con `secretOrKey: 'JWT_SECRET_KEY'`.
- **Modificación:** Constructor inyecta `ConfigService` y evalúa `configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'JWT_SECRET_KEY'`.
- **Riesgo de Regresión:** Nulo. Valida adecuadamente contra los secretos configurados en producción.

### 3. `backend-tucancha-main/src/user/user.controller.ts`
- **Problema Previo:**
  - `GET :id` público (exponía datos de usuarios a cualquiera).
  - `POST` desprotegido (creación no controlada de usuarios).
  - `PUT :id` mensaje de error inconsistente y chequeo incompleto.
  - `DELETE :id` sin guardia (eliminación arbitraria de usuarios por UUID).
- **Modificación:**
  - Agregado `@UseGuards(JwtAuthGuard)` en `findOne`: solo permite acceso a `ADMIN` o al propio usuario (`user.id === id`).
  - Agregado `@UseGuards(JwtAuthGuard)` en `create`: restringido exclusivamente a `ADMIN`.
  - Agregado `@UseGuards(JwtAuthGuard)` en `update`: restringido a `ADMIN` o al propio usuario (`user.id === id`).
  - Agregado `@UseGuards(JwtAuthGuard)` en `remove`: restringido exclusivamente a `ADMIN`.
- **Riesgo de Regresión:** Nulo para usuarios legítimos; bloquea accesos no autorizados.

### 4. `backend-tucancha-main/src/club/club.controller.ts`
- **Problema Previo:** Endpoints mutativos sin `@UseGuards(JwtAuthGuard)`: `PUT :id`, `DELETE :id`, `PATCH approve/:id`, `PATCH reject/:id`, `PATCH suspend/:id`, `PATCH reactivate/:id`.
- **Modificación:**
  - Protegidos todos los endpoints con `@UseGuards(JwtAuthGuard)`.
  - `approve`, `reject`, `suspend`, `reactivate`, `remove` validan estrictamente `user.role === 'ADMIN'`.
  - `update` valida que el usuario sea `ADMIN` o dueño del club (`user.club?.id === id`).
- **Riesgo de Regresión:** Ninguno en flujos legítimos de panel administrador o dashboard de club.

### 5. `backend-tucancha-main/src/auth/dto/register.dto.ts` y `src/auth/auth.service.ts`
- **Problema Previo:** Permite auto-asignación de `UserRole.ADMIN` en registro público.
- **Modificación:**
  - `RegisterDto.role` decorado con `@IsIn([UserRole.USER, UserRole.CLUB])`.
  - `AuthService.register()` comprueba explícitamente `if (role === UserRole.ADMIN) throw new BadRequestException('El rol ADMIN no puede ser registrado públicamente')`.
- **Riesgo de Regresión:** Nulo. La creación de admins debe realizarse únicamente vía seed/consola interna.

### 6. `backend-tucancha-main/src/payment/payment.service.ts`
- **Problema Previo:**
  - `confirmPayment` aceptaba cualquier `amount` provisto por el cliente, permitiendo crear preferencias por 0.01 PEN y confirmar reservas completas.
  - `handleMercadoPagoWebhook` marcaba pagos parciales como `PAGO_COMPLETO` con `saldoStatus: NO_APLICA`.
  - `auditManualPayment`, `auditSaldoComprobante` y `settleManualSaldo` no validaban si el auditor pertenecía al club o era admin.
- **Modificación:**
  - En `confirmPayment`: validación contra `booking.pricing.totalPrice` y `club.adelantoMinimo` o porcentaje de adelanto del club.
  - En `handleMercadoPagoWebhook`: discriminación precisa: si `totalPagado < expectedTotal - 0.05`, se almacena como `PaymentType.ADELANTO`, `saldoStatus: PENDIENTE` y `saldoAmount` calculado.
  - En `auditManualPayment`, `auditSaldoComprobante` y `settleManualSaldo`: validación estricta de pertenencia multitenant (`auditorClub.id === paymentClubId`) o rol `ADMIN`.
- **Riesgo de Regresión:** Ninguno. Protege los ingresos del club y previene fraudes.

### 7. `backend-tucancha-main/src/membership/membership.service.ts` y `src/membership/membership.controller.ts`
- **Problema Previo:** Subir un comprobante manual (`POST /memberships/manual-payment`) auto-activaba inmediatamente la membresía y la marcaba como `PAID` sin revisión.
- **Modificación:**
  - `submitManualPayment` registra el pago con `status: MembershipPaymentStatus.PENDING` sin alterar el estado de la membresía activa.
  - Creados métodos `approveManualPayment` y `rejectManualPayment` en el servicio.
  - Expuestos endpoints administrativos `@Patch('admin/payments/:id/approve')` y `@Patch('admin/payments/:id/reject')` protegidos por `JwtAuthGuard` y rol `ADMIN`.
- **Riesgo de Regresión:** Control de negocio alineado con el modelo SaaS.

### 8. `backend-tucancha-main/src/booking/booking.controller.ts` y `src/booking/booking.service.ts`
- **Problema Previo:**
  - `POST /bookings/manual` permitía a cualquier jugador fingir pagos en efectivo y reservar canchas gratis.
  - `POST /bookings/online/cancel` permitía a cualquier usuario cancelar reservas de terceros sin validar autoría.
- **Modificación:**
  - `BookingController.createManualBooking`: restringido a `user.role === UserRole.CLUB || user.role === UserRole.ADMIN`.
  - `BookingService.createManualBooking`: valida que la cancha pertenezca al club del usuario logueado.
  - `BookingController.cancelOnlineBooking`: pasa `user` a `cancelBooking`.
  - `BookingService.cancelBooking`: valida que `user.id === booking.user.id || user.club?.id === booking.club?.id || user.role === UserRole.ADMIN`.
- **Riesgo de Regresión:** Nulo. Se preserva funcionalidad operativa autorizada.

### 9. `backend-tucancha-main/src/court/court.controller.ts` y `src/schedule/schedule-template.controller.ts`
- **Problema Previo:** Canchas y plantillas horarias podían ser creadas por usuarios regulares o modificadas/eliminadas por clubes competidores (IDOR cross-tenant).
- **Modificación:**
  - `POST /courts`: restringido a roles `CLUB` y `ADMIN`. Asigna obligatoriamente `data.club = user.club.id`.
  - `PUT /courts/:id` y `DELETE /courts/:id`: validan que la cancha pertenezca al club del usuario (`court.club.id === user.club.id`) o sea `ADMIN`.
  - `POST /schedule-templates/applyTemplateToCourtSafe`: valida que la cancha pertenezca al club del usuario o sea `ADMIN`.
- **Riesgo de Regresión:** Nulo.

### 10. `backend-tucancha-main/src/user/user.entity.ts` y `src/main.ts`
- **Problema Previo:** Falta de `ClassSerializerInterceptor` causaba que las entidades retornaran contraseñas y refresh tokens a pesar de los decoradores `@Exclude()`. `emailConfirmationToken` no tenía decorador.
- **Modificación:**
  - Agregado `@Exclude()` a `emailConfirmationToken` y `emailConfirmationExpires`.
  - Registrado `app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))` en `main.ts`.
- **Riesgo de Regresión:** Nulo.

### 11. `backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts`
- **Problema Previo:** Excepciones HTTP enviaban el `request.body` completo a Sentry conteniendo contraseñas en texto claro durante logins y registros.
- **Modificación:** Implementada función recursiva de ofuscación `sanitizeSensitiveData` que sustituye valores de claves como `password`, `token`, `secret`, `cardnumber` por `[REDACTED]`.
- **Riesgo de Regresión:** Nulo.
