# Plan de Remediación de Seguridad — TuCancha

Este plan establece el orden estricto de mitigación para subsanar las vulnerabilidades detectadas, clasificado por prioridad y nivel de impacto arquitectónico.

---

## P0 — Production Blockers (Inmediato — Bloquean Salida a Producción)

### P0-01: Corrección de Clave Secreta JWT y Sincronización de Estrategia
- **Vulnerabilidad Asociada:** SEC-001
- **Clasificación:** `SAFE`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/auth/jwt.strategy.ts`
  - `backend-tucancha-main/src/auth/auth.module.ts`
  - `backend-tucancha-main/src/auth/auth.service.ts`
- **Acción:**
  1. Modificar `auth.module.ts` para registrar `JwtModule.registerAsync` inyectando `ConfigService` y obteniendo `configService.getOrThrow<string>('JWT_SECRET')`.
  2. Inyectar `ConfigService` en `JwtStrategy` y pasar `configService.getOrThrow<string>('JWT_SECRET')` a `super()`.
  3. Asegurar que `auth.service.ts` use la misma clave `JWT_SECRET` para firmar access tokens.
- **Riesgo de Regresión:** Nulo (requiere verificar que `.env` en producción contenga un secreto de al menos 32 caracteres).
- **Pruebas:** Firmar un token con clave inválida y confirmar que la API responda `401 Unauthorized`.

### P0-02: Proteger Endpoints Públicos de Usuarios (`user.controller.ts`)
- **Vulnerabilidad Asociada:** SEC-002
- **Clasificación:** `REVIEW REQUIRED`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/user/user.controller.ts`
- **Acción:**
  1. Aplicar `@UseGuards(JwtAuthGuard)` a `remove(@Param('id') id: string)` y restringirlo a `ADMIN`.
  2. Aplicar `@UseGuards(JwtAuthGuard)` a `create` o eliminar el endpoint si el registro legítimo se realiza por `POST /auth/register`.
  3. Proteger `findOne(@Param('id') id: string)` exigiendo que `user.id === id` o `user.role === 'ADMIN'`.
- **Riesgo de Regresión:** Bajo (verificar si el frontend consumía `GET /users/:id` de forma anónima).

### P0-03: Proteger Rutas Administrativas y Destructivas de Clubes (`club.controller.ts`)
- **Vulnerabilidad Asociada:** SEC-003
- **Clasificación:** `SAFE`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/club/club.controller.ts`
- **Acción:**
  1. Añadir `@UseGuards(JwtAuthGuard)` a `PUT :id`, `DELETE :id`, `approveClub`, `rejectClub`, `suspendClub`, `reactivateClub`.
  2. Comprobar que en `approve`, `reject`, `suspend` y `reactivate` el usuario autenticado posea rol `ADMIN`.
  3. En `PUT :id`, verificar que `user.role === 'ADMIN'` o `user.club.id === id`.
- **Riesgo de Regresión:** Bajo. El panel administrativo frontend ya envía el Bearer token en sus llamadas.

### P0-04: Eliminar Asignación Arbitraria de Rol `ADMIN` en Registro
- **Vulnerabilidad Asociada:** SEC-004
- **Clasificación:** `SAFE`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/auth/auth.service.ts`
  - `backend-tucancha-main/src/auth/dto/register.dto.ts`
- **Acción:**
  1. En `auth.service.ts` (`register`), agregar validación explícita: si `role === UserRole.ADMIN`, lanzar `BadRequestException('El rol ADMIN no puede ser registrado públicamente')`.
  2. Si el rol no es `CLUB`, forzar por defecto `UserRole.USER`.
- **Riesgo de Regresión:** Nulo.

### P0-05: Sanitizar Cálculo de Precios y Bloquear Tampering en Pagos
- **Vulnerabilidad Asociada:** SEC-005
- **Clasificación:** `REVIEW REQUIRED`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/payment/payment.service.ts`
- **Acción:**
  1. En `confirmPayment(dto)`, no aceptar un `amount` arbitrario del cliente a menos que coincida exactamente con las reglas de adelanto mínimo del club (`club.adelantoMinimo` o porcentaje).
  2. En `handleMercadoPagoWebhook`, si el monto pagado es menor al total de la reserva, registrar el pago como `PaymentType.ADELANTO` con `saldoStatus = 'PENDIENTE'` y no liquidar la reserva como `PAGO_COMPLETO`.
- **Riesgo de Regresión:** Medio (debe probarse exhaustivamente el flujo de checkout con tarjeta y con adelanto).

### P0-06: Bloquear Auto-Activación de Membresías sin Pago Confirmado
- **Vulnerabilidad Asociada:** SEC-006
- **Clasificación:** `ARCHITECTURAL`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/membership/membership.service.ts`
  - `backend-tucancha-main/src/membership/entities/membership_payment.entity.ts`
- **Acción:**
  1. En `submitManualPayment`, registrar el pago con estado `PENDING_AUDIT`.
  2. No llamar a `activateOrRenewMembership` de forma inmediata.
  3. Crear endpoint administrativo para que el superadministrador apruebe el comprobante antes de otorgar vigencia activa al club.
- **Riesgo de Regresión:** Requiere que el equipo de soporte u operaciones audite los vouchers en el panel administrativo.

### P0-07: Proteger Aprobación de Pagos Manuales (`auditManualPayment`)
- **Vulnerabilidad Asociada:** SEC-007
- **Clasificación:** `SAFE`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/payment/payment.service.ts`
- **Acción:**
  1. En `auditManualPayment`, verificar que `auditor.role === UserRole.ADMIN` o que el club de la reserva corresponda estrictamente a `auditor.club.id`. En caso contrario, lanzar `ForbiddenException`.
- **Riesgo de Regresión:** Nulo.

### P0-08: Restringir `POST /bookings/manual` a Rol `CLUB` y `ADMIN`
- **Vulnerabilidad Asociada:** SEC-008
- **Clasificación:** `SAFE`
- **Archivos Afectados:**
  - `backend-tucancha-main/src/booking/booking.controller.ts`
- **Acción:**
  1. Agregar validación en el controlador: si `user.role !== 'CLUB' && user.role !== 'ADMIN'`, lanzar `ForbiddenException('Solo los clubes y administradores pueden registrar pagos manuales en caja')`.
  2. Verificar que la cancha corresponda al club del usuario logueado.
- **Riesgo de Regresión:** Nulo.

---

## P1 — Critical & High Priority (Inmediatamente después de P0)

### P1-01: Verificación de Autoría en Cancelación de Reservas (`cancelBooking`)
- **Vulnerabilidad Asociada:** SEC-009
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/booking/booking.service.ts` y `booking.controller.ts`
- **Acción:** Pasar el `user` autenticado a `cancelBooking` y comprobar que `booking.user.id === user.id || booking.club.id === user.club?.id || user.role === 'ADMIN'`.

### P1-02: Ocultar Datos Sensibles y Hashes en Respuestas de Usuario
- **Vulnerabilidad Asociada:** SEC-010
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/main.ts` y `user.service.ts`
- **Acción:** Activar `app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))` y proyectar campos explícitos en `findOneById`.

### P1-03: Sanitización de Cuerpos en Excepciones Sentry
- **Vulnerabilidad Asociada:** SEC-011
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts`
- **Acción:** Crear función redactora que elimine claves como `password`, `token`, `newPassword`, `refreshToken` antes de enviar `extra.body` a Sentry.

### P1-04: Implementar Verificación de Firma HMAC en Webhooks Mercado Pago
- **Vulnerabilidad Asociada:** SEC-012
- **Clasificación:** `REVIEW REQUIRED`
- **Archivo:** `backend-tucancha-main/src/payment/payment.service.ts` y `membership.service.ts`
- **Acción:** Validar cabecera `x-signature` calculando HMAC-SHA256 con la clave secreta de webhook de Mercado Pago.

### P1-05: Rate Limiting en Autenticación y APIs Públicas
- **Vulnerabilidad Asociada:** SEC-013
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/app.module.ts` y `auth.controller.ts`
- **Acción:** Integrar `@nestjs/throttler` configurando límite de 5 intentos por minuto para `/auth/login` y `/auth/forgot-password`.

### P1-06: Verificación de Pertenencia en Canchas (`CourtController`)
- **Vulnerabilidad Asociada:** SEC-014
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/court/court.controller.ts`
- **Acción:** En `update` y `remove`, validar que la cancha pertenezca a `user.club.id` antes de proceder.

---

## P2 — Medium Priority (Robustez Operativa)

### P2-01: Migrar Tokens de Sesión Frontend a Cookies HttpOnly
- **Vulnerabilidad Asociada:** SEC-015
- **Clasificación:** `ARCHITECTURAL`
- **Archivo:** `nextjs-cancha-main/lib/axios.ts` y `nextjs-cancha-main/lib/auth.ts`
- **Acción:** Abandonar el almacenamiento de `refresh_token` en `localStorage` y gestionar sesiones íntegramente mediante cookies seguras.

### P2-02: Reactivar Typecheck y Linter en Build de Next.js
- **Vulnerabilidad Asociada:** SEC-016
- **Clasificación:** `REVIEW REQUIRED`
- **Archivo:** `nextjs-cancha-main/next.config.mjs`
- **Acción:** Eliminar `ignoreBuildErrors: true` e `ignoreDuringBuilds: true`, solventando los errores de tipado existentes.

### P2-03: Lista Blanca de Extensiones en Cargas de Archivos
- **Vulnerabilidad Asociada:** SEC-017
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/court/court.controller.ts` y `src/club/club.controller.ts`
- **Acción:** Configurar `fileFilter` en Multer limitando a `image/jpeg`, `image/png`, `image/webp`.

### P2-04: Reparación de Suites de Pruebas Unitarias Rotas
- **Vulnerabilidad Asociada:** SEC-018
- **Clasificación:** `REVIEW REQUIRED`
- **Archivo:** `backend-tucancha-main/src/**/*.spec.ts`
- **Acción:** Inyectar mocks adecuados de repositorios y servicios dependientes en los módulos de prueba de NestJS para restablecer la cobertura ejecutable al 100%.

### P2-05: Actualización Segura de Dependencias Vulnerables
- **Vulnerabilidad Asociada:** SEC-019
- **Clasificación:** `REVIEW REQUIRED`
- **Archivo:** `backend-tucancha-main/package.json`
- **Acción:** Actualizar paquetes compatibles mediante `npm update`, prestando especial atención a TypeORM y validator.

---

## P3 — Low Priority & Hardening

### P3-01: Ofuscación de Mensajes de Error Internos en Producción
- **Vulnerabilidad Asociada:** SEC-020
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts`
- **Acción:** No retornar `exception.message` crudo si el estado es 500 y `NODE_ENV === 'production'`.

### P3-02: Hardening de Cabeceras HTTP con Helmet
- **Vulnerabilidad Asociada:** SEC-021
- **Clasificación:** `SAFE`
- **Archivo:** `backend-tucancha-main/src/main.ts`
- **Acción:** Importar y registrar `helmet()` en la aplicación NestJS.

---

## P4 — Cleanup & Deprecation (Limpieza de Código Muerto)

1. Deprecar y archivar `backend-tucancha-main/src/database/database.providers.ts` y `database.module.ts`.
2. Consolidar el módulo de Mercado Pago eliminando el directorio con error tipográfico `src/mecado-pago/`.
3. Eliminar datos mockeados en `nextjs-cancha-main/lib/auth.ts` (`club1`, `club2`).
4. Desactivar el endpoint duplicado de login `nextjs-cancha-main/app/api/login/route.ts` en favor de NextAuth.
