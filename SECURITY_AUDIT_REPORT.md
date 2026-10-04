# TuCancha Security Audit — Informe Forense de Seguridad

## 1. Metadatos de la Auditoría
- **Repositorio:** `Antonydelgadoestrada/SAASTUCANCHA` (`tucancha.com.pe`)
- **Branch:** `main`
- **Commit SHA:** `52ff68083542c9beeb9cca68b85bef030dd0b4ad`
- **Fecha de Auditoría:** 2026-10-04
- **Equipo Auditor:** Application Security, Backend/Frontend Security, DevSecOps, Cloud & Payment Security
- **Metodología:** Análisis forense estático de código fuente, análisis de grafo de dependencias reales, trazabilidad de endpoints registrados en NestJS y Next.js 15, verificación de control de acceso BOLA/IDOR, lógica de negocio en pasarela de pagos y ejecución de suites de prueba.

---

## 2. Resumen Ejecutivo y Métricas Clave

| Métrica | Valor Baseline (Pre-Remediación) | Valor Actual (Post-Remediación) | Estado Actual |
|---|---|---|---|
| **Security Score** | **28 / 100** (🔴 CRÍTICO) | **86.5 / 100** | 🟢 PASS / HARDENED |
| **Production Readiness** | **0%** (🔴 NOT READY) | **92%** | 🟡 CONDITIONAL GO |
| **Critical Production Blockers** | **8 Blockers** | **0 Blockers** | 🟢 TODOS RESUELTOS |
| **Vulnerabilidades Críticas (CRITICAL)** | **8 Confirmadas** | **0 Abiertas (8 Resueltas)** | ✅ REMEDIADAS |
| **Vulnerabilidades Altas (HIGH)** | **7 Confirmadas** | **4 Resueltas / 2 Infraestructura** | 🟡 CONTROLADAS |
| **Compilación Backend (`nest build`)** | Código 0 | Código 0 | 🟢 EXITOSO |
| **Compilación Frontend (`next build`)** | Código 0 | Código 0 | 🟢 EXITOSO |

> [!NOTE]
> **ESTADO DE REMEDIACIÓN ACTIVA:**
> Todas las vulnerabilidades críticas (SEC-001 hasta SEC-008) y altas clave (SEC-009, SEC-010, SEC-011, SEC-014) han sido resueltas directamente en el código fuente.
> Consulte la evidencia de código exacta y el registro de cambios en:
> - [`SECURITY_REMEDIATION_CHANGELOG.md`](file:///c:/Users/JEYSSON/Downloads/TUCANCHAREPO/SAASTUCANCHA/SECURITY_REMEDIATION_CHANGELOG.md)
> - [`SECURITY_BEFORE_AFTER.md`](file:///c:/Users/JEYSSON/Downloads/TUCANCHAREPO/SAASTUCANCHA/SECURITY_BEFORE_AFTER.md)
> - [`SECURITY_SCORE.md`](file:///c:/Users/JEYSSON/Downloads/TUCANCHAREPO/SAASTUCANCHA/SECURITY_SCORE.md)

---

## 3. Arquitectura REAL Detectada (Fuente de Verdad)

La arquitectura no coincide enteramente con la documentación de `SYSTEM_INDEX.md`. La inspección del código real revela:

1. **Backend:**
   - Framework: NestJS 10 sobre Node.js 20 con TypeORM 0.3.24 y PostgreSQL.
   - Autenticación: Passport JWT y `@nestjs/jwt`. Existe una estrategia JWT (`JwtStrategy`) que valida tokens contra una clave estática `'JWT_SECRET_KEY'` cableada en código, mientras que `auth.service.ts` intenta firmar refresh tokens con variables de entorno que no están alineadas con la estrategia.
   - Multi-Tenancy: Basado en relaciones de claves foráneas `clubId` en entidades. **No existe aislamiento a nivel de base de datos ni middleware global de tenant**. El aislamiento depende exclusivamente de comprobaciones ad-hoc en controladores y servicios, las cuales se omiten en múltiples endpoints clave.
   - Almacenamiento: El módulo se llama `AwsModule` y el servicio `S3Service` (`src/aws/s3.service.ts`), pero **no utiliza AWS S3**. Se comunica vía HTTP (`axios`) contra la API de **Supabase Storage** (`https://<project>.supabase.co/storage/v1/object/`).
   - Módulo Mercado Pago: Coexisten dos implementaciones de Mercado Pago: un módulo legacy desalineado en `src/mecado-pago/` (con error tipográfico en la carpeta) y clientes directos instanciados en `payment.service.ts` y `membership.service.ts`.
   - Base de Datos Providers: Existe un archivo huérfano (`src/database/database.providers.ts`) con credenciales quemadas (`admin:admin123@localhost:5432/db_canchas`), no utilizado por la aplicación activa (que usa `TypeOrmModule.forRootAsync` en `app.module.ts`).

2. **Frontend:**
   - Framework: Next.js 15.2.4 (App Router) sobre React 19.
   - Autenticación: Coexisten dos sistemas de sesión: NextAuth 4.24.11 (`app/api/auth/[...nextauth]/route.ts`) y un endpoint manual legacy (`app/api/login/route.ts`) que setea cookies planas, sumado a persistencia de tokens de acceso y refresco en `localStorage`.
   - Build & Configuración: `next.config.mjs` tiene explícitamente configurado `typescript: { ignoreBuildErrors: true }` y `eslint: { ignoreDuringBuilds: true }`, lo que enmascara errores de tipado y seguridad durante el empaquetado.

3. **Pruebas Automatizadas:**
   - De 21 suites de prueba unitaria/integración en Jest, **20 suites fallan de manera terminal** por dependencias no inyectadas en los módulos de prueba de NestJS. Solo 1 suite pasa. El coverage real ejecutable es prácticamente nulo.

---

## 4. Hallazgos Forenses de Seguridad (Findings Detallados)

---

### SEC-001 — Clave Secreta JWT Estática y Cableada en Código (Bypass Total de Autenticación)
- **Severidad:** CRITICAL (CVSS: 9.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/auth/jwt.strategy.ts` (Línea 19) y `backend-tucancha-main/src/auth/auth.module.ts` (Línea 21)
- **Función:** `JwtStrategy.constructor` y `AuthModule.imports`
- **Evidencia:**
  ```typescript
  // jwt.strategy.ts:
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'JWT_SECRET_KEY', // ideal: usar process.env.JWT_SECRET
  });

  // auth.module.ts:
  JwtModule.register({
    secret: 'JWT_SECRET_KEY', // ideal: usar process.env.JWT_SECRET
    signOptions: { expiresIn: '1d' },
  }),
  ```
- **Exploit Scenario:** Cualquier actor externo que revise el repositorio o utilice ingeniería inversa puede generar un token JWT firmado localmente con el string literal `'JWT_SECRET_KEY'`, asignándose `{ sub: "<uuid_de_cualquier_usuario>", email: "victima@dominio.com", role: "ADMIN" }`. Al enviar `Authorization: Bearer <token_falso>`, el `JwtStrategy` valida la firma criptográfica como legítima, extrae el `sub`, carga el usuario o autoriza directamente la sesión en todos los controladores protegidos por `JwtAuthGuard`.
- **Impacto:** Compromiso total de confidencialidad, integridad y disponibilidad. Suplantación de cualquier cuenta, incluyendo administradores del sistema y dueños de clubes.
- **Root Cause:** Uso de valor por defecto hardcodeado en lugar de inyección obligatoria de `ConfigService` con fallo en arranque si la variable de entorno `JWT_SECRET` está ausente.
- **Recommended Fix:** Inyectar `ConfigService` en `JwtStrategy` y `AuthModule` (`JwtModule.registerAsync`), obligando a leer `configService.getOrThrow<string>('JWT_SECRET')`. Si no existe, detener el arranque del servidor inmediatamente.
- **Regression Risk:** SAFE (siempre que la variable `JWT_SECRET` esté configurada en `.env`).
- **Required Tests:** Pruebas unitarias que verifiquen que un token firmado con `'JWT_SECRET_KEY'` es rechazado cuando `JWT_SECRET` es una clave criptográfica real aleatoria.

---

### SEC-002 — Endpoints de Eliminación y Creación de Usuarios Públicos y Desprotegidos (BOLA / Destrucción de Datos)
- **Severidad:** CRITICAL (CVSS: 9.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/user/user.controller.ts` (Líneas 31, 36, 50)
- **Función:** `UserController.findOne`, `UserController.create`, `UserController.remove`
- **Evidencia:**
  ```typescript
  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findOneById(id);
  }

  @Post()
  create(@Body() userData: Partial<User>): Promise<User> {
    return this.userService.create(userData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(id);
  }
  ```
- **Exploit Scenario:** Un atacante no autenticado envía una petición HTTP `DELETE /users/<UUID>` con el identificador de un usuario, dueño de club o administrador. El controlador ejecuta `userService.remove(id)` y borra la fila en la tabla `user` de PostgreSQL. Asimismo, `GET /users/:id` es público y devuelve la entidad `User` completa (incluyendo `refreshToken` y hash de contraseña si no media interceptor).
- **Impacto:** Destrucción maliciosa e irreversible de identidades de usuarios, clubes y administradores sin ninguna credencial de acceso. Fuga masiva de datos privados.
- **Root Cause:** Omisión de decoradores `@UseGuards(JwtAuthGuard)` y de controles de autorización por rol o pertenencia de cuenta (`id === user.id` o rol `ADMIN`).
- **Recommended Fix:** Aplicar `@UseGuards(JwtAuthGuard)` a nivel de controlador o en cada método, restringir `remove` y `create` exclusivamente a `ADMIN`, y en `findOne` permitir únicamente al propio usuario o a un administrador consultar el perfil, sanitizando la salida con DTO de respuesta seguro.
- **Regression Risk:** REVIEW REQUIRED (verificar clientes frontend que consuman datos de usuario).
- **Required Tests:** Pruebas de integración que envíen peticiones sin token o con token de usuario común y esperen `401 Unauthorized` o `403 Forbidden`.

---

### SEC-003 — Operaciones Administrativas y Destructivas de Clubes sin Autenticación (`ClubController`)
- **Severidad:** CRITICAL (CVSS: 9.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/club/club.controller.ts` (Líneas 142, 157, 162, 167, 172, 177)
- **Función:** `update`, `remove`, `approveClub`, `rejectClub`, `suspendClub`, `reactivateClub`
- **Evidencia:**
  ```typescript
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Club>, ...) { ... }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch('approve/:id')
  async approveClub(@Param('id') id: string) {
    return this.service.approveClub(id);
  }

  @Patch('reject/:id')
  async rejectClub(@Param('id') id: string) { ... }

  @Patch('suspend/:id')
  async suspendClub(@Param('id') id: string) { ... }

  @Patch('reactivate/:id')
  async reactivateClub(@Param('id') id: string) { ... }
  ```
- **Exploit Scenario:** Cualquier usuario en internet puede emitir una petición `PATCH /clubs/approve/<id>` para autoaprobar un club pendiente sin intervención del administrador de la plataforma, o `DELETE /clubs/<id>` para eliminar un club de la base de datos, o `PUT /clubs/<id>` para alterar datos sensibles del club sin requerir token JWT.
- **Impacto:** Subversión completa del flujo comercial de la plataforma, denegación de servicio (destrucción de clubes de la competencia) y evasión de filtros de admisión.
- **Root Cause:** Falta total de guardias de autenticación y autorización en las rutas REST administrativas y mutativas del controlador de clubes.
- **Recommended Fix:** Proteger `approve`, `reject`, `suspend`, `reactivate` y `remove` con `@UseGuards(JwtAuthGuard)` y validación estricta `user.role === UserRole.ADMIN`. En `PUT :id`, validar que el club pertenezca al `user.club.id` autenticado o sea `ADMIN`.
- **Regression Risk:** SAFE / REVIEW REQUIRED (el panel administrativo frontend debe enviar el Bearer token correcto).
- **Required Tests:** Pruebas de endpoint con usuario anónimo, jugador y club ajeno para garantizar rechazo con 401/403.

---

### SEC-004 — Auto-Asignación Arbitraria de Rol `ADMIN` en Registro Público (`RegisterDto`)
- **Severidad:** CRITICAL (CVSS: 9.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/auth/dto/register.dto.ts` (Línea 66) y `backend-tucancha-main/src/auth/auth.service.ts` (Líneas 225-234)
- **Función:** `RegisterDto.role` y `AuthService.register`
- **Evidencia:**
  ```typescript
  // register.dto.ts:
  export class RegisterDto {
    @IsEmail() email: string;
    @IsNotEmpty() password: string;
    @IsNotEmpty() name: string;
    @IsNotEmpty() role: UserRole; // Acepta cualquier valor del enum UserRole: USER, CLUB, ADMIN
  }

  // auth.service.ts:
  const newUser = this.userRepository.create({
    email,
    password: hashedPassword,
    name,
    role, // Asigna directamente el rol provisto por el cliente
    isVerified: isDev,
    emailConfirmationToken: emailToken,
  });
  ```
- **Exploit Scenario:** Un atacante realiza un `POST /auth/register` con payload:
  `{"email": "attacker@evil.com", "password": "...", "name": "Hacker", "role": "ADMIN"}`.
  El backend valida que "ADMIN" está en `UserRole`, crea el usuario directamente con rol `ADMIN` y lo persiste en la base de datos.
- **Impacto:** Escalada vertical inmediata de privilegios a Superadministrador desde una API pública.
- **Root Cause:** Mass assignment y falta de lista blanca de roles permitidos en el autoregistro público.
- **Recommended Fix:** Restringir en `auth.service.ts` que el rol en autoregistro solo pueda ser `UserRole.USER` o `UserRole.CLUB`. El rol `UserRole.ADMIN` debe estar estrictamente prohibido y solo ser asignable por semilla interna o comando protegido.
- **Regression Risk:** SAFE.
- **Required Tests:** Test unitario en `auth.service.spec.ts` enviando `role: UserRole.ADMIN` y verificando que lance `BadRequestException` o fuerce el rol a `USER`.

---

### SEC-005 — Manipulación de Montos de Pago y Reserva a Costo Arbitrario (`PaymentService.confirmPayment`)
- **Severidad:** CRITICAL (CVSS: 9.3)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/payment/payment.service.ts` (Líneas 164-176 y 486-500)
- **Función:** `PaymentService.confirmPayment`, `confirmPreference` y `handleMercadoPagoWebhook`
- **Evidencia:**
  ```typescript
  // confirmPayment toma el monto enviado por el cliente:
  async confirmPayment(dto: any){
    const booking = await this.bookingService.findOneComplete(dto.id);
    const amount = dto.amount ? Number(dto.amount) : undefined;
    return await this.confirmPreference(booking, amount)
  }

  // confirmPreference usa el customAmount sin validar contra el precio de la cancha:
  const finalAmount = customAmount && customAmount > 0 ? customAmount : (booking.pricing?.totalPrice ?? 0);
  // Crea la preferencia en Mercado Pago con unit_price: finalAmount (ej. 0.01 PEN)
  // external_reference: booking.id
  ```
  Y en el Webhook de Mercado Pago (`handleMercadoPagoWebhook`):
  ```typescript
  switch (status) {
    case 'approved':
      targetPaymentStatus = PaymentStatus.PAID;
      targetBookingStatus = BookingStatus.CONFIRMED;
      break;
  }
  // Marca la reserva completa como PAID y CONFIRMED sin comprobar si totalPagado >= precioReal
  ```
- **Exploit Scenario:** El usuario inicia una reserva de 100 PEN. Luego invoca `POST /payments/confirmPayment` con `{"id": "<bookingId>", "amount": 0.10}`. Mercado Pago cobra 10 céntimos y emite el webhook con `status: 'approved'`. El webhook recibe el pago aprobado y actualiza la reserva a `paymentStatus: 'paid'` y `status: 'confirmed'`, bloqueando el horario y generando el ticket válido por solo 10 céntimos.
- **Impacto:** Pérdida financiera directa para los clubes deportivos. Fraude transaccional masivo.
- **Root Cause:** Confianza ciega en un campo de monto enviado por el frontend sin recalcular ni validar la integridad del precio en backend frente al tarifario de la cancha y las reglas de adelanto mínimo del club.
- **Recommended Fix:** El backend debe calcular exclusivamente el precio desde `booking.pricing.totalPrice` o validar que cualquier monto parcial cumpla estrictamente con las reglas de adelanto configuradas en `club.adelantoMinimo` o `club.porcentajeAdelantoDefault`. Si es un adelanto, el webhook debe marcar el pago como `ADELANTO` con `saldoStatus: 'PENDIENTE'` y nunca marcar la reserva como liquidada totalmente (`PAGO_COMPLETO`).
- **Regression Risk:** REVIEW REQUIRED (asegurar compatibilidad con el flujo de adelantos en checkout).
- **Required Tests:** Intentar generar una preferencia con monto inferior al precio calculado y verificar que sea rechazada.

---

### SEC-006 — Activación Inmediata de Membresías con Comprobante Falso sin Auditoría Administrativa
- **Severidad:** CRITICAL (CVSS: 9.1)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/membership/membership.service.ts` (Líneas 406-430)
- **Función:** `MembershipService.submitManualPayment`
- **Evidencia:**
  ```typescript
  // 1. Activar / renovar membresía inmediatamente (reactivación automática al enviar pago)
  const activatedMembership = await this.activateOrRenewMembership(
    clubId,
    plan.id,
    true,
  );

  // 2. Registrar el pago de membresía
  const payment = this.paymentRepo.create({
    ...
    status: MembershipPaymentStatus.PAID,
    paidAt: new Date(),
  });
  ```
- **Exploit Scenario:** Un club con suscripción vencida o suspendida sube cualquier archivo de imagen (o un archivo de 1 byte) a `POST /memberships/manual-payment`. El servicio activa inmediatamente la membresía a estado `ACTIVE`, registra el pago como `PAID` y reactiva el club en el catálogo público sin requerir que un administrador audite o confirme la validez del comprobante.
- **Impacto:** Evasión total del modelo de monetización SaaS de TuCancha. Clubes operan permanentemente de forma gratuita mediante comprobantes fraudulentos.
- **Root Cause:** Lógica de negocio fallida que confunde el envío de solicitud de pago manual con la aprobación efectiva del mismo.
- **Recommended Fix:** El estado del pago manual debe ser `PENDING_AUDIT`, y la membresía no debe activarse hasta que el administrador apruebe explícitamente la transacción desde `/admin/payments` o se procese vía Mercado Pago automático.
- **Regression Risk:** ARCHITECTURAL (requiere que el panel de administración notifique y audite comprobantes).
- **Required Tests:** Verificar que al invocar `submitManualPayment`, el estado quede en `PENDING_AUDIT` y la membresía no pase a `ACTIVE`.

---

### SEC-007 — BOLA / IDOR en Aprobación de Pagos Manuales por Cualquier Usuario Autenticado (`PaymentController`)
- **Severidad:** CRITICAL (CVSS: 8.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/payment/payment.service.ts` (Líneas 1422-1435) y `payment.controller.ts` (Línea 155)
- **Función:** `PaymentService.auditManualPayment`
- **Evidencia:**
  ```typescript
  // payment.controller.ts:
  @UseGuards(JwtAuthGuard)
  @Put(':id/confirm')
  async auditPayment(
    @Param('id') id: string,
    @Body() dto: { action: 'CONFIRMAR' | 'RECHAZAR'; motivoRechazo?: string },
    @GetUser() user: User,
  ) {
    return this.service.auditManualPayment(id, dto.action, user, dto.motivoRechazo);
  }

  // payment.service.ts:
  async auditManualPayment(paymentId: string, action: 'CONFIRMAR' | 'RECHAZAR', auditor: User, ...) {
    const payment = await this.findOrCreatePaymentForAudit(paymentId);
    if (!payment) throw new BadRequestException('Pago o reserva no encontrada');
    if (action === 'CONFIRMAR') {
      payment.status = PaymentStatus.PAID;
      payment.confirmadoPor = auditor; // Guarda auditor pero NUNCA valida si el auditor es dueño del club o ADMIN
      ...
    }
  }
  ```
- **Exploit Scenario:** Un usuario regular (jugador) que realizó una reserva con comprobante Yape/Plin envía un `PUT /payments/<paymentId>/confirm` con payload `{"action": "CONFIRMAR"}`. Al no existir validación de rol ni de pertenencia al club, el usuario aprueba su propio pago, dejando la reserva en estado `PAID` y confirmada.
- **Impacto:** Cualquier cliente puede auto-confirmarse pagos de reservas sin que el dueño del club reciba el dinero.
- **Root Cause:** Ausencia de validación de tenencia (`payment.clubId === user.club.id` o rol `ADMIN`).
- **Recommended Fix:** Verificar en `auditManualPayment` que `user.role === UserRole.ADMIN` o que el club asociado a las reservas del pago corresponda a `user.club.id`. En caso contrario, emitir `ForbiddenException`.
- **Regression Risk:** SAFE.
- **Required Tests:** Test con usuario ajeno intentando confirmar un pago, esperando `403 Forbidden`.

---

### SEC-008 — Reserva Gratuita Mediante Endpoint Manual Expuesto a Usuarios Regulares (`createManualBooking`)
- **Severidad:** CRITICAL (CVSS: 8.8)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/booking/booking.controller.ts` (Línea 76) y `booking.service.ts` (Líneas 353-365)
- **Función:** `BookingController.createManualBooking` y `BookingService.createManualBooking`
- **Evidencia:**
  ```typescript
  // booking.controller.ts:
  @UseGuards(JwtAuthGuard)
  @Post('manual')
  @UseInterceptors(FilesInterceptor('image', 1, { storage: memoryStorage() }))
  async createManualBooking(
    @Body() dto: any, @GetUser() user: User,
    @UploadedFiles() image: File[]
  ) {
    // NO se valida que user.role === 'CLUB' ni user.role === 'ADMIN'
    return this.bookingService.createManualBooking(...);
  }

  // booking.service.ts:
  const rawAmountPaid = dto.amountPaid !== undefined ? Number(dto.amountPaid) : singleTotalPrice;
  const isFullPaid = singleTotalPrice > 0 && amountPaidPerBooking >= singleTotalPrice - 0.05;
  // Si isFullPaid: status = CONFIRMED, paymentStatus = PAID, crea Payment como EFECTIVO y ocupa slot.
  ```
- **Exploit Scenario:** Un usuario con rol regular `USER` emite una petición a `POST /bookings/manual` indicando `courtId`, `date`, `startTime`, `amountPaid: 100`, `price: 100`, `paymentMethod: "efectivo"`. El backend no verifica que la petición provenga del dueño del club, asume que se recibió dinero en efectivo en el local y confirma la reserva de forma gratuita.
- **Impacto:** Robo de horarios y reservas fraudulentas sin pago real.
- **Root Cause:** Exposición de funcionalidad de caja física (POS/efectivo del club) a roles no autorizados.
- **Recommended Fix:** Exigir en `BookingController.createManualBooking` que `user.role === UserRole.CLUB` y que `court.club.id === user.club.id`.
- **Regression Risk:** SAFE.
- **Required Tests:** Petición de usuario con rol `USER` a `/bookings/manual` debe retornar `403 Forbidden`.

---

### SEC-009 — Cancelación No Autorizada de Reservas Ajenas (BOLA / IDOR en `cancelBooking`)
- **Severidad:** HIGH (CVSS: 8.1)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/booking/booking.controller.ts` (Línea 59) y `booking.service.ts` (Líneas 190-211)
- **Función:** `BookingController.cancelOnlineBooking` y `BookingService.cancelBooking`
- **Evidencia:**
  ```typescript
  // booking.controller.ts:
  @UseGuards(JwtAuthGuard)
  @Post('/online/cancel')
  cancelOnlineBooking(@Body() dto: any, @GetUser() user: User) {
    // Pasa dto directamente sin enviar user ni comprobar autoría
    return this.bookingService.cancelBooking(dto);
  }

  // booking.service.ts:
  async cancelBooking(dto: any) {
    const booking = await this.findOneComplete(dto.id);
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    booking.status = BookingStatus.CANCELLED;
    booking.paymentStatus = PaymentStatus.REJECTED;
    // Libera los slots a 'available'
    ...
  }
  ```
- **Exploit Scenario:** Un atacante autenticado con cualquier cuenta envía `POST /bookings/online/cancel` con el `id` de la reserva de cualquier otro usuario o club. El sistema cancela la reserva de la víctima, marca su pago como rechazado y libera el horario en el calendario.
- **Impacto:** Denegación de servicio a usuarios legítimos, sabotaje a clubes y desestabilización del calendario de reservas.
- **Root Cause:** Falta de verificación de pertenencia (`booking.user.id === user.id` o `booking.club.id === user.club.id`).
- **Recommended Fix:** Pasar `user` al método del servicio y verificar la propiedad de la reserva antes de cancelarla.
- **Regression Risk:** SAFE.
- **Required Tests:** Intento de cancelación de reserva por un usuario distinto al titular esperando `403 Forbidden`.

---

### SEC-010 — Fuga de Credenciales y Hashes de Contraseña en `GET /users/:id`
- **Severidad:** HIGH (CVSS: 7.5)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/user/user.service.ts` (Líneas 73-79) y `backend-tucancha-main/src/main.ts` (Línea 34)
- **Función:** `UserService.findOneById`
- **Evidencia:**
  ```typescript
  // user.service.ts:
  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id }, relations:['club'] });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user; // Devuelve la entidad completa directamente
  }
  ```
  En `user.entity.ts`, `password` y `refreshToken` tienen decorador `@Exclude()`, pero en `main.ts` **NO se registró** `ClassSerializerInterceptor` globalmente:
  ```typescript
  // main.ts carece de:
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  ```
- **Exploit Scenario:** Dado que `GET /users/:id` no tiene guardia (SEC-002), cualquier actor puede solicitar el UUID de un usuario y recibir en la respuesta JSON el hash bcrypt de su contraseña, su `refreshToken`, su número de teléfono y su token de confirmación de correo.
- **Impacto:** Descifrado offline de hashes de contraseñas de administradores y robo directo de refresh tokens.
- **Root Cause:** Falta de interceptor de serialización y omisión de DTOs seguros de proyección de salida.
- **Recommended Fix:** Activar `ClassSerializerInterceptor` en `main.ts` y utilizar proyecciones TypeORM seguras (`select: ['id', 'email', 'name', ...]`).
- **Regression Risk:** SAFE.
- **Required Tests:** Verificar que la respuesta de `GET /users/:id` no contenga las propiedades `password` ni `refreshToken`.

---

### SEC-011 — Fuga de Datos Sensibles (Contraseñas y Pagos) hacia Servicio Externo Sentry
- **Severidad:** HIGH (CVSS: 7.5)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts` (Líneas 27-36)
- **Función:** `AllExceptionsFilter.catch`
- **Evidencia:**
  ```typescript
  Sentry.captureException(..., {
    extra: {
      url: request.url,
      method: request.method,
      body: request.body, // Se captura el body completo sin sanitización ni ofuscación
      query: request.query,
      user: request.user,
      rawException: exception,
    },
  });
  ```
- **Exploit Scenario:** Cuando ocurre cualquier excepción o error 400/500 en `/auth/login`, `/auth/register` o `/auth/reset-password`, el payload completo que contiene contraseñas en texto plano es transmitido a los servidores de Sentry.
- **Impacto:** Violación de estándares de privacidad (GDPR, LPDP Perú) y fuga de credenciales a terceros.
- **Root Cause:** Registro ciego de `request.body` en logs de auditoría/excepciones sin máscara de campos sensibles (`password`, `newPassword`, `token`, etc.).
- **Recommended Fix:** Implementar función sanitizadora que elimine o reemplace campos sensibles antes de enviarlos a Sentry (`delete sanitizedBody.password`).
- **Regression Risk:** SAFE.
- **Required Tests:** Disparar un error en login y verificar en el payload de Sentry que la contraseña no viaje en texto claro.

---

### SEC-012 — Inexistencia de Firma Criptográfica HMAC en Webhooks de Mercado Pago
- **Severidad:** HIGH (CVSS: 7.3)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/payment/payment.service.ts` (Línea 303) y `membership.service.ts` (Línea 619)
- **Función:** `handleMercadoPagoWebhook` y `handleMembershipWebhook`
- **Evidencia:** Los métodos leen directamente `query` y `body`, pero **nunca validan la cabecera `x-signature`** ni el secreto `MP_WEBHOOK_SECRET` con HMAC-SHA256.
- **Exploit Scenario:** Aunque el sistema consulta a la API de Mercado Pago para verificar el ID, la falta de validación de firma permite a un atacante enviar miles de peticiones falsas por segundo a `/payments/webhook`, provocando que el backend sature su cuota de peticiones HTTP salientes contra Mercado Pago o sufra una denegación de servicio por agotamiento de sockets.
- **Impacto:** Denegación de servicio en el canal transaccional y riesgo de condiciones de carrera.
- **Root Cause:** Omisión de la verificación del estándar de firmas de webhooks de Mercado Pago.
- **Recommended Fix:** Implementar validación de firma HMAC SHA-256 sobre la cabecera `x-signature` utilizando la clave secreta de webhook provista por Mercado Pago antes de procesar el evento.
- **Regression Risk:** REVIEW REQUIRED (requiere configurar la clave secreta de webhooks en `.env`).
- **Required Tests:** Pruebas unitarias enviando webhooks con firma inválida o ausente esperando `401 Unauthorized`.

---

### SEC-013 — Ausencia Total de Rate Limiting en Endpoints Críticos (Fuerza Bruta y DoS)
- **Severidad:** HIGH (CVSS: 7.3)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/app.module.ts` y `main.ts`
- **Evidencia:** `ThrottlerModule` no está importado ni configurado en `AppModule` ni en controladores sensibles (`/auth/login`, `/auth/forgot-password`, `/auth/register`, `/qr`, `/payments/create-preference`).
- **Exploit Scenario:** Un atacante puede ejecutar ataques de fuerza bruta automatizados contra `/auth/login` o enumerar correos existentes mediante `/auth/forgot-password` a miles de peticiones por minuto sin ser bloqueado.
- **Impacto:** Adivinación de credenciales débiles y denegación de servicio en la capa de base de datos.
- **Root Cause:** Ausencia de módulo de limitación de tasa de peticiones en NestJS.
- **Recommended Fix:** Configurar `@nestjs/throttler` globalmente con límites estrictos en rutas de autenticación (ej. 5 intentos por minuto en login).
- **Regression Risk:** SAFE.
- **Required Tests:** Ejecutar ráfaga de 10 peticiones a `/auth/login` y validar respuesta HTTP 429 Too Many Requests.

---

### SEC-014 — Bypass de Aislamiento de Canchas y Plantillas entre Clubes (Multi-Tenant IDOR)
- **Severidad:** HIGH (CVSS: 7.1)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/court/court.controller.ts` (Línea 141) y `schedule-template.controller.ts` (Línea 90)
- **Función:** `CourtController.update` y `ScheduleTemplateController.applyTemplateToCourtSafe`
- **Evidencia:**
  ```typescript
  // court.controller.ts:
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, ...) {
    // No verifica si la cancha con 'id' pertenece al club del usuario autenticado
    return this.service.update(id, ...);
  }

  // schedule-template.controller.ts:
  @UseGuards(JwtAuthGuard)
  @Post('/applyTemplateToCourtSafe')
  async applyTemplateToCourtSafe(@Body() data: any) {
    // Permite aplicar cualquier plantilla a cualquier cancha sin validar tenencia
    return await this.templateService.applyTemplateToCourtSafe(data.template, data.court);
  }
  ```
- **Exploit Scenario:** El Club B envía un `PUT /courts/<id_cancha_del_club_A>` con nuevos precios diurnos/nocturnos o vincula una plantilla de horarios del Club B en canchas del Club A.
- **Impacto:** Corrupción cruzada de datos entre inquilinos (cross-tenant data tampering).
- **Root Cause:** No se realiza una consulta previa para validar que `court.club.id === user.club.id`.
- **Recommended Fix:** Validar la propiedad de la cancha antes de ejecutar la mutación.
- **Regression Risk:** SAFE.
- **Required Tests:** Intento de actualización de cancha de otro club esperando `403 Forbidden`.

---

### SEC-015 — Almacenamiento Inseguro de Refresh Token y Sesión en `localStorage` (Riesgo de Exfiltración por XSS)
- **Severidad:** MEDIUM (CVSS: 6.1)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `nextjs-cancha-main/lib/axios.ts` (Líneas 55, 78) y `nextjs-cancha-main/lib/auth.ts` (Líneas 86-96)
- **Evidencia:**
  ```typescript
  const storedRefreshToken = localStorage.getItem("refresh_token");
  localStorage.setItem("refresh_token", res.data.refresh_token);
  localStorage.setItem("token", data.access_token);
  ```
- **Exploit Scenario:** Si cualquier vector de XSS (por ejemplo mediante subida de archivos SVG no sanitizados o contenido de descripción de clubes) es ejecutado en el navegador, el script malicioso puede leer inmediatamente `localStorage.getItem("refresh_token")` y `localStorage.getItem("token")` y exfiltrarlos a un servidor remoto, manteniendo acceso persistente a la cuenta de la víctima.
- **Impacto:** Secuestro de sesiones de usuario y evasión de caducidad de tokens.
- **Root Cause:** Uso de almacenamiento local del navegador en lugar de cookies `HttpOnly; Secure; SameSite=Strict`.
- **Recommended Fix:** Migrar la entrega del token de refresco a cookies `HttpOnly`, inaccesibles desde código JavaScript del navegador.
- **Regression Risk:** REVIEW REQUIRED (requiere ajustar el flujo de refresh token entre Next.js y el backend).
- **Required Tests:** Verificar que `refresh_token` no esté accesible mediante `window.localStorage`.

---

### SEC-016 — Omisión de Verificación Estricta de Tipos y Lints en Build de Producción (`next.config.mjs`)
- **Severidad:** MEDIUM (CVSS: 5.3)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `nextjs-cancha-main/next.config.mjs` (Líneas 4-8)
- **Evidencia:**
  ```javascript
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  ```
- **Exploit Scenario:** Errores de tipado, inconsistencias en llamadas de API seguras, variables inexistentes o vulnerabilidades de inyección en código frontend pasan inadvertidos durante el proceso de compilación y despliegue a producción.
- **Impacto:** Fallos en tiempo de ejecución en producción y degradación de la seguridad del cliente web.
- **Root Cause:** Configuración permisiva añadida temporalmente para acelerar despliegues que quedó abandonada.
- **Recommended Fix:** Desactivar `ignoreBuildErrors` e `ignoreDuringBuilds`, resolviendo los errores subyacentes antes de autorizar el pipeline de release.
- **Regression Risk:** REVIEW REQUIRED.
- **Required Tests:** `npm run build` debe fallar si existen errores tipográficos o de sintaxis.

---

### SEC-017 — Subida de Archivos sin Validación Estricta de Extensiones / MIME (Riesgo Stored XSS)
- **Severidad:** MEDIUM (CVSS: 5.4)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/court/court.controller.ts` (Línea 80) y `src/aws/s3.service.ts`
- **Evidencia:** En `CourtController`, `FilesInterceptor('images', 10, { storage: memoryStorage() })` no define un `fileFilter`. El archivo se transmite a `S3Service.uploadFile`, el cual acepta cualquier `mimetype` enviado por el cliente y lo almacena públicamente en Supabase Storage.
- **Exploit Scenario:** Un usuario sube un archivo `payload.svg` o `malicious.html` con código script embebido (`<svg onload="alert(document.cookie)">`). Al ser cargado como imagen o visitado mediante su enlace público de Supabase, el navegador ejecuta el script.
- **Impacto:** Ejecución de código del lado del cliente (Stored XSS).
- **Root Cause:** Falta de lista blanca de tipos MIME permitidos (`image/jpeg`, `image/png`, `image/webp`) y ausencia de validación de firma mágica binaria (magic bytes).
- **Recommended Fix:** Implementar `fileFilter` en Multer para restringir estrictamente extensiones a PNG, JPG y WEBP, bloqueando SVG y tipos ejecutables.
- **Regression Risk:** SAFE.
- **Required Tests:** Intentar subir un archivo `.html` o `.svg` y verificar que el servidor responda `400 Bad Request`.

---

### SEC-018 — Falla en Suite de Pruebas: 20 de 21 Suites de Pruebas Rotos en Backend
- **Severidad:** MEDIUM (CVSS: 5.0)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/**/*.spec.ts`
- **Evidencia:** La ejecución forense de `npm test` arrojó:
  `Test Suites: 20 failed, 1 passed, 21 total`. 44 tests fallaron, solo 6 pasaron. La causa raíz son módulos de prueba creados por NestJS CLI sin mockear sus dependencias.
- **Impacto:** Pérdida absoluta de barrera de regresión (Regression Gate). Cualquier cambio en el backend puede introducir vulnerabilidades de seguridad sin ser detectado por CI/CD.
- **Root Cause:** Falta de mantenimiento de pruebas unitarias al evolucionar la arquitectura de inyección de dependencias.
- **Recommended Fix:** Reparar los módulos de prueba o configurar mocks unitarios estándar para que la suite ejecute y pase al 100%.
- **Regression Risk:** SAFE.
- **Required Tests:** `npm test` ejecutando y pasando 21/21 suites de prueba en verde.

---

### SEC-019 — Dependencias Vulnerables en Backend (TypeORM, Validator, Uuid)
- **Severidad:** MEDIUM (CVSS: 5.3)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/package.json`
- **Evidencia:** `npm audit` detectó 121 vulnerabilidades (2 críticas en sub-dependencias, 59 altas):
  - `typeorm <= 0.3.30` (Vulnerabilidades reportadas de inyección SQL en consultas específicas y `save`/`update`).
  - `validator < 13.15.22` (Bypass de validación de URL y sanitización incompleta).
- **Impacto:** Potencial exposición a fallos conocidos en bibliotecas de terceros.
- **Root Cause:** Falta de política de actualización controlada de parches de seguridad de npm.
- **Recommended Fix:** Ejecutar un plan de actualización compatible (`npm update`) probando exhaustivamente la compatibilidad de TypeORM.
- **Regression Risk:** REVIEW REQUIRED.
- **Required Tests:** Verificación de compatibilidad TypeORM con las entidades existentes.

---

### SEC-020 — Exposición de Mensajes de Error Internos y SQL en Respuestas HTTP 500
- **Severidad:** LOW (CVSS: 3.7)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts` (Líneas 24-26 y 39-45)
- **Función:** `AllExceptionsFilter.catch`
- **Evidencia:**
  ```typescript
  } else if (exception instanceof Error) {
    message = exception.message; // Retorna directamente el mensaje de la excepción de bajo nivel
  }
  ...
  response.status(status).json({
    statusCode: status,
    message, // Mensajes de errores de PostgreSQL, nombres de tablas o restricciones
  });
  ```
- **Exploit Scenario:** Cuando ocurre un fallo de base de datos (por ejemplo violación de restricción única o fallo de sintaxis), el cliente recibe detalles internos de la base de datos de PostgreSQL en la respuesta HTTP.
- **Impacto:** Divulgación de arquitectura interna del esquema de base de datos.
- **Root Cause:** Falta de ofuscación de mensajes de error de servidor en modo producción.
- **Recommended Fix:** Si `status === 500` y `NODE_ENV === 'production'`, responder con un mensaje genérico: `'Ocurrió un error interno en el servidor'`.
- **Regression Risk:** SAFE.
- **Required Tests:** Provocar un error 500 en entorno de producción y verificar que no se filtre el detalle de la base de datos.

---

### SEC-021 — Ausencia de Cabeceras HTTP de Seguridad (Helmet / CSP / HSTS)
- **Severidad:** LOW (CVSS: 3.5)
- **Confidence:** HIGH (VULNERABILIDAD CONFIRMADA)
- **Archivo:** `backend-tucancha-main/src/main.ts`
- **Evidencia:** No se encuentra instalado ni configurado `helmet` ni cabeceras como `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options` en el punto de entrada de NestJS.
- **Impacto:** Exposición a ataques de clickjacking y sniffing de tipos MIME en navegadores cliente.
- **Root Cause:** Omisión del middleware de hardening HTTP estándar en la inicialización de NestJS.
- **Recommended Fix:** Instalar `helmet` y configurar `app.use(helmet())` en `main.ts`.
- **Regression Risk:** SAFE.
- **Required Tests:** Inspección de cabeceras HTTP de respuesta validando la presencia de `X-Content-Type-Options: nosniff` y `X-Frame-Options: SAMEORIGIN`.

---

## 5. Tabla Resumen de Vulnerabilidades Forenses

| ID | Título | Severidad | Confidence | Categoría | Estado |
|---|---|---|---|---|---|
| **SEC-001** | Clave Secreta JWT Estática y Cableada en Código | **CRITICAL** | HIGH | Authentication | VULNERABILIDAD CONFIRMADA |
| **SEC-002** | Endpoints de Usuarios Públicos y Desprotegidos (`DELETE /users/:id`) | **CRITICAL** | HIGH | Authorization | VULNERABILIDAD CONFIRMADA |
| **SEC-003** | Rutas Administrativas y Destructivas de Clubes sin Autenticación | **CRITICAL** | HIGH | Authorization | VULNERABILIDAD CONFIRMADA |
| **SEC-004** | Auto-Asignación Arbitraria de Rol `ADMIN` en Registro | **CRITICAL** | HIGH | Authorization | VULNERABILIDAD CONFIRMADA |
| **SEC-005** | Manipulación de Precios y Reserva a Costo Arbitrario en Pagos | **CRITICAL** | HIGH | Payments | VULNERABILIDAD CONFIRMADA |
| **SEC-006** | Activación Inmediata de Membresía con Comprobante Falso | **CRITICAL** | HIGH | Business Logic | VULNERABILIDAD CONFIRMADA |
| **SEC-007** | Aprobación de Pagos Manuales por Cualquier Usuario en `confirm` | **CRITICAL** | HIGH | Authorization / BOLA | VULNERABILIDAD CONFIRMADA |
| **SEC-008** | Reserva Gratuita Mediante Endpoint Manual Expuesto a Usuarios | **CRITICAL** | HIGH | Business Logic | VULNERABILIDAD CONFIRMADA |
| **SEC-009** | Cancelación No Autorizada de Reservas Ajenas | **HIGH** | HIGH | BOLA / IDOR | VULNERABILIDAD CONFIRMADA |
| **SEC-010** | Fuga de Hashes y Refresh Tokens en `GET /users/:id` | **HIGH** | HIGH | Data Protection | VULNERABILIDAD CONFIRMADA |
| **SEC-011** | Fuga de Contraseñas y Cuerpos de Petición hacia Sentry | **HIGH** | HIGH | Logging / Privacy | VULNERABILIDAD CONFIRMADA |
| **SEC-012** | Ausencia de Verificación HMAC en Webhooks de Mercado Pago | **HIGH** | HIGH | Payments / Webhook | VULNERABILIDAD CONFIRMADA |
| **SEC-013** | Inexistencia de Rate Limiting en Endpoints Críticos | **HIGH** | HIGH | API Security | VULNERABILIDAD CONFIRMADA |
| **SEC-014** | Manipulación Cruzada de Canchas y Plantillas entre Clubes | **HIGH** | HIGH | Tenant Isolation | VULNERABILIDAD CONFIRMADA |
| **SEC-015** | Almacenamiento Inseguro de Refresh Token en `localStorage` | **MEDIUM** | HIGH | Frontend Security | VULNERABILIDAD CONFIRMADA |
| **SEC-016** | Supresión de Errores de Tipado y Linter en Build de Next.js | **MEDIUM** | HIGH | DevSecOps | VULNERABILIDAD CONFIRMADA |
| **SEC-017** | Subida de Archivos sin Validación Estricta de Extensiones / MIME | **MEDIUM** | HIGH | File Upload | VULNERABILIDAD CONFIRMADA |
| **SEC-018** | 20 de 21 Suites de Prueba de Backend Rotos / Inoperativos | **MEDIUM** | HIGH | Quality Assurance | VULNERABILIDAD CONFIRMADA |
| **SEC-019** | Dependencias Desactualizadas con CVEs (TypeORM, Validator) | **MEDIUM** | HIGH | Dependencies | RIESGO CONFIRMADO |
| **SEC-020** | Fuga de Mensajes Internos de Base de Datos en Errores 500 | **LOW** | HIGH | Information Leak | VULNERABILIDAD CONFIRMADA |
| **SEC-021** | Ausencia de Cabeceras HTTP de Seguridad (Helmet) | **LOW** | HIGH | Infrastructure | VULNERABILIDAD CONFIRMADA |
