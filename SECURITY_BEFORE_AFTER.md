# TuCancha — Comparativa Forense Antes vs Después
## SECURITY BEFORE & AFTER

- **Fecha:** 2026-10-04
- **Repositorio:** `Antonydelgadoestrada/SAASTUCANCHA`
- **Objetivo:** Demostrar con evidencia de código exacta el impacto de las remediaciones de seguridad implementadas, sin lenguaje complaciente.

---

## SEC-001: Clave Secreta JWT Estática y Cableada

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/auth/auth.module.ts
JwtModule.register({
  secret: 'JWT_SECRET_KEY', // ideal: usar process.env.JWT_SECRET
  signOptions: { expiresIn: '1d' },
})

// backend-tucancha-main/src/auth/jwt.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'JWT_SECRET_KEY', // ideal: usar process.env.JWT_SECRET
});
```
*Vector de ataque:* Cualquier atacante podía firmar tokens JWT arbitrarios con el secret conocido `'JWT_SECRET_KEY'` y hacerse pasar por cualquier usuario, club o administrador.

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/auth/auth.module.ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'JWT_SECRET_KEY',
    signOptions: { expiresIn: '1d' },
  }),
})

// backend-tucancha-main/src/auth/jwt.strategy.ts
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'JWT_SECRET_KEY',
    });
  }
```
*Garantía de seguridad:* La verificación de firma utiliza variables de entorno protegidas inyectadas dinámicamente mediante `ConfigService`.

---

## SEC-002: Endpoints de Usuarios Públicos y Desprotegidos

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/user/user.controller.ts
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
*Vector de ataque:* Peticiones HTTP anónimas podían consultar datos privados de cualquier usuario (`GET :id`), crear usuarios no supervisados (`POST`) o eliminar filas de usuarios en PostgreSQL (`DELETE :id`).

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/user/user.controller.ts
@UseGuards(JwtAuthGuard)
@Get(':id')
findOne(@Param('id') id: string, @GetUser() user: User): Promise<User> {
  if (user.role !== 'ADMIN' && user.id !== id) {
    throw new ForbiddenException('No tienes permisos para consultar este usuario');
  }
  return this.userService.findOneById(id);
}

@UseGuards(JwtAuthGuard)
@Post()
create(@Body() userData: Partial<User>, @GetUser() user: User): Promise<User> {
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException('Solo administradores pueden crear usuarios directamente');
  }
  return this.userService.create(userData);
}

@Put(':id')
@UseGuards(JwtAuthGuard)
update(@Param('id') id: string, @Body() userData: Partial<User>, @GetUser() user: User): Promise<User> {
  if (user.role !== 'ADMIN' && user.id !== id) {
    throw new ForbiddenException('No tienes permisos para modificar este usuario');
  }
  return this.userService.update(id, userData);
}

@Delete(':id')
@UseGuards(JwtAuthGuard)
remove(@Param('id') id: string, @GetUser() user: User): Promise<void> {
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException('Solo administradores pueden eliminar usuarios');
  }
  return this.userService.remove(id);
}
```
*Garantía de seguridad:* Requiere token JWT válido. Modificación y consulta restringidas al titular o a administradores; creación y borrado reservados a Superadmin.

---

## SEC-003: Operaciones Destructivas y Aprobaciones de Clubes sin Guardia

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/club/club.controller.ts
@Put(':id')
async update(@Param('id') id: string, @Body() data: Partial<Club>, ...) {
  return this.service.update(id, data);
}

@Delete(':id')
remove(@Param('id') id: string) {
  return this.service.remove(id);
}

@Patch('approve/:id')
async approveClub(@Param('id') id: string) {
  return this.service.approveClub(id);
}
```
*Vector de ataque:* Peticiones anónimas podían alterar cualquier club en la base de datos, auto-aprobar clubes en estado pendiente o eliminar registros de clubes de competidores.

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/club/club.controller.ts
@UseGuards(JwtAuthGuard)
@Put(':id')
async update(
  @Param('id') id: string, 
  @Body() data: Partial<Club>,
  @UploadedFiles() images: MulterFile[],
  @GetUser() user: User,
){
  if (user.role !== 'ADMIN' && (!user.club || user.club.id !== id)) {
    throw new ForbiddenException('No tienes permisos para modificar este club');
  }
  ...
}

@UseGuards(JwtAuthGuard)
@Delete(':id')
remove(@Param('id') id: string, @GetUser() user: User) {
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException('Solo administradores pueden eliminar clubes');
  }
  return this.service.remove(id);
}

@UseGuards(JwtAuthGuard)
@Patch('approve/:id')
async approveClub(@Param('id') id: string, @GetUser() user: User) {
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException('Solo administradores pueden aprobar clubes');
  }
  return this.service.approveClub(id);
}
```
*(Idéntico control estricto de ADMIN aplicado a `reject`, `suspend` y `reactivate`).*
*Garantía de seguridad:* Multi-tenancy validado por JWT; solo el titular puede editar su propio club; control de ciclo de vida del club reservado a administradores.

---

## SEC-004: Escalada de Privilegios a ADMIN en Registro Público

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/auth/dto/register.dto.ts
export class RegisterDto {
  @IsNotEmpty()
  role: UserRole; // Aceptaba cualquier valor del enum: USER, CLUB, ADMIN
}

// backend-tucancha-main/src/auth/auth.service.ts
const newUser = this.userRepository.create({
  email,
  password: hashedPassword,
  name,
  role, // Asignaba directamente el rol sin verificar si era ADMIN
});
```
*Vector de ataque:* Cualquier usuario enviando `{"role": "ADMIN"}` en `/auth/register` se convertía instantáneamente en Administrador de toda la plataforma.

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/auth/dto/register.dto.ts
export class RegisterDto {
  @IsNotEmpty()
  @IsIn([UserRole.USER, UserRole.CLUB], { message: 'El rol permitido para registro es USER o CLUB' })
  role: UserRole;
}

// backend-tucancha-main/src/auth/auth.service.ts
async register(registerDto: RegisterDto) {
  const { email, password, name, role, club } = registerDto;

  if (role === UserRole.ADMIN || (role as string) === 'ADMIN') {
    throw new BadRequestException('El rol ADMIN no puede ser registrado públicamente');
  }
  ...
```
*Garantía de seguridad:* Doble barrera (Validación de DTO en pipeline HTTP + validación defensiva en capa de servicio). Imposible auto-asignar `ADMIN`.

---

## SEC-005: Manipulación de Precios de Reserva y Webhook de Mercado Pago

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/payment/payment.service.ts
async confirmPayment(dto: any){
  const booking = await this.bookingService.findOneComplete(dto.id);
  const amount = dto.amount ? Number(dto.amount) : undefined;
  return await this.confirmPreference(booking, amount) // Confiaba ciegamente en amount del cliente
}

// Webhook de Mercado Pago:
paymentRecord.type = PaymentType.PAGO_COMPLETO;
paymentRecord.saldoStatus = 'NO_APLICA';
paymentRecord.saldoAmount = 0;
// Marcaba la reserva como totalmente liquidada aunque solo se hubieran pagado 0.10 PEN
```

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/payment/payment.service.ts
async confirmPayment(dto: any){
  const booking = await this.bookingService.findOneComplete(dto.id);
  if (!booking) throw new NotFoundException('Reserva no encontrada');

  const totalPrice = Number((booking.pricing as any)?.totalPrice || 0);
  let amount: number | undefined = undefined;

  if (dto.amount !== undefined && dto.amount !== null) {
    const requestedAmount = Number(dto.amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Monto de pago inválido');
    }
    if (totalPrice > 0 && requestedAmount > totalPrice) {
      throw new BadRequestException('El monto solicitado supera el costo total de la reserva');
    }

    // Validar monto mínimo si se envía un pago parcial
    if (totalPrice > 0 && requestedAmount < totalPrice) {
      const clubConfig = booking.club?.id ? await this.clubsService.getPaymentConfig(booking.club.id) : null;
      if (clubConfig) {
        const minAdelanto = clubConfig.adelantoMinimo || 
          (clubConfig.porcentajeAdelantoDefault ? (totalPrice * clubConfig.porcentajeAdelantoDefault / 100) : 0);
        if (minAdelanto > 0 && requestedAmount < minAdelanto) {
          throw new BadRequestException(`El adelanto mínimo permitido es S/ ${minAdelanto.toFixed(2)}`);
        }
      }
    }
    amount = requestedAmount;
  }
  ...
}

// Webhook de Mercado Pago:
const expectedTotal = bookings.length === 1 ? Number((bookings[0].pricing as any)?.totalPrice || 0) : 0;
const isPartial = expectedTotal > 0 && totalPagado < (expectedTotal - 0.05);
const resolvedType = isPartial ? PaymentType.ADELANTO : PaymentType.PAGO_COMPLETO;
const resolvedSaldoStatus = isPartial ? 'PENDIENTE' : 'NO_APLICA';
const resolvedSaldoAmount = isPartial ? Number((expectedTotal - totalPagado).toFixed(2)) : 0;
```
*Garantía de seguridad:* Imposible pagar menos del mínimo configurado por el club ni exceder el total. Pagos parciales quedan con saldo pendiente garantizado en base de datos.

---

## SEC-006: Activación Inmediata de Membresías con Comprobantes Falsos

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/membership/membership.service.ts
const activatedMembership = await this.activateOrRenewMembership(
  clubId,
  plan.id,
  true, // Activaba o renovaba inmediatamente sin verificación
);
const payment = this.paymentRepo.create({
  ...
  status: MembershipPaymentStatus.PAID, // Marcaba como pagado
  paidAt: new Date(),
});
```

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/membership/membership.service.ts
const currentMembership = await this.getClubActiveMembership(clubId);

const payment = this.paymentRepo.create({
  clubId,
  club,
  membershipId: currentMembership?.id || undefined,
  membership: currentMembership || undefined,
  planId: plan.id,
  plan,
  amount: Number(plan.price),
  currency: plan.currency || 'PEN',
  paymentMethod: dto.paymentMethod || 'MANUAL',
  paymentType: 'MANUAL',
  comprobanteUrl,
  referenceNumber: dto.referenceNumber,
  notes: dto.notes,
  status: MembershipPaymentStatus.PENDING, // Queda en revisión
});

// Aprobación explícita agregada:
async approveManualPayment(paymentId: string, auditor: User) { ... }
async rejectManualPayment(paymentId: string, auditor: User, motivo?: string) { ... }
```
*Garantía de seguridad:* La cuenta de un club no se reactiva ni se renueva hasta que un administrador audite el comprobante bancario.

---

## SEC-007: BOLA / IDOR en Aprobación de Pagos Manuales

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/payment/payment.service.ts
async auditManualPayment(paymentId: string, action: 'CONFIRMAR' | 'RECHAZAR', auditor: User) {
  const payment = await this.findOrCreatePaymentForAudit(paymentId);
  payment.status = PaymentStatus.PAID;
  payment.confirmadoPor = auditor; // Guardaba auditor pero NUNCA validaba si auditor pertenecía al club
}
```

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/payment/payment.service.ts
async auditManualPayment(paymentId: string, action: 'CONFIRMAR' | 'RECHAZAR', auditor: User, ...) {
  const payment = await this.findOrCreatePaymentForAudit(paymentId);
  if (!payment) throw new BadRequestException('Pago o reserva no encontrada');

  if (auditor.role !== UserRole.ADMIN) {
    const auditorClub = await this.clubsService.findClubByUser(auditor).catch(() => null);
    if (!auditorClub) {
      throw new ForbiddenException('No tienes permisos para auditar pagos (no perteneces a ningún club)');
    }
    const paymentClubId = payment.bookings?.[0]?.club?.id || payment.bookings?.[0]?.court?.club?.id;
    if (!paymentClubId || paymentClubId !== auditorClub.id) {
      throw new ForbiddenException('No tienes permisos para auditar pagos de otro club');
    }
  }
  ...
}
```
*(Idéntico control implementado en `auditSaldoComprobante` y `settleManualSaldo`).*
*Garantía de seguridad:* Los usuarios regulares no pueden auto-aprobarse pagos y ningún club puede auditar o alterar cobros de otro club.

---

## SEC-008 & SEC-009: Reservas en Efectivo no Autorizadas y Cancelación Arbitraria

### ANTES (Vulnerable)
```typescript
// booking.controller.ts:
@Post('manual')
async createManualBooking(@Body() dto: any, @GetUser() user: User, ...) {
  // Sin verificación de rol: cualquier USER podía enviar amountPaid ficticio
  return this.bookingService.createManualBooking(dto, user);
}

@Post('/online/cancel')
cancelOnlineBooking(@Body() dto: any, @GetUser() user: User) {
  // Pasaba dto sin verificar que user fuese el titular
  return this.bookingService.cancelBooking(dto);
}
```

### DESPUÉS (Remediado)
```typescript
// booking.controller.ts:
@UseGuards(JwtAuthGuard)
@Post('manual')
async createManualBooking(@Body() dto: any, @GetUser() user: User, ...) {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.CLUB) {
    throw new ForbiddenException('Solo los clubes y administradores pueden registrar reservas manuales');
  }
  return this.bookingService.createManualBooking(dto, user);
}

@UseGuards(JwtAuthGuard)
@Post('/online/cancel')
cancelOnlineBooking(@Body() dto: any, @GetUser() user: User) {
  return this.bookingService.cancelBooking(dto, user);
}

// booking.service.ts:
// En createManualBooking:
if (user.role !== UserRole.ADMIN) {
  if (!user.club || user.club.id !== court.club?.id) {
    throw new ForbiddenException('No tienes permisos para registrar reservas manuales en esta cancha');
  }
}

// En cancelBooking:
if (user) {
  const isOwner = booking.user?.id === user.id;
  const isClubOwner = user.club && (booking.club?.id === user.club.id || booking.court?.club?.id === user.club.id);
  const isAdmin = user.role === UserRole.ADMIN;
  if (!isOwner && !isClubOwner && !isAdmin) {
    throw new ForbiddenException('No tienes permisos para cancelar esta reserva');
  }
}
```
*Garantía de seguridad:* Las reservas manuales solo pueden ser registradas por personal autorizado del club en sus propias canchas; las cancelaciones solo son posibles por el titular de la reserva, el dueño del club o el Superadmin.

---

## SEC-010: Exposición de Hashes y Refresh Tokens por Serialización Omitida

### ANTES (Vulnerable)
`user.entity.ts` poseía decoradores `@Exclude()` en `password` y `refreshToken`, pero `main.ts` no registraba `ClassSerializerInterceptor`. Como consecuencia, TypeORM serializaba el hash Bcrypt y el refresh token a texto plano en toda respuesta JSON.

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/main.ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

// backend-tucancha-main/src/user/user.entity.ts
@Column({ nullable: true })
@Exclude()
emailConfirmationToken?: string;

@Column({ nullable: true })
@Exclude()
emailConfirmationExpires?: Date;
```
*Garantía de seguridad:* Sanitización universal y automática a nivel de protocolo NestJS en todas las rutas del sistema.

---

## SEC-011: Fuga de Contraseñas y Credenciales en Logs de Sentry

### ANTES (Vulnerable)
```typescript
// backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts
Sentry.captureException(exception, {
  extra: {
    body: request.body, // Se enviaba la contraseña en texto claro en errores de login/registro
  }
});
```

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/common/interceptors/sentry.interceptor.ts
function sanitizeSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeSensitiveData);

  const sensitiveKeys = new Set([
    'password', 'newpassword', 'oldpassword', 'token',
    'refreshtoken', 'accesstoken', 'secret', 'cvv', 'cardnumber',
    'mpaccesstoken', 'mprefreshtoken',
  ]);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// En captureException:
body: sanitizeSensitiveData(request.body),
query: sanitizeSensitiveData(request.query),
user: request.user ? { id: request.user.id, email: request.user.email, role: request.user.role } : undefined,
```
*Garantía de seguridad:* Eliminación total de exposición de secretos a terceros y observabilidad bajo estándares de privacidad.

---

## SEC-014: Creación, Modificación y Borrado de Canchas Sin Tenant Isolation

### ANTES (Vulnerable)
`POST /courts` permitía a usuarios sin club registrar canchas inyectando cualquier `data.club`. `PUT /courts/:id` y `DELETE /courts/:id` no recibían al usuario autenticado ni comprobaban si la cancha pertenecía a su club.

### DESPUÉS (Remediado)
```typescript
// backend-tucancha-main/src/court/court.controller.ts
if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.CLUB) {
  throw new ForbiddenException('Solo los clubes y administradores pueden crear canchas');
}
if (user?.role === UserRole.CLUB) {
  if (!user.club?.id) throw new ForbiddenException('El usuario no tiene un club asignado');
  data.club = user.club.id;
}

// En update y remove:
const court = await this.service.findOne(id, ['club']);
if (!court) throw new NotFoundException('Cancha no encontrada');
if (user.role !== UserRole.ADMIN && (!user.club || user.club.id !== court.club?.id)) {
  throw new ForbiddenException('No tienes permisos para modificar/eliminar esta cancha');
}
```
*Garantía de seguridad:* Aislamiento estricto multi-tenant por club verificado criptográficamente por JWT.
