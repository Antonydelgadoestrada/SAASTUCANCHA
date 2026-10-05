import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubTransaction, TransactionDirection, TransactionCategory, TransactionOrigin, TransactionStatus } from './club-transaction.entity';
import { Payment } from '../payment/payment.entity';
import { PaymentStatus } from '../payment/payment-status.enum';
import { PaymentMethod } from '../payment/payment-method.enum';

@Injectable()
export class TransactionsService implements OnModuleInit {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(ClubTransaction)
    private readonly transactionRepo: Repository<ClubTransaction>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async onModuleInit() {
    // Run backfill once on startup in the background
    this.backfillOldPayments().catch(e => this.logger.error('Error in automatic backfill:', e));
  }

  async backfillOldPayments() {
    const payments = await this.paymentRepo.find({
      where: { status: PaymentStatus.PAID },
      relations: ['bookings', 'bookings.club', 'bookings.user', 'bookings.court', 'bookings.court.club'],
    });

    let count = 0;
    for (const payment of payments) {
      const booking = payment.bookings?.[0];
      if (!booking) continue;
      
      try {
        if (payment.method === PaymentMethod.MERCADOPAGO) {
          await this.recordFromMercadoPago(payment, booking);
        } else {
          await this.recordFromManualReservationPayment(payment, booking, booking?.user?.id);
        }
        count++;
      } catch (e) {
        this.logger.error(`Failed to backfill payment ${payment.id}`, e);
      }
    }

    try {
      const events = await this.transactionRepo.query(`
        SELECT e.*, c."clubId"
        FROM court_schedule_event e
        JOIN court c ON c.id = e."courtId"
        WHERE e.price > 0
      `);
      for (const ev of events) {
        await this.recordEventCreation(ev, ev.clubId);
        count++;
      }
    } catch (e) {
      this.logger.error(`Failed to backfill events`, e);
    }

    return { success: true, count };
  }

  private async upsertTransaction(
    sourceType: string,
    sourceId: string,
    data: Partial<ClubTransaction>
  ) {
    try {
      let tx = await this.transactionRepo.findOne({ where: { sourceType, sourceId } });
      if (tx) {
        Object.assign(tx, data);
      } else {
        tx = this.transactionRepo.create({ sourceType, sourceId, ...data });
      }
      return await this.transactionRepo.save(tx);
    } catch (error) {
      this.logger.error(`Failed to upsert transaction for ${sourceType}:${sourceId}`, error);
    }
  }

  async recordFromMercadoPago(payment: any, booking: any) {
    try {
      const isAdvance = payment.type === 'ADELANTO';
      const category = isAdvance ? TransactionCategory.RESERVATION_ADVANCE : TransactionCategory.RESERVATION_FULL;
      
      await this.upsertTransaction('RESERVATION', `${booking.id}:MP`, {
        clubId: booking?.club?.id || booking?.court?.club?.id || booking?.club,
        reservationId: booking.id,
        occurredAt: new Date(),
        direction: TransactionDirection.IN,
        category,
        origin: TransactionOrigin.MERCADOPAGO,
        paymentMethod: payment.method || 'MERCADOPAGO',
        channel: 'MERCADOPAGO',
        grossAmount: payment.amount,
        feeAmount: payment.feeAmount || 0,
        feePercent: 0,
        netAmount: payment.netAmount || payment.amount,
        currency: payment.currency || 'PEN',
        reservationTotal: Number((booking.pricing as any)?.totalPrice || (booking.pricing as any)?.basePrice || 0),
        paidAccumulated: payment.amount,
        pendingAfter: isAdvance ? Math.max(0, Number((booking.pricing as any)?.totalPrice || 0) - payment.amount) : 0,
        status: TransactionStatus.APPROVED,
        description: `${isAdvance ? 'Adelanto' : 'Pago Total'} Reserva Online - ${booking.id.slice(-5)}`,
        externalId: payment.transactionId,
      });
    } catch (e) {
      this.logger.error(`Error recording MP transaction`, e);
    }
  }

  async recordVoucherSubmitted(payment: any, booking: any, isSaldo = false) {
    try {
      const isAdvance = payment.type === 'ADELANTO';
      const category = isSaldo 
        ? TransactionCategory.RESERVATION_BALANCE 
        : (isAdvance ? TransactionCategory.RESERVATION_ADVANCE : TransactionCategory.RESERVATION_FULL);
      
      const sourceId = isSaldo ? `${booking.id}:SALDO_VOUCHER` : `${booking.id}:VOUCHER`;

      const grossAmount = isSaldo ? (payment.saldoAmount || 0) : payment.amount;

      await this.upsertTransaction('RESERVATION', sourceId, {
        clubId: booking?.club?.id || booking?.court?.club?.id || booking?.club,
        reservationId: booking.id,
        submittedAt: new Date(),
        direction: TransactionDirection.IN,
        category,
        origin: TransactionOrigin.VOUCHER,
        paymentMethod: isSaldo ? (payment.saldoMethod || 'TRANSFERENCIA') : (payment.paymentMethod || payment.method),
        channel: 'VOUCHER',
        grossAmount: grossAmount,
        feeAmount: 0,
        feePercent: 0,
        netAmount: grossAmount,
        currency: payment.currency || 'PEN',
        reservationTotal: Number((booking.pricing as any)?.totalPrice || (booking.pricing as any)?.basePrice || 0),
        status: TransactionStatus.PENDING,
        description: `Comprobante subido - ${isSaldo ? 'Saldo' : 'Reserva'} - ${booking.id.slice(-5)}`,
        voucherRef: isSaldo ? payment.saldoComprobanteUrl : payment.comprobanteUrl,
      });
    } catch (e) {
      this.logger.error(`Error recording voucher submitted`, e);
    }
  }

  async recordVoucherReviewed(payment: any, action: 'CONFIRMAR' | 'RECHAZAR', reviewerId: string, booking: any, isSaldo = false) {
    try {
      const sourceId = isSaldo ? `${booking.id}:SALDO_VOUCHER` : `${booking.id}:VOUCHER`;
      let tx = await this.transactionRepo.findOne({ where: { sourceType: 'RESERVATION', sourceId } });
      
      if (!tx) {
        this.logger.warn(`Voucher transaction not found for ${sourceId}, creating it now...`);
        // Fallback: Si no existe, creamos la transacción en este momento (retroactividad para vouchers antiguos)
        const isAdvance = payment.type === 'ADELANTO';
        const category = isSaldo 
          ? TransactionCategory.RESERVATION_BALANCE 
          : (isAdvance ? TransactionCategory.RESERVATION_ADVANCE : TransactionCategory.RESERVATION_FULL);
        const grossAmount = isSaldo ? (payment.saldoAmount || 0) : (payment.amount || 0);

        tx = this.transactionRepo.create({
          sourceType: 'RESERVATION',
          sourceId,
          clubId: booking?.club?.id || booking?.court?.club?.id || booking?.club,
          reservationId: booking.id,
          submittedAt: payment.createdAt || new Date(),
          direction: TransactionDirection.IN,
          category,
          origin: TransactionOrigin.VOUCHER,
          paymentMethod: isSaldo ? (payment.saldoMethod || 'TRANSFERENCIA') : (payment.paymentMethod || payment.method),
          channel: 'VOUCHER',
          grossAmount,
          feeAmount: 0,
          feePercent: 0,
          netAmount: grossAmount,
          currency: payment.currency || 'PEN',
          reservationTotal: Number((booking.pricing as any)?.totalPrice || (booking.pricing as any)?.basePrice || 0),
          status: TransactionStatus.PENDING,
          description: `Comprobante auditado - ${isSaldo ? 'Saldo' : 'Reserva'} - ${booking.id.slice(-5)}`,
          voucherRef: isSaldo ? payment.saldoComprobanteUrl : payment.comprobanteUrl,
        });
      }

      if (tx.status !== TransactionStatus.PENDING) {
        return; // Already reviewed
      }

      const isApproved = action === 'CONFIRMAR';
      tx.status = isApproved ? TransactionStatus.APPROVED : TransactionStatus.REJECTED;
      tx.reviewedByUserId = reviewerId;
      
      if (isApproved) {
        tx.occurredAt = new Date(); // Dinero confirmado en este momento
        if (!isSaldo) {
          tx.paidAccumulated = tx.grossAmount;
          tx.pendingAfter = Math.max(0, (tx.reservationTotal || 0) - tx.grossAmount);
        } else {
          // Si es saldo, el total pagado hasta aquí es el adelanto + el saldo
          const previousAmount = payment.amount || 0;
          tx.paidAccumulated = previousAmount + tx.grossAmount;
          tx.pendingAfter = Math.max(0, (tx.reservationTotal || 0) - tx.paidAccumulated);
        }
      }

      tx.metadata = { ...tx.metadata, rejectedReason: !isApproved ? (isSaldo ? payment.motivoRechazo : payment.motivoRechazo) : null };
      
      await this.transactionRepo.save(tx);
    } catch (e) {
      this.logger.error(`Error recording voucher reviewed`, e);
    }
  }

  async recordFromManualReservationPayment(payment: any, booking: any, registeredByUserId: string) {
    try {
      if (!payment || payment.amount <= 0) return;
      
      const isAdvance = payment.type === 'ADELANTO';
      const category = isAdvance ? TransactionCategory.RESERVATION_ADVANCE : TransactionCategory.RESERVATION_FULL;

      await this.upsertTransaction('RESERVATION', `${booking.id}:MANUAL`, {
        clubId: booking?.club?.id || booking?.court?.club?.id || booking?.club,
        reservationId: booking.id,
        occurredAt: new Date(),
        direction: TransactionDirection.IN,
        category,
        origin: TransactionOrigin.MANUAL,
        registeredByUserId,
        paymentMethod: payment.paymentMethod || payment.method || 'CASH',
        channel: 'MANUAL',
        grossAmount: payment.amount,
        feeAmount: payment.feeAmount || 0,
        feePercent: payment.method === 'CARD' && payment.feeAmount > 0 ? Number(((payment.feeAmount / payment.amount) * 100).toFixed(2)) : 0,
        netAmount: payment.netAmount || payment.amount,
        currency: payment.currency || 'PEN',
        reservationTotal: Number((booking.pricing as any)?.totalPrice || (booking.pricing as any)?.basePrice || 0),
        paidAccumulated: payment.amount,
        pendingAfter: isAdvance ? Math.max(0, Number((booking.pricing as any)?.totalPrice || 0) - payment.amount) : 0,
        status: TransactionStatus.APPROVED,
        description: `Pago Manual ${isAdvance ? 'Adelanto' : 'Total'} - ${booking.id.slice(-5)}`,
      });
    } catch (e) {
      this.logger.error(`Error recording manual reservation payment`, e);
    }
  }

  async recordBalancePayment(payment: any, booking: any, registeredByUserId: string) {
    try {
      if (!payment || !payment.saldoAmount || payment.saldoAmount <= 0) return;

      const paidAccumulated = (payment.amount || 0) + payment.saldoAmount;

      await this.upsertTransaction('RESERVATION', `${booking.id}:SALDO_MANUAL`, {
        clubId: booking?.club?.id || booking?.court?.club?.id || booking?.club,
        reservationId: booking.id,
        occurredAt: new Date(),
        direction: TransactionDirection.IN,
        category: TransactionCategory.RESERVATION_BALANCE,
        origin: TransactionOrigin.MANUAL,
        registeredByUserId,
        paymentMethod: payment.saldoMethod || 'CASH',
        channel: 'MANUAL',
        grossAmount: payment.saldoAmount,
        feeAmount: payment.saldoFeeAmount || 0,
        feePercent: payment.saldoMethod === 'CARD' && payment.saldoFeeAmount > 0 ? Number(((payment.saldoFeeAmount / payment.saldoAmount) * 100).toFixed(2)) : 0,
        netAmount: payment.saldoNetAmount || payment.saldoAmount,
        currency: payment.currency || 'PEN',
        reservationTotal: Number((booking.pricing as any)?.totalPrice || (booking.pricing as any)?.basePrice || 0),
        paidAccumulated,
        pendingAfter: Math.max(0, Number((booking.pricing as any)?.totalPrice || 0) - paidAccumulated),
        status: TransactionStatus.APPROVED,
        description: `Cobro Saldo Restante - ${booking.id.slice(-5)}`,
        metadata: { notes: payment.saldoNotas },
      });
    } catch (e) {
      this.logger.error(`Error recording balance payment`, e);
    }
  }

  async recordFromMembershipPayment(membershipPayment: any) {
    try {
      if (membershipPayment.status !== 'APPROVED' && membershipPayment.status !== 'PAID') return;

      await this.upsertTransaction('MEMBERSHIP', `${membershipPayment.id}`, {
        clubId: membershipPayment.clubId || membershipPayment.club?.id,
        membershipPaymentId: membershipPayment.id,
        occurredAt: membershipPayment.paidAt || new Date(),
        direction: TransactionDirection.OUT,
        category: TransactionCategory.MEMBERSHIP_PAYMENT,
        origin: TransactionOrigin.MERCADOPAGO, // usually platform payment
        paymentMethod: membershipPayment.paymentMethod || 'CARD',
        channel: 'PLATFORM',
        grossAmount: membershipPayment.amount,
        feeAmount: 0,
        feePercent: 0,
        netAmount: membershipPayment.amount,
        currency: membershipPayment.currency || 'PEN',
        status: TransactionStatus.APPROVED,
        description: `Pago Plan/Membresía - ${membershipPayment.id.slice(-5)}`,
        externalId: membershipPayment.mpPaymentId,
      });
    } catch (e) {
      this.logger.error(`Error recording membership payment`, e);
    }
  }

  async recordRefund(payment: any, booking: any, amount: number) {
     // Optional refund implementation
  }

  async recordEventCreation(event: any, clubId: string) {
    try {
      if (!event.price || event.price <= 0) return;

      await this.upsertTransaction('EVENT', `${event.id}`, {
        clubId,
        occurredAt: event.createdAt || new Date(),
        direction: TransactionDirection.IN,
        category: TransactionCategory.OTHER,
        origin: TransactionOrigin.MANUAL,
        paymentMethod: 'CASH',
        channel: 'EVENT',
        grossAmount: event.price,
        feeAmount: 0,
        feePercent: 0,
        netAmount: event.price,
        currency: 'PEN',
        status: TransactionStatus.APPROVED,
        description: `Cobro de Evento - ${event.name}`,
      });
    } catch (e) {
      this.logger.error(`Error recording event creation`, e);
    }
  }

  async findAllByClub(clubId: string, page: number = 1, limit: number = 10, startDate?: string, endDate?: string, status?: string, paymentMethod?: string, category?: string) {
    const query = this.transactionRepo.createQueryBuilder('tx')
      .where('tx.clubId = :clubId', { clubId });

    if (startDate) {
      query.andWhere('(tx.occurredAt >= :startDate OR (tx.occurredAt IS NULL AND tx.submittedAt >= :startDate))', { startDate });
    }
    if (endDate) {
      query.andWhere('(tx.occurredAt <= :endDate OR (tx.occurredAt IS NULL AND tx.submittedAt <= :endDate))', { endDate });
    }
    if (status) {
      query.andWhere('tx.status = :status', { status });
    }
    if (paymentMethod) {
      query.andWhere('tx.paymentMethod = :paymentMethod', { paymentMethod });
    }
    if (category) {
      query.andWhere('tx.category = :category', { category });
    }

    query.orderBy('tx.occurredAt', 'DESC', 'NULLS LAST')
      .addOrderBy('tx.submittedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getMetrics(clubId: string, startDate?: string, endDate?: string, paymentMethod?: string, category?: string) {
    const query = this.transactionRepo.createQueryBuilder('tx')
      .select('SUM(tx.netAmount)', 'totalIngresosNetos')
      .addSelect('SUM(tx.grossAmount)', 'totalIngresosBrutos')
      .addSelect('SUM(tx.feeAmount)', 'totalComisiones')
      .addSelect(`SUM(CASE WHEN tx.origin = 'MERCADOPAGO' THEN tx.feeAmount ELSE 0 END)`, 'comisionesMP')
      .addSelect(`SUM(CASE WHEN tx.paymentMethod = 'CARD' AND tx.origin = 'MANUAL' THEN tx.feeAmount ELSE 0 END)`, 'comisionesPOS')
      .addSelect(`SUM(CASE WHEN tx.channel = 'EVENT' THEN tx.netAmount ELSE 0 END)`, 'totalIngresosEventos')
      .where('tx.clubId = :clubId', { clubId })
      .andWhere('tx.status = :status', { status: TransactionStatus.APPROVED })
      .andWhere('tx.direction = :direction', { direction: TransactionDirection.IN });
      
    if (startDate) {
      query.andWhere('tx.occurredAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('tx.occurredAt <= :endDate', { endDate });
    }
    if (paymentMethod) {
      query.andWhere('tx.paymentMethod = :paymentMethod', { paymentMethod });
    }
    if (category) {
      query.andWhere('tx.category = :category', { category });
    }

    const res = await query.getRawOne();
    
    const queryOut = this.transactionRepo.createQueryBuilder('tx')
      .select('SUM(tx.netAmount)', 'totalEgresos')
      .addSelect(`SUM(CASE WHEN tx.category = 'MEMBERSHIP_PAYMENT' THEN tx.netAmount ELSE 0 END)`, 'pagoMembresias')
      .where('tx.clubId = :clubId', { clubId })
      .andWhere('tx.status = :status', { status: TransactionStatus.APPROVED })
      .andWhere('tx.direction = :direction', { direction: TransactionDirection.OUT });
      
    if (startDate) {
      queryOut.andWhere('tx.occurredAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryOut.andWhere('tx.occurredAt <= :endDate', { endDate });
    }
    
    const resOut = await queryOut.getRawOne();
    
    return {
      totalIngresosBrutos: Number(res?.totalIngresosBrutos || 0),
      totalIngresosNetos: Number(res?.totalIngresosNetos || 0),
      totalComisiones: Number(res?.totalComisiones || 0),
      comisionesMP: Number(res?.comisionesMP || 0),
      comisionesPOS: Number(res?.comisionesPOS || 0),
      totalIngresosEventos: Number(res?.totalIngresosEventos || 0),
      totalEgresos: Number(resOut?.totalEgresos || 0),
      pagoMembresias: Number(resOut?.pagoMembresias || 0)
    };
  }
}
