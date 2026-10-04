# Reporte de Desviación de Documentación (Documentation Drift Report)

## 1. Comparativa: Documentación Declarada vs. Realidad del Código Fuente

Este reporte contrasta las afirmaciones contenidas en `SYSTEM_INDEX.md`, `README.md` y `task.md` frente a la implementación física existente en el repositorio.

---

## 2. Matriz de Afirmaciones de Seguridad (Security Claims Table)

| Afirmación Documentada | Doc. | Impl. | Activo | Verif. | Test. | Conclusión Forense |
|---|---|---|---|---|---|---|
| **"Vulnerabilidad IDOR en bulkUpdate corregida con verificación de permisos por cancha (`user.club.id`)"** | Sí | Sí | Sí | Parcial | No | **PARTIALLY VERIFIED** — Se corrigió en `bulkUpdate`, pero se dejó abierto en `applyTemplateToCourtSafe` (Línea 90) y en `CourtController.update` (Línea 141). |
| **"Idempotencia de pagos y webhooks garantizada por transactionId y bloqueo transaccional"** | Sí | Sí | Sí | No | No | **PARTIALLY VERIFIED** — Existe transacción y control de `transactionId`, pero **no se valida el monto cobrado ni la firma HMAC**, permitiendo confirmación de reservas completas por montos de 0.01 PEN. |
| **"Aislamiento estricto de credenciales de Mercado Pago: Reservas vía token del club, Membresías vía plataforma"** | Sí | Sí | Sí | Sí | No | **VERIFIED** — Efectivamente se comprueba que las reservas cobran hacia `club.mpAccessToken` y las membresías hacia `MP_ACCESS_TOKEN`. |
| **"Protección de catálogo público: exclusión de clubes no aprobados o con membresía caducada"** | Sí | Sí | Sí | Sí | No | **VERIFIED** — En `CourtService` (`findFeaturedPublic` y `findAllWithFilters`), se incluye la cláusula SQL que verifica `status = 'APPROVED'` y estado de membresía o período de prueba. |
| **"Almacenamiento de archivos mediante AWS S3 (AWS SDK v3)"** | Sí | No | No | No | N/A | **OUTDATED / FALSE CLAIM** — El servicio `s3.service.ts` no utiliza el SDK de AWS; se comunica directamente mediante `axios` hacia la API REST de **Supabase Storage**. |
| **"Cobertura de pruebas unitarias e integración funcional en Payment, Membership, Schedule"** | Sí | Sí | No | No | No | **FALSE CLAIM** — En la ejecución real de `npm test`, 20 de 21 suites de prueba fallan con errores fatales de inyección de dependencias. Solo 1 suite pasa. |
| **"Gestión de sesiones y autenticación segura con JWT"** | Sí | Sí | Sí | No | No | **OUTDATED / VULNERABLE** — El sistema declara JWT seguro, pero `JwtStrategy` valida firmas contra el string literal hardcodeado `'JWT_SECRET_KEY'`. |

---

## 3. Tabla de Desviación Documental (Documentation Drift)

| Documento | Afirmación Escrita | Realidad en Código Actual | Estado de la Documentación | Recomendación |
|---|---|---|---|---|
| `SYSTEM_INDEX.md` (Sec. 1) | "Backend: NestJS 10, AWS SDK v3 S3/SES" | `s3.service.ts` usa Supabase Storage por llamadas Axios REST; AWS S3 está en desuso. | **OBSOLETO** | Actualizar la descripción arquitectónica para declarar Supabase Storage de manera transparente. |
| `SYSTEM_INDEX.md` (Sec. 3.1) | "Vulnerabilidad IDOR en bulkUpdate corregida" | Se parchó un endpoint específico, pero se mantuvieron múltiples IDORs críticos en `CourtController` y `BookingController`. | **PARCIALMENTE ACTUAL** | Ampliar la auditoría para documentar el estado real de BOLA/IDOR en todas las entidades. |
| `SYSTEM_INDEX.md` (Sec. 6) | Lista 4 suites de prueba como garantía de cobertura (QA Agent). | Las suites fallan masivamente (`npm test` arroja exit code 1 con 20 fallos). | **OBSOLETO** | Corregir los módulos de prueba de NestJS antes de declarar pruebas operativas en el índice. |
| `task.md` (Línea 32) | "Reemplazar AWS S3 por Supabase Storage en s3.service.ts" | Se implementó el cambio hacia Supabase Storage, pero se mantuvo el nombre de clase `S3Service` y el módulo `AwsModule`. | **ACTUAL** | Refactorizar nombres de clases y módulos para reflejar `SupabaseStorageService`. |
| `PLAN_SPRINT_1.md` | Detalla tareas de diagnóstico y corrección de horarios de canchas. | La lógica de plantillas virtuales se encuentra implementada en `ScheduleTemplateService`. | **ACTUAL** | Mantener como registro histórico de sprint. |
| `SYSTEM_INDEX.md` (Sprint D) | "Panel Admin: Gestor de pagos exclusivo para cobro de membresías" | Los endpoints `/memberships/admin/payments` existen y están activos en `MembershipController`. | **ACTUAL** | Control verificado en capa de controladores administrativos. |

---

## 4. Conclusión de Drift

Existe un **Drift Documental Significativo (aprox. 45%)** entre lo que el `SYSTEM_INDEX.md` asume como blindado y la postura real del código. Documentos previos asumieron que la resolución puntual de un bug en un endpoint equivalía al aseguramiento integral de todo el sistema, ocultando vulnerabilidades críticas en controladores adyacentes y suites de prueba rotas.
