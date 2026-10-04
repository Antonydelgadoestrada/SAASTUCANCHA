# Lista de Verificación de Seguridad para Producción (Security Checklist)

Esta lista define los controles obligatorios que deben cumplirse antes de autorizar el pase a producción (`🟢 READY`).

---

## 1. Autenticación y Criptografía

- [ ] **[!] FAILED:** `JWT_SECRET` se inyecta dinámicamente y no existen cadenas estáticas `'JWT_SECRET_KEY'` en código fuente. (SEC-001)
- [ ] **[!] FAILED:** La expiración de Access Token (15 min) y Refresh Token (7 días) está sincronizada entre backend y frontend.
- [ ] **[!] FAILED:** Los tokens de restablecimiento de contraseña (`resetPassword`) son de un solo uso y se invalidan tras ser consumidos.
- [ ] **[!] FAILED:** El endpoint `/auth/forgot-password` responde de manera idéntica tanto si el correo existe como si no existe (anti-enumeración).
- [ ] **[!] FAILED:** Los tokens de sesión y refresco no se almacenan en texto plano en `localStorage`. (SEC-015)
- [x] **[x] VERIFIED:** Las contraseñas de usuario se almacenan con hash seguro mediante `bcrypt` (10 rondas de salt).
- [x] **[x] VERIFIED:** La autenticación federada con Google (`GoogleAuthService`) verifica el token criptográfico contra Google OAuth2 Client.

---

## 2. Autorización y Control de Acceso (RBAC / BOLA / IDOR)

- [ ] **[!] FAILED:** No existen endpoints mutativos ni destructivos sin `@UseGuards(JwtAuthGuard)`. (`DELETE /users/:id` y `DELETE /clubs/:id` fallan). (SEC-002, SEC-003)
- [ ] **[!] FAILED:** La auto-asignación del rol `ADMIN` está completamente bloqueada en el registro público. (SEC-004)
- [ ] **[!] FAILED:** Las acciones de aprobación, rechazo y suspensión de clubes exigen estrictamente rol `ADMIN`. (SEC-003)
- [ ] **[!] FAILED:** La auditoría y confirmación de pagos manuales valida que el usuario sea el dueño del club o `ADMIN`. (SEC-007)
- [ ] **[!] FAILED:** La creación de reservas manuales en efectivo (`POST /bookings/manual`) está restringida a los clubes y administradores. (SEC-008)
- [ ] **[!] FAILED:** La cancelación de reservas (`cancelOnlineBooking`) valida la pertenencia de la reserva antes de proceder. (SEC-009)
- [ ] **[!] FAILED:** La actualización y eliminación de canchas (`PUT /courts/:id`, `DELETE /courts/:id`) verifica que pertenezcan al club del usuario autenticado. (SEC-014)

---

## 3. Aislamiento Multi-Tenant

- [ ] **[!] FAILED:** Un Club A no puede modificar, pausar ni alterar las tarifas de canchas del Club B. (SEC-014)
- [ ] **[!] FAILED:** Un Club A no puede auditar ni aprobar transacciones financieras pertenecientes al Club B. (SEC-007)
- [ ] **[!] FAILED:** Las plantillas de horarios no pueden ser aplicadas a canchas ajenas mediante `/applyTemplateToCourtSafe`. (SEC-014)
- [x] **[x] VERIFIED:** El catálogo público (`findFeaturedPublic`, `findAllWithFilters`) aísla y oculta canchas de clubes suspendidos o con membresía vencida.

---

## 4. Pasarela de Pagos y Lógica Transaccional (Mercado Pago)

- [ ] **[!] FAILED:** El backend rechaza cualquier preferencia o confirmación donde el monto enviado por el cliente discrepe de la tarifa calculada por el sistema. (SEC-005)
- [ ] **[!] FAILED:** El webhook de Mercado Pago no marca una reserva como `PAGO_COMPLETO` si el monto cobrado es inferior al total. (SEC-005)
- [ ] **[!] FAILED:** Los pagos manuales con comprobante de membresía quedan en `PENDING_AUDIT` y no activan la suscripción automáticamente. (SEC-006)
- [ ] **[!] FAILED:** Los webhooks de Mercado Pago validan la firma criptográfica HMAC en la cabecera `x-signature`. (SEC-012)
- [x] **[x] VERIFIED:** La idempotencia contra procesamientos duplicados de webhooks está protegida por `transactionId` (`mpPaymentId`) en transacciones TypeORM.
- [x] **[x] VERIFIED:** Separación estricta de credenciales de cobro: reservas utilizan `club.mpAccessToken` y membresías utilizan la credencial de plataforma.

---

## 5. Prevención de Concurrencia y Race Conditions

- [x] **[x] VERIFIED:** La creación de reservas (`createOnlineBooking`, `createManualBooking`) y la actualización de disponibilidad se ejecutan dentro de bloques atómicos `transaction(async (manager) => ...)`.
- [x] **[x] VERIFIED:** Se captura el error `23505` de PostgreSQL para abortar colisiones concurrentes en el mismo slot.
- [ ] **[!] FAILED:** Verificación de bloqueos pesimistas (`SELECT FOR UPDATE`) en escenarios de alta concurrencia en reservas populares.

---

## 6. Validación de Entradas y Protección contra Inyecciones

- [x] **[x] VERIFIED:** No se detectan inyecciones SQL directas en `CourtService` (las consultas usan parámetros nombrados `:sport`, `:lat`, `:lng`, `:q`).
- [ ] **[!] FAILED:** `ValidationPipe` en `main.ts` no tiene activado `forbidNonWhitelisted: true`, permitiendo propiedades adicionales no declaradas.
- [ ] **[!] FAILED:** Controladores de reservas y pagos reciben `@Body() dto: any` en lugar de clases DTO fuertemente tipadas y validadas.
- [ ] **[!] FAILED:** Las subidas de archivos en canchas no tienen filtro de tipos MIME, permitiendo potenciales archivos ejecutables o SVG maliciosos. (SEC-017)

---

## 7. Protección de Datos y Privacidad

- [ ] **[!] FAILED:** `GET /users/:id` no filtra contraseñas ni refresh tokens al carecer de `ClassSerializerInterceptor`. (SEC-010)
- [ ] **[!] FAILED:** El filtro de excepciones de Sentry envía contraseñas y datos de pago en texto claro dentro de `request.body`. (SEC-011)
- [x] **[x] VERIFIED:** Las variables de entorno `NEXT_PUBLIC_*` del frontend no exponen secretos privados de backend.

---

## 8. Infraestructura, Despliegue y CI/CD

- [x] **[x] VERIFIED:** Contenedores Docker ejecutan procesos con usuarios sin privilegios de root (`nestjs:nodejs` y `nextjs:nodejs`).
- [x] **[x] VERIFIED:** `docker-compose.vm.yml` no expone puertos de bases de datos internamente y configura reinicio automático `unless-stopped`.
- [ ] **[!] FAILED:** `next.config.mjs` suprime la verificación de TypeScript y ESLint durante el empaquetado de producción. (SEC-016)
- [ ] **[!] FAILED:** No existe pipeline de CI/CD que ejecute linter, pruebas y compilación del backend previo al despliegue.
- [ ] **[!] FAILED:** Falta middleware de seguridad HTTP (`helmet`) en la API NestJS. (SEC-021)
- [ ] **[!] FAILED:** `npm audit` presenta 121 vulnerabilidades conocidas en dependencias de Node.js. (SEC-019)

---

## 9. Pruebas y Regression Gate

- [ ] **[!] FAILED:** La suite de pruebas de NestJS falla masivamente: 20 de 21 suites de prueba no ejecutan. (SEC-018)
- [ ] **[!] FAILED:** No existen pruebas de seguridad automatizadas que evalúen escalada de privilegios ni bypass de pagos.
