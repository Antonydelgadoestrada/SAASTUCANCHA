import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThan, EntityManager } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoyaltyConfig } from './entities/loyalty_config.entity';
import { LoyaltyReward } from './entities/loyalty_reward.entity';
import { LoyaltyBalance } from './entities/loyalty_balance.entity';
import {
  LoyaltyRedemption,
  LoyaltyRedemptionStatus,
} from './entities/loyalty_redemption.entity';
import {
  LoyaltyTransaction,
  LoyaltyTransactionType,
} from './entities/loyalty_transaction.entity';
import { UpdateLoyaltyConfigDto } from './dto/loyalty-config.dto';
import {
  CreateLoyaltyRewardDto,
  UpdateLoyaltyRewardDto,
} from './dto/loyalty-reward.dto';
import { LoyaltyRewardType } from './enums/loyalty-reward-type.enum';
import { calculateCouponDiscount } from './utils/discount-calculator';
import { PreviewCouponDto } from './dto/preview-coupon.dto';
import { User } from '../user/user.entity';
import { Court } from '../court/court.entity';
import { Booking } from '../booking/booking.entity';
import { BookingStatus } from '../booking/booking-status.enum';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectRepository(LoyaltyConfig)
    private readonly loyaltyConfigRepo: Repository<LoyaltyConfig>,
    @InjectRepository(LoyaltyReward)
    private readonly loyaltyRewardRepo: Repository<LoyaltyReward>,
    @InjectRepository(LoyaltyBalance)
    private readonly loyaltyBalanceRepo: Repository<LoyaltyBalance>,
    @InjectRepository(LoyaltyRedemption)
    private readonly loyaltyRedemptionRepo: Repository<LoyaltyRedemption>,
    @InjectRepository(LoyaltyTransaction)
    private readonly loyaltyTxRepo: Repository<LoyaltyTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // 1. FEATURE FLAG & TENANT VERIFICATION
  // =========================================================================

  async isLoyaltyActiveForClub(
    clubId: string,
  ): Promise<{ enabled: boolean; config?: LoyaltyConfig }> {
    // 1. Variable global de entorno
    if (process.env.LOYALTY_ENABLED !== 'true') {
      return { enabled: false };
    }

    // 2. Whitelist opcional de clubes
    const allowedClubs = process.env.LOYALTY_ALLOWED_CLUB_IDS;
    if (allowedClubs && allowedClubs.trim() !== '') {
      const allowedList = allowedClubs.split(',').map((id) => id.trim());
      if (!allowedList.includes(clubId)) {
        return { enabled: false };
      }
    }

    // 3. Switch por club en base de datos
    const config = await this.loyaltyConfigRepo.findOne({
      where: { clubId },
    });

    if (!config || !config.isActive) {
      return { enabled: false, config: config || undefined };
    }

    return { enabled: true, config };
  }

  // =========================================================================
  // 2. HOOK: OTORGAR PUNTOS POR RESERVA PAGADA
  // =========================================================================

  async handleBookingPaid(params: {
    clubId: string;
    userId: string;
    bookingId: string;
    bookingStartTime: string | Date;
  }): Promise<{ pointsAwarded: number; newBalance: number } | null> {
    try {
      // 1. Verificación de activación
      const { enabled, config } = await this.isLoyaltyActiveForClub(
        params.clubId,
      );
      if (!enabled || !config) {
        return null;
      }

      // RN5: Guarda anti-abuso: reservas con total <= 0 (bonificadas/gratuitas) no otorgan puntos
      if ((params as any).totalPrice !== undefined && (params as any).totalPrice <= 0) {
        this.logger.log(
          `[Loyalty] Reserva ${params.bookingId} tiene total <= 0. Omitiendo otorgamiento de puntos.`,
        );
        return null;
      }
      if ((params as any).totalPrice === undefined) {
        const bookingRepo = this.dataSource.getRepository(Booking);
        const booking = await bookingRepo.findOne({ where: { id: params.bookingId } });
        if (booking && Number((booking.pricing as any)?.totalPrice ?? 0) <= 0 && Number((booking.pricing as any)?.discounts ?? 0) > 0) {
          this.logger.log(
            `[Loyalty] Reserva ${params.bookingId} cubierta por cupón (total <= 0). Omitiendo otorgamiento de puntos.`,
          );
          return null;
        }
      }

      // 2. Idempotencia: comprobar si ya se otorgaron puntos por este bookingId
      const existingTx = await this.loyaltyTxRepo.findOne({
        where: {
          bookingId: params.bookingId,
          type: In([
            LoyaltyTransactionType.EARN_DAY,
            LoyaltyTransactionType.EARN_NIGHT,
            LoyaltyTransactionType.EARN_COUNT,
            LoyaltyTransactionType.EARN_BONUS,
          ]),
        },
      });

      if (existingTx) {
        this.logger.warn(
          `La reserva ${params.bookingId} ya tiene puntos otorgados (tx: ${existingTx.id}). Omitiendo para evitar duplicados.`,
        );
        return null;
      }

      // 3. Cálculo de puntos según modo de configuración
      let pointsToAward = 0;
      let txType: LoyaltyTransactionType;

      if (config.mode === 'A') {
        const isNight = this.isNightTime(
          params.bookingStartTime,
          config.nightStartsAt || '18:00',
        );
        pointsToAward = isNight ? config.nightPoints : config.dayPoints;
        txType = isNight
          ? LoyaltyTransactionType.EARN_NIGHT
          : LoyaltyTransactionType.EARN_DAY;
      } else {
        // En Modo B los puntos dependen del conteo acumulado (se calcula en la transacción con lock)
        txType = LoyaltyTransactionType.EARN_COUNT;
      }

      // 4. Transacción atómica
      return await this.dataSource.transaction(async (manager) => {
        // Doble verificación dentro de la transacción
        const doubleCheckTx = await manager.findOne(LoyaltyTransaction, {
          where: {
            bookingId: params.bookingId,
            type: In([
              LoyaltyTransactionType.EARN_DAY,
              LoyaltyTransactionType.EARN_NIGHT,
              LoyaltyTransactionType.EARN_COUNT,
              LoyaltyTransactionType.EARN_BONUS,
            ]),
          },
        });
        if (doubleCheckTx) {
          return null;
        }

        // Obtener o crear balance con pessimistic lock
        let balance = await manager
          .createQueryBuilder(LoyaltyBalance, 'b')
          .setLock('pessimistic_write')
          .where('b.clubId = :clubId AND b.userId = :userId', {
            clubId: params.clubId,
            userId: params.userId,
          })
          .getOne();

        if (!balance) {
          balance = manager.create(LoyaltyBalance, {
            clubId: params.clubId,
            userId: params.userId,
            balance: 0,
            paidReservationsCount: 0,
          });
        }

        // Cálculo específico para Modo B
        if (config.mode === 'B') {
          const nextCount = (balance.paidReservationsCount || 0) + 1;
          balance.paidReservationsCount = nextCount;

          const bonusEveryX = config.bonusEveryX || 1;
          if (nextCount % bonusEveryX === 0) {
            pointsToAward = config.bonusPoints || 0;
            txType = LoyaltyTransactionType.EARN_BONUS;
          } else {
            pointsToAward = 0;
            txType = LoyaltyTransactionType.EARN_COUNT;
          }
        } else {
          balance.paidReservationsCount =
            (balance.paidReservationsCount || 0) + 1;
        }

        balance.balance = (balance.balance || 0) + pointsToAward;
        await manager.save(LoyaltyBalance, balance);

        // Registrar transacción de puntos
        const tx = manager.create(LoyaltyTransaction, {
          clubId: params.clubId,
          userId: params.userId,
          type: txType,
          points: pointsToAward,
          bookingId: params.bookingId,
          note: `Puntos otorgados por reserva pagada (${txType})`,
        });
        await manager.save(LoyaltyTransaction, tx);

        this.logger.log(
          `Otorgados ${pointsToAward} pts a usuario ${params.userId} en club ${params.clubId} por reserva ${params.bookingId}. Nuevo saldo: ${balance.balance}`,
        );

        return {
          pointsAwarded: pointsToAward,
          newBalance: balance.balance,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error al otorgar puntos para booking ${params.bookingId}: ${error.message}`,
        error.stack,
      );
      // Retornar null de manera no bloqueante
      return null;
    }
  }

  // =========================================================================
  // 3. CANJE DE PREMIOS (USUARIO)
  // =========================================================================

  async redeemReward(params: {
    clubId: string;
    userId: string;
    rewardId: string;
  }): Promise<{ redemption: LoyaltyRedemption; newBalance: number }> {
    const { enabled } = await this.isLoyaltyActiveForClub(params.clubId);
    if (!enabled) {
      throw new BadRequestException(
        'El programa de fidelidad no está activo para este club',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Validar que el premio existe y está activo
      const reward = await manager.findOne(LoyaltyReward, {
        where: {
          id: params.rewardId,
          clubId: params.clubId,
          isActive: true,
        },
      });

      if (!reward) {
        throw new NotFoundException('Premio no encontrado o inactivo');
      }

      // 2. Bloqueo pesimista sobre el saldo del usuario
      const balance = await manager
        .createQueryBuilder(LoyaltyBalance, 'b')
        .setLock('pessimistic_write')
        .where('b.clubId = :clubId AND b.userId = :userId', {
          clubId: params.clubId,
          userId: params.userId,
        })
        .getOne();

      if (!balance || balance.balance < reward.pointsCost) {
        throw new BadRequestException(
          `Saldo insuficiente. Tienes ${balance ? balance.balance : 0} puntos y el premio requiere ${reward.pointsCost}.`,
        );
      }

      // 3. Generar código único de canje
      const code = await this.generateUniqueRedemptionCode(manager);

      // 4. Descontar puntos del saldo
      balance.balance -= reward.pointsCost;
      await manager.save(LoyaltyBalance, balance);

      // 5. Crear registro de redención con expiración a 15 días (RN3)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      const redemption = manager.create(LoyaltyRedemption, {
        clubId: params.clubId,
        userId: params.userId,
        rewardId: reward.id,
        rewardNameSnapshot: reward.name,
        rewardCostSnapshot: reward.pointsCost,
        rewardTypeSnapshot: reward.rewardType || LoyaltyRewardType.TEXT_ONLY,
        discountValueSnapshot: reward.discountValue || null,
        maxDiscountSnapshot: reward.maxDiscountAmount || null,
        code,
        status: LoyaltyRedemptionStatus.PENDING,
        requestedAt: new Date(),
        expiresAt,
      });
      await manager.save(LoyaltyRedemption, redemption);

      // 6. Crear transacción de débito (puntos negativos)
      const tx = manager.create(LoyaltyTransaction, {
        clubId: params.clubId,
        userId: params.userId,
        type: LoyaltyTransactionType.REDEEM,
        points: -reward.pointsCost,
        redemptionId: redemption.id,
        note: `Canje de premio: ${reward.name} (Código: ${code})`,
      });
      await manager.save(LoyaltyTransaction, tx);

      this.logger.log(
        `Canje exitoso para usuario ${params.userId}. Código: ${code}, Puntos: -${reward.pointsCost}, Saldo restante: ${balance.balance}`,
      );

      return {
        redemption,
        newBalance: balance.balance,
      };
    });
  }

  // =========================================================================
  // 4. ENTREGA DE PREMIO (STAFF / RECEPCIÓN)
  // =========================================================================

  async deliverReward(params: {
    clubId: string;
    code: string;
    staffUserId: string;
  }): Promise<LoyaltyRedemption> {
    const formattedCode = params.code.trim().toUpperCase();

    const redemption = await this.loyaltyRedemptionRepo.findOne({
      where: {
        code: formattedCode,
        clubId: params.clubId,
      },
    });

    if (!redemption) {
      throw new NotFoundException(
        `Código de canje "${formattedCode}" no encontrado para este club`,
      );
    }

    // Verificar si expiró
    if (
      redemption.status === LoyaltyRedemptionStatus.PENDING &&
      new Date() > redemption.expiresAt
    ) {
      await this.expireSingleRedemption(redemption);
      throw new BadRequestException(
        'El código de canje ha expirado y los puntos han sido reembolsados al usuario.',
      );
    }

    // RN2: Los cupones de descuento y hora gratis se aplican al reservar, no se entregan en mostrador
    if (
      redemption.rewardTypeSnapshot &&
      redemption.rewardTypeSnapshot !== LoyaltyRewardType.TEXT_ONLY
    ) {
      throw new BadRequestException(
        'Los cupones de descuento se aplican al reservar una cancha, no se entregan manualmente',
      );
    }

    if (redemption.status !== LoyaltyRedemptionStatus.PENDING) {
      throw new BadRequestException(
        `El canje ya no se encuentra pendiente. Estado actual: ${redemption.status}`,
      );
    }

    redemption.status = LoyaltyRedemptionStatus.DELIVERED;
    redemption.resolvedAt = new Date();
    redemption.resolvedByUserId = params.staffUserId;

    await this.loyaltyRedemptionRepo.save(redemption);

    this.logger.log(
      `Premio entregado exitosamente. Código: ${redemption.code}, Staff: ${params.staffUserId}`,
    );

    return redemption;
  }

  // =========================================================================
  // 5. RECHAZAR / ANULAR CANJE (STAFF) CON REEMBOLSO
  // =========================================================================

  async rejectRedemption(params: {
    clubId: string;
    redemptionId: string;
    reason: string;
    staffUserId: string;
  }): Promise<LoyaltyRedemption> {
    return await this.dataSource.transaction(async (manager) => {
      const redemption = await manager.findOne(LoyaltyRedemption, {
        where: {
          id: params.redemptionId,
          clubId: params.clubId,
        },
      });

      if (!redemption) {
        throw new NotFoundException('Canje no encontrado para este club');
      }

      if (redemption.status !== LoyaltyRedemptionStatus.PENDING) {
        throw new BadRequestException(
          `Solo se pueden rechazar canjes en estado PENDIENTE. Estado actual: ${redemption.status}`,
        );
      }

      // 1. Actualizar estado del canje
      redemption.status = LoyaltyRedemptionStatus.REJECTED;
      redemption.rejectReason = params.reason;
      redemption.resolvedAt = new Date();
      redemption.resolvedByUserId = params.staffUserId;
      await manager.save(LoyaltyRedemption, redemption);

      // 2. Reembolsar puntos al balance del usuario
      let balance = await manager
        .createQueryBuilder(LoyaltyBalance, 'b')
        .setLock('pessimistic_write')
        .where('b.clubId = :clubId AND b.userId = :userId', {
          clubId: params.clubId,
          userId: redemption.userId,
        })
        .getOne();

      if (!balance) {
        balance = manager.create(LoyaltyBalance, {
          clubId: params.clubId,
          userId: redemption.userId,
          balance: 0,
          paidReservationsCount: 0,
        });
      }

      balance.balance = (balance.balance || 0) + redemption.rewardCostSnapshot;
      await manager.save(LoyaltyBalance, balance);

      // 3. Registrar transacción de reembolso
      const refundTx = manager.create(LoyaltyTransaction, {
        clubId: params.clubId,
        userId: redemption.userId,
        type: LoyaltyTransactionType.REFUND,
        points: redemption.rewardCostSnapshot,
        redemptionId: redemption.id,
        note: `Reembolso por canje rechazado: ${params.reason}`,
      });
      await manager.save(LoyaltyTransaction, refundTx);

      this.logger.log(
        `Canje ${redemption.id} rechazado. Reembolsados ${redemption.rewardCostSnapshot} pts a usuario ${redemption.userId}`,
      );

      return redemption;
    });
  }

  // =========================================================================
  // 6. HOOK: REVERSIÓN POR CANCELACIÓN DE RESERVA
  // =========================================================================

  async handleBookingCancelled(params: {
    bookingId: string;
  }): Promise<void> {
    try {
      // RN6: Revertir cupón de fidelidad si fue aplicado a esta reserva
      await this.rollbackAppliedCoupon(params.bookingId);

      // 1. Buscar transacciones de otorgamiento para este booking
      const earnTxs = await this.loyaltyTxRepo.find({
        where: {
          bookingId: params.bookingId,
          type: In([
            LoyaltyTransactionType.EARN_DAY,
            LoyaltyTransactionType.EARN_NIGHT,
            LoyaltyTransactionType.EARN_BONUS,
            LoyaltyTransactionType.EARN_COUNT,
          ]),
        },
      });

      if (!earnTxs || earnTxs.length === 0) {
        return;
      }

      // 2. Idempotencia: evitar doble reversión
      const existingReversal = await this.loyaltyTxRepo.findOne({
        where: {
          bookingId: params.bookingId,
          type: LoyaltyTransactionType.REVERSAL,
        },
      });

      if (existingReversal) {
        this.logger.warn(
          `La reserva ${params.bookingId} ya tiene reversión de puntos registrada. Omitiendo.`,
        );
        return;
      }

      // 3. Transacción de reversión
      await this.dataSource.transaction(async (manager) => {
        const totalPointsToReverse = earnTxs.reduce(
          (sum, tx) => sum + (tx.points > 0 ? tx.points : 0),
          0,
        );
        const sampleTx = earnTxs[0];

        let balance = await manager
          .createQueryBuilder(LoyaltyBalance, 'b')
          .setLock('pessimistic_write')
          .where('b.clubId = :clubId AND b.userId = :userId', {
            clubId: sampleTx.clubId,
            userId: sampleTx.userId,
          })
          .getOne();

        if (balance) {
          const currentBalance = balance.balance || 0;
          const actualDeduction = Math.min(currentBalance, totalPointsToReverse);

          balance.balance = Math.max(0, currentBalance - totalPointsToReverse);
          balance.paidReservationsCount = Math.max(
            0,
            (balance.paidReservationsCount || 0) - 1,
          );
          await manager.save(LoyaltyBalance, balance);

          const reversalTx = manager.create(LoyaltyTransaction, {
            clubId: sampleTx.clubId,
            userId: sampleTx.userId,
            bookingId: params.bookingId,
            type: LoyaltyTransactionType.REVERSAL,
            points: -actualDeduction,
            note: `Reversión de puntos por cancelación de reserva`,
          });
          await manager.save(LoyaltyTransaction, reversalTx);

          this.logger.log(
            `Puntos revertidos para booking ${params.bookingId}: -${actualDeduction} pts. Saldo restante: ${balance.balance}`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Error al revertir puntos para booking ${params.bookingId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // =========================================================================
  // 7. CRON Y AUTO-EXPIRACIÓN DE CANJES PENDIENTES
  // =========================================================================

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredRedemptionsCron(): Promise<number> {
    try {
      const expiredList = await this.loyaltyRedemptionRepo.find({
        where: {
          status: LoyaltyRedemptionStatus.PENDING,
          expiresAt: LessThan(new Date()),
        },
      });

      if (!expiredList || expiredList.length === 0) {
        return 0;
      }

      this.logger.log(
        `Procesando expiración automática de ${expiredList.length} canje(s) pendiente(s)...`,
      );

      let processedCount = 0;
      for (const redemption of expiredList) {
        try {
          await this.expireSingleRedemption(redemption);
          processedCount++;
        } catch (itemErr) {
          this.logger.error(
            `Error al expirar redención ${redemption.id}: ${itemErr.message}`,
          );
        }
      }

      return processedCount;
    } catch (error) {
      this.logger.error(
        `Error en handleExpiredRedemptionsCron: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  private async expireSingleRedemption(
    redemption: LoyaltyRedemption,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 1. Marcar como expirado
      redemption.status = LoyaltyRedemptionStatus.EXPIRED;
      redemption.resolvedAt = new Date();
      await manager.save(LoyaltyRedemption, redemption);

      // 2. Reembolsar saldo al usuario
      let balance = await manager
        .createQueryBuilder(LoyaltyBalance, 'b')
        .setLock('pessimistic_write')
        .where('b.clubId = :clubId AND b.userId = :userId', {
          clubId: redemption.clubId,
          userId: redemption.userId,
        })
        .getOne();

      if (!balance) {
        balance = manager.create(LoyaltyBalance, {
          clubId: redemption.clubId,
          userId: redemption.userId,
          balance: 0,
          paidReservationsCount: 0,
        });
      }

      balance.balance = (balance.balance || 0) + redemption.rewardCostSnapshot;
      await manager.save(LoyaltyBalance, balance);

      // 3. Registrar transacción de reembolso por expiración
      const refundTx = manager.create(LoyaltyTransaction, {
        clubId: redemption.clubId,
        userId: redemption.userId,
        type: LoyaltyTransactionType.REFUND,
        points: redemption.rewardCostSnapshot,
        redemptionId: redemption.id,
        note: `Reembolso por expiración automática de canje (${redemption.code})`,
      });
      await manager.save(LoyaltyTransaction, refundTx);

      this.logger.log(
        `Canje ${redemption.code} expirado. ${redemption.rewardCostSnapshot} pts reembolsados a usuario ${redemption.userId}`,
      );
    });
  }

  // =========================================================================
  // 7.1. CUPONES DE DESCUENTO Y HORA GRATIS (NIVEL 2)
  // =========================================================================

  async previewCoupon(
    clubId: string,
    dto: PreviewCouponDto,
  ): Promise<{
    valid: boolean;
    redemptionId?: string;
    code?: string;
    rewardType?: LoyaltyRewardType;
    rewardName?: string;
    discountValue?: number | null;
    discountAmount?: number;
    calculatedDiscount?: number;
    netPrice?: number;
    newTotalPrice?: number;
    originalPrice?: number;
    requiresPayment?: boolean;
    courtPriceDay?: number;
    message?: string;
    reason?: string;
    user?: { id: string; email: string };
  }> {
    try {
      const { enabled } = await this.isLoyaltyActiveForClub(clubId);
      if (!enabled) {
        return {
          valid: false,
          reason: 'El programa de fidelidad no está activo para este club',
        };
      }

      const formattedCode = (dto.code || '').trim().toUpperCase();
      if (!formattedCode) {
        return { valid: false, reason: 'Código de cupón requerido' };
      }

      // Resolver usuario objetivo
      let targetUserId = dto.userId;
      if (!targetUserId && dto.userEmail) {
        const user = await this.dataSource.getRepository(User).findOne({
          where: { email: dto.userEmail.trim().toLowerCase() },
        });
        if (!user) {
          return {
            valid: false,
            reason: `No se encontró ningún usuario con el correo ${dto.userEmail}`,
          };
        }
        targetUserId = user.id;
      }

      if (!targetUserId) {
        return {
          valid: false,
          reason: 'Se requiere el correo o identificador del cliente para validar el cupón',
        };
      }

      // Buscar cupón en redenciones
      const redemption = await this.loyaltyRedemptionRepo.findOne({
        where: {
          code: formattedCode,
          clubId,
        },
      });

      if (!redemption) {
        return {
          valid: false,
          reason: `Cupón "${formattedCode}" no encontrado o no pertenece a este club`,
        };
      }

      // Validar pertenencia al usuario
      if (redemption.userId !== targetUserId) {
        return {
          valid: false,
          reason: 'El cupón no pertenece al cliente seleccionado',
        };
      }

      // Validar estado pendiente
      if (redemption.status !== LoyaltyRedemptionStatus.PENDING) {
        return {
          valid: false,
          reason: `El cupón ya no está disponible (estado actual: ${redemption.status})`,
        };
      }

      // Validar vigencia
      if (new Date() > redemption.expiresAt) {
        return {
          valid: false,
          reason: 'El cupón ha expirado y no puede ser utilizado',
        };
      }

      // Validar tipo de recompensa
      const rewardType =
        redemption.rewardTypeSnapshot || LoyaltyRewardType.TEXT_ONLY;
      if (rewardType === LoyaltyRewardType.TEXT_ONLY) {
        return {
          valid: false,
          reason: 'Este premio es informativo y no aplica descuento sobre reservas de cancha',
        };
      }

      // Cargar información de la cancha para obtener tarifa diurna
      const court = await this.dataSource.getRepository(Court).findOne({
        where: { id: dto.courtId },
      });

      if (!court) {
        return { valid: false, reason: 'Cancha no encontrada' };
      }

      const { discountAmount, netPrice } = calculateCouponDiscount({
        rewardType,
        discountValue: redemption.discountValueSnapshot,
        maxDiscountAmount: redemption.maxDiscountSnapshot,
        basePrice: dto.basePrice,
        courtPriceDay: court.priceDay,
      });

      return {
        valid: true,
        redemptionId: redemption.id,
        code: redemption.code,
        rewardType,
        rewardName: redemption.rewardNameSnapshot,
        discountValue: redemption.discountValueSnapshot,
        discountAmount,
        calculatedDiscount: discountAmount,
        netPrice,
        newTotalPrice: netPrice,
        originalPrice: dto.basePrice,
        requiresPayment: netPrice > 0,
        courtPriceDay: Number(court.priceDay) || 0,
        message: `Cupón válido: descuento de S/ ${discountAmount.toFixed(2)}`,
        user: {
          id: targetUserId,
          email: dto.userEmail,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error al previsualizar cupón ${dto?.code}: ${error.message}`,
        error.stack,
      );
      return {
        valid: false,
        reason: 'Error interno al validar el cupón',
      };
    }
  }

  async applyManualCouponInsideTransaction(
    manager: EntityManager,
    params: {
      clubId: string;
      userId: string;
      couponCode: string;
      bookingId: string;
      courtId: string;
      basePrice: number;
    },
  ): Promise<{
    discountAmount: number;
    redemptionId: string;
    rewardType: LoyaltyRewardType;
  }> {
    const { enabled } = await this.isLoyaltyActiveForClub(params.clubId);
    if (!enabled) {
      throw new BadRequestException(
        'El programa de fidelidad no está activo para este club',
      );
    }

    const formattedCode = (params.couponCode || '').trim().toUpperCase();
    if (!formattedCode) {
      throw new BadRequestException('El código del cupón es obligatorio');
    }

    // Bloqueo pesimista exclusivo para evitar concurrencia y doble uso
    const redemption = await manager
      .createQueryBuilder(LoyaltyRedemption, 'r')
      .setLock('pessimistic_write')
      .where('r.code = :code AND r.clubId = :clubId', {
        code: formattedCode,
        clubId: params.clubId,
      })
      .getOne();

    if (!redemption) {
      throw new NotFoundException(
        `El cupón "${formattedCode}" no existe o no pertenece a este club`,
      );
    }

    if (redemption.userId !== params.userId) {
      throw new BadRequestException(
        'El cupón de fidelidad no pertenece al cliente de la reserva',
      );
    }

    if (redemption.status !== LoyaltyRedemptionStatus.PENDING) {
      throw new BadRequestException(
        `El cupón ya fue utilizado o no está disponible (estado: ${redemption.status})`,
      );
    }

    if (new Date() > redemption.expiresAt) {
      throw new BadRequestException('El cupón de fidelidad ha expirado');
    }

    const rewardType =
      redemption.rewardTypeSnapshot || LoyaltyRewardType.TEXT_ONLY;
    if (rewardType === LoyaltyRewardType.TEXT_ONLY) {
      throw new BadRequestException(
        'Este premio no es un cupón de descuento aplicable a reservas',
      );
    }

    const court = await manager.findOne(Court, {
      where: { id: params.courtId },
    });
    if (!court) {
      throw new NotFoundException('Cancha no encontrada');
    }

    const { discountAmount } = calculateCouponDiscount({
      rewardType,
      discountValue: redemption.discountValueSnapshot,
      maxDiscountAmount: redemption.maxDiscountSnapshot,
      basePrice: params.basePrice,
      courtPriceDay: court.priceDay,
    });

    // Actualizar estado del cupón a APPLIED y asociar a la reserva
    redemption.status = LoyaltyRedemptionStatus.APPLIED;
    redemption.bookingId = params.bookingId;
    redemption.appliedDiscountAmount = discountAmount;
    redemption.appliedAt = new Date();
    await manager.save(LoyaltyRedemption, redemption);

    this.logger.log(
      `[Loyalty] Cupón ${redemption.code} APLICADO exitosamente a la reserva ${params.bookingId}. Descuento: S/ ${discountAmount}`,
    );

    return {
      discountAmount,
      redemptionId: redemption.id,
      rewardType,
    };
  }

  async rollbackAppliedCoupon(
    bookingId: string,
    existingManager?: EntityManager,
  ): Promise<{ rolledBack: boolean; status?: LoyaltyRedemptionStatus }> {
    const executeRollback = async (manager: EntityManager) => {
      const redemption = await manager
        .createQueryBuilder(LoyaltyRedemption, 'r')
        .setLock('pessimistic_write')
        .where('r.bookingId = :bookingId', { bookingId })
        .getOne();

      if (!redemption || redemption.status !== LoyaltyRedemptionStatus.APPLIED) {
        return { rolledBack: false };
      }

      const now = new Date();
      if (now < redemption.expiresAt) {
        // Aún vigente: restaurar a PENDING para que el usuario pueda usarlo nuevamente
        redemption.status = LoyaltyRedemptionStatus.PENDING;
        redemption.bookingId = null as any;
        redemption.appliedDiscountAmount = null as any;
        redemption.appliedAt = null as any;
        await manager.save(LoyaltyRedemption, redemption);

        this.logger.log(
          `[Loyalty] Cupón ${redemption.code} revertido a PENDING tras cancelación de reserva ${bookingId}`,
        );
        return { rolledBack: true, status: LoyaltyRedemptionStatus.PENDING };
      } else {
        // Expiró mientras la reserva estuvo activa: marcar EXPIRED y reembolsar los puntos
        redemption.status = LoyaltyRedemptionStatus.EXPIRED;
        redemption.resolvedAt = now;
        redemption.bookingId = null as any;
        await manager.save(LoyaltyRedemption, redemption);

        let balance = await manager
          .createQueryBuilder(LoyaltyBalance, 'b')
          .setLock('pessimistic_write')
          .where('b.clubId = :clubId AND b.userId = :userId', {
            clubId: redemption.clubId,
            userId: redemption.userId,
          })
          .getOne();

        if (!balance) {
          balance = manager.create(LoyaltyBalance, {
            clubId: redemption.clubId,
            userId: redemption.userId,
            balance: 0,
            paidReservationsCount: 0,
          });
        }

        balance.balance = (balance.balance || 0) + redemption.rewardCostSnapshot;
        await manager.save(LoyaltyBalance, balance);

        const refundTx = manager.create(LoyaltyTransaction, {
          clubId: redemption.clubId,
          userId: redemption.userId,
          type: LoyaltyTransactionType.REFUND,
          points: redemption.rewardCostSnapshot,
          redemptionId: redemption.id,
          note: `Reembolso por cupón expirado durante reserva cancelada (${redemption.code})`,
        });
        await manager.save(LoyaltyTransaction, refundTx);

        this.logger.log(
          `[Loyalty] Cupón ${redemption.code} expirado tras cancelación de reserva ${bookingId}. Reembolsados ${redemption.rewardCostSnapshot} pts a usuario ${redemption.userId}`,
        );
        return { rolledBack: true, status: LoyaltyRedemptionStatus.EXPIRED };
      }
    };

    if (existingManager) {
      return await executeRollback(existingManager);
    } else {
      return await this.dataSource.transaction(executeRollback);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleReconcileCancelledBookingsCouponsCron(): Promise<number> {
    try {
      const appliedRedemptions = await this.loyaltyRedemptionRepo.find({
        where: {
          status: LoyaltyRedemptionStatus.APPLIED,
        },
        relations: ['booking'],
      });

      if (!appliedRedemptions || appliedRedemptions.length === 0) {
        return 0;
      }

      let reconciledCount = 0;
      for (const redemption of appliedRedemptions) {
        const booking = redemption.booking;
        if (
          !booking ||
          booking.status === BookingStatus.CANCELLED ||
          (booking.status as any) === 'REJECTED'
        ) {
          this.logger.warn(
            `[Loyalty Cron] Conciliando cupón huérfano ${redemption.code} de reserva ${redemption.bookingId} con estado ${booking?.status || 'NOT_FOUND'}`,
          );
          await this.rollbackAppliedCoupon(redemption.bookingId);
          reconciledCount++;
        }
      }

      return reconciledCount;
    } catch (error) {
      this.logger.error(
        `Error en handleReconcileCancelledBookingsCouponsCron: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  // =========================================================================
  // 8. GESTIÓN DE CONFIGURACIÓN Y CATÁLOGO DE PREMIOS (CRUD)
  // =========================================================================

  async getConfig(clubId: string): Promise<LoyaltyConfig> {
    let config = await this.loyaltyConfigRepo.findOne({
      where: { clubId },
    });

    if (!config) {
      config = this.loyaltyConfigRepo.create({
        clubId,
        isActive: false,
        mode: 'A',
        dayPoints: 10,
        nightPoints: 15,
        nightStartsAt: '18:00',
        bonusEveryX: 5,
        bonusPoints: 50,
      });
      config = await this.loyaltyConfigRepo.save(config);
    }

    return config;
  }

  async updateConfig(
    clubId: string,
    dto: UpdateLoyaltyConfigDto,
  ): Promise<LoyaltyConfig> {
    let config = await this.loyaltyConfigRepo.findOne({
      where: { clubId },
    });

    if (!config) {
      config = this.loyaltyConfigRepo.create({
        clubId,
        isActive: false,
        mode: 'A',
        dayPoints: 10,
        nightPoints: 15,
        nightStartsAt: '18:00',
        bonusEveryX: 5,
        bonusPoints: 50,
      });
    }

    Object.assign(config, dto);
    return await this.loyaltyConfigRepo.save(config);
  }

  async getRewards(
    clubId: string,
    onlyActive: boolean = true,
  ): Promise<LoyaltyReward[]> {
    const where: any = { clubId };
    if (onlyActive) {
      where.isActive = true;
    }

    return await this.loyaltyRewardRepo.find({
      where,
      order: { pointsCost: 'ASC', createdAt: 'DESC' },
    });
  }

  async createReward(
    clubId: string,
    dto: CreateLoyaltyRewardDto,
  ): Promise<LoyaltyReward> {
    this.validateRewardTypeAndValues(dto);
    const reward = this.loyaltyRewardRepo.create({
      ...dto,
      clubId,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return await this.loyaltyRewardRepo.save(reward);
  }

  async updateReward(
    clubId: string,
    rewardId: string,
    dto: UpdateLoyaltyRewardDto,
  ): Promise<LoyaltyReward> {
    const reward = await this.loyaltyRewardRepo.findOne({
      where: { id: rewardId, clubId },
    });

    if (!reward) {
      throw new NotFoundException('Premio no encontrado para este club');
    }

    const mergedType = dto.rewardType ?? reward.rewardType;
    const mergedDiscountValue =
      dto.discountValue !== undefined ? dto.discountValue : reward.discountValue;
    const mergedMaxDiscount =
      dto.maxDiscountAmount !== undefined
        ? dto.maxDiscountAmount
        : reward.maxDiscountAmount;

    this.validateRewardTypeAndValues({
      rewardType: mergedType,
      discountValue: mergedDiscountValue,
      maxDiscountAmount: mergedMaxDiscount,
    });

    if (
      mergedType === LoyaltyRewardType.FREE_HOUR ||
      mergedType === LoyaltyRewardType.TEXT_ONLY
    ) {
      dto.discountValue = null as any;
      dto.maxDiscountAmount = null as any;
    }

    Object.assign(reward, dto);
    return await this.loyaltyRewardRepo.save(reward);
  }

  private validateRewardTypeAndValues(dto: {
    rewardType?: LoyaltyRewardType;
    discountValue?: number | null;
    maxDiscountAmount?: number | null;
  }): void {
    const type = dto.rewardType || LoyaltyRewardType.TEXT_ONLY;
    if (type === LoyaltyRewardType.FIXED_DISCOUNT) {
      if (
        dto.discountValue === undefined ||
        dto.discountValue === null ||
        Number(dto.discountValue) <= 0
      ) {
        throw new BadRequestException(
          'Para un premio de descuento fijo, discountValue debe ser mayor a 0',
        );
      }
    } else if (type === LoyaltyRewardType.PERCENT_DISCOUNT) {
      if (
        dto.discountValue === undefined ||
        dto.discountValue === null ||
        Number(dto.discountValue) <= 0 ||
        Number(dto.discountValue) > 100
      ) {
        throw new BadRequestException(
          'Para un porcentaje de descuento, discountValue debe estar entre 1 y 100',
        );
      }
      if (
        dto.maxDiscountAmount !== undefined &&
        dto.maxDiscountAmount !== null &&
        Number(dto.maxDiscountAmount) <= 0
      ) {
        throw new BadRequestException(
          'maxDiscountAmount debe ser mayor a 0 si se especifica',
        );
      }
    } else if (
      type === LoyaltyRewardType.FREE_HOUR ||
      type === LoyaltyRewardType.TEXT_ONLY
    ) {
      dto.discountValue = null as any;
      dto.maxDiscountAmount = null as any;
    }
  }

  async deleteReward(clubId: string, rewardId: string): Promise<void> {
    const reward = await this.loyaltyRewardRepo.findOne({
      where: { id: rewardId, clubId },
    });

    if (!reward) {
      throw new NotFoundException('Premio no encontrado para este club');
    }

    // Desactivar de forma lógica para no romper historial de canjes
    reward.isActive = false;
    await this.loyaltyRewardRepo.save(reward);
  }

  async getUserBalance(
    clubId: string,
    userId: string,
  ): Promise<{ balance: number; paidReservationsCount: number }> {
    const balance = await this.loyaltyBalanceRepo.findOne({
      where: { clubId, userId },
    });

    return {
      balance: balance ? balance.balance : 0,
      paidReservationsCount: balance ? balance.paidReservationsCount : 0,
    };
  }

  async getUserTransactions(
    clubId: string,
    userId: string,
    limit: number = 50,
  ): Promise<LoyaltyTransaction[]> {
    return await this.loyaltyTxRepo.find({
      where: { clubId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['booking', 'redemption'],
    });
  }

  async getUserRedemptions(
    clubId: string,
    userId: string,
  ): Promise<LoyaltyRedemption[]> {
    return await this.loyaltyRedemptionRepo.find({
      where: { clubId, userId },
      order: { requestedAt: 'DESC' },
      relations: ['reward'],
    });
  }

  async getClubRedemptions(
    clubId: string,
    status?: LoyaltyRedemptionStatus,
  ): Promise<LoyaltyRedemption[]> {
    const where: any = { clubId };
    if (status) {
      where.status = status;
    }

    return await this.loyaltyRedemptionRepo.find({
      where,
      order: { requestedAt: 'DESC' },
      relations: ['user', 'reward', 'resolvedByUser', 'booking'],
    });
  }

  // =========================================================================
  // 9. MÉTODOS AUXILIARES PRIVADOS
  // =========================================================================

  private isNightTime(
    bookingStartTime: string | Date,
    nightStartsAt: string,
  ): boolean {
    let timeStr = '00:00';

    if (bookingStartTime instanceof Date) {
      const hours = String(bookingStartTime.getHours()).padStart(2, '0');
      const minutes = String(bookingStartTime.getMinutes()).padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
    } else if (typeof bookingStartTime === 'string') {
      if (bookingStartTime.includes('T')) {
        const d = new Date(bookingStartTime);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        timeStr = `${hours}:${minutes}`;
      } else {
        timeStr = bookingStartTime.substring(0, 5);
      }
    }

    return timeStr >= nightStartsAt;
  }

  private async generateUniqueRedemptionCode(
    manager?: any,
  ): Promise<string> {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 0, 1, I, O para evitar confusión
    let attempts = 0;

    while (attempts < 10) {
      attempts++;
      let randomPart = '';
      for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const code = `TC-${randomPart}`;

      const repo = manager
        ? manager.getRepository(LoyaltyRedemption)
        : this.loyaltyRedemptionRepo;

      const existing = await repo.findOne({ where: { code } });
      if (!existing) {
        return code;
      }
    }

    // Fallback con timestamp si hubiese colisiones extremas
    return `TC-${Date.now().toString(36).toUpperCase()}`;
  }
}
