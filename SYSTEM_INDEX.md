# ÍNDICE GENERAL Y MEMORIA DEL PROYECTO (TUCANCHA.COM.PE)

**Fecha de última actualización:** 2026-08-14  
**Rol Director:** Orquestador Autónomo Principal (Tech Lead / Software Architect)

---

## 1. Arquitectura General del Sistema

- **Frontend:** Next.js 15 (React 19, TypeScript, Tailwind CSS, TanStack React Query v5, Radix UI, Sonner).
- **Backend:** NestJS 10 (Node.js, TypeScript, TypeORM, PostgreSQL, Passport JWT, AWS SDK v3 S3/SES, Resend).
- **Modelo de Disponibilidad:** Basado en plantillas (`ScheduleTemplate`), overrides por slot (`CourtScheduleAvailability`) y eventos/bloqueos recurrentes (`CourtScheduleEvent`).
- **Modelo de Pagos Marketplace:**
  - **Reservas:** Dinero hacia el `mpAccessToken` del club (OAuth).
  - **Membresías:** Dinero hacia las credenciales directas de la plataforma (`MP_ACCESS_TOKEN`).

---

## 2. Estado de Funcionalidades por Sprint

### Sprint 1: Diagnóstico y Corrección de Gestión de Horarios
- [x] **Tarea 1 (Backend - `findAllByClub`):** Corregido en `ScheduleTemplateService` para retornar el arreglo completo con `.find()`.
- [x] **Tarea 2 (Plantillas):** Configuración de plantillas guardadas e integración con el catálogo.
- [x] **Tarea 3 (Estado Centralizado Frontend):** Implementado diccionario `scheduleChanges` en `schedule-management.tsx` para acumular cambios.
- [x] **Tarea 4 (Conexión Componente Time Slot):** `ScheduleTimeSlot` comunica adecuadamente `onStatusChange` al componente padre.
- [x] **Tarea 5 (Carga de Datos Reales):** Conectado con TanStack React Query mediante `getByCourt`.
- [x] **Tarea 6 (Manejo de Errores y Logging):** Integrado `bulkUpdate` con logging explicito y control de errores.

### Sprint 2: Plantillas de Horarios y Bloqueos Recurrentes
- [x] **Plantillas Reutilizables:** Formularios y controladores para definición de slots de horarios.
- [x] **Sistema de Bloqueos Recurrentes (`court-schedule-event`):**
  - Tipos de recurrencia: `weekly`, `monthly`, `custom`.
  - Validación estricta de no solape en Backend (`assertNoOverlappingCourtEvent`).
  - Expansión dinámica a slots virtuales `status: event` para representación en UI.

### Plan de Membresías: Sprint A (Fundaciones)
- [x] **Blindaje del Webhook de Reservas:**
  - Idempotencia garantizada por `transactionId` (`mpPaymentId`).
  - Transacciones atómicas TypeORM para evitar condiciones de carrera por webhooks duplicados.
  - Mapeo dinámico y riguroso de métodos de pago (`CARD`, `YAPE`, `PLIN`, `TRANSFER`).
- [x] **Modelado de Dominio y Entidades de Membresía:**
  - `MembershipPlan`: Planes configurables con precios, monedas, intervalos (`MONTHLY`, `SEMIANNUAL`, `ANNUAL`) y días de gracia.
  - `ClubMembership`: Gestión del ciclo de vida (`PENDING`, `ACTIVE`, `GRACE`, `EXPIRED`, `CANCELLED`), fechas de vigencia y auto-renovación.
  - `MembershipPayment`: Registro idempotente de pagos de membresías con índice único sobre `mpPaymentId`.
- [x] **Lógica de Negocio y Reglas de Vigencia:**
  - Renovación anticipada suma vigencia al `endDate` actual.
  - Renovación expirada inicia vigencia desde `now`.
  - Cancelación desactiva `autoRenew` sin cortar el acceso hasta `endDate`.
  - Regla de visibilidad pública: Requiere `APPROVED` y estado `ACTIVE` o `GRACE`.
- [x] **Módulo Registrado en NestJS:** `MembershipModule` integrado en `AppModule` con DTOs, Controlador y Servicio.

### Plan de Membresías: Sprint B (Suscripciones MP y UI)
- [x] **Checkout de Membresía en Mercado Pago:**
  - Endpoint `POST /memberships/checkout-preference` que genera la preferencia oficial de pago hacia la cuenta de la plataforma.
  - Retorno de `init_point`, `preferenceId` y registro de pago en `PENDING`.
- [x] **Webhook Separado para Membresías:**
  - Endpoint `POST /memberships/webhook` independiente del webhook de reservas.
  - Idempotencia contra `MembershipPayment.mpPaymentId` y activación/renovación transaccional.
- [x] **Interfaz de Usuario del Club:**
  - Nueva página `/club/membership` en Next.js con diseño responsivo, banner de estado, tarjeta de suscripción actual, selector de planes y tabla de historial de pagos.
  - Botón "Membresía" añadido a la barra de navegación lateral (`AppSidebar`).
  - Detección de retorno de Mercado Pago (`?payment=success` o `?payment=failure`) con verificación automática.

### Plan de Membresías: Sprint C (Visibilidad y Crons)
- [x] **Cron Jobs de Ciclo de Vida Automatizado (`MembershipCronService`):**
  - Tarea diaria a las 00:05 AM para evaluar `endDate` y `graceEndDate`.
  - Transición automática: `ACTIVE` -> `GRACE` -> `EXPIRED`.
- [x] **Notificaciones por Email Automatizadas (`MailerService`):**
  - Aviso preventivo de vencimiento a 3 días de expirar.
  - Alerta de entrada a periodo de gracia con fecha límite de pago.
  - Notificación de membresía expirada y canchas pausadas.
- [x] **Filtros Estrictos de Visibilidad Pública (`CourtService`):**
  - `findFeaturedPublic` y `findAllWithFilters` bloquean clubes que no tengan `status = 'APPROVED'` y membresía en `('ACTIVE', 'GRACE')`.
  - Canchas de clubes vencidos quedan automáticamente invisibles en el catálogo público.

---

## 3. Estado de Auditoría de Seguridad (Security Agent)

1. **Vulnerabilidad IDOR en `bulkUpdate` (Corregida - Severidad Crítica):**
   - Verificación de permisos por cancha (`user.club.id`) en `ScheduleTemplateController` y `ScheduleTemplateService.bulkUpdate`.
2. **Idempotencia de Pagos y Webhooks (Corregida - Severidad Alta):**
   - Validación temprana contra pagos ya procesados y bloqueo transaccional para evitar cobros dobles o duplicidad de confirmaciones tanto en reservas como en membresías.
3. **Aislamiento Estricto de Tokens Mercado Pago:**
   - Separación estricta de credenciales: Reservas operan vía `club.mpAccessToken`, membresías operan vía credenciales de plataforma (`MP_ACCESS_TOKEN`).
4. **Protección de Catálogo Público:**
   - Exclusión a nivel de consulta SQL de clubes inactivos, no aprobados o con membresía caducada.

---

## 4. Auditoría de Accesibilidad (Accessibility Agent)

1. **Atributos ARIA y Lectores de Pantalla:**
   - `ScheduleTimeSlot` incluye `aria-label` descriptivo y `<span className="sr-only">`.
   - Tarjetas de planes de membresía con labels explícitos de compra para tecnologías de asistencia.
2. **Navegación Teclado & Enfoque:**
   - Componentes Radix UI (`Dialog`, `Popover`, `Select`) garantizan atrapamiento de foco y soporte de tecla Escape.

---

## 5. Auditoría de Rendimiento y Arquitectura (Optimization Agent)

1. **Transacciones Atómicas en BD:**
   - Métodos `bulkUpdate`, `handleMercadoPagoWebhook` y `handleMembershipWebhook` envueltos en transacciones TypeORM.
2. **Índices de Búsqueda:**
   - Índices en `transactionId`, `clubId`, `planId`, `status`, `endDate` y `mpPaymentId` para consultas eficientes y seguras.
3. **Consultas Existenciales Eficientes:**
   - Subconsultas `EXISTS (SELECT 1 FROM club_memberships ...)` indexadas en filtros de catálogo.

---

## 6. Pruebas Unitarias e Integración (QA Agent)

- `backend-tucancha-main/src/schedule/schedule-template.service.spec.ts`: Cobertura de plantillas y autorización IDOR.
- `backend-tucancha-main/src/payment/payment.service.spec.ts`: Cobertura de idempotencia del webhook de reservas y transacciones.
- `backend-tucancha-main/src/membership/membership.service.spec.ts`: Cobertura de reglas de negocio de membresías, checkout y webhook de membresías.
- `backend-tucancha-main/src/membership/membership-cron.service.spec.ts`: Cobertura de transiciones de estado de membresías (`ACTIVE` -> `GRACE` -> `EXPIRED`) y notificaciones por correo.

---

## 7. Registro de Archivos Modificados / Creados

### Horarios
- `[MODIFY]` `backend-tucancha-main/src/schedule/schedule-template.controller.ts`
- `[MODIFY]` `backend-tucancha-main/src/schedule/schedule-template.service.ts`
- `[MODIFY]` `nextjs-cancha-main/components/club/schedule-time-slot.tsx`
- `[NEW]` `backend-tucancha-main/src/schedule/schedule-template.service.spec.ts`

### Membresías, Pagos y Visibilidad (Sprint A, B & C)
- `[MODIFY]` `backend-tucancha-main/src/payment/payment-method.enum.ts`
- `[MODIFY]` `backend-tucancha-main/src/payment/payment.entity.ts`
- `[MODIFY]` `backend-tucancha-main/src/payment/payment.service.ts`
- `[MODIFY]` `backend-tucancha-main/src/club/club.entity.ts`
- `[MODIFY]` `backend-tucancha-main/src/app.module.ts`
- `[MODIFY]` `backend-tucancha-main/src/membership/membership.service.ts`
- `[MODIFY]` `backend-tucancha-main/src/membership/membership.controller.ts`
- `[MODIFY]` `backend-tucancha-main/src/membership/membership.module.ts`
- `[MODIFY]` `backend-tucancha-main/src/membership/membership.service.spec.ts`
- `[MODIFY]` `backend-tucancha-main/src/mailer/mailer.service.ts`
- `[MODIFY]` `backend-tucancha-main/src/court/court.service.ts`
- `[MODIFY]` `nextjs-cancha-main/components/layout/app-sidebar.tsx`
- `[NEW]` `backend-tucancha-main/src/payment/payment.service.spec.ts`
- `[NEW]` `backend-tucancha-main/src/membership/enums/membership-status.enum.ts`
- `[NEW]` `backend-tucancha-main/src/membership/enums/billing-interval.enum.ts`
- `[NEW]` `backend-tucancha-main/src/membership/enums/membership-payment-status.enum.ts`
- `[NEW]` `backend-tucancha-main/src/membership/entities/membership_plan.entity.ts`
- `[NEW]` `backend-tucancha-main/src/membership/entities/club_membership.entity.ts`
- `[NEW]` `backend-tucancha-main/src/membership/entities/membership_payment.entity.ts`
- `[NEW]` `backend-tucancha-main/src/membership/dto/create-membership-plan.dto.ts`
- `[NEW]` `backend-tucancha-main/src/membership/dto/update-membership-plan.dto.ts`
- `[NEW]` `backend-tucancha-main/src/membership/dto/subscribe-plan.dto.ts`
- `[NEW]` `backend-tucancha-main/src/membership/membership-cron.service.ts`
- `[NEW]` `backend-tucancha-main/src/membership/membership-cron.service.spec.ts`
- `[NEW]` `nextjs-cancha-main/lib/membership.ts`
- `[NEW]` `nextjs-cancha-main/components/club/membership-content.tsx`
- `[NEW]` `nextjs-cancha-main/app/(club)/club/membership/page.tsx`
- `[NEW]` `SYSTEM_INDEX.md`
