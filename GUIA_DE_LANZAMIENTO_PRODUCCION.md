# 🚀 GUÍA DE LANZAMIENTO A PRODUCCIÓN: FIDELIDAD, CUPONES Y USUARIOS POR CLUB
## Plataforma TuCancha (Producción en DigitalOcean)

> **Documento Operativo:** Guía paso a paso de ejecución de lanzamiento  
> **Rama Integrada Lista:** `release/loyalty-users` (Commit [`58718b8`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA))  
> **Script DDL Consolidado:** [`scripts/release_loyalty_users_schema.sql`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/scripts/release_loyalty_users_schema.sql)  
> **Impacto Estimado en Producción:** **CERO TIEMPO DE INACTIVIDAD (Zero-Downtime)**

---

## 📋 A. Antes de Empezar

1. **Ventana Recomendada de Lanzamiento:**
   * **Horario Óptimo:** Madrugada (entre las **00:00 y las 05:00 AM hora de Lima/Perú**) o una mañana de lunes temprano (06:00 a 07:00 AM).
   * **Motivo:** En este horario el volumen de transacciones de Mercado Pago y alquileres de canchas presenciales es mínimo o nulo.
2. **Personal Disponible:**
   * **Responsable de Operaciones / Desarrollador Principal:** Para ejecutar los comandos, verificar los logs y realizar las pruebas de humo.
   * **Administrador del Club Piloto:** Notificado previamente de que participará en la prueba gradual de puntos.
3. **Comunicación a los Clubes:**
   * Como el lanzamiento es **aditivo** y **compatible hacia atrás**, los clubes no percibirán interrupción de servicio. No se requiere anunciar mantenimiento con suspensión de plataforma.

---

## 💾 B. Respaldos Obligatorios Previos

### 1. Respaldo de Base de Datos de Producción (PostgreSQL en DigitalOcean)
* **Método 1 (Instantánea / Snapshot desde DigitalOcean Console - Recomendado):**
  1. Ingresar a [cloud.digitalocean.com](https://cloud.digitalocean.com) $\rightarrow$ **Databases** $\rightarrow$ Seleccionar la base de datos de producción (`tucancha-db` o similar).
  2. Ir a la pestaña **Settings** o **Backups**.
  3. Clic en **Create Snapshot / Manual Backup**. Esperar a que el estado marque *Available*.
* **Método 2 (Vía CLI con `pg_dump` desde PowerShell / Git Bash):**
  ```powershell
  # Reemplazar con la URL de conexión de producción de DigitalOcean
  pg_dump "$PROD_DATABASE_URL" -Fc -v -f "tucancha_backup_pre_launch_$(Get-Date -Format 'yyyyMMdd_HHmm').dump"
  ```

### 2. Respaldo de Git (Etiqueta Local y Remota)
Verifica que la etiqueta de respaldo sobre `main` esté confirmada:
```powershell
# En PowerShell (desde la raíz del proyecto):
git tag -a pre-loyalty-release-v1.0 main -m "Etiqueta de respaldo de producción previo a merge de fidelidad y usuarios"
```

---

## 🔍 C. Revisión Previa en Producción (Solo Lectura)

Conéctate a la base de datos de producción mediante **Beekeeper Studio**, **DBeaver** o la consola de DigitalOcean y ejecuta estas consultas de solo lectura para constatar el estado inicial:

```sql
-- 1. Verificar valores actuales de roles (no debe existir 'RECEPCIONISTA' aún)
SELECT enumlabel FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
WHERE t.typname = 'user_role_enum';

-- 2. Confirmar que las nuevas columnas no existen todavía
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user' 
  AND column_name IN ('assignedClubId', 'permissions', 'deletedAt');

-- 3. Confirmar que no hay tablas previas de fidelidad
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'loyalty_%';
```

### ⚠️ Verificación Crítica: `DATABASE_SYNCHRONIZE`
* En el panel de **DigitalOcean App Platform** (o en el archivo `.env` del servidor VM):
* Revisa que la variable `DATABASE_SYNCHRONIZE` **NO esté en `true`**. Debe estar fijada en `"false"` o no estar definida.
* *Razón:* Si estuviese en `true`, TypeORM intentará recalcular el esquema en vivo al arrancar y entrará en conflicto con columnas históricas nulas.

---

## ⚙️ D. Configuración de Variables de Entorno en DigitalOcean (ANTES del Despliegue)

En el panel de DigitalOcean $\rightarrow$ Tu App Backend $\rightarrow$ **Settings** $\rightarrow$ **App-Level Environment Variables** (o Component-Level en `api`), agrega las siguientes variables antes de fusionar el código:

| Variable | Valor Inicial | Propósito |
| :--- | :--- | :--- |
| `DATABASE_SYNCHRONIZE` | `false` | Impide que TypeORM ejecute alteraciones destructivas al arrancar. |
| `LOYALTY_ENABLED` | `false` | Mantiene el módulo de fidelidad apagado e inerte durante el primer arranque. |
| `LOYALTY_ALLOWED_CLUB_IDS` | `<UUID_DEL_CLUB_PILOTO>` | Limita el programa al club que realizará las pruebas de validación. |

*Clic en **Save**.*

---

## 🗄️ E. Ejecución del SQL en Producción

> **¡ORDEN VITAL!** El script SQL debe ejecutarse **ANTES** de hacer merge a `main`.

1. Abre el cliente de base de datos conectado a **Producción**.
2. Abre y ejecuta el contenido completo del archivo:  
   [`scripts/release_loyalty_users_schema.sql`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/scripts/release_loyalty_users_schema.sql)
3. La ejecución tarda menos de **2 segundos** y responderá con `COMMIT`.

### Verificación Posterior Inmediata (Solo Lectura):
Ejecuta la comprobación para garantizar que todo quedó activo:
```sql
-- 1. Verificar 'RECEPCIONISTA' en el enum
SELECT enumlabel FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
WHERE t.typname = 'user_role_enum';

-- 2. Verificar las 3 columnas agregadas a "user"
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user' 
  AND column_name IN ('assignedClubId', 'permissions', 'deletedAt');

-- 3. Verificar las 5 tablas loyalty_* creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'loyalty_%' 
ORDER BY table_name;
```

---

## 🔀 F. Pull Request y Merge hacia `main`

El código ya está listo y probado en la rama `release/loyalty-users`. Ahora procedemos a sincronizarlo con GitHub:

### Paso 1: Subir la rama de lanzamiento a GitHub
```powershell
# En PowerShell (desde la raíz del repositorio):
git push origin release/loyalty-users
```

### Paso 2: Abrir Pull Request en GitHub
1. Ir al repositorio en GitHub: `https://github.com/Antonydelgadoestrada/SAASTUCANCHA`
2. Clic en **Compare & pull request** para `release/loyalty-users` hacia `main`.
3. Título del PR: `feat: lanzamiento v1.0 - puntos de fidelidad, cupones y usuarios por club`
4. **Revisar el diff:** Confirmar que no hay archivos de promociones ni claves privadas.

### Paso 3: Ejecutar el Merge en GitHub
* **Recomendación:** Seleccionar **"Create a merge commit"** (NO usar *Squash and merge* si se desea conservar la trazabilidad y autoría de los commits).
* Al confirmar el merge, **DigitalOcean detectará el commit en `main` y comenzará el despliegue automático**.

---

## 🚢 G. Despliegue y Monitoreo en DigitalOcean

1. Ingresar a la consola de **DigitalOcean App Platform** $\rightarrow$ Pestaña **Activity**.
2. Observar el progreso del despliegue:
   - **Backend (`api`):** Compilará con `npm run build` y arrancará con `node dist/main`.
   - **Frontend (`frontend`):** Compilará las 44 rutas estáticas y dinámicas.
3. **Qué mirar en los Logs de la API:**
   - Buscar el mensaje: `API listening on port 3001` (o puerto configurado).
   - Verificar que TypeORM muestre `TypeOrmCoreModule dependencies initialized`.
   - Constatar que **NO aparezcan** errores de conexión a la base de datos.
4. **Tiempo estimado de espera:** Entre 4 y 7 minutos.

---

## 🧪 H. Verificación Inmediata en Producción (Smoke Test)

Una vez que el despliegue marque **Healthy / Live**:

1. **Login de Roles Clave:**
   - Iniciar sesión como `USER` (jugador habitual) $\rightarrow$ Verificar que el dashboard cargue fluido.
   - Iniciar sesión como `CLUB` (administrador) $\rightarrow$ Comprobar acceso al menú.
2. **Navegación y Páginas Nuevas:**
   - Como `CLUB`: ingresar a `/club/users` $\rightarrow$ Crear un recepcionista de prueba con contraseña temporal.
   - Probar login con el nuevo recepcionista $\rightarrow$ Validar que solo vea las opciones para las que tiene permisos.
3. **Flujo de Reservas Tradicionales:**
   - Buscar canchas como jugador en `/search`.
   - Completar una reserva manual en el club o virtual de prueba.
   - Confirmar que el flujo de cobros habitual funcione al 100%.
4. **Confirmar Fidelidad Inerte:**
   - Ingresar como club no piloto $\rightarrow$ Confirmar que fidelidad aparece inactiva sin afectar reservas.

---

## 🎯 I. Activación Gradual del Piloto de Fidelidad

Una vez validado que la plataforma opera con normalidad:

1. **Habilitar Programa para el Club Piloto:**
   - En DigitalOcean $\rightarrow$ Variables de Entorno del Backend:
     ```env
     LOYALTY_ENABLED=true
     LOYALTY_ALLOWED_CLUB_IDS=<UUID_DEL_CLUB_PILOTO>
     ```
   - Guardar cambios (la API se reinicia en caliente en segundos).
2. **Prueba Operativa en el Club Piloto:**
   - El dueño del club ingresa a `/club/loyalty`.
   - Activa el programa (Modo A o B) y registra un premio de prueba (ej. *"Bebida Energética - 50 pts"*).
   - Realizar una reserva de prueba pagada y constatar que se sumen los puntos.
   - Solicitar un canje desde la app de usuario y validarlo en la mesa de entrega del club con el código `TC-XXXXXX`.
3. **Lanzamiento Global:**
   - Tras 48 a 72 horas de operación estable, retirar `LOYALTY_ALLOWED_CLUB_IDS` (dejar vacío). A partir de ese momento, todos los clubes de TuCancha podrán activar sus programas autónomamente.

---

## 🛡️ J. Plan de Reversa por Niveles (Rollback Contingente)

Si surgiera algún imprevisto grave durante o después del lanzamiento, aplicar la reversa según el nivel de urgencia:

### Nivel 1: Apagado Instantáneo sin Redespliegue (Tiempo: 30 segundos)
Si el problema es específico de fidelidad o puntos:
1. En DigitalOcean $\rightarrow$ Cambiar:
   ```env
   LOYALTY_ENABLED=false
   ```
2. Guardar. El módulo queda completamente inerte; ningún punto se procesa ni se descuenta.

### Nivel 2: Rollback desde DigitalOcean Console (Tiempo: 2 minutos)
Si la nueva versión de la API o Frontend presenta fallas de arranque:
1. En DigitalOcean $\rightarrow$ Tu App $\rightarrow$ Pestaña **Activity**.
2. Buscar el despliegue anterior exitoso.
3. Clic en los tres puntos (`...`) $\rightarrow$ **Rollback to this deployment**.
4. DigitalOcean reactivará de inmediato los contenedores de la versión anterior.

### Nivel 3: Reversión en Git mediante Pull Request Limpio (Tiempo: 5 minutos)
*(NUNCA usar `git reset --hard` ni `git push --force` sobre `main`)*
```powershell
# En PowerShell:
git checkout main
git pull origin main
git revert -m 1 <HASH_DEL_COMMIT_DE_MERGE> -m "revert: rollback de lanzamiento de fidelidad y usuarios"
git push origin main
```
Esto creará un commit aditivo inverso y disparará el despliegue de la versión previa automáticamente.

### Nivel 4: Base de Datos de Producción (Inofensiva por Naturaleza)
* **Importante:** Las tablas y columnas agregadas son **100% aditivas** (`NULL` o con valores por defecto). No interfieren con el código antiguo si el software se revierte.
* **NO es necesario restaurar la base de datos completa**, ya que restaurar un snapshot borraría las reservas y pagos legítimos creados por los usuarios durante el día. Las tablas `loyalty_*` simplemente quedan inactivas.

---

## 🚨 K. Señales de Alerta y Monitoreo Post-Lanzamiento

Monitorear activamente durante las primeras 3 horas posteriores al lanzamiento:
1. **Logs en Tiempo Real:** En DigitalOcean $\rightarrow$ **Runtime Logs** de `api`.
2. **Sentry (Monitor de Excepciones):** Verificar que la tasa de errores se mantenga en cero o dentro de los márgenes habituales.
3. **Webhooks de Mercado Pago:** Comprobar en `/admin/mercadopago` o en el panel de pagos que las aprobaciones de cobros sigan liquidándose exitosamente.
4. **Métricas de Caja:** Verificar en `/club/payments` y `/club/transactions` que los cobros en efectivo y transferencias cuadren al centavo.
