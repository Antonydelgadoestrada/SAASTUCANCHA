# AUDITORÍA TÉCNICA Y DE NEGOCIO: DESCUENTOS Y "HORA GRATIS" POR PUNTOS DE FIDELIDAD (TUCANCHA)

**Fecha de Auditoría:** Octubre 2026  
**Entorno:** Producción / Staging (`feature/loyalty-points` $\rightarrow$ Target `MAIN-2.0`)  
**Tipo de Análisis:** Solo lectura, verificación de código fuente y base de datos relacional  
**Sistema:** Backend NestJS + TypeORM + PostgreSQL | Frontend Next.js (App Router) + Tailwind  

---

## 1. RESUMEN EJECUTIVO

La propuesta de transformar los premios de fidelidad por puntos en **CUPONES DE DESCUENTO** (porcentaje o monto fijo) o de **"HORA GRATIS"** aplicados directamente sobre el precio de la reserva es **TÉCNICAMENTE VIABLE**, pero **NO es viable de forma directa en el estado actual del código sin corregir primero 4 fallbacks críticos de precio cero y el cálculo de reservas manuales**.

En el sistema actual, múltiples servicios asumen que cualquier reserva con precio `0` es inválida o producto de un error de carga, forzando un recálculo que sobreescribe el total con el precio de lista de la cancha (`courtPrice * dur * 2`), lo que genera deudas ficticias y descuadra los reportes de caja.

**Recomendación de Implementación:**  
Se recomienda ejecutar la estrategia en 2 etapas:
1. **Fase 1 (Inmediata y Segura - Alternativa 1 / Nivel 2):** Implementar la validación y canje de cupones desde el **Panel del Club (Recepción / Reserva Manual)**. Esto corrige los cuellos de botella de reservas con costo S/ 0 en un entorno supervisado por el staff del club, sin alterar las pasarelas de pago.
2. **Fase 2 (Ampliación - Alternativa 2 / Nivel 3):** Habilitar el canje autónomo en el **Checkout Web del Usuario**, incorporando un bypass completo de la pasarela Mercado Pago para carritos con saldo final neto de S/ 0.00.

---

## 2. CÁLCULO DE PRECIO DE PUNTA A PUNTA

### 2.1. Flujo de Reserva Online vs. Reserva Manual
* **Reserva Online (`createOnlineBooking`):**
  * **[HECHO CONFIRMADO]** El cálculo de precios ocurre íntegramente en el cliente en [`nextjs-cancha-main/components/search-results-advanced.tsx:L156-L166`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/search-results-advanced.tsx#L156-L166). El cliente computa:
    $$\text{effectiveSlotPrice} = \text{hasPromo} \ ?\ \text{promoSlotPrice} : \text{regularSlotPrice}$$
    $$\text{totalPrice} = \text{effectiveSlotPrice} \times \text{slotCount}$$
  * **[HECHO CONFIRMADO]** El cliente envía al servidor el objeto `pricing: { basePrice, discounts, taxes, totalPrice }`.
  * **[HECHO CONFIRMADO]** En [`backend-tucancha-main/src/booking/booking.service.ts:L607-L634`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L607-L634), el backend **confía ciegamente en el valor enviado por el cliente**: almacena `dto.pricing` sin validar ni recalcular contra la base de datos de canchas y pasa `dto.pricing.totalPrice` directo a Mercado Pago.
* **Reserva Manual del Club (`createManualBooking`):**
  * **[HECHO CONFIRMADO]** En [`nextjs-cancha-main/components/club/manual-booking-modal.tsx:L203-L219`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/club/manual-booking-modal.tsx#L203-L219), el frontend sugiere un precio base, pero permite al staff editar manualmente los campos `totalPrice` y `amountPaid`.
  * **[HECHO CONFIRMADO]** En [`backend-tucancha-main/src/booking/booking.service.ts:L385`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L385), `createManualBooking` asigna:  
    `singleTotalPrice = Number(finalPricing?.totalPrice ?? dto.price ?? 0)`.  
    No existe ninguna validación en el servidor contra la tarifa oficial de la cancha; el servidor acepta y persiste el precio que el club ingrese.

### 2.2. Estructura del campo `booking.pricing`
* **[HECHO CONFIRMADO]** Definido en [`backend-tucancha-main/src/booking/create-booking.dto.ts:L24-L36`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/create-booking.dto.ts#L24-L36):
  ```typescript
  class PricingDto {
    basePrice: number;
    discounts: number;
    taxes: number;
    totalPrice: number;
  }
  ```
* **[HECHO CONFIRMADO - Código Muerto]** Los atributos `discounts` y `taxes` **no se leen, ni se calculan, ni se utilizan en ningún servicio del backend ni del frontend**. En toda la base de código únicamente se consulta `pricing.totalPrice` (con fallback de rescate a `pricing.basePrice` si el primero fuera nulo).

### 2.3. Precios Día/Noche y Promociones
* **[HECHO CONFIRMADO]** La entidad `Court` ([`court.entity.ts`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/court/court.entity.ts)) define: `priceDay`, `priceNight`, `promoDay`, `promoNight`, `isPromoActive`.
* **[HECHO CONFIRMADO]** El horario nocturno se fija a partir de las `18:00` ($\text{hora} \ge 18$) tanto en frontend ([`search-results-advanced.tsx:L153`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/search-results-advanced.tsx#L153)) como en backend ([`loyalty.service.ts:L124`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/loyalty/loyalty.service.ts#L124)).
* **[HECHO CONFIRMADO]** El módulo `Promotion` ([`backend-tucancha-main/src/promotion/`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/promotion/)) está **completamente desconectado**: `PromotionService` es un CRUD genérico que jamás se inyecta en `BookingService` ni en `PaymentService`. Las promociones operativas son únicamente las banderas de la cancha (`promoDay` / `promoNight`).

### 2.4. Redondeos y Tolerancias
* **[HECHO CONFIRMADO]** Se implementa una tolerancia fija de `0.05` soles para evitar problemas de precisión en números de punto flotante:
  1. [`backend-tucancha-main/src/booking/booking.service.ts:L405`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L405): `amountPaidPerBooking >= singleTotalPrice - 0.05`.
  2. [`backend-tucancha-main/src/payment/payment.service.ts:L1694`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L1694): `Number(payment.amount || 0) >= totalPrice - 0.05`.

---

## 3. DE PRECIO A PAGO Y CASO TOTAL S/ 0

### 3.1. Derivación de Adelanto y Saldo
* **[HECHO CONFIRMADO]** El club configura `porcentajeAdelantoDefault` (por defecto 50%).
* **[HECHO CONFIRMADO]** En [`nextjs-cancha-main/components/search-results-advanced.tsx:L177`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/search-results-advanced.tsx#L177):  
  `advanceAmount = Math.max(1, Number(((totalPrice * advancePercent) / 100).toFixed(2)))`.  
  *Nota Crítica:* Si `totalPrice` es `0`, la instrucción `Math.max(1, ...)` fuerza el adelanto a S/ 1.00 en vez de S/ 0.00.
* **[HECHO CONFIRMADO]** Saldo restante: `remainingAmount = Math.max(0, totalPrice - advanceAmount)`.

### 3.2. Criterio de "Pagada Completamente"
* **[HECHO CONFIRMADO]** La condición estricta en [`booking.service.ts:L405`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L405) es:
  ```typescript
  const isFullPaid = singleTotalPrice > 0 && amountPaidPerBooking >= singleTotalPrice - 0.05;
  ```
  **Consecuencia:** Si `singleTotalPrice == 0`, `isFullPaid` es **forzosamente FALSE**, debido a la cláusula `singleTotalPrice > 0`.

### 3.3. Comportamiento ante Total S/ 0 por cada vía
1. **Mercado Pago:**  
   **[HECHO CONFIRMADO]** [`mercado-pago.service.ts:L40`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/mecado-pago/mercado-pago.service.ts#L40) envía `unit_price: Number(booking.unit_price)`. La API de Mercado Pago responde con error HTTP 400 (`unit_price must be greater than 0`).
2. **Subida y Auditoría de Voucher / Presencial:**  
   **[HECHO CONFIRMADO]** En [`payment.service.ts:L1613-L1617`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L1613-L1617):
   ```typescript
   if (isNaN(totalPrice) || totalPrice <= 0) {
     const courtPrice = Number(booking.court?.priceDay || booking.court?.priceNight || 0);
     const dur = Number(booking.duration || 1);
     totalPrice = courtPrice * dur * 2;
   }
   ```
   El backend sobreescribe el total 0 con la tarifa de lista de la cancha.
3. **Liquidación de Saldo en Club (`settleSaldoAtClub`):**  
   **[HECHO CONFIRMADO]** [`payment.service.ts:L1945-L1949`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L1945-L1949) contiene idéntico bloque que infla `totalPrice <= 0` a `courtPrice * dur * 2`.
4. **Métricas de Pagos del Club (`getClubPaymentsMetrics`):**  
   **[HECHO CONFIRMADO]** [`payment.service.ts:L971-L975`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L971-L975) y [`L1018-L1022`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L1018-L1022) inflan cualquier reserva $\le 0$ y la cargan como deuda a cobrar en `saldoPendienteTotal`.

---

## 4. RESERVAS MANUALES DEL CLUB (VERIFICACIÓN DE HIPÓTESIS H1)

### 4.1. VERIFICACIÓN: **HECHO CONFIRMADO (HIPÓTESIS CIERTA)**
> **Hipótesis H1:** *"En el panel del club, al crear una reserva manual y editar precio y monto pagado a 0 y 0, la reserva queda como pendiente / 'auditar' y NO pasa a pago completo."*

**Trazabilidad exacta en el código:**
1. En [`booking.service.ts:L385`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L385): `singleTotalPrice = 0`, `amountPaidPerBooking = 0`.
2. En [`booking.service.ts:L405-L407`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L405-L407):
   * `isFullPaid = (0 > 0 && 0 >= -0.05)` $\rightarrow$ **FALSE**.
   * `isPartialPaid = (!false && 0 > 0)` $\rightarrow$ **FALSE**.
   * `isUnpaid = (!false && !false)` $\rightarrow$ **TRUE**.
3. En [`booking.service.ts:L409-L410`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L409-L410):
   * `initialBookingStatus = isUnpaid ? BookingStatus.PENDING : BookingStatus.CONFIRMED;` $\rightarrow$ **Asigna PENDING**.
   * `initialPaymentStatus = isFullPaid ? PaymentStatus.PAID : PaymentStatus.PENDING;` $\rightarrow$ **Asigna PENDING**.
4. En [`booking.service.ts:L489`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L489):  
   `slots.map((s) => ({ ...s, status: isUnpaid ? 'on-hold' : 'occupied' }))`.  
   Los horarios quedan retenidos en `'on-hold'`, no ocupados formalmente.
5. En [`booking.service.ts:L510`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L510):  
   `if (!isUnpaid)` evalúa a `false` $\rightarrow$ **NO SE CREA LA FILA PAYMENT**.
6. En [`manual-booking-modal.tsx:L488`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/club/manual-booking-modal.tsx#L488):  
   La interfaz muestra la etiqueta `"Pendiente"`. La reserva cae en la pestaña de pendientes/auditar y nunca se confirma automáticamente.

---

## 5. LIBRO DE TRANSACCIONES Y CAJA (VERIFICACIÓN DE H2 Y H3)

### 5.1. Entidad `ClubTransaction` y Fuentes de Monto
* **[HECHO CONFIRMADO]** En [`club-transaction.entity.ts`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/transactions/club-transaction.entity.ts): Campos `grossAmount`, `netAmount`, `feeAmount`, `reservationTotal`, `status`, `direction`, `category`, `origin`, `sourceType`, `sourceId`.
* **[HECHO CONFIRMADO]** En [`transactions.service.ts`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/transactions/transactions.service.ts):
  * **Mercado Pago (L98, L103):** `grossAmount = payment.amount`, `reservationTotal = booking.pricing.totalPrice`.
  * **Voucher (L135, L140):** `grossAmount = payment.amount`, `reservationTotal = booking.pricing.totalPrice`.
  * **Manual (L233, L238):** `grossAmount = payment.amount`, `reservationTotal = booking.pricing.totalPrice`.
  * **Saldo Manual (L265, L270):** `grossAmount = payment.saldoAmount`, `reservationTotal = booking.pricing.totalPrice`.

### 5.2. VERIFICACIÓN HIPÓTESIS H2: **HECHO CONFIRMADO (CON MATIZ CRÍTICO)**
> **Hipótesis H2:** *"El precio de lista de la cancha es el que termina en las Transacciones, aunque el club haya editado el precio de la reserva; por lo tanto editar precios a mano descuadra la caja."*

* **En la tabla `club_transactions`:** El registro toma `payment.amount` y `booking.pricing.totalPrice`. No toma el precio de lista.
* **En las Métricas de Caja del Club ([`payment.service.ts:L971-L975`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/payment/payment.service.ts#L971-L975)):** Si el club puso precio `0`, el cálculo de métricas descarta el 0 y le impone `courtPrice * dur * 2`, acumulándolo en `saldoPendienteTotal`.  
**Conclusión:** Editar precio a 0 sí descuadra la caja del club, pues le genera un saldo por cobrar ficticio equivalente a la tarifa completa de lista. Además, en [`transactions.service.ts:L218`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/transactions/transactions.service.ts#L218):
`if (!payment || payment.amount <= 0) return;`  
Cualquier transacción con monto 0 se descarta y no se graba en el libro.

### 5.3. VERIFICACIÓN HIPÓTESIS H3: **HECHO CONFIRMADO (HIPÓTESIS CIERTA)**
> **Hipótesis H3:** *"Una reserva con total S/0 no tiene hoy un camino válido en el sistema."*
* Queda bloqueada en reserva manual como `PENDING` sin `Payment` (H1).
* Falla en Mercado Pago con error 400.
* Se infla al precio de lista en auditorías y liquidación de saldos.
* Es descartada por el libro de transacciones.

### 5.4. Diseño Contable para Descuentos
* **Opción A (Recomendada - Flujo de Caja Puro / Neto Cobrado):**  
  Registrar en `grossAmount` y `netAmount` el dinero real recibido en caja (S/ 80.00 o S/ 0.00). El descuento se registra en `metadata: { originalPrice: 100, discount: 20, couponCode: "TC-XXXX" }`.  
  *Ventaja:* Arqueo perfecto de caja física y cuentas bancarias. No inventa ingresos artificiales.
* **Opción B (Bruto Devengado + Línea de Descuento Negativa):**  
  Registrar S/ 100 de ingreso y S/ 20 de egreso.  
  *Desventaja:* Descuadra la conciliación bancaria y de efectivo del administrador del club.

---

## 6. CANCELACIÓN, NO-SHOW Y DEVOLUCIÓN DE CUPÓN

* **[HECHO CONFIRMADO]** En [`booking.service.ts:L194-L233`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking.service.ts#L194-L233), `cancelBooking` pasa el estado a `CANCELLED` y `REJECTED`, libera los horarios y revierte los puntos otorgados al reservar vía `loyaltyService.handleBookingCancelled`.
* **[HECHO CONFIRMADO]** `cancelBooking` **no ejecuta reembolsos de dinero ni crea egresos en `club_transactions`**.
* **[HECHO CONFIRMADO]** `NO_SHOW` solo existe en el enum [`booking-status.enum.ts`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/booking/booking-status.enum.ts). No existe lógica de negocio ni pantalla que lo aplique.
* **Enganche de Devolución de Cupón:**  
  Al cancelar formalmente una reserva con cupón dentro del plazo permitido, el cupón debe desvincularse y volver a estado `PENDING` (`bookingId = null`), llamando a `loyaltyService.handleBookingCouponRollback({ bookingId })` dentro de `cancelBooking`. Si es no-show, el cupón queda consumido (`DELIVERED`).

---

## 7. ESTADO ACTUAL DEL MÓDULO DE PUNTOS Y CAMBIOS NECESARIOS

### 7.1. Falla de Seguridad Detectada en Otorgamiento de Puntos
* **[HECHO CONFIRMADO]** En [`loyalty.service.ts:L95-L134`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/loyalty/loyalty.service.ts#L95-L134), `handleBookingPaid` **no valida el monto cobrado**. Si una reserva gratis de S/ 0 se marcara como pagada, el sistema otorgaría puntos de día o noche.
* **Regla de Protección Obligatoria:**
  ```typescript
  if (Number(booking.pricing?.totalPrice ?? 0) <= 0) return; // No otorgar puntos por turnos gratis
  ```

### 7.2. Cambios Requeridos en Modelos de Fidelidad
* **`LoyaltyReward`:**
  * `rewardType`: Enum (`TEXT_ONLY`, `FIXED_DISCOUNT`, `PERCENT_DISCOUNT`, `FREE_HOUR`).
  * `discountValue`: Número (monto en soles o porcentaje).
  * `maxDiscountAmount`: Tope máximo en soles (opcional).
* **`LoyaltyRedemption`:**
  * `bookingId`: UUID nullable de la reserva vinculada.
  * `status`: Ampliar con `RESERVED` y `APPLIED`.
  * `appliedDiscountAmount`: Monto deducido efectivamente.

---

## 8. FRONTEND: DÓNDE ENCAJA CADA PIEZA

1. **Checkout Online:** [`nextjs-cancha-main/components/search-results-advanced.tsx:L1740-L1820`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/search-results-advanced.tsx#L1740-L1820). Bloque *"¿Tienes un cupón de fidelidad?"* antes del selector de método de pago.
2. **Modal Reserva Manual Club:** [`nextjs-cancha-main/components/club/manual-booking-modal.tsx:L473-L545`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/club/manual-booking-modal.tsx#L473-L545). Input *"Código de Cupón"* con botón de validación que recalcula el precio.
3. **Pantalla de Transacciones:** [`nextjs-cancha-main/components/club/transactions-content.tsx:L264-L272`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/nextjs-cancha-main/components/club/transactions-content.tsx#L264-L272). Despliega el neto cobrado real.
4. **Plantillas de Correo:** [`backend-tucancha-main/src/mailer/mailer.service.ts:L751-L785`](file:///c:/Users/anton/OneDrive/Documentos/PROYECTOS/SAASTUCANCHA/backend-tucancha-main/src/mailer/mailer.service.ts#L751-L785). Muestra el desglose del descuento y saldo S/ 0.

---

## 9. ALTERNATIVAS DE DISEÑO COMPARADAS

| Dimensión | Alternativa 1: Nivel 2 (Validado por el Club en Recepción / Manual) | Alternativa 2: Nivel 3 (Checkout Web Usuario Automático) |
| :--- | :--- | :--- |
| **Flujo** | El staff ingresa el código `TC-XXXXXX` en el modal de reserva manual; el sistema valida, descuenta el precio y consume el cupón. | El usuario aplica su cupón en la web. Si el saldo es S/ 0, se salta Mercado Pago y confirma directamente. |
| **Archivos a Modificar** | **4 existentes:** `booking.service.ts`, `loyalty.service.ts`, `transactions.service.ts`, `manual-booking-modal.tsx`. | **9 existentes:** Los 4 anteriores + `create-booking.dto.ts`, `payment.service.ts`, `search-results-advanced.tsx`, `payments.ts`, `mailer.service.ts`. |
| **Archivos Nuevos** | 1 migración DDL (`rewardType`, `discountValue`, `bookingId`). | 1 migración DDL idéntica + `PricingEngine` centralizado. |
| **Cuadre de Caja** | Neto recibido en caja (S/ 0 o saldo parcial). Caja física 100% cuadrada. | Idéntico: neto cobrado por pasarela o caja. |
| **Representación S/ 0** | Método `CUPON_PUNTOS`, `singleTotalPrice = 0`, `isFullPaid = true`, `BookingStatus.CONFIRMED`. | Idéntico. |
| **Nivel de Riesgo** | **Bajo.** Supervisado por el cajero del club. | **Medio - Alto.** Expone bypass público de pasarela si no se valida exhaustivamente en el servidor. |

---

## 10. MATRIZ DE RIESGOS

1. **Modificación de fallbacks en `payment.service.ts`:** Riesgo de romper reservas antiguas sin pricing si no se verifica explícitamente `totalPrice === 0` (bonificado) vs `pricing == null` (antigua dañada).
2. **Abuso de puntos:** Riesgo de bucle infinito (canjear hora gratis $\rightarrow$ ganar puntos por jugarla $\rightarrow$ canjear otra hora gratis) si no se bloquea en `handleBookingPaid`.
3. **Concurrencia:** Riesgo de doble uso simultáneo del mismo cupón. Debe usarse `setLock('pessimistic_write')` sobre la entidad `LoyaltyRedemption`.

---

## 11. RESOLUCIÓN DE REGLAS DE NEGOCIO (CONFIRMADAS)

1. **Asunción del Costo:** El club asume el 100% del costo del descuento u hora libre como su propia estrategia de fidelización. La plataforma Tucancha no liquida ni reembolsa dinero al club por este concepto.
2. **Vigencia del Cupón:** El cupón es válido siempre que se aplique/canjee en la reserva antes de su fecha de expiración (`expiresAt`), independientemente de si la fecha del partido reservado es posterior.
3. **Comisiones de Plataforma:** Tucancha monetiza por modelo SaaS de membresías a clubes y no cobra comisión porcentual por reserva; turnos de S/ 0 no generan conflictos de comisiones de plataforma.
4. **Cálculo de "Hora Gratis":** En cualquier caso (horario diurno, nocturno o mixto), el beneficio de "Hora Gratis" descuenta exactamente el valor de **1 hora de tarifa día** de la cancha seleccionada ($2 \text{ bloques de } 30\text{ min} \times \text{precio de día}$).
