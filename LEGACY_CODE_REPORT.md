# Reporte de Código Obsoleto, Huérfano y Legacy (Legacy & Dead Code Report)

**Principio Rector:** Este reporte clasifica los componentes desconectados o duplicados sin eliminarlos de forma automática, preservando la integridad del historial hasta la fase de refactorización posterior.

---

## 1. Clasificación por Estado de Actividad

| Clasificación | Definición |
|---|---|
| **ACTIVE** | El archivo es ejecutado y participa en el flujo de producción. |
| **INDIRECTLY ACTIVE** | No es ruta directa pero es importado por componentes activos. |
| **TEST ONLY** | Existe únicamente para pruebas automatizadas. |
| **DEVELOPMENT ONLY** | Utilizado durante inicialización local, seeding o desarrollo. |
| **DEPLOYMENT ONLY** | Participa en la configuración de contenedores o despliegue en VM. |
| **DEAD CODE** | No existen referencias activas en el grafo de dependencias. |
| **LEGACY** | Código antiguo o superado que convive con una implementación nueva. |
| **ORPHANED** | Módulo o archivo desconectado del árbol principal de la aplicación. |

---

## 2. Inventario Detallado de Código Inactivo o Desconectado

---

### LEGACY-001 — Módulo y Proveedor de Base de Datos Huérfano
- **Archivo:** `backend-tucancha-main/src/database/database.providers.ts` y `src/database/database.module.ts`
- **Tipo:** `DEAD CODE` / `ORPHANED`
- **Evidencia en Código:**
  `DatabaseModule` no es importado en `AppModule` ni en ningún módulo secundario. En su interior, `databaseProviders` intenta instanciar un `DataSource` manual con credenciales quemadas:
  `host: 'localhost'`, `username: 'admin'`, `password: 'admin123'`, `database: 'db_canchas'`.
  La aplicación activa se conecta mediante `TypeOrmModule.forRootAsync` directamente en `app.module.ts`.
- **Riesgo:** Confusión para desarrolladores y auditorías; exposición innecesaria de credenciales por defecto.
- **Recomendación:** Archivar y eliminar en la fase P5 de limpieza de repositorio.

---

### LEGACY-002 — Módulo Duplicado de Mercado Pago con Error Tipográfico
- **Archivo:** `backend-tucancha-main/src/mecado-pago/mercado-pago.module.ts` y `src/mecado-pago/mercado-pago.service.ts`
- **Tipo:** `LEGACY` / `DUPLICATE`
- **Evidencia en Código:**
  La carpeta tiene un error tipográfico (`mecado-pago`). Este módulo es importado por `BookingModule`, mientras que `PaymentService` (`src/payment/payment.service.ts`) y `MembershipService` (`src/membership/membership.service.ts`) instancian directamente `new MercadoPagoConfig({ accessToken })`. Existen por ende dos clientes de Mercado Pago con arquitecturas distintas.
- **Riesgo:** Comportamiento asincrónico dispar, dispersión de tokens y dificultad para unificar el webhook y las comisiones de la pasarela.
- **Recomendación:** Unificar toda la interacción con Mercado Pago en un servicio singleton robusto bajo `src/mercado-pago/`.

---

### LEGACY-003 — Endpoint de Inicio de Sesión Duplicado en Frontend
- **Archivo:** `nextjs-cancha-main/app/api/login/route.ts`
- **Tipo:** `LEGACY` / `DUPLICATE`
- **Evidencia en Código:**
  Este endpoint maneja un `POST` manual escribiendo una cookie de sesión no estándar `response.cookies.set('user', JSON.stringify(user))`, mientras que la aplicación utiliza NextAuth en `app/api/auth/[...nextauth]/route.ts` con tokens JWT y middleware basado en NextAuth.
- **Riesgo:** Inconsistencias de sesión, bypass del middleware de NextAuth y desalineación de estados de usuario.
- **Recomendación:** Retirar `app/api/login/route.ts` una vez confirmado que ningún formulario legado lo invoca.

---

### LEGACY-004 — Entidades Mockeadas y Funciones Simuladas en `lib/auth.ts`
- **Archivo:** `nextjs-cancha-main/lib/auth.ts`
- **Tipo:** `LEGACY` / `DEVELOPMENT ONLY`
- **Evidencia en Código:**
  El archivo conserva objetos estáticos en memoria:
  `const club1 = { "id": "d310e693...", "name": "Club Deportivo Elite" ... }` y `const club2 = { ... }`, así como funciones mock comentadas (`approveClub`, `rejectClub`).
- **Riesgo:** Carga innecesaria en el bundle del cliente y filtración de datos de pruebas o esquemas previos.
- **Recomendación:** Limpiar objetos dummy y mantener únicamente las funciones de autenticación reales.

---

### LEGACY-005 — Script de Backfill en Servicio de Transacciones
- **Archivo:** `backend-tucancha-main/src/transactions/backfill.ts`
- **Tipo:** `DEVELOPMENT ONLY` / `MIGRATION ONLY`
- **Evidencia en Código:**
  Archivo ejecutable de consola creado para migrar pagos históricos hacia la tabla `club_transaction`. Su lógica ya fue absorbida por `TransactionsService.backfillOldPayments()` y `TransactionsController.backfill()`.
- **Riesgo:** Bajo. No es invocado por el build de producción.
- **Recomendación:** Trasladar a una carpeta aislada de scripts o herramientas (`scripts/migrations/`).

---

### LEGACY-006 — Archivos de Prueba Autogenerados sin Mocks
- **Archivo:** 20 archivos `.spec.ts` en `backend-tucancha-main/src/` (incluyendo `auth.controller.spec.ts`, `club.controller.spec.ts`, etc.)
- **Tipo:** `BROKEN TEST`
- **Evidencia en Código:**
  Generados automáticamente al ejecutar `nest generate controller/service`. Fallan en `npm test` por no configurar proveedores.
- **Riesgo:** Distorsión de las métricas de CI/CD y falsa sensación de cobertura.
- **Recomendación:** Actualizar con mocks funcionales en la fase P2 del plan de remediación.
