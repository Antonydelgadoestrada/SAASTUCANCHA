# Plan de Pruebas de Seguridad — TuCancha (Security Test Plan)

## 1. Estado Actual de la Suite de Pruebas (Forensic Baseline)

Al ejecutar `npm test` en `backend-tucancha-main` bajo el commit `52ff68083542c9beeb9cca68b85bef030dd0b4ad`, el resultado fue:

```
Test Suites: 20 failed, 1 passed, 21 total
Tests:       44 failed, 6 passed, 50 total
Snapshots:   0 total
Time:        217.827 s
Ran all test suites.
```

### Diagnóstico de Fallo
20 suites fallan de manera inmediata antes de ejecutar aserciones porque fueron generadas por el scaffolding de NestJS (`Test.createTestingModule({ controllers: [XController] })`) sin proveer los providers, repositorios inyectados (`@InjectRepository`) ni servicios dependientes. 

---

## 2. Plan de Pruebas de Regresión y Seguridad Requerido

Para garantizar que las remediaciones no rompan funcionalidades y certifiquen la seguridad, se deben implementar y ejecutar los siguientes vectores de prueba:

---

### Módulo A: Pruebas de Autenticación y Autorización (RBAC)

1. **Test A1: Rechazo de Tokens con Clave Hardcodeada**
   - **Objetivo:** Asegurar que ningún token firmado con `'JWT_SECRET_KEY'` sea aceptado tras configurar `JWT_SECRET` en variables de entorno.
   - **Esperado:** HTTP `401 Unauthorized`.

2. **Test A2: Intento de Registro con Rol `ADMIN`**
   - **Objetivo:** Enviar `POST /auth/register` con payload `role: 'ADMIN'`.
   - **Esperado:** HTTP `400 Bad Request` o asignación forzada a `USER`.

3. **Test A3: Protección de Endpoints de Destrucción de Usuarios**
   - **Objetivo:** Enviar `DELETE /users/<id>` sin token, con token de jugador y con token de club.
   - **Esperado:** HTTP `401 Unauthorized` o `403 Forbidden` en todos los casos excepto con token legítimo de `ADMIN`.

4. **Test A4: Protección de Operaciones de Club**
   - **Objetivo:** Enviar `PATCH /clubs/approve/<id>` sin token y con token de jugador.
   - **Esperado:** HTTP `401 Unauthorized` / `403 Forbidden`.

---

### Módulo B: Pruebas de Aislamiento Multi-Tenant (BOLA / IDOR)

1. **Test B1: Modificación Cruzada de Canchas entre Clubes**
   - **Precondición:** Cancha C1 pertenece al Club 1. Petición autenticada como Club 2.
   - **Acción:** `PUT /courts/<id_cancha_C1>` con cambio de precio.
   - **Esperado:** HTTP `403 Forbidden` o `404 Not Found`. La cancha debe conservar su tarifa original.

2. **Test B2: Cancelación No Autorizada de Reserva Ajena**
   - **Precondición:** Reserva R1 creada por Usuario 1 en Club 1.
   - **Acción:** Usuario 2 envía `POST /bookings/online/cancel` con `id: R1`.
   - **Esperado:** HTTP `403 Forbidden`. El estado de la reserva no cambia.

3. **Test B3: Aplicación Forzada de Plantillas de Horarios**
   - **Acción:** Petición a `/schedule-templates/applyTemplateToCourtSafe` intentando sobrescribir la plantilla de una cancha perteneciente a otro club.
   - **Esperado:** HTTP `403 Forbidden`.

---

### Módulo C: Pruebas de Integridad Financiera y Pasarela de Pagos

1. **Test C1: Manipulación de Monto en `confirmPayment` (Payment Tampering)**
   - **Precondición:** Cancha con tarifa fijada en 80.00 PEN.
   - **Acción:** Petición a `POST /payments/confirmPayment` enviando `amount: 0.05`.
   - **Esperado:** El sistema debe rechazar la creación de la preferencia o forzar el precio a 80.00 PEN (o exigir el adelanto mínimo legal configurado por el club).

2. **Test C2: Simulación de Webhook Mercado Pago con Subpago**
   - **Precondición:** Reserva de 100 PEN.
   - **Acción:** Enviar payload de webhook simulando cobro aprobado por 5 PEN.
   - **Esperado:** El pago se registra como `ADELANTO` con `saldoAmount: 95.00 PEN`, `saldoStatus: PENDIENTE`, y bajo ninguna circunstancia se marca como `PAGO_COMPLETO`.

3. **Test C3: Auditoría No Autorizada de Comprobantes de Pago**
   - **Acción:** Usuario regular o Club ajeno envía `PUT /payments/<id>/confirm` con `action: 'CONFIRMAR'`.
   - **Esperado:** HTTP `403 Forbidden`.

4. **Test C4: Envío de Pago Manual de Membresía con Comprobante**
   - **Acción:** Club envía comprobante a `POST /memberships/manual-payment`.
   - **Esperado:** El registro de pago queda en estado `PENDING_AUDIT`. La membresía del club permanece en su estado anterior hasta aprobación humana por el administrador.

5. **Test C5: Intento de Reserva en Efectivo por Jugador Regular**
   - **Acción:** Usuario con rol `USER` llama a `POST /bookings/manual` con `amountPaid: 100`.
   - **Esperado:** HTTP `403 Forbidden` (`Solo clubes y administradores pueden registrar cobros directos en caja`).

---

### Módulo D: Pruebas de Resiliencia y Denegación de Servicio

1. **Test D1: Límite de Tasa en Autenticación (Rate Limiting)**
   - **Acción:** Lanzar 15 peticiones concurrentes a `POST /auth/login` con credenciales incorrectas.
   - **Esperado:** A partir de la 6ª petición, el servidor responde HTTP `429 Too Many Requests`.

2. **Test D2: Subida de Archivos No Permitidos**
   - **Acción:** Subir un archivo `.svg` y un archivo `.html` a los endpoints de imágenes de canchas y comprobantes.
   - **Esperado:** HTTP `400 Bad Request` por tipo MIME no permitido.

---

## 3. Matriz de Ejecución y Criterio de Aprobación

```
┌─────────────────────────────────┬───────────┬─────────────────────┐
│ Suite de Pruebas                │ Estado    │ Criterio Gate       │
├─────────────────────────────────┼───────────┼─────────────────────┤
│ Pruebas Unitarias Existentes    │ 🔴 20/21 F │ 100% pasando        │
│ Pruebas de Autenticación (A)    │ 🔴 Pend.  │ 0 fallos tolerados  │
│ Pruebas Multi-Tenant (B)        │ 🔴 Pend.  │ 0 fugas toleradas   │
│ Pruebas de Pagos y Montos (C)   │ 🔴 Pend.  │ 0 anomalías de caja │
│ Pruebas DoS y Rate Limit (D)    │ 🔴 Pend.  │ Rate limit verif.   │
└─────────────────────────────────┴───────────┴─────────────────────┘
```
