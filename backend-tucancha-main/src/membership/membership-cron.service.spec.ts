import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MembershipCronService } from './membership-cron.service';
import { ClubMembership } from './entities/club_membership.entity';
import { MembershipStatus } from './enums/membership-status.enum';
import { MailerService } from '../mailer/mailer.service';
import { addDays, subDays } from 'date-fns';

describe('MembershipCronService - Sprint C Lifecycle & Automated Crons', () => {
  let service: MembershipCronService;
  let membershipRepo: any;
  let mailerService: any;

  const mockMembershipRepo = {
    find: jest.fn(),
    save: jest.fn((m) => Promise.resolve(m)),
  };

  const mockMailerService = {
    sendMembershipExpiringSoonEmail: jest.fn().mockResolvedValue(true),
    sendMembershipEnteredGraceEmail: jest.fn().mockResolvedValue(true),
    sendMembershipExpiredEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipCronService,
        {
          provide: getRepositoryToken(ClubMembership),
          useValue: mockMembershipRepo,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<MembershipCronService>(MembershipCronService);
    membershipRepo = module.get(getRepositoryToken(ClubMembership));
    mailerService = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMembershipStatusTransitions', () => {
    it('should transition ACTIVE memberships past endDate to GRACE if graceEndDate is in the future', async () => {
      const now = new Date();
      const activePastEnd: ClubMembership = {
        id: 'mem-1',
        clubId: 'club-1',
        club: { name: 'Club Central', email: 'club@test.com' } as any,
        plan: { name: 'Plan Pro' } as any,
        status: MembershipStatus.ACTIVE,
        startDate: subDays(now, 31),
        endDate: subDays(now, 1), // Ended yesterday
        graceEndDate: addDays(now, 2), // Grace valid for 2 more days
        autoRenew: true,
        cancelAtPeriodEnd: false,
        payments: [],
        createdAt: subDays(now, 31),
        updatedAt: now,
      };

      // 1st find: expired active memberships
      // 2nd find: expired grace memberships
      // 3rd find: 3-day warning memberships
      mockMembershipRepo.find
        .mockResolvedValueOnce([activePastEnd]) // step 1
        .mockResolvedValueOnce([]) // step 2
        .mockResolvedValueOnce([]); // step 3

      await service.handleMembershipStatusTransitions();

      expect(activePastEnd.status).toBe(MembershipStatus.GRACE);
      expect(mockMembershipRepo.save).toHaveBeenCalledWith(activePastEnd);
      expect(mockMailerService.sendMembershipEnteredGraceEmail).toHaveBeenCalledWith(
        'club@test.com',
        'Club Central',
        expect.any(Date),
      );
    });

    it('should transition GRACE memberships past graceEndDate to EXPIRED', async () => {
      const now = new Date();
      const graceExpired: ClubMembership = {
        id: 'mem-2',
        clubId: 'club-2',
        club: { name: 'Club Norte', email: 'norte@test.com' } as any,
        plan: { name: 'Plan Básico' } as any,
        status: MembershipStatus.GRACE,
        startDate: subDays(now, 35),
        endDate: subDays(now, 5),
        graceEndDate: subDays(now, 1), // Grace ended yesterday
        autoRenew: true,
        cancelAtPeriodEnd: false,
        payments: [],
        createdAt: subDays(now, 35),
        updatedAt: now,
      };

      mockMembershipRepo.find
        .mockResolvedValueOnce([]) // step 1
        .mockResolvedValueOnce([graceExpired]) // step 2
        .mockResolvedValueOnce([]); // step 3

      await service.handleMembershipStatusTransitions();

      expect(graceExpired.status).toBe(MembershipStatus.EXPIRED);
      expect(mockMembershipRepo.save).toHaveBeenCalledWith(graceExpired);
      expect(mockMailerService.sendMembershipExpiredEmail).toHaveBeenCalledWith(
        'norte@test.com',
        'Club Norte',
      );
    });

    it('should send warning email for ACTIVE memberships expiring in 3 days', async () => {
      const now = new Date();
      const expiringIn3Days: ClubMembership = {
        id: 'mem-3',
        clubId: 'club-3',
        club: { name: 'Club Sur', email: 'sur@test.com' } as any,
        plan: { name: 'Plan Anual' } as any,
        status: MembershipStatus.ACTIVE,
        startDate: subDays(now, 362),
        endDate: addDays(now, 3), // Expiring in 3 days
        graceEndDate: addDays(now, 6),
        autoRenew: false,
        cancelAtPeriodEnd: true,
        payments: [],
        createdAt: subDays(now, 362),
        updatedAt: now,
      };

      mockMembershipRepo.find
        .mockResolvedValueOnce([]) // step 1
        .mockResolvedValueOnce([]) // step 2
        .mockResolvedValueOnce([expiringIn3Days]); // step 3

      await service.handleMembershipStatusTransitions();

      expect(mockMailerService.sendMembershipExpiringSoonEmail).toHaveBeenCalledWith(
        'sur@test.com',
        'Club Sur',
        'Plan Anual',
        3,
        expect.any(Date),
      );
    });
  });
});
