import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PaymentController } from '../payment.controller';
import { PaymentService } from '../payment.service';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { Club } from '../../club/club.entity';

describe('Recepcionista Payment & Audit Access (RBAC Matrix)', () => {
  let controller: PaymentController;
  let service: jest.Mocked<PaymentService>;

  const mockClub: Club = {
    id: 'club-test-123',
    name: 'Club Test',
    status: 'APPROVED',
  } as Club;

  const mockService = {
    getClubPaymentsList: jest.fn().mockResolvedValue([]),
    getClubPaymentMetrics: jest.fn().mockResolvedValue({ totalRecaudado: 0 }),
    auditManualPayment: jest.fn().mockResolvedValue({ status: 'success' }),
    settleManualSaldo: jest.fn().mockResolvedValue({ status: 'success' }),
    auditSaldoComprobante: jest.fn().mockResolvedValue({ status: 'success' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get(PaymentService);
  });

  describe('Recepcionista con permiso "bookings" (Gestión de Reservas y Auditoría)', () => {
    const receptionistBookingsOnly: User = {
      id: 'rec-1',
      role: UserRole.RECEPCIONISTA,
      permissions: ['bookings', 'dashboard'],
      club: mockClub,
      isActive: true,
    } as User;

    it('debe permitir consultar la lista de pagos/reservas del club (/payments/club/list)', async () => {
      await expect(
        controller.getList(receptionistBookingsOnly, 'all', 'all', 'all', ''),
      ).resolves.toEqual([]);
      expect(mockService.getClubPaymentsList).toHaveBeenCalledWith(
        receptionistBookingsOnly,
        { status: 'all', method: 'all', type: 'all', search: '' },
      );
    });

    it('debe permitir consultar métricas de recaudación del club (/payments/club/metrics)', async () => {
      await expect(
        controller.getMetrics(receptionistBookingsOnly),
      ).resolves.toEqual({ totalRecaudado: 0 });
      expect(mockService.getClubPaymentMetrics).toHaveBeenCalledWith(
        receptionistBookingsOnly,
        'club-test-123',
      );
    });

    it('debe permitir auditar comprobante inicial (PUT /payments/:id/confirm)', async () => {
      await expect(
        controller.auditPayment('payment-1', { action: 'CONFIRMAR' }, receptionistBookingsOnly),
      ).resolves.toEqual({ status: 'success' });
      expect(mockService.auditManualPayment).toHaveBeenCalledWith(
        'payment-1',
        'CONFIRMAR',
        receptionistBookingsOnly,
        undefined,
      );
    });

    it('debe permitir auditar comprobante inicial (PATCH /payments/:id/confirm)', async () => {
      await expect(
        controller.auditPaymentPatch('payment-1', { action: 'RECHAZAR', motivoRechazo: 'Ilegible' }, receptionistBookingsOnly),
      ).resolves.toEqual({ status: 'success' });
      expect(mockService.auditManualPayment).toHaveBeenCalledWith(
        'payment-1',
        'RECHAZAR',
        receptionistBookingsOnly,
        'Ilegible',
      );
    });

    it('debe permitir liquidar saldo restante (PATCH /payments/:id/settle-saldo)', async () => {
      await expect(
        controller.settleSaldoPatch('payment-1', { monto: 25, metodo: 'EFECTIVO' }, receptionistBookingsOnly),
      ).resolves.toEqual({ status: 'success' });
      expect(mockService.settleManualSaldo).toHaveBeenCalled();
    });

    it('debe permitir auditar comprobante de saldo restante (PATCH /payments/:id/confirm-saldo)', async () => {
      await expect(
        controller.auditSaldoPatch('payment-1', { action: 'CONFIRMAR' }, receptionistBookingsOnly),
      ).resolves.toEqual({ status: 'success' });
      expect(mockService.auditSaldoComprobante).toHaveBeenCalled();
    });
  });

  describe('Recepcionista con permiso "payments"', () => {
    const receptionistPaymentsOnly: User = {
      id: 'rec-2',
      role: UserRole.RECEPCIONISTA,
      permissions: ['payments'],
      club: mockClub,
      isActive: true,
    } as User;

    it('debe permitir listar pagos y auditar comprobantes', async () => {
      await expect(
        controller.getList(receptionistPaymentsOnly, 'all', 'all', 'all', ''),
      ).resolves.toEqual([]);
      await expect(
        controller.auditPayment('payment-1', { action: 'CONFIRMAR' }, receptionistPaymentsOnly),
      ).resolves.toEqual({ status: 'success' });
    });
  });

  describe('Recepcionista SIN permiso "bookings" NI "payments" (p.ej. solo "loyalty")', () => {
    const receptionistNoAccess: User = {
      id: 'rec-3',
      role: UserRole.RECEPCIONISTA,
      permissions: ['loyalty'],
      club: mockClub,
      isActive: true,
    } as User;

    it('debe bloquear con 403 Forbidden al consultar /payments/club/list', async () => {
      await expect(
        controller.getList(receptionistNoAccess, 'all', 'all', 'all', ''),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con 403 Forbidden al consultar /payments/club/metrics', async () => {
      await expect(
        controller.getMetrics(receptionistNoAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con 403 Forbidden al auditar comprobante', async () => {
      await expect(
        controller.auditPayment('payment-1', { action: 'CONFIRMAR' }, receptionistNoAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con 403 Forbidden al liquidar saldo', async () => {
      await expect(
        controller.settleSaldoPatch('payment-1', { monto: 10 }, receptionistNoAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con 403 Forbidden al auditar saldo', async () => {
      await expect(
        controller.auditSaldoPatch('payment-1', { action: 'CONFIRMAR' }, receptionistNoAccess),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Dueño del Club (rol CLUB)', () => {
    const clubOwner: User = {
      id: 'owner-1',
      role: UserRole.CLUB,
      club: mockClub,
      isActive: true,
    } as User;

    it('debe tener acceso total a la lista y a la auditoría sin requerir campo permissions', async () => {
      await expect(
        controller.getList(clubOwner, 'all', 'all', 'all', ''),
      ).resolves.toEqual([]);
      await expect(
        controller.auditPayment('payment-1', { action: 'CONFIRMAR' }, clubOwner),
      ).resolves.toEqual({ status: 'success' });
    });
  });
});
