import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { ClubTransaction, TransactionDirection, TransactionCategory, TransactionOrigin, TransactionStatus } from './club-transaction.entity';
import { Payment, PaymentType } from '../payment/payment.entity';
import { PaymentStatus } from '../payment/payment-status.enum';
import { MembershipPayment } from '../membership/entities/membership_payment.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  console.log('Starting Backfill of Club Transactions...');

  const transactionRepo = dataSource.getRepository(ClubTransaction);
  const paymentRepo = dataSource.getRepository(Payment);
  const membershipPaymentRepo = dataSource.getRepository(MembershipPayment);

  // 1. Backfill Payments (Reservations)
  const payments = await paymentRepo.find({ relations: ['bookings', 'bookings.club', 'user'] });
  console.log(`Found ${payments.length} reservation payments to process.`);
  
  for (const payment of payments) {
    if (!payment.bookings || payment.bookings.length === 0) continue;
    const booking = payment.bookings[0];
    const clubId = booking.club?.id;
    if (!clubId) continue;

    const isAdvance = payment.type === PaymentType.ADELANTO;
    const initialCategory = isAdvance ? TransactionCategory.RESERVATION_ADVANCE : TransactionCategory.RESERVATION_FULL;
    
    // Check if it's MP online
    if (payment.transactionId && payment.method === 'MERCADOPAGO') {
      const sourceId = `${booking.id}:MP`;
      if (payment.status === PaymentStatus.PAID) {
        await transactionRepo.upsert({
          sourceType: 'RESERVATION',
          sourceId,
          clubId,
          reservationId: booking.id,
          occurredAt: payment.fechaConfirmacion || payment.updatedAt || payment.createdAt,
          direction: TransactionDirection.IN,
          category: initialCategory,
          origin: TransactionOrigin.MERCADOPAGO,
          paymentMethod: payment.method || 'MERCADOPAGO',
          channel: 'MERCADOPAGO',
          grossAmount: payment.amount,
          feeAmount: payment.feeAmount || 0,
          feePercent: 0,
          netAmount: payment.netAmount || payment.amount,
          currency: payment.currency || 'PEN',
          reservationTotal: Number(payment.amount || 0) + Number(payment.saldoAmount || 0), // estimation
          paidAccumulated: payment.amount,
          pendingAfter: isAdvance ? Math.max(0, Number(payment.saldoAmount || 0)) : 0,
          status: TransactionStatus.APPROVED,
          description: `${isAdvance ? 'Adelanto' : 'Pago Total'} Reserva Online (Backfill)`,
          externalId: payment.transactionId,
          metadata: { backfilled: true } as any
        }, ['sourceType', 'sourceId']);
      }
    } else if (payment.comprobanteUrl || payment.pendingAudit) {
      // It's a voucher
      const sourceId = `${booking.id}:VOUCHER`;
      let txStatus = TransactionStatus.PENDING;
      if (payment.status === PaymentStatus.PAID) txStatus = TransactionStatus.APPROVED;
      if (payment.status === PaymentStatus.REJECTED) txStatus = TransactionStatus.REJECTED;

      await transactionRepo.upsert({
        sourceType: 'RESERVATION',
        sourceId,
        clubId,
        reservationId: booking.id,
        submittedAt: payment.createdAt,
        occurredAt: txStatus === TransactionStatus.APPROVED ? (payment.fechaConfirmacion || payment.updatedAt) : undefined,
        direction: TransactionDirection.IN,
        category: initialCategory,
        origin: TransactionOrigin.VOUCHER,
        paymentMethod: payment.method || 'TRANSFERENCIA',
        channel: 'VOUCHER',
        grossAmount: payment.amount,
        feeAmount: 0,
        feePercent: 0,
        netAmount: payment.amount,
        currency: payment.currency || 'PEN',
        status: txStatus,
        description: `Comprobante subido (Backfill)`,
        voucherRef: payment.comprobanteUrl,
        metadata: { backfilled: true } as any
      }, ['sourceType', 'sourceId']);
    } else {
      // Manual payment
      const sourceId = `${booking.id}:MANUAL`;
      if (payment.status === PaymentStatus.PAID) {
        await transactionRepo.upsert({
          sourceType: 'RESERVATION',
          sourceId,
          clubId,
          reservationId: booking.id,
          occurredAt: payment.fechaConfirmacion || payment.updatedAt || payment.createdAt,
          direction: TransactionDirection.IN,
          category: initialCategory,
          origin: TransactionOrigin.MANUAL,
          paymentMethod: payment.method || 'CASH',
          channel: 'MANUAL',
          grossAmount: payment.amount,
          feeAmount: payment.feeAmount || 0,
          feePercent: 0,
          netAmount: payment.netAmount || payment.amount,
          currency: payment.currency || 'PEN',
          status: TransactionStatus.APPROVED,
          description: `Pago Manual (Backfill)`,
          metadata: { backfilled: true } as any
        }, ['sourceType', 'sourceId']);
      }
    }

    // 2. Backfill Saldo if exists
    if (payment.saldoStatus === 'PAGADO' && payment.saldoAmount > 0) {
      const isSaldoVoucher = !!payment.saldoComprobanteUrl;
      const origin = isSaldoVoucher ? TransactionOrigin.VOUCHER : TransactionOrigin.MANUAL;
      const sourceId = `${booking.id}:SALDO_${origin}`;
      
      await transactionRepo.upsert({
        sourceType: 'RESERVATION',
        sourceId,
        clubId,
        reservationId: booking.id,
        occurredAt: payment.saldoFechaConfirmacion || payment.updatedAt,
        direction: TransactionDirection.IN,
        category: TransactionCategory.RESERVATION_BALANCE,
        origin,
        paymentMethod: payment.saldoMethod || 'CASH',
        channel: origin,
        grossAmount: payment.saldoAmount,
        feeAmount: payment.saldoFeeAmount || 0,
        feePercent: 0,
        netAmount: payment.saldoNetAmount || payment.saldoAmount,
        currency: payment.currency || 'PEN',
        status: TransactionStatus.APPROVED,
        description: `Cobro Saldo Restante (Backfill)`,
        voucherRef: payment.saldoComprobanteUrl,
        metadata: { backfilled: true, notes: payment.saldoNotas } as any
      }, ['sourceType', 'sourceId']);
    } else if (payment.saldoStatus === 'PENDIENTE' && payment.saldoComprobanteUrl) {
      // Pending saldo voucher
      await transactionRepo.upsert({
        sourceType: 'RESERVATION',
        sourceId: `${booking.id}:SALDO_VOUCHER`,
        clubId,
        reservationId: booking.id,
        submittedAt: payment.updatedAt,
        direction: TransactionDirection.IN,
        category: TransactionCategory.RESERVATION_BALANCE,
        origin: TransactionOrigin.VOUCHER,
        paymentMethod: payment.saldoMethod || 'TRANSFERENCIA',
        channel: 'VOUCHER',
        grossAmount: payment.saldoAmount,
        feeAmount: 0,
        feePercent: 0,
        netAmount: payment.saldoAmount,
        currency: payment.currency || 'PEN',
        status: TransactionStatus.PENDING,
        description: `Comprobante subido - Saldo (Backfill)`,
        voucherRef: payment.saldoComprobanteUrl,
        metadata: { backfilled: true } as any
      }, ['sourceType', 'sourceId']);
    }
  }

  // 3. Backfill Membership Payments
  const memberships = await membershipPaymentRepo.find({ where: { status: 'APPROVED' as any } });
  console.log(`Found ${memberships.length} approved membership payments to process.`);

  for (const mp of memberships) {
    if (!mp.clubId) continue;
    await transactionRepo.upsert({
      sourceType: 'MEMBERSHIP',
      sourceId: mp.id,
      clubId: mp.clubId,
      membershipPaymentId: mp.id,
      occurredAt: mp.paidAt || mp.updatedAt || mp.createdAt,
      direction: TransactionDirection.OUT,
      category: TransactionCategory.MEMBERSHIP_PAYMENT,
      origin: TransactionOrigin.MERCADOPAGO,
      paymentMethod: mp.paymentMethod || 'CARD',
      channel: 'PLATFORM',
      grossAmount: mp.amount,
      feeAmount: 0,
      feePercent: 0,
      netAmount: mp.amount,
      currency: mp.currency || 'PEN',
      status: TransactionStatus.APPROVED,
      description: `Pago Plan/Membresía (Backfill)`,
      externalId: mp.mpPaymentId,
      metadata: { backfilled: true } as any
    }, ['sourceType', 'sourceId']);
  }

  console.log('Backfill complete!');
  await app.close();
}

bootstrap().catch(console.error);
