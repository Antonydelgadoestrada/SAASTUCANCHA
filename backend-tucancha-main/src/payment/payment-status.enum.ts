export enum PaymentStatus {
    PENDING = 'pending',         // Pago pendiente
    PAID = 'paid',              // Pagado
    FAILED = 'failed',          // Falló el pago
    REFUNDED = 'refunded',
    REJECTED = 'rejected'       // Reembolsado
  }