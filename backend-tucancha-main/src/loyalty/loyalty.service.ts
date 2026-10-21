import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThan } from 'typeorm';
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

      // 5. Crear registro de redención con expiración a 30 días
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const redemption = manager.create(LoyaltyRedemption, {
        clubId: params.clubId,
        userId: params.userId,
        rewardId: reward.id,
        rewardNameSnapshot: reward.name,
        rewardCostSnapshot: reward.pointsCost,
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

    Object.assign(reward, dto);
    return await this.loyaltyRewardRepo.save(reward);
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
      relations: ['user', 'reward', 'resolvedByUser'],
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
