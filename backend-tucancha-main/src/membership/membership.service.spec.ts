import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MembershipService } from './membership.service';
import { MembershipPlan } from './entities/membership_plan.entity';
import { ClubMembership } from './entities/club_membership.entity';
import { MembershipPayment } from './entities/membership_payment.entity';
import { Club } from '../club/club.entity';
import { MembershipStatus } from './enums/membership-status.enum';
import { BillingInterval } from './enums/billing-interval.enum';
import { MembershipPaymentStatus } from './enums/membership-payment-status.enum';
import { addDays, addMonths } from 'date-fns';

// Mock MercadoPago
jest.mock('mercadopago', () => {
  return {
    MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
    Preference: jest.fn().mockImplementation(() => ({
      create: jest.fn().mockResolvedValue({
        id: 'pref-12345',
        init_point: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref-12345',
      }),
    })),
    Payment: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue({
        id: '9988776655',
        external_reference: 'membership_payment-uuid-1',
        status: 'approved',
        transaction_amount: 150,
        currency_id: 'PEN',
        payment_type_id: 'credit_card',
        payment_method_id: 'visa',
        order: { id: 'order-123' },
      }),
    })),
  };
});

describe('MembershipService - Sprint A & B Business Rules, Checkout & Webhook', () => {
  let service: MembershipService;
  let planRepo: any;
  let membershipRepo: any;
  let paymentRepo: any;
  let clubRepo: any;

  const mockPlan: MembershipPlan = {
    id: 'plan-1',
    name: 'Plan Mensual Pro',
    price: 150,
    currency: 'PEN',
    interval: BillingInterval.MONTHLY,
    graceDays: 5,
    features: ['Canchas ilimitadas', 'Estadísticas'],
    isActive: true,
    memberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClub: Club = {
    id: 'club-123',
    name: 'Club Deportivo Central',
    email: 'club@deportivo.pe',
    status: 'APPROVED',
  } as any;

  const mockPlanRepo = {
    create: jest.fn((dto) => ({ ...dto, id: 'plan-new' })),
    save: jest.fn((p) => Promise.resolve(p)),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMembershipRepo = {
    create: jest.fn((dto) => ({ ...dto, id: 'membership-uuid' })),
    save: jest.fn((m) => Promise.resolve(m)),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPaymentRepo = {
    create: jest.fn((dto) => ({ ...dto, id: 'payment-uuid-1' })),
    save: jest.fn((p) => Promise.resolve(p)),
    find: jest.fn(),
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockClubRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        {
          provide: getRepositoryToken(MembershipPlan),
          useValue: mockPlanRepo,
        },
        {
          provide: getRepositoryToken(ClubMembership),
          useValue: mockMembershipRepo,
        },
        {
          provide: getRepositoryToken(MembershipPayment),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(Club),
          useValue: mockClubRepo,
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
    planRepo = module.get(getRepositoryToken(MembershipPlan));
    membershipRepo = module.get(getRepositoryToken(ClubMembership));
    paymentRepo = module.get(getRepositoryToken(MembershipPayment));
    clubRepo = module.get(getRepositoryToken(Club));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Sprint A Rules: activateOrRenewMembership (Early vs Expired Renewal)', () => {
    it('should start membership from NOW when club has NO active membership', async () => {
      mockClubRepo.findOne.mockResolvedValue(mockClub);
      mockPlanRepo.findOne.mockResolvedValue(mockPlan);
      mockMembershipRepo.findOne.mockResolvedValue(null); // No active membership

      const result = await service.activateOrRenewMembership('club-123', 'plan-1', true);

      expect(mockMembershipRepo.create).toHaveBeenCalled();
      expect(result.status).toBe(MembershipStatus.ACTIVE);
      expect(result.autoRenew).toBe(true);
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('should ADD time to current endDate when renewing BEFORE expiration', async () => {
      const now = new Date();
      const existingEndDate = addDays(now, 10);
      const existingStartDate = addDays(now, -20);

      const existingActiveMembership: ClubMembership = {
        id: 'membership-existing',
        clubId: 'club-123',
        club: mockClub,
        planId: 'plan-1',
        plan: mockPlan,
        status: MembershipStatus.ACTIVE,
        startDate: existingStartDate,
        endDate: existingEndDate,
        autoRenew: true,
        cancelAtPeriodEnd: false,
        payments: [],
        createdAt: existingStartDate,
        updatedAt: now,
      };

      mockClubRepo.findOne.mockResolvedValue(mockClub);
      mockPlanRepo.findOne.mockResolvedValue(mockPlan);
      mockMembershipRepo.findOne.mockResolvedValue(existingActiveMembership);

      const result = await service.activateOrRenewMembership('club-123', 'plan-1', true);

      expect(mockMembershipRepo.create).not.toHaveBeenCalled();
      expect(result.id).toBe('membership-existing');
      const expectedEndDate = addMonths(existingEndDate, 1);
      expect(new Date(result.endDate).getTime()).toBeCloseTo(expectedEndDate.getTime(), -3);
    });
  });

  describe('Sprint B Rules: createMembershipPreference (Checkout Plataforma)', () => {
    it('should create a pending payment and return checkout init_point for club', async () => {
      mockClubRepo.findOne.mockResolvedValue(mockClub);
      mockPlanRepo.findOne.mockResolvedValue(mockPlan);

      const result = await service.createMembershipPreference('club-123', 'plan-1', true);

      expect(mockPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clubId: 'club-123',
          planId: 'plan-1',
          amount: 150,
          status: MembershipPaymentStatus.PENDING,
        }),
      );
      expect(result.init_point).toContain('mercadopago.com.pe/checkout');
      expect(result.preferenceId).toBe('pref-12345');
      expect(result.paymentId).toBe('payment-uuid-1');
    });
  });

  describe('Sprint B Rules: handleMembershipWebhook (Idempotency & Activation)', () => {
    it('should ignore webhook if payment with same mpPaymentId is already PAID', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'payment-uuid-1',
        mpPaymentId: '9988776655',
        status: MembershipPaymentStatus.PAID,
      });

      await service.handleMembershipWebhook({ 'data.id': '9988776655', type: 'payment' });

      expect(mockPaymentRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('should activate membership and update payment record upon approved webhook', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null); // Not processed yet
      mockClubRepo.findOne.mockResolvedValue(mockClub);
      mockPlanRepo.findOne.mockResolvedValue(mockPlan);
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const pendingPayment = {
        id: 'payment-uuid-1',
        clubId: 'club-123',
        planId: 'plan-1',
        status: MembershipPaymentStatus.PENDING,
      };

      mockPaymentRepo.manager.transaction.mockImplementation(async (trxCb) => {
        const mockTrx = {
          findOne: jest.fn().mockResolvedValue(pendingPayment),
          save: jest.fn((_, entity) => Promise.resolve(entity)),
        };
        return trxCb(mockTrx);
      });

      await service.handleMembershipWebhook({ 'data.id': '9988776655', type: 'payment' });

      expect(mockPaymentRepo.manager.transaction).toHaveBeenCalled();
      expect(pendingPayment.status).toBe(MembershipPaymentStatus.PAID);
    });
  });
});
